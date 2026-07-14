import { getEnabledSports } from '@/config/sports.config'
import { getNbaDailySyncOrchestrationContract } from '@/services/nba-data-sync.service'
import { syncRecentResults } from '@/services/results-sync.service'
import { recalculateTeamStatsFromResults } from '@/services/team-stats-calculator.service'
import { recalculateHeadToHead } from '@/services/team-matchups-calculator.service'
import { settlePredictionHistory } from '@/services/prediction-history.service'
import { withTimeout } from '@/services/sync-reliability.service'
import { previewNbaFeatureStoreSnapshot } from '@/services/nba-feature-store-integration.service'
import { getNbaDataQualityAudit } from '@/services/nba-data-quality.service'
import { generateNbaPredictions } from '@/services/nba-prediction-engine.service'
import { getNbaModelHealthV2 } from '@/services/nba-prediction-settlement.service'
import {
  planHistoricalFeatureGeneration,
  runHistoricalFeatureSnapshotWritePilot,
  runHistoricalPredictionLineagePilot,
} from '@/services/historical-feature-generation.service'

export type DailySyncOrchestratorV2Options = {
  dryRun?: boolean
  providerCallBudget?: number
  resumeFromStep?: string | null
  cancelAfterStep?: string | null
  timeoutMs?: number
}

type DailySyncStepStatus =
  | 'planned'
  | 'completed'
  | 'skipped_dry_run'
  | 'skipped_dependency'
  | 'skipped_external_blocker'
  | 'skipped_cancelled'
  | 'failed'

type DailySyncStepResult = {
  order: number
  id: string
  label: string
  status: DailySyncStepStatus
  dependencyIds: string[]
  skippedReason: string | null
  checkpoint: string
  idempotencyKey: string
  timeoutMs: number
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  providerCallsPlanned: number
  providerCallsUsed: number
  mutates: boolean
  data?: unknown
  error?: string
}

export async function runDailySportsPipeline() {
  const sports = getEnabledSports()
  const results = []

  for (const sport of sports) {
    try {
      const sync = await syncRecentResults(sport.key, 3)
      const stats = await recalculateTeamStatsFromResults(sport.key)
      const h2h = await recalculateHeadToHead(sport.key)
      const settlement = await settlePredictionHistory(sport.key)

      results.push({
        success: true,
        sportKey: sport.key,
        sync,
        stats,
        h2h,
        settlement,
      })
    } catch (error) {
      results.push({
        success: false,
        sportKey: sport.key,
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected pipeline error',
      })
    }
  }

  return {
    success: true,
    results,
  }
}

function nowIso() {
  return new Date().toISOString()
}

const NBA_DAILY_DEPENDENCIES: Record<string, string[]> = {
  nba_daily_schedules: [],
  nba_daily_results: ['nba_daily_schedules'],
  nba_daily_injuries: ['nba_daily_schedules'],
  nba_daily_lineups: ['nba_daily_schedules'],
  nba_daily_team_stats: ['nba_daily_results'],
  nba_daily_player_stats: ['nba_daily_schedules'],
  nba_daily_feature_preview: [
    'nba_daily_team_stats',
    'nba_daily_injuries',
    'nba_daily_lineups',
    'nba_daily_player_stats',
  ],
  nba_daily_prediction_preview: ['nba_daily_feature_preview'],
  nba_daily_settlement: ['nba_daily_results'],
  nba_daily_data_quality: ['nba_daily_feature_preview', 'nba_daily_settlement'],
}

