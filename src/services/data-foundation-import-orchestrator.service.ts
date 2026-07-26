import 'server-only'

import { planHistoricalImport, runHistoricalImportEngineV2Validation } from '@/services/historical-import-engine.service'

export type HistoricalImportOrchestratorModeV2 =
  | 'PLAN_ONLY'
  | 'DRY_RUN'
  | 'LOCAL_EXECUTION'
  | 'MANUAL_PRODUCTION_READY'

type OrchestratorRequest = {
  mode?: HistoricalImportOrchestratorModeV2 | string | null
  sportKey?: string | null
  leagueKey?: string | null
  providerId?: string | null
  season?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  dataTypes?: string[] | null
  batchSizeDays?: number | null
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeMode(value: unknown): HistoricalImportOrchestratorModeV2 {
  if (value === 'DRY_RUN' || value === 'LOCAL_EXECUTION' || value === 'MANUAL_PRODUCTION_READY') return value
  return 'PLAN_ONLY'
}

function blockedForMode(mode: HistoricalImportOrchestratorModeV2) {
  if (mode === 'LOCAL_EXECUTION') {
    return [
      'LOCAL_EXECUTION is contract-ready only in this autonomous run; provider transport and persistence remain disabled.',
      'Use existing protected historical-import execution routes only after a separately approved bounded execution plan.',
    ]
  }
  if (mode === 'MANUAL_PRODUCTION_READY') {
    return [
      'MANUAL_PRODUCTION_READY produces a runbook-ready plan only.',
      'Production SQL, production mutations and historical odds execution are forbidden in this autonomous run.',
    ]
  }
  return []
}

export function planHistoricalImportOrchestratorV2(request: OrchestratorRequest = {}) {
  const mode = normalizeMode(request.mode)
  const plan = planHistoricalImport({
    sportKey: request.sportKey ?? 'baseball_mlb',
    leagueKey: request.leagueKey ?? 'mlb',
    providerId: request.providerId ?? 'sportsdataio',
    season: request.season ?? '2026',
    dateFrom: request.dateFrom ?? null,
    dateTo: request.dateTo ?? null,
    dataTypes: request.dataTypes ?? ['schedules', 'scores', 'players', 'team_stats', 'player_stats', 'odds'],
    dryRun: true,
    batchSizeDays: request.batchSizeDays ?? 3,
  })
  const modeBlockers = blockedForMode(mode)
  const executionAllowed = mode === 'PLAN_ONLY' || mode === 'DRY_RUN'
  return {
    success: plan.success && (executionAllowed || modeBlockers.length > 0),
    mode: 'historical_import_orchestrator_v2',
    requestedMode: mode,
    effectiveMode: executionAllowed ? mode : 'PLAN_ONLY',
    generatedAt: nowIso(),
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    executionAllowed,
    corePlan: plan,
    orchestration: {
      supportedModes: ['PLAN_ONLY', 'DRY_RUN', 'LOCAL_EXECUTION', 'MANUAL_PRODUCTION_READY'] as HistoricalImportOrchestratorModeV2[],
      checkpointing: 'Delegates checkpoint construction to Historical Import Engine Core and stores future durable execution evidence in sports_sync_jobs.',
      resume: 'Resume by job/checkpoint idempotency key; never restart sibling checkpoints that are already complete.',
      retry: 'Retry only failed checkpoints with the same idempotency key and bounded provider-call budget.',
      dedupe: 'Upsert normalized rows by canonical destination conflict targets and provider entity mappings.',
      quotaBudget: 'Provider calls are estimates in plan mode and actual calls must be ledgered before execution.',
      validationBeforePersistence: 'Every adapter must validate identity, required fields, timestamps and temporal safety before persistence.',
      reconciliationAfterPersistence: 'Post-write reconciliation must compare inserted/updated/skipped counts, duplicate keys and orphan records.',
    },
    blockers: [...modeBlockers, ...plan.validation.errors],
    warnings: [
      ...plan.validation.warnings,
      'No provider transport is executed by this V2 wrapper.',
      'No production mutations are permitted in this autonomous run.',
    ],
  }
}

export function validateHistoricalImportOrchestratorV2() {
  const core = runHistoricalImportEngineV2Validation()
  const planOnly = planHistoricalImportOrchestratorV2({ mode: 'PLAN_ONLY' })
  const dryRun = planHistoricalImportOrchestratorV2({ mode: 'DRY_RUN' })
  const localExecution = planHistoricalImportOrchestratorV2({ mode: 'LOCAL_EXECUTION' })
  const productionReady = planHistoricalImportOrchestratorV2({ mode: 'MANUAL_PRODUCTION_READY' })
  const checks = [
    ['core validation passes', core.success],
    ['PLAN_ONLY makes zero provider calls', planOnly.providerCallsMade === 0],
    ['DRY_RUN makes zero provider calls', dryRun.providerCallsMade === 0],
    ['DRY_RUN makes zero mutations', dryRun.remoteMutationsMade === 0],
    ['LOCAL_EXECUTION is blocked to contract-only', !localExecution.executionAllowed && localExecution.effectiveMode === 'PLAN_ONLY'],
    ['MANUAL_PRODUCTION_READY is blocked to contract-only', !productionReady.executionAllowed && productionReady.effectiveMode === 'PLAN_ONLY'],
    ['checkpoint plan exists', planOnly.corePlan.job.totalCheckpoints >= 1],
    ['idempotency keys exist', planOnly.corePlan.checkpoints.every((checkpoint) => checkpoint.idempotencyKey && checkpoint.dedupeKey)],
  ]
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => String(name))
  return {
    success: failedChecks.length === 0,
    mode: 'historical_import_orchestrator_v2_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    summary: {
      coreSuccess: core.success,
      planOnlyCheckpoints: planOnly.corePlan.job.totalCheckpoints,
      planOnlyEstimatedProviderCalls: planOnly.corePlan.quotaEstimate.estimatedProviderCalls,
      localExecutionBlocked: !localExecution.executionAllowed,
      productionReadyBlocked: !productionReady.executionAllowed,
    },
  }
}
