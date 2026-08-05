import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CRON_STATUS_HTTP: Record<string, number> = {
  SUCCESS: 200,
  SUCCESS_CHANGED: 200,
  SUCCESS_NO_CHANGE: 200,
  NOT_DUE: 200,
  PLANNED: 200,
  BUDGET_BLOCKED: 409,
  BLOCKED: 423,
  MISSED_REFRESH: 207,
  FAILED_RETRYABLE: 502,
  completed: 200,
  no_op: 200,
  already_current: 200,
  waiting: 200,
  locked: 200,
  quota_blocked: 409,
  provider_error: 502,
  partial: 207,
  invalid_stage: 400,
  configuration_error: 500,
}

type CronOperatingDayAction =
  | 'status_refresh'
  | 'morning_sync'
  | 'midday_refresh'
  | 'final_refresh'
  | 'lock'
  | 'sync_results'
  | 'settle'
  | 'replay'
  | 'calibrate'
  | 'complete'
  | 'reconcile_preview'
  | 'resolve_next_slate'
  | 'next_slate_preview'
  | 'prepare_next_slate'
  | 'recommendation_lock'
  | 'postgame_rollover'
  | 'status'

type CronAutomationStatus = {
  selectedSlateDate: string | null
  currentStage: string | null
  nextAction: CronOperatingDayAction
  nextActionReason: string | null
  localCalendarDate: string | null
  activeOperatingDate: string | null
  activeSlateDate: string | null
  providerQueryDate: string | null
  nextSlateDate: string | null
  dateSelectionReason: string | null
  consecutiveSameActionCount: number | null
  actionStuck: boolean | null
  currentLifecycleState: string | null
  operatingDayId: string | null
  eventsFound: number | null
  staleEvents: number | null
  activeCandidates: number | null
  officialPicks: number | null
  latestOddsTimestamp: string | null
}

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}` || request.nextUrl.searchParams.get('secret') === secret
}

function parseDryRun(request: NextRequest) {
  const value = request.nextUrl.searchParams.get('dryRun')
  if (value === 'true') return true
  if (value === 'false') return false
  return false
}

function schedulerOwner(request: NextRequest, dryRun: boolean) {
  return {
    writeOwner: dryRun ? 'NONE_DRY_RUN' : 'GITHUB_ACTIONS_PRODUCTION_OPERATING_DAY_SCHEDULER',
    runtimeOwner: 'adaptive_refresh_execution_bridge_v2',
    observerSchedulers: ['GITHUB_PRODUCTION_OPERATING_DAY_HEARTBEAT_MANUAL', 'GITHUB_OPERATING_DAY_REFRESH_MANUAL'],
    disabledSchedulers: ['VERCEL_OPERATING_DAY_CRON'],
    responsibilities: {
      eventStatusPersistence: 'GITHUB_ACTIONS_PRODUCTION_OPERATING_DAY_SCHEDULER',
      resultsSync: 'GITHUB_ACTIONS_PRODUCTION_OPERATING_DAY_SCHEDULER',
      settlement: 'GITHUB_ACTIONS_PRODUCTION_OPERATING_DAY_SCHEDULER',
      learningLabels: 'SETTLEMENT_DERIVED_PREDICTION_HISTORY_LABELS',
      performanceRefresh: 'GITHUB_ACTIONS_PRODUCTION_OPERATING_DAY_SCHEDULER_AFTER_SETTLEMENT',
      dailySnapshot: 'GITHUB_ACTIONS_PRODUCTION_OPERATING_DAY_SCHEDULER_AFTER_SETTLEMENT',
      providerBudgetEnforcement: 'APPLICATION_PROVIDER_BUDGET_SERVICE',
      postgameReconciliation: 'GITHUB_ACTIONS_PRODUCTION_OPERATING_DAY_SCHEDULER',
    },
    duplicateProtection: [
      'provider_action_lock',
      'operating_day_unique_date',
      'game_results_upsert',
      'prediction_status_already_settled_guard',
      'ai_performance_snapshots_idempotency_key',
    ],
    requestMethod: request.method,
    dryRun,
  }
}

async function runPostgameContinuity(dryRun: boolean, source: string) {
  const { runAdaptiveRefresh } = await import('@/services/adaptive-refresh-orchestrator.service')
  const steps = []
  let totalProviderCalls = 0
  let totalWrites = 0
  let settlementObserved = false
  let schedulerHeartbeat: Record<string, unknown> | null = null

  for (let step = 0; step < 3; step += 1) {
    const adaptive = await runAdaptiveRefresh({ dryRun, source })
    const record = adaptive as Record<string, unknown>
    const selectedAction = String(record.selectedAction ?? '')
    steps.push(adaptive)
    totalProviderCalls += Number(record.providerCallsMade ?? 0)
    totalWrites += Number(record.remoteMutationsMade ?? 0)
    if (selectedAction === 'settle') settlementObserved = true
    const status = String(record.status ?? '')
    const shouldContinue =
      dryRun === false &&
      adaptive.success === true &&
      ['sync_results', 'settle'].includes(selectedAction) &&
      !['NOT_DUE', 'SUCCESS_NO_CHANGE'].includes(status)
    if (!shouldContinue) break
  }

  let dailyUpdate: Record<string, unknown> | null = null
  if (dryRun === false && settlementObserved) {
    const { getAiPerformanceCenterDailyUpdate } = await import('@/services/ai-performance-center.service')
    dailyUpdate = await getAiPerformanceCenterDailyUpdate({ dryRun: false, validationMode: true }) as Record<string, unknown>
    totalWrites += Number((dailyUpdate.automaticDailyUpdate as Record<string, unknown> | undefined)?.durableWritesMade ?? 0)
  }

  const last = (steps.at(-1) ?? {}) as Record<string, unknown>
  const shouldRecordSchedulerHeartbeat =
    steps.every((step) => step.success) &&
    (
      dryRun === true ||
      totalWrites === 0 ||
      ['NOT_DUE', 'SUCCESS_NO_CHANGE'].includes(String(last.status ?? ''))
    )

  if (shouldRecordSchedulerHeartbeat) {
    const { recordOperatingDaySchedulerHeartbeat } = await import('@/services/operating-day.service')
    const lastStep = (steps.at(-1) ?? {}) as Record<string, unknown>
    schedulerHeartbeat = await recordOperatingDaySchedulerHeartbeat({
      selectedDate: String(lastStep.selectedDate ?? ''),
      requestId: String(lastStep.executionRunId ?? ''),
      source,
      status: dryRun === true ? 'SUCCESS_NO_CHANGE' : String(lastStep.status ?? 'SUCCESS_NO_CHANGE'),
      dryRun,
      selectedAction: typeof lastStep.selectedAction === 'string' ? lastStep.selectedAction : null,
      dueSteps: Array.isArray(lastStep.dueSteps) ? lastStep.dueSteps : [],
      metadata: {
        heartbeatReason: dryRun === true
          ? 'successful_protected_dry_run_observation'
          : 'successful_protected_writer_no_product_mutation_observation',
        heartbeatUpdatesHealthMarker: true,
        appInvocationId: String(lastStep.executionRunId ?? ''),
        protectedInvocationRecorded: true,
        workflowSuccessRequiresInvocationEvidence: true,
      },
    }) as Record<string, unknown>
    totalWrites += Number(schedulerHeartbeat.remoteMutationsMade ?? 0)
  }

  return {
    success: steps.every((step) => step.success),
    status: String(last.status ?? (steps.every((step) => step.success) ? 'SUCCESS' : 'FAILED_RETRYABLE')),
    mode: 'operating_day_postgame_continuity_owner_v1',
    delegatedMode: 'adaptive_refresh_execution_bridge_v2',
    dryRun,
    source,
    steps,
    selectedAction: last.selectedAction ?? null,
    selectedDate: last.selectedDate ?? null,
    settlementObserved,
    schedulerHeartbeat,
    dailyUpdate,
    providerCallsMade: totalProviderCalls,
    remoteMutationsMade: totalWrites,
  }
}

async function handle(request: NextRequest) {
  const id = requestId(request)
  if (!authorized(request)) {
    return apiError({ id, code: 'UNAUTHORIZED', message: 'Unauthorized operating-day cron request.', status: 401 })
  }
  const dryRun = parseDryRun(request)
  let status: Partial<CronAutomationStatus> = {}
  try {
    const adaptive = await runPostgameContinuity(
      dryRun,
      request.method === 'POST' ? 'GITHUB_ACTIONS_PRODUCTION_OPERATING_DAY_SCHEDULER' : 'MANUAL_OR_VERCEL_READ_ONLY_CALLER'
    )
    const adaptiveRecord = adaptive as Record<string, unknown>
    const adaptiveStatus = String(adaptiveRecord.status ?? (adaptive.success ? 'SUCCESS' : 'FAILED_RETRYABLE'))
    return apiOk(
      {
        ...adaptive,
        mode: 'operating_day_consolidated_cron_execution_v2',
        delegatedMode: adaptive.mode,
        status: adaptiveStatus,
        retryable: ['FAILED_RETRYABLE', 'MISSED_REFRESH', 'BUDGET_BLOCKED', 'BLOCKED'].includes(adaptiveStatus),
        writes: Number(adaptiveRecord.remoteMutationsMade ?? 0),
        schedulerContract: {
          route: '/api/cron/operating-day',
          executionEngine: 'adaptive_refresh_execution_bridge_v2',
          overlapProtection: 'provider_action_lock',
          providerBudgetGuarded: true,
          refreshWindowGuarded: true,
          providerCallsMadeByDryRun: dryRun ? 0 : undefined,
          legacyAutomationShortCircuitBypassed: true,
          schedulerOwnership: schedulerOwner(request, dryRun),
          dryRunDefault: 'false_for_production_continuity',
        },
      },
      id,
      { status: CRON_STATUS_HTTP[adaptiveStatus] ?? (adaptive.success ? 200 : 409) }
    )

    const { getOperatingDayAutomationStatus } = await import('@/services/operating-day-automation.service')
    status = await getOperatingDayAutomationStatus() as CronAutomationStatus
    if (!status) throw new Error('Operating-day automation status unavailable.')
    if (dryRun) {
      return apiOk({ ...status, mode: 'operating_day_consolidated_cron_dry_run_v1', dryRun: true }, id)
    }
    if (!status.selectedSlateDate) {
      return apiOk(
        {
          success: true,
          mode: 'operating_day_consolidated_cron_execution_v1',
          dryRun: false,
          status: 'waiting',
          retryable: true,
          selectedDate: null,
          selectedAction: null,
          currentStage: status.currentStage,
          nextAction: status.nextAction,
          nextActionReason: status.nextActionReason,
          dateSelection: {
            localCalendarDate: status.localCalendarDate,
            activeOperatingDate: status.activeOperatingDate,
            activeSlateDate: status.activeSlateDate,
            providerQueryDate: status.providerQueryDate,
            nextSlateDate: status.nextSlateDate,
            dateSelectionReason: status.dateSelectionReason,
          },
          consecutiveSameActionCount: status.consecutiveSameActionCount,
          actionStuck: status.actionStuck,
          providerCallsMade: 0,
          writes: 0,
          warnings: ['No upcoming MLB slate is currently available.'],
          schedulerStatus: status,
        },
        id
      )
    }
    if (status.nextAction === 'status' || status.currentLifecycleState === 'ready_for_analysis') {
      return apiOk(
        {
          success: true,
          mode: 'operating_day_consolidated_cron_execution_v1',
          dryRun: false,
          status: 'already_current',
          retryable: false,
          selectedAction: 'status',
          selectedDate: status.selectedSlateDate,
          operatingDayId: status.operatingDayId,
          currentStage: status.currentStage,
          nextAction: status.nextAction,
          nextActionReason: status.nextActionReason,
          dateSelection: {
            localCalendarDate: status.localCalendarDate,
            activeOperatingDate: status.activeOperatingDate,
            activeSlateDate: status.activeSlateDate,
            providerQueryDate: status.providerQueryDate,
            nextSlateDate: status.nextSlateDate,
            dateSelectionReason: status.dateSelectionReason,
          },
          consecutiveSameActionCount: status.consecutiveSameActionCount,
          actionStuck: status.actionStuck,
          providerCallsMade: 0,
          writes: 0,
          warnings: [],
          summary: {
            eventsFound: status.eventsFound,
            staleEvents: status.staleEvents,
            activeCandidates: status.activeCandidates,
            officialPicks: status.officialPicks,
            latestOddsTimestamp: status.latestOddsTimestamp,
          },
          schedulerStatus: status,
        },
        id
      )
    }
    const { executeOperatingDay } = await import('@/services/operating-day.service')
    const action = status.nextAction as CronOperatingDayAction
    const result = await executeOperatingDay({
      action,
      sportKey: 'baseball_mlb',
      leagueKey: 'mlb',
      selectedDate: status.selectedSlateDate,
      confirmed: true,
      dryRun: false,
      maximumRequests: action === 'status_refresh' || action === 'final_refresh' || action === 'sync_results' ? 1 : 3,
      requestId: id,
    })
    const resultRecord = result as Record<string, unknown>
    const executionStatus = String(resultRecord.status ?? (result.success ? 'completed' : 'partial'))
    const normalizedStatus =
      result.success && Number(resultRecord.providerCallsMade ?? 0) === 0 && executionStatus === 'morning_synced'
        ? 'already_current'
        : result.success
          ? 'completed'
          : executionStatus === 'provider_budget_blocked'
            ? 'quota_blocked'
            : executionStatus.includes('provider')
              ? 'provider_error'
              : 'partial'
    return apiOk(
      {
        success: result.success,
        mode: 'operating_day_consolidated_cron_execution_v1',
        dryRun: false,
        status: normalizedStatus,
        retryable: ['provider_error', 'partial', 'quota_blocked'].includes(normalizedStatus),
        selectedAction: action,
        selectedDate: String(resultRecord.selectedDate ?? status.selectedSlateDate),
        operatingDayId: String(resultRecord.operatingDayId ?? status.operatingDayId ?? ''),
        currentStage: status.currentStage,
        nextAction: status.nextAction,
        nextActionReason: status.nextActionReason,
        dateSelection: {
          localCalendarDate: status.localCalendarDate,
          activeOperatingDate: status.activeOperatingDate,
          activeSlateDate: status.activeSlateDate,
          providerQueryDate: status.providerQueryDate,
          nextSlateDate: status.nextSlateDate,
          dateSelectionReason: status.dateSelectionReason,
        },
        consecutiveSameActionCount: status.consecutiveSameActionCount,
        actionStuck: status.actionStuck,
        providerCallsMade: Number(resultRecord.providerCallsMade ?? 0),
        writes: Number(resultRecord.remoteMutationsMade ?? 0),
        warnings: Array.isArray(resultRecord.warnings) ? resultRecord.warnings : [],
        execution: {
          mode: resultRecord.mode,
          status: resultRecord.status,
          eventsLinked: resultRecord.eventsLinked,
          eventsReceived: resultRecord.eventsReceived,
          snapshotsInserted: resultRecord.snapshotsInserted,
          snapshotsReused: resultRecord.snapshotsReused,
          featuresGenerated: resultRecord.featuresGenerated,
          predictionsGenerated: resultRecord.predictionsGenerated,
          candidatesGenerated: resultRecord.candidatesGenerated,
          officialPicks: resultRecord.officialPicks,
          provider: resultRecord.provider,
          endpoint: resultRecord.endpoint,
          providerCheckRequired: resultRecord.providerCheckRequired,
          providerCheckAttempted: resultRecord.providerCheckAttempted,
          providerCheckCompleted: resultRecord.providerCheckCompleted,
          rowsReceived: resultRecord.rowsReceived,
          statusesChanged: resultRecord.statusesChanged,
          rowsUpdated: resultRecord.rowsUpdated,
          rowsSkipped: resultRecord.rowsSkipped,
          gamesMatched: resultRecord.gamesMatched,
          finalGamesDetected: resultRecord.finalGamesDetected,
          scoreRowsInserted: resultRecord.scoreRowsInserted,
          scoreRowsUpdated: resultRecord.scoreRowsUpdated,
          nonFinalRowsSkipped: resultRecord.nonFinalRowsSkipped,
          staleRowsSkipped: resultRecord.staleRowsSkipped,
          unmatchedEvents: resultRecord.unmatchedEvents,
          failureReason: resultRecord.failureReason,
        },
        schedulerStatus: status,
      },
      id,
      { status: CRON_STATUS_HTTP[normalizedStatus] ?? (result.success ? 200 : 409) }
    )
  } catch (error) {
    const message = errorMessage(error, 'Unknown operating-day cron error')
    return apiOk(
      {
        success: false,
        mode: 'operating_day_consolidated_cron_execution_v1',
        dryRun,
        status: 'configuration_error',
        retryable: true,
        selectedAction: status?.nextAction ?? null,
        selectedDate: status?.selectedSlateDate ?? null,
        operatingDayId: status?.operatingDayId ?? null,
        currentStage: status?.currentStage ?? null,
        nextAction: status?.nextAction ?? null,
        nextActionReason: status?.nextActionReason ?? null,
        dateSelection: status ? {
          localCalendarDate: status.localCalendarDate,
          activeOperatingDate: status.activeOperatingDate,
          activeSlateDate: status.activeSlateDate,
          providerQueryDate: status.providerQueryDate,
          nextSlateDate: status.nextSlateDate,
          dateSelectionReason: status.dateSelectionReason,
        } : null,
        consecutiveSameActionCount: status?.consecutiveSameActionCount ?? null,
        actionStuck: status?.actionStuck ?? null,
        providerCallsMade: 0,
        writes: 0,
        warnings: [message],
        error: {
          code: 'CRON_EXECUTION_FAILED',
          message,
        },
        schedulerStatus: status,
      },
      id,
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