const MLB_PERSONAL_PLAN_CAPTURE_SCHEDULE = {
  mode: 'sportsdataio_mlb_personal_plan_capture_schedule_v1',
  active: false,
  cronEnabled: false,
  sportKey: 'baseball_mlb',
  leagueKey: 'mlb',
  provider: 'sportsdataio_discovery_lab',
  providerCallPolicy: {
    concurrency: 1,
    automaticRetries: false,
    productionEligibleByDefault: false,
    noProviderCallsFromDailySyncV2: true,
    estimatedTypicalDailyCalls: 8,
    estimatedFullSlateHistoricalReconstructionCalls: 22,
    dailyPlanLimit: 1000,
    callEstimateNotes: [
      'GameOddsByDate is one call per date, not one call per game.',
      'GameOddsLineMovement is reserved for explicitly approved historical reconstruction, not routine every-game polling.',
      'No 30-second polling is represented or enabled.',
    ],
  },
  quarantinePolicy: {
    trial: false,
    scrambled: false,
    productionEligible: false,
    productionRecommendationsEnabled: false,
    modelPromotionEnabled: false,
  },
  plannedWindows: [
    {
      order: 1,
      id: 'mlb_personal_schedule_status_sync',
      label: 'Morning schedule sync',
      endpointTemplate: '/api/mlb/odds/json/GamesByDate/{date}',
      plannedProviderCalls: 1,
      purpose: 'Identify scheduled games and provider GameIds for the slate.',
    },
    {
      order: 2,
      id: 'mlb_personal_initial_odds_capture',
      label: 'Initial odds capture',
      endpointTemplate: '/api/mlb/odds/json/GameOddsByDate/{date}',
      plannedProviderCalls: 1,
      purpose: 'Capture current full-game consensus odds when available.',
    },
    {
      order: 3,
      id: 'mlb_personal_midday_odds_refresh',
      label: 'Midday odds refresh',
      endpointTemplate: '/api/mlb/odds/json/GameOddsByDate/{date}',
      plannedProviderCalls: 1,
      purpose: 'Refresh date-level consensus odds without reconstructing historical movement.',
    },
    {
      order: 4,
      id: 'mlb_personal_pregame_odds_refresh',
      label: 'Pregame odds refresh',
      endpointTemplate: '/api/mlb/odds/json/GameOddsByDate/{date}',
      plannedProviderCalls: 1,
      purpose: 'Refresh pregame consensus odds once before the slate starts.',
    },
    {
      order: 5,
      id: 'mlb_personal_final_pregame_capture',
      label: 'Final pregame capture',
      endpointTemplate: '/api/mlb/odds/json/GameOddsByDate/{date}',
      plannedProviderCalls: 1,
      purpose: 'Optional final date-level capture 10-15 minutes before first pitch while skipping started games.',
    },
    {
      order: 6,
      id: 'mlb_personal_availability_projection_refresh',
      label: 'Availability/projection refresh',
      endpointTemplate: 'Players or projection endpoints where supported and explicitly approved',
      plannedProviderCalls: '0 by default; 1-2 only when approved',
      purpose: 'Refresh availability/projection context only when historical timestamp safety is proven.',
    },
    {
      order: 7,
      id: 'mlb_personal_results_sync',
      label: 'Postgame results',
      endpointTemplate: '/api/mlb/odds/json/GamesByDate/{date}',
      plannedProviderCalls: 1,
      purpose: 'Capture completed scores for settlement after games complete.',
    },
    {
      order: 8,
      id: 'mlb_personal_team_game_stats',
      label: 'Team game stats',
      endpointTemplate: '/api/mlb/odds/json/TeamGameStatsByDate/{date}',
      plannedProviderCalls: 1,
      purpose: 'Postgame team stats for reporting and future non-leaking feature research only.',
    },
    {
      order: 9,
      id: 'mlb_personal_player_game_stats',
      label: 'Player game stats',
      endpointTemplate: '/api/mlb/fantasy/json/PlayerGameStatsByDate/{date}',
      plannedProviderCalls: 1,
      purpose: 'Postgame player stats for reporting and future non-leaking feature research only.',
    },
    {
      order: 10,
      id: 'mlb_personal_settlement',
      label: 'Settlement',
      endpointTemplate: 'local persisted sport_events and linked prediction_history rows',
      plannedProviderCalls: 0,
      purpose: 'Settle linked quarantined predictions using persisted completed results.',
    },
    {
      order: 11,
      id: 'mlb_personal_data_quality',
      label: 'Data quality',
      endpointTemplate: 'local normalized tables',
      plannedProviderCalls: 0,
      purpose: 'Audit mappings, duplicates, quarantine flags, timestamp leakage and production gate exclusions.',
    },
    {
      order: 12,
      id: 'mlb_personal_technical_reporting',
      label: 'Technical reporting',
      endpointTemplate: 'local linked snapshots, predictions and settlement rows',
      plannedProviderCalls: 0,
      purpose: 'Report quarantined technical validation only; no public picks or production promotion.',
    },
  ],
}

