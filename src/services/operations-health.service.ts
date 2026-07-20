import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdaptiveRefreshStatus } from '@/services/adaptive-refresh-orchestrator.service'
import { getCurrentBoard } from '@/services/current-board.service'
import { getProviderBudgetStatus } from '@/services/provider-budget.service'
import { getUniversalProjectionEngine } from '@/services/universal-projection-engine.service'
import { ACTIVE_EVENT_TIMEZONE, puertoRicoUtcRange } from '@/services/active-event.service'
import { resolveMlbGameLifecycle } from '@/services/mlb-game-lifecycle.service'
import { localDateInTimeZone } from '@/services/provider-time-normalization.service'

type MigrationCheck = {
  table: string
  status: 'APPLIED' | 'MISSING' | 'UNKNOWN'
  error: string | null
}

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const TIMEZONE = ACTIVE_EVENT_TIMEZONE
const EXTERNAL_SCHEDULER_EXPECTED_CADENCE_MINUTES = 15

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function ageMinutes(value: string | null | undefined, now = new Date()) {
  if (!value) return null
  const ms = now.getTime() - new Date(value).getTime()
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 60000)) : null
}

async function tableExists(table: string): Promise<MigrationCheck> {
  try {
    const { error } = await supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).limit(1)
    if (error) {
      const code = String((error as { code?: string }).code ?? '')
      const message = error.message ?? ''
      const details = String((error as { details?: string }).details ?? '')
      const evidence = [code, message, details].filter(Boolean).join(': ')
      const explicitlyMissing =
        code === '42P01' ||
        code === 'PGRST205' ||
        /does not exist|could not find|relation .* not found|relation .* does not exist/i.test(evidence)
      return { table, status: explicitlyMissing ? 'MISSING' : 'UNKNOWN', error: evidence || 'ambiguous table check failure' }
    }
    return { table, status: 'APPLIED', error: null }
  } catch (error) {
    return { table, status: 'UNKNOWN', error: error instanceof Error ? error.message : 'unknown migration check error' }
  }
}

async function latestLifecycleEvents() {
  const { data, error } = await supabaseAdmin
    .from('operating_day_lifecycle_events')
    .select('action,status,started_at,completed_at,provider_calls_made,blocking_reason,metadata,created_at')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) return { rows: [], error: error.message }
  return { rows: data ?? [], error: null }
}

async function settlementBacklog() {
  const { count, error } = await supabaseAdmin
    .from('prediction_history')
    .select('*', { count: 'exact', head: true })
    .eq('sport_key', SPORT_KEY)
    .in('status', ['PENDING', 'pending', 'ACTIVE', 'active'])
  return {
    pendingPredictions: error ? null : count ?? 0,
    error: error?.message ?? null,
  }
}