function summarizeExecutionData(stepId: string, data: unknown) {
  if (!data || typeof data !== 'object') return data
  const value = data as Record<string, unknown>

  if (stepId === 'nba_daily_feature_preview') {
    const snapshot = value.snapshot as Record<string, unknown> | undefined
    const playerStats = value.playerStats as Record<string, unknown> | undefined
    return {
      mode: value.mode,
      featureQualityScore: snapshot?.featureQualityScore,
      dataSufficiencyScore: snapshot?.dataSufficiencyScore,
      noLeakage: snapshot?.noLeakage,
      playerStatsStatus: playerStats?.availabilityStatus,
      playerStatsRows: playerStats?.sampleSize,
    }
  }

  if (stepId === 'nba_daily_prediction_preview') {
    const predictions = Array.isArray(value.predictions) ? value.predictions : []
    return {
      mode: value.mode,
      persisted: value.persisted,
      saved: value.saved,
      predictions: predictions.length,
      validation: value.validation,
    }
  }

  if (stepId === 'nba_daily_data_quality') {
    const issueSummary = value.issueSummary as Record<string, unknown> | undefined
    return {
      mode: value.mode,
      status: value.status,
      issues: issueSummary?.total,
    }
  }

  if (stepId === 'nba_daily_settlement') {
    return {
      mode: value.mode,
      status: value.status,
      issues: value.issues,
      warnings: value.warnings,
    }
  }

  return {
    mode: value.mode,
    success: value.success,
    status: value.status,
  }
}

async function executeReadOnlyStep(stepId: string) {
  if (stepId === 'nba_daily_feature_preview') {
    return summarizeExecutionData(stepId, await previewNbaFeatureStoreSnapshot())
  }

  if (stepId === 'nba_daily_prediction_preview') {
    return summarizeExecutionData(stepId, await generateNbaPredictions({ persist: false, limit: 5 }))
  }

  if (stepId === 'nba_daily_settlement') {
    return summarizeExecutionData(stepId, await getNbaModelHealthV2())
  }

  if (stepId === 'nba_daily_data_quality') {
    return summarizeExecutionData(stepId, await getNbaDataQualityAudit())
  }

  return null
}

export async function runDailySyncOrchestratorV2(options: DailySyncOrchestratorV2Options = {}) {
  const dryRun = options.dryRun ?? true
  const providerCallBudget = Math.max(0, options.providerCallBudget ?? 0)
  const timeoutMs = Math.max(1000, options.timeoutMs ?? 15000)
  const startedAt = nowIso()
  const contract = getNbaDailySyncOrchestrationContract()
  const featureGenerationHandoff = planHistoricalFeatureGeneration({
    sportKey: 'basketball_nba',
    leagueKey: 'nba',
    market: 'moneyline',
    executionMode: 'trial_only',
  })
  const snapshotWritePilot = await runHistoricalFeatureSnapshotWritePilot({
    dryRun: true,
    confirmed: false,
    maximumEvents: 5,
    maximumMarketsPerEvent: 3,
    maximumSnapshots: 15,
  })
  const predictionLineagePilot = await runHistoricalPredictionLineagePilot({
    dryRun: true,
    confirmed: false,
    maximumSnapshots: 15,
    maximumPredictions: 5,
    settle: false,
  })
  const resumeFromStep = options.resumeFromStep ?? null
  const cancelAfterStep = options.cancelAfterStep ?? null
  let providerCallsUsed = 0
  let resumeReached = !resumeFromStep
  let cancelled = false
  const completed = new Set<string>()
  const results: DailySyncStepResult[] = []

  for (const step of contract.steps) {
    const dependencies = NBA_DAILY_DEPENDENCIES[step.id] ?? []
    const base = {
      order: step.order,
      id: step.id,
      label: step.label,
      dependencyIds: dependencies,
      checkpoint: step.checkpoint,
      idempotencyKey: step.idempotencyKey,
      timeoutMs,
      providerCallsPlanned: step.providerCallsAllowedByDefault,
      providerCallsUsed: 0,
      mutates: step.mutates,
    }

    if (!resumeReached) {
      if (step.id === resumeFromStep) {
        resumeReached = true
      } else {
        results.push({
          ...base,
          status: 'skipped_dependency',
          skippedReason: `Waiting to resume from ${resumeFromStep}.`,
          startedAt: null,
          completedAt: null,
          durationMs: null,
        })
        continue
      }
    }

    if (cancelled) {
      results.push({
        ...base,
        status: 'skipped_cancelled',
        skippedReason: `Execution cancelled after ${cancelAfterStep}.`,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      })
      continue
    }

    const missingDependencies = dependencies.filter((id) => !completed.has(id))
    if (missingDependencies.length > 0) {
      results.push({
        ...base,
        status: 'skipped_dependency',
        skippedReason: `Missing completed dependencies: ${missingDependencies.join(', ')}.`,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      })
      continue
    }

    if (step.status === 'contract_only_blocked_external') {
      results.push({
        ...base,
        status: 'skipped_external_blocker',
        skippedReason: step.productionSafetyGate,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      })
      continue
    }

    if (providerCallsUsed + step.providerCallsAllowedByDefault > providerCallBudget) {
      results.push({
        ...base,
        status: 'skipped_dependency',
        skippedReason: `Provider-call budget ${providerCallBudget} would be exceeded.`,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      })
      continue
    }

    if (dryRun || step.mutates) {
      completed.add(step.id)
      results.push({
        ...base,
        status: dryRun ? 'planned' : 'skipped_dry_run',
        skippedReason: dryRun
          ? 'Dry run: execution contract validated without mutation.'
          : 'Mutating daily-orchestration execution is not enabled by V2 without explicit approval.',
        startedAt: null,
        completedAt: null,
        durationMs: null,
      })
    } else {
      const stepStartedMs = Date.now()
      const stepStartedAt = nowIso()
      try {
        const data = await withTimeout(executeReadOnlyStep(step.id), timeoutMs)
        providerCallsUsed += step.providerCallsAllowedByDefault
        completed.add(step.id)
        results.push({
          ...base,
          status: 'completed',
          skippedReason: null,
          startedAt: stepStartedAt,
          completedAt: nowIso(),
          durationMs: Date.now() - stepStartedMs,
          providerCallsUsed: step.providerCallsAllowedByDefault,
          data,
        })
      } catch (error) {
        results.push({
          ...base,
          status: 'failed',
          skippedReason: null,
          startedAt: stepStartedAt,
          completedAt: nowIso(),
          durationMs: Date.now() - stepStartedMs,
          error: error instanceof Error ? error.message : 'Unknown daily sync step error',
        })
      }
    }

    if (cancelAfterStep && step.id === cancelAfterStep) {
      cancelled = true
    }
  }

  const failed = results.filter((step) => step.status === 'failed')
  const completedSteps = results.filter((step) => step.status === 'completed' || step.status === 'planned')
  const skipped = results.filter((step) => step.status.startsWith('skipped'))

  return {
    success: failed.length === 0,
    mode: 'daily_sync_orchestrator_v2',
    generatedAt: nowIso(),
    startedAt,
    finishedAt: nowIso(),
    dryRun,
    providerUsage: {
      externalProviderCallsMade: providerCallsUsed,
      providerCallBudget,
      source: 'daily_sync_orchestrator_v2_local_contract',
    },
    executionPolicy: {
      concurrency: 1,
      automaticRetries: false,
      timeoutMs,
      authorizationOrSchemaErrorsRetryable: false,
      unrestrictedProviderExecution: false,
    },
    checkpointing: {
      resumable: true,
      resumeFromStep,
      nextResumeStep: failed[0]?.id ?? skipped.find((step) => step.status === 'skipped_dependency')?.id ?? null,
      cancellationRequestedAfterStep: cancelAfterStep,
      cancellationApplied: cancelled,
    },
    isolation: {
      trialRowsCanImproveProductionConfidence: false,
      productionPredictionGate: 'closed_for_trial_only_or_externally_blocked_domains',
      predictionPreviewPersistsPicks: false,
      historicalFeatureGenerationUsesProviderCalls: false,
      pregameFeatureSnapshotsImmutable: true,
    },
    mlbPersonalPlanCaptureSchedule: MLB_PERSONAL_PLAN_CAPTURE_SCHEDULE,
    featureGenerationHandoff: {
      mode: featureGenerationHandoff.mode,
      eligible: featureGenerationHandoff.eligibility.eligible,
      persistenceReady: featureGenerationHandoff.eligibility.persistenceReady,
      persistenceStatus: featureGenerationHandoff.persistenceReadiness.status,
      migrationFilename: featureGenerationHandoff.persistenceReadiness.migration.filename,
      migrationApplied: featureGenerationHandoff.persistenceReadiness.migration.applied,
      leakageValidationReady: featureGenerationHandoff.eligibility.leakageValidationReady,
      backtestHandoffReady: featureGenerationHandoff.eligibility.backtestHandoffReady,
      backtestReady: featureGenerationHandoff.backtestInputReadiness.ready,
      providerCallsMade: featureGenerationHandoff.providerUsage.externalProviderCallsMade,
      checkpointStrategy: featureGenerationHandoff.batching.checkpointStrategy,
      deterministicPersistenceKey: featureGenerationHandoff.persistenceReadiness.deterministicKey,
      postgamePolicy:
        'Results/stats/settlement updates prepare performance inputs but must not overwrite original pregame feature snapshots.',
    },
    historicalFeatureSnapshotWritePilot: {
      mode: snapshotWritePilot.mode,
      status: snapshotWritePilot.status,
      writeModeAvailable: snapshotWritePilot.schema.applied,
      maximumSafeBatch: snapshotWritePilot.caps.maximumSnapshots,
      eligibleCandidateCount: snapshotWritePilot.candidateSelection.eligibleCandidates,
      persistedSnapshotCount:
        snapshotWritePilot.persistence.inserted + snapshotWritePilot.persistence.reused,
      checkpoint: snapshotWritePilot.checkpoint,
      productionGate:
        'closed_for_trial_snapshots; production prediction linkage requires production_eligible snapshots and settled production samples.',
      pregame: {
        normalizedDataReady: snapshotWritePilot.schema.applied,
        eligibleFeatureSnapshotCandidate:
          snapshotWritePilot.candidateSelection.eligibleCandidates > 0,
        snapshotWriteReadiness: snapshotWritePilot.status,
        predictionLinkageReadiness: snapshotWritePilot.linkage.featureSnapshotIdFkAvailable,
        trialProductionGate: 'trial_only_snapshots_cannot_link_to_production_predictions',
      },
      postgame: {
        settlementReadiness: 'settlement_requires_completed events and existing settlement validation gates',
        originalSnapshotImmutable: snapshotWritePilot.immutability.linkedSnapshotMutationProtected,
        linkedPredictionBacktestEligibility:
          'requires linked production snapshot, valid price, genuine closing snapshot and settled production result',
      },
    },
    historicalPredictionLineagePilot: {
      mode: predictionLineagePilot.mode,
      status: predictionLineagePilot.status,
      eligibleSnapshotCount: predictionLineagePilot.snapshotSelection.eligibleSnapshots,
      maximumPredictions: predictionLineagePilot.caps.maximumPredictions,
      linkedPredictionCount: predictionLineagePilot.linkageCounts.linkedPredictions,
      trialLinkedPredictionCount: predictionLineagePilot.linkageCounts.trialLinkedPredictions,
      productionLinkedPredictionCount: predictionLineagePilot.linkageCounts.productionLinkedPredictions,
      settlementStatus: predictionLineagePilot.settlement.status,
      backtestContractEligibility: {
        roiEligibleRows: predictionLineagePilot.backtestEligibility.rowsEligibleForRoi,
        calibrationEligibleRows:
          predictionLineagePilot.backtestEligibility.rowsEligibleForCalibration,
        clvEligibleRows: predictionLineagePilot.backtestEligibility.rowsEligibleForClv,
        blockedForTrialStatus:
          predictionLineagePilot.backtestEligibility.rowsBlockedForTrialStatus,
      },
      productionGate:
        'closed_for_trial_lineage; production performance requires production_eligible linked predictions with real prices, closing snapshots and settled samples.',
      pregame: {
        normalizedData: snapshotWritePilot.schema.applied,
        featureSnapshotGeneration: featureGenerationHandoff.eligibility.leakageValidationReady,
        snapshotPersistence:
          snapshotWritePilot.persistence.inserted + snapshotWritePilot.persistence.reused,
        predictionCreationAndLinkage: predictionLineagePilot.status,
        productionTrialGate:
          'trial=true and production_eligible=false rows validate linkage only',
      },
      postgame: {
        resultSynchronization: 'uses existing sport_events and sport_game_stats only',
        settlement: predictionLineagePilot.settlement.status,
        performanceEligibility:
          predictionLineagePilot.backtestEligibility.rowsEligibleForRoi > 0
            ? 'production_roi_candidates_present'
            : 'blocked',
        calibrationEligibility:
          predictionLineagePilot.backtestEligibility.rowsEligibleForCalibration > 0
            ? 'production_calibration_candidates_present'
            : 'blocked',
        originalSnapshotImmutability:
          predictionLineagePilot.immutability.incompatibleReplacementRejected,
      },
    },
    summary: {
      steps: results.length,
      completed: completedSteps.length,
      skipped: skipped.length,
      failed: failed.length,
      blockedExternal: results.filter((step) => step.status === 'skipped_external_blocker').length,
      providerCallsUsed,
    },
    steps: results,
  }
}