async function statusRefreshEvidence(lifecycleRows: Array<Record<string, unknown>>, now = new Date()) {
  const latestLedger = lifecycleRows.find((row) => String(row.action) === 'status_refresh')
  const latestMetadata = asRecord(latestLedger?.metadata)
  const ledgerCheckCompleted =
    latestMetadata.providerCheckCompleted === true ||
    ['SUCCESS_CHANGED', 'SUCCESS_NO_CHANGE'].includes(String(latestLedger?.status ?? ''))
  if (latestLedger && ledgerCheckCompleted) {
    const checkedAt = String(latestMetadata.lastProviderCheckAt ?? latestLedger.completed_at ?? latestLedger.created_at ?? '') || null
    return {
      status: String(latestLedger.status ?? 'SUCCESS_NO_CHANGE'),
      provider: String(latestMetadata.provider ?? 'mlb_stats_api'),
      endpoint: latestMetadata.endpoint ?? null,
      providerCheckRequired: true,
      providerCheckAttempted: latestMetadata.providerCheckAttempted === true || Number(latestLedger.provider_calls_made ?? 0) > 0,
      providerCheckCompleted: true,
      providerCallsMade: Number(latestLedger.provider_calls_made ?? latestMetadata.providerCallsMade ?? 0),
      rowsReceived: Number(latestMetadata.rowsReceived ?? 0),
      statusesChanged: Number(latestMetadata.statusesChanged ?? 0),
      rowsUpdated: Number(latestMetadata.rowsUpdated ?? 0),
      lastProviderCheckAt: checkedAt,
      lastStatusChangeAt: latestMetadata.lastStatusChangeAt ?? null,
      latestSourceTimestamp: latestMetadata.latestSourceTimestamp ?? null,
      failureReason: null,
      evidenceSource: 'operating_day_lifecycle_events',
    }
  }
  const operatingDate = localDateInTimeZone(now.toISOString(), TIMEZONE) ?? now.toISOString().slice(0, 10)
  const range = puertoRicoUtcRange(operatingDate)
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, start_time, status, updated_at, metadata, sport_key, league_key')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .order('start_time', { ascending: true })
  if (error) {
    return {
      status: 'QUERY_FAILED',
      provider: 'mlb_stats_api',
      providerCheckRequired: false,
      providerCheckAttempted: false,
      providerCheckCompleted: false,
      providerCallsMade: 0,
      rowsReceived: 0,
      statusesChanged: 0,
      lastProviderCheckAt: null,
      lastStatusChangeAt: null,
      failureReason: error.message,
      evidenceSource: 'sport_events_read_fallback',
    }
  }
  const rows = (data ?? []) as Array<{ id: string; start_time: string | null; status: string | null; updated_at: string | null; metadata: Record<string, unknown> | null; sport_key: string; league_key: string | null }>
  const lifecycles = rows.map((event) => resolveMlbGameLifecycle(event, now))
  const staleStatusCount = lifecycles.filter((lifecycle) => lifecycle.lifecycle === 'STATUS_UNCONFIRMED' || (!lifecycle.statusFresh && lifecycle.lifecycle === 'PREGAME')).length
  const lastStatusChangeAt = rows
    .map((row) => row.updated_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null
  return {
    status: staleStatusCount > 0 ? 'MISSED_REFRESH' : 'NOT_DUE',
    provider: 'mlb_stats_api',
    providerCheckRequired: staleStatusCount > 0,
    providerCheckAttempted: false,
    providerCheckCompleted: false,
    providerCallsMade: 0,
    rowsReceived: rows.length,
    statusesChanged: 0,
    lastProviderCheckAt: null,
    lastStatusChangeAt,
    failureReason: staleStatusCount > 0 ? 'MLB Stats API status refresh is due but was not executed by this read-only health request.' : null,
    evidenceSource: 'sport_events_read_fallback',
  }
}

function statusRank(status: string) {
  if (['FAILED', 'BLOCKED'].includes(status)) return 5
  if (['PARTIAL', 'DEGRADED'].includes(status)) return 4
  if (status === 'UNKNOWN') return 3
  if (status === 'HEALTHY') return 1
  return 2
}

function overallStatus(input: {
  pendingMigration: boolean
  adaptiveBlocked: boolean
  staleCritical: boolean
  failedSteps: number
}) {
  const candidates = [
    input.pendingMigration ? 'BLOCKED' : 'HEALTHY',
    input.adaptiveBlocked ? 'DEGRADED' : 'HEALTHY',
    input.staleCritical ? 'PARTIAL' : 'HEALTHY',
    input.failedSteps > 0 ? 'DEGRADED' : 'HEALTHY',
  ]
  return candidates.sort((a, b) => statusRank(b) - statusRank(a))[0]
}

export async function getOperationsHealth() {
  const generatedAt = new Date().toISOString()
  const [adaptive, budget, lifecycle, backlog, migrations, projections, board] = await Promise.all([
    getAdaptiveRefreshStatus(),
    getProviderBudgetStatus({ provider: 'sportsdataio', sportKey: SPORT_KEY }),
    latestLifecycleEvents(),
    settlementBacklog(),
    Promise.all([
      tableExists('universal_projection_history'),
      tableExists('ai_performance_snapshots'),
      tableExists('operating_days'),
      tableExists('operating_day_lifecycle_events'),
      tableExists('sports_sync_jobs'),
      tableExists('provider_entity_mappings'),
    ]),
    getUniversalProjectionEngine({ sportKey: SPORT_KEY, date: undefined, dryRun: true }),
    getCurrentBoard({ sportKey: SPORT_KEY, mode: 'CURRENT', limit: 100 }),
  ])
  const statusRefresh = await statusRefreshEvidence(lifecycle.rows as Array<Record<string, unknown>>)
  const latestSuccessfulProtected = (lifecycle.rows as Array<Record<string, unknown>>).find((row) => {
    const status = String(row.status ?? '')
    return ['SUCCESS_CHANGED', 'SUCCESS_NO_CHANGE', 'completed', 'morning_synced', 'midday_refreshed', 'results_synced'].some((needle) => status.includes(needle))
  })
  const lastSuccessfulProtectedInvocationAt = String(latestSuccessfulProtected?.completed_at ?? latestSuccessfulProtected?.created_at ?? '') || null
  const evidenceAge = ageMinutes(lastSuccessfulProtectedInvocationAt)
  const externalSchedulerVerified = Boolean(lastSuccessfulProtectedInvocationAt)
  const automaticMultiRefreshActive = externalSchedulerVerified && evidenceAge !== null && evidenceAge <= EXTERNAL_SCHEDULER_EXPECTED_CADENCE_MINUTES * 3
  const failedSteps = lifecycle.rows.filter((row: Record<string, unknown>) => {
    const status = String(row.status ?? '').toLowerCase()
    return status.includes('failed') || status.includes('error')
  })
  const retryingSteps = lifecycle.rows.filter((row: Record<string, unknown>) => {
    const status = String(row.status ?? '').toLowerCase()
    return status.includes('retry') || status.includes('partial')
  })
  const missingMigrations = migrations.filter((migration) => migration.status === 'MISSING')
  const unknownMigrations = migrations.filter((migration) => migration.status === 'UNKNOWN')
  const staleFreshness = adaptive.freshness.filter((item) => ['STALE', 'FAILED', 'PENDING'].includes(item.status) && item.supported)
  const userVisibleProjections = Number(projections.summary.userVisible ?? 0)
  const blockers = [
    ...adaptive.blockers,
    ...missingMigrations.map((migration) => `migration_${migration.table}_${migration.status.toLowerCase()}`),
    lifecycle.error ? `lifecycle_ledger_read_failed:${lifecycle.error}` : null,
    backlog.error ? `settlement_backlog_read_failed:${backlog.error}` : null,
  ].filter(Boolean) as string[]
  const projectionBlocked = Number(projections.projectionHealth?.blocked ?? 0)
  const projectionVisible = userVisibleProjections
  const platformHealth = blockers.length || staleFreshness.length ? 'DEGRADED' : 'HEALTHY'
  const providerHealth = adaptive.providerBudget.mode === 'EXHAUSTED'
    ? 'BLOCKED'
    : adaptive.blockers.includes('odds_not_current')
      ? 'DEGRADED'
      : 'HEALTHY'
  const projectionHealth = projectionVisible > 0
    ? 'OPERATIONAL'
    : projectionBlocked > 0
      ? 'LIMITED_BLOCKED_BY_INTEGRITY'
      : 'INSUFFICIENT_DATA'
  const predictionHealth = board.candidates.length > 0
    ? 'OPERATIONAL'
    : adaptive.gamesReadyForAnalysis > 0
      ? 'DEGRADED'
      : 'WAITING_FOR_VALID_INPUTS'
  const status = overallStatus({
    pendingMigration: missingMigrations.length > 0,
    adaptiveBlocked: adaptive.blockers.length > 0,
    staleCritical: staleFreshness.some((item) => ['odds', 'prediction', 'recommendation'].includes(item.domain)),
    failedSteps: failedSteps.length,
  })
  return {
    success: true,
    status,
    mode: 'operations_health_v1',
    generatedAt,
    sportKey: SPORT_KEY,
    leagueKey: LEAGUE_KEY,
    operatingDate: adaptive.operatingDate,
    deployment: {
      productionUrl: 'https://pick-analyzer.vercel.app',
      version: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? null,
    },
    scheduler: {
      configured: adaptive.schedulerAudit.configuredCronCount > 0,
      configuredCrons: adaptive.schedulerAudit.configuredCrons,
      lastCronInvocation: adaptive.schedulerAudit.jobs[0]?.lastRunAt ?? null,
      nextScheduledRun: adaptive.schedulerAudit.jobs[0]?.nextRunAt ?? null,
      limitation: 'vercel.json currently defines one daily Hobby-compatible cron; intraday cadence requires external scheduler or manual protected execution.',
      schedulerEvidenceSource: lastSuccessfulProtectedInvocationAt ? 'operating_day_lifecycle_events' : 'none',
      lastExternalSchedulerInvocationAt: lastSuccessfulProtectedInvocationAt,
      lastSuccessfulProtectedInvocationAt,
      externalSchedulerVerified,
      automaticMultiRefreshActive,
      evidenceAgeMinutes: evidenceAge,
    },
    adaptiveExecution: {
      mode: 'protected_existing_operating_day_bridge',
      currentRunStatus: adaptive.automationStatus,
      nextAction: adaptive.nextAction,
      nextActionAt: adaptive.nextActionAt,
      dueSteps: adaptive.refreshPlan.filter((item) => item.decision === 'DUE_NOW'),
      planOnly: false,
      blockers: adaptive.blockers,
      statusRefresh,
    },
    providerBudgets: {
      sportsdataio: {
        status: adaptive.providerBudget.mode,
        callsMadeToday: budget.callsMadeToday,
        callsPlannedToday: budget.callsPlannedToday,
        hardRemaining: budget.hardRemaining,
        estimatedCallsRemaining: budget.estimatedCallsRemaining,
        dailyBudget: budget.config.dailyCallBudget,
        monthlyEstimateAtCurrentDailyBudget: budget.config.dailyCallBudget * 30,
        lastProviderCall: budget.lastProviderCall,
      },
    },
    componentHealth: {
      platform: {
        status: platformHealth,
        blocker: blockers[0] ?? null,
        explanation: platformHealth === 'HEALTHY' ? 'No critical production blocker is currently active.' : 'One or more critical operational dependencies is degraded.',
      },
      provider: {
        status: providerHealth,
        blocker: adaptive.blockers.find((blocker) => blocker.includes('odds') || blocker.includes('provider')) ?? null,
        explanation: providerHealth === 'HEALTHY' ? 'Provider budget and stored freshness are acceptable.' : 'Provider-backed market freshness is not current or provider budget is blocked.',
      },
      projection: {
        status: projectionHealth,
        visible: projectionVisible,
        blocked: projectionBlocked,
        explanation: projectionVisible > 0
          ? 'Projection board has user-visible rows that satisfy integrity gates.'
          : 'Projection integrity is blocking user-visible rows until entity, feature, starter, validity or sample contracts are satisfied.',
      },
      prediction: {
        status: predictionHealth,
        candidates: board.candidates.length,
        officialPicks: board.officialPickCount,
        explanation: board.candidates.length ? 'Current Board has stored candidates.' : 'Prediction candidates are waiting for valid current inputs.',
      },
    },
    freshness: adaptive.freshness.map((item) => ({
      domain: item.domain,
      label: item.label,
      lastAttemptAt: item.fetchedAt,
      lastSuccessAt: item.lastUpdated,
      lastChangeAt: item.lastUpdated,
      sourceTimestamp: item.lastUpdated,
      ageMinutes: item.ageMinutes,
      thresholdMinutes: item.staleAfterMinutes,
      status: item.status,
      executionMode: item.supported ? 'scheduled_or_protected' : 'unsupported',
      nextDueAt: item.nextRecommendedRefreshAt,
      currentRunStatus: adaptive.automationStatus,
      failureReason: item.staleReason,
      retryAt: item.nextRecommendedRefreshAt,
    })),
    projections: {
      summary: projections.summary,
      health: projections.projectionHealth,
      persistence: projections.persistence,
      userVisible: userVisibleProjections,
    },
    currentBoard: {
      candidates: board.candidates.length,
      officialPicks: board.officialPickCount,
      latestOddsTimestamp: board.latestOddsTimestamp,
      status: board.boardHealth.status,
      warnings: board.boardHealth.warnings,
    },
    settlementBacklog: backlog,
    migrations: {
      pending: missingMigrations,
      unknown: unknownMigrations,
      checks: migrations,
    },
    executionLedger: {
      table: 'operating_day_lifecycle_events',
      recentRuns: lifecycle.rows,
      failedSteps,
      retryingSteps,
      staleLocks: [],
    },
    cacheState: {
      operationalRoutesUseNoStoreFetch: true,
      dashboardMustRefetchAfterMutation: true,
      globalCacheDisabled: false,
      notes: ['Current operations APIs are dynamic server routes; browser clients request with cache:no-store where panels consume them.'],
    },
    exactBlockers: blockers,
    providerCallsToday: budget.callsMadeToday,
    mutationsToday: lifecycle.rows.reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>).remoteMutationsMade ?? 0 : 0), 0),
    readinessScore: {
      schedulerReliability: adaptive.schedulerAudit.configuredCronCount > 0 ? 55 : 20,
      adaptiveExecution: 70,
      providerBudgetSafety: adaptive.providerBudget.mode === 'EXHAUSTED' ? 20 : 85,
      dataFreshness: staleFreshness.length ? 45 : 80,
      temporalIntegrity: 85,
      projectionOperations: userVisibleProjections > 0 ? 70 : 45,
      predictionOperations: board.candidates.length > 0 ? 75 : 45,
      currentBoardFreshness: board.latestOddsTimestamp ? 70 : 35,
      settlementReliability: backlog.error ? 35 : 65,
      cacheReliability: 70,
      observability: 80,
      failureRecovery: retryingSteps.length ? 55 : 70,
      migrationReadiness: missingMigrations.length ? 40 : unknownMigrations.length ? 70 : 90,
    },
    closedBetaReadiness: {
      score: Math.round((
        (adaptive.blockers.length ? 50 : 85) +
        (adaptive.providerBudget.mode === 'EXHAUSTED' ? 20 : 80) +
        (board.candidates.length ? 75 : 45) +
        (projectionVisible > 0 ? 75 : 45) +
        (missingMigrations.length ? 35 : unknownMigrations.length ? 70 : 90) +
        (lifecycle.error ? 35 : 75)
      ) / 6),
      status: blockers.length ? 'LIMITED' : 'READY_FOR_MONITORED_CLOSED_BETA',
      exactBlockers: blockers,
      notes: [
        'Closed beta readiness is operational, not betting-performance certification.',
        'Official thresholds, champion state, projection integrity and settlement policy remain unchanged.',
      ],
    },
    certification: {
      operationsProductionReady: false,
      closedBetaOperationsReady: blockers.length === 0 && missingMigrations.length === 0,
      reason: blockers.length
        ? 'Operations health has explicit blockers or stale supported data.'
        : 'Closed beta readiness is acceptable only if protected execution is monitored; production certification remains false until intraday scheduler cadence is proven.',
    },
    guardrails: {
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      predictionMutationsMade: 0,
      officialThresholdsChanged: false,
      championRowsMutated: false,
      v7Promoted: false,
      currentBoardPolicyChanged: false,
      settlementPolicyChanged: false,
    },
  }
}
