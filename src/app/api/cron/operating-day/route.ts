import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  MLB_OPERATING_DAY_SCHEDULER_GRACE_MINUTES,
  MLB_OPERATING_DAY_WRITE_SCHEDULER_INTERVAL_MINUTES,
} from '@/config/mlb-operating-day-scheduler'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const VERCEL_PRIMARY_SOURCE = 'VERCEL_OPERATING_DAY_CRON_PRIMARY'
const GITHUB_FALLBACK_SOURCE = 'GITHUB_ACTIONS_PRODUCTION_OPERATING_DAY_FALLBACK'
const MANUAL_SOURCE = 'MANUAL_PROTECTED_OPERATING_DAY_DISPATCH'
const PRIMARY_LEASE_TOLERANCE_MINUTES =
  MLB_OPERATING_DAY_WRITE_SCHEDULER_INTERVAL_MINUTES + MLB_OPERATING_DAY_SCHEDULER_GRACE_MINUTES

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

function schedulerSource(request: NextRequest, dryRun: boolean) {
  if (dryRun) return 'NONE_DRY_RUN'
  if (request.nextUrl.searchParams.get('scheduler') === 'github-fallback') return GITHUB_FALLBACK_SOURCE
  if (request.nextUrl.searchParams.get('scheduler') === 'manual') return MANUAL_SOURCE
  return request.method === 'GET' ? VERCEL_PRIMARY_SOURCE : GITHUB_FALLBACK_SOURCE
}

function schedulerOwner(requestMethod: string, dryRun: boolean, source: string) {
  const writeOwner = dryRun ? 'NONE_DRY_RUN' : source
  return {
    writeOwner,
    primaryScheduler: 'VERCEL_OPERATING_DAY_CRON_PRIMARY',
    fallbackScheduler: 'GITHUB_ACTIONS_PRODUCTION_OPERATING_DAY_FALLBACK',
    runtimeOwner: 'adaptive_refresh_execution_bridge_v2',
    observerSchedulers: ['GITHUB_PRODUCTION_OPERATING_DAY_HEARTBEAT_MANUAL', 'GITHUB_OPERATING_DAY_REFRESH_MANUAL'],
    disabledSchedulers: [],
    responsibilities: {
      eventStatusPersistence: 'VERCEL_OPERATING_DAY_CRON_PRIMARY',
      resultsSync: 'VERCEL_OPERATING_DAY_CRON_PRIMARY',
      settlement: 'VERCEL_OPERATING_DAY_CRON_PRIMARY',
      learningLabels: 'SETTLEMENT_DERIVED_PREDICTION_HISTORY_LABELS',
      performanceRefresh: 'VERCEL_OPERATING_DAY_CRON_PRIMARY_AFTER_SETTLEMENT',
      dailySnapshot: 'VERCEL_OPERATING_DAY_CRON_PRIMARY_AFTER_SETTLEMENT',
      providerBudgetEnforcement: 'APPLICATION_PROVIDER_BUDGET_SERVICE',
      postgameReconciliation: 'VERCEL_OPERATING_DAY_CRON_PRIMARY',
    },
    duplicateProtection: [
      'primary_scheduler_recent_success_lease',
      'provider_action_lock',
      'operating_day_unique_date',
      'game_results_upsert',
      'prediction_status_already_settled_guard',
      'ai_performance_snapshots_idempotency_key',
    ],
    requestMethod,
    dryRun,
  }
}

function successfulSchedulerStatus(status: unknown) {
  return ['SUCCESS', 'SUCCESS_CHANGED', 'SUCCESS_NO_CHANGE', 'NOT_DUE', 'PLANNED'].includes(String(status ?? ''))
}

function ageMinutes(value: string | null) {
  if (!value) return null
  const ms = Date.now() - new Date(value).getTime()
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 60000)) : null
}

async function recentPrimarySchedulerLease() {
  const { data, error } = await supabaseAdmin
    .from('operating_day_lifecycle_events')
    .select('request_id,action,status,completed_at,created_at,metadata')
    .order('created_at', { ascending: false })
    .limit(40)
  if (error) {
    return {
      available: false,
      primaryRecent: false,
      error: error.message,
      lastPrimarySuccessAt: null,
      lastPrimaryRequestId: null,
      lastPrimaryStatus: null,
      ageMinutes: null,
    }
  }
  const primary = (data ?? []).find((row) => {
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {}
    return String(metadata.source ?? metadata.schedulerSource ?? '') === VERCEL_PRIMARY_SOURCE && successfulSchedulerStatus(row.status)
  })
  const lastPrimarySuccessAt = String(primary?.completed_at ?? primary?.created_at ?? '') || null
  const age = ageMinutes(lastPrimarySuccessAt)
  return {
    available: true,
    primaryRecent: age !== null && age <= PRIMARY_LEASE_TOLERANCE_MINUTES,
    error: null,
    lastPrimarySuccessAt,
    lastPrimaryRequestId: String(primary?.request_id ?? '') || null,
    lastPrimaryStatus: primary?.status ?? null,
    ageMinutes: age,
  }
}

function fallbackLeaseSkipResponse({
  id,
  dryRun,
  source,
  lease,
}: {
  id: string
  dryRun: boolean
  source: string
  lease: Awaited<ReturnType<typeof recentPrimarySchedulerLease>>
}) {
  const executionRunId = crypto.randomUUID()
  return apiOk(
    {
      success: true,
      status: 'SUCCESS_NO_CHANGE',
      mode: 'operating_day_consolidated_cron_execution_v2',
      delegatedMode: 'primary_scheduler_lease_v1',
      dryRun,
      source,
      steps: [
        {
          success: true,
          status: 'SUCCESS_NO_CHANGE',
          mode: 'primary_scheduler_lease_v1',
          dryRun,
          executionMode: 'fallback_skipped_primary_recent_success',
          executionRunId,
          selectedAction: 'fallback_skip',
          selectedDate: null,
          providerCallsMade: 0,
          remoteMutationsMade: 0,
          primaryScheduler: VERCEL_PRIMARY_SOURCE,
          fallbackScheduler: GITHUB_FALLBACK_SOURCE,
          lease,
        },
      ],
      selectedAction: 'fallback_skip',
      selectedDate: null,
      settlementObserved: false,
      schedulerHeartbeat: {
        success: true,
        mode: 'primary_scheduler_lease_v1',
        remoteMutationsMade: 0,
        primarySchedulerRecent: true,
        lastPrimarySuccessAt: lease.lastPrimarySuccessAt,
      },
      continuityPolicy: PLANNER_CONTINUITY_POLICY,
      actionChain: {
        actionsAttempted: 0,
        actionsCompleted: 0,
        providerActionsCompleted: 0,
        actionSequence: ['fallback_skip'],
        reasonPerAction: [{ action: 'fallback_skip', status: 'SUCCESS_NO_CHANGE', stopReason: 'PRIMARY_RECENT_SUCCESS_LEASE' }],
        stateChangePerAction: [{ action: 'fallback_skip', stateChange: 'NO_MATERIAL_CHANGE' }],
        providerCallsPerAction: [{ action: 'fallback_skip', providerCallsMade: 0 }],
        mutationsPerAction: [{ action: 'fallback_skip', remoteMutationsMade: 0 }],
        plannerRecomputedAfterEachAction: [],
        plannerRecomputations: 0,
        stopReason: 'PRIMARY_RECENT_SUCCESS_LEASE',
        nextExternalAction: null,
        durationMs: 0,
        capsReached: {
          maxActions: false,
          maxProviderActions: false,
          maxMutations: false,
          maxDuration: false,
        },
        repeatedActionGuardTriggered: false,
      },
      schedulerContract: {
        route: '/api/cron/operating-day',
        executionEngine: 'adaptive_refresh_execution_bridge_v2',
        overlapProtection: 'primary_scheduler_recent_success_lease + provider_action_lock',
        providerBudgetGuarded: true,
        refreshWindowGuarded: true,
        providerCallsMadeByDryRun: dryRun ? 0 : undefined,
        legacyAutomationShortCircuitBypassed: true,
        schedulerOwnership: schedulerOwner('POST', dryRun, source),
        dryRunDefault: 'false_for_production_continuity',
        lease,
      },
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      writes: 0,
    },
    id,
    { status: 200 }
  )
}

const PLANNER_CONTINUITY_POLICY = {
  version: 'planner_continuity_v1',
  maxActionsPerInvocation: 3,
  maxProviderActionsPerInvocation: 1,
  maxRepeatedSameAction: 1,
  maxDurationMs: 5 * 60 * 1000,
  maxMutationsPerInvocation: 500,
  safeInternalContinuationActions: ['settle'],
  providerActions: ['status_refresh', 'morning_sync', 'midday_refresh', 'final_refresh', 'sync_results'],
  stopReasons: [
    'DRY_RUN_PLAN_ONLY',
    'ACTION_FAILED',
    'NO_MATERIAL_CHANGE',
    'NO_NEXT_ACTION',
    'SECOND_PROVIDER_ACTION_REQUIRED',
    'UNSAFE_INTERNAL_CONTINUATION',
    'REPEATED_ACTION_GUARD',
    'MUTATION_CAP_REACHED',
    'DURATION_CAP_REACHED',
    'MAX_ACTIONS_REACHED',
  ],
}

function isProviderPlannerAction(action: string | null) {
  return Boolean(action && PLANNER_CONTINUITY_POLICY.providerActions.includes(action))
}

function isSafeInternalContinuationAction(action: string | null) {
  return Boolean(action && PLANNER_CONTINUITY_POLICY.safeInternalContinuationActions.includes(action))
}

function actionIdentity(action: string | null, selectedDate: unknown) {
  return `${action ?? 'none'}:${String(selectedDate ?? 'unknown')}:baseball_mlb`
}

function stateChangeForAction(record: Record<string, unknown>) {
  const status = String(record.status ?? '')
  const action = typeof record.selectedAction === 'string' ? record.selectedAction : null
  const mutations = Number(record.remoteMutationsMade ?? 0)
  if (mutations <= 0 || ['NOT_DUE', 'SUCCESS_NO_CHANGE', 'SKIPPED'].includes(status)) return 'NO_MATERIAL_CHANGE'
  if (isProviderPlannerAction(action)) return 'PRODUCT_DATA_CHANGED'
  if (isSafeInternalContinuationAction(action)) return 'INTERNAL_STATE_CHANGED'
  return 'UNKNOWN'
}

async function runPostgameContinuity(dryRun: boolean, source: string) {
  const { runAdaptiveRefresh } = await import('@/services/adaptive-refresh-orchestrator.service')
  const steps = []
  const actionTrace = []
  const startedAt = Date.now()
  const actionIdentities = new Set<string>()
  let totalProviderCalls = 0
  let totalWrites = 0
  let settlementObserved = false
  let schedulerHeartbeat: Record<string, unknown> | null = null
  let providerActionsCompleted = 0
  let plannerRecomputations = 0
  let stopReason = 'MAX_ACTIONS_REACHED'
  let nextExternalAction: string | null = null
  let repeatedActionGuardTriggered = false

  for (let step = 0; step < PLANNER_CONTINUITY_POLICY.maxActionsPerInvocation; step += 1) {
    const adaptive = await runAdaptiveRefresh({ dryRun, source })
    const record = adaptive as Record<string, unknown>
    const selectedAction = String(record.selectedAction ?? '')
    const selectedDate = record.selectedDate ?? null
    const identity = actionIdentity(selectedAction || null, selectedDate)
    const providerAction = isProviderPlannerAction(selectedAction)
    const stateChange = stateChangeForAction(record)
    steps.push(adaptive)
    totalProviderCalls += Number(record.providerCallsMade ?? 0)
    totalWrites += Number(record.remoteMutationsMade ?? 0)
    if (providerAction) providerActionsCompleted += 1
    actionIdentities.add(identity)
    if (selectedAction === 'settle') settlementObserved = true
    const status = String(record.status ?? '')
    actionTrace.push({
      step: step + 1,
      action: selectedAction || null,
      selectedDate,
      actionIdentity: identity,
      providerAction,
      providerCallsMade: Number(record.providerCallsMade ?? 0),
      remoteMutationsMade: Number(record.remoteMutationsMade ?? 0),
      stateChange,
      status,
      success: adaptive.success === true,
      plannerRecomputedAfterAction: false,
      stopReason: null as string | null,
    })
    const currentTrace = actionTrace[actionTrace.length - 1]
    if (dryRun === true) {
      stopReason = 'DRY_RUN_PLAN_ONLY'
      currentTrace.stopReason = stopReason
      break
    }
    if (adaptive.success !== true) {
      stopReason = 'ACTION_FAILED'
      currentTrace.stopReason = stopReason
      break
    }
    if (Date.now() - startedAt >= PLANNER_CONTINUITY_POLICY.maxDurationMs) {
      stopReason = 'DURATION_CAP_REACHED'
      currentTrace.stopReason = stopReason
      break
    }
    if (totalWrites >= PLANNER_CONTINUITY_POLICY.maxMutationsPerInvocation) {
      stopReason = 'MUTATION_CAP_REACHED'
      currentTrace.stopReason = stopReason
      break
    }
    if (stateChange === 'NO_MATERIAL_CHANGE' || ['NOT_DUE', 'SUCCESS_NO_CHANGE'].includes(status)) {
      stopReason = 'NO_MATERIAL_CHANGE'
      currentTrace.stopReason = stopReason
      break
    }
    const preview = await runAdaptiveRefresh({ dryRun: true, source: `${source}_CONTINUITY_PREVIEW` })
    plannerRecomputations += 1
    currentTrace.plannerRecomputedAfterAction = true
    const previewRecord = preview as Record<string, unknown>
    const nextAction = typeof previewRecord.selectedAction === 'string' ? previewRecord.selectedAction : null
    const nextDate = previewRecord.selectedDate ?? selectedDate
    const nextIdentity = actionIdentity(nextAction, nextDate)
    if (!nextAction) {
      stopReason = 'NO_NEXT_ACTION'
      currentTrace.stopReason = stopReason
      break
    }
    if (actionIdentities.has(nextIdentity)) {
      stopReason = 'REPEATED_ACTION_GUARD'
      repeatedActionGuardTriggered = true
      nextExternalAction = nextAction
      currentTrace.stopReason = stopReason
      break
    }
    if (isProviderPlannerAction(nextAction)) {
      stopReason = 'SECOND_PROVIDER_ACTION_REQUIRED'
      nextExternalAction = nextAction
      currentTrace.stopReason = stopReason
      break
    }
    if (!isSafeInternalContinuationAction(nextAction)) {
      stopReason = 'UNSAFE_INTERNAL_CONTINUATION'
      nextExternalAction = nextAction
      currentTrace.stopReason = stopReason
      break
    }
    if (providerActionsCompleted > PLANNER_CONTINUITY_POLICY.maxProviderActionsPerInvocation) {
      stopReason = 'SECOND_PROVIDER_ACTION_REQUIRED'
      nextExternalAction = nextAction
      currentTrace.stopReason = stopReason
      break
    }
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
      dryRun === false ||
      totalWrites === 0 ||
      ['NOT_DUE', 'SUCCESS_NO_CHANGE'].includes(String(last.status ?? ''))
    )

  if (shouldRecordSchedulerHeartbeat) {
    const { recordOperatingDaySchedulerHeartbeat } = await import('@/services/operating-day.service')
    const lastStep = (steps.at(-1) ?? {}) as Record<string, unknown>
    const heartbeatStatus = dryRun === true
      ? 'SUCCESS_NO_CHANGE'
      : ['SKIPPED', 'NOT_DUE', 'SUCCESS_NO_CHANGE'].includes(String(lastStep.status ?? ''))
        ? 'SUCCESS_NO_CHANGE'
        : String(lastStep.status ?? 'SUCCESS_NO_CHANGE')
    schedulerHeartbeat = await recordOperatingDaySchedulerHeartbeat({
      selectedDate: String(lastStep.selectedDate ?? ''),
      requestId: String(lastStep.executionRunId ?? ''),
      source,
      status: heartbeatStatus,
      dryRun,
      selectedAction: typeof lastStep.selectedAction === 'string' ? lastStep.selectedAction : null,
      dueSteps: Array.isArray(lastStep.dueSteps) ? lastStep.dueSteps : [],
      metadata: {
        heartbeatReason: dryRun === true
          ? 'successful_protected_dry_run_observation'
          : totalWrites > 0
            ? 'successful_protected_writer_product_mutation_observation'
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
    continuityPolicy: PLANNER_CONTINUITY_POLICY,
    actionChain: {
      actionsAttempted: actionTrace.length,
      actionsCompleted: actionTrace.filter((item) => item.success).length,
      providerActionsCompleted,
      actionSequence: actionTrace.map((item) => item.action).filter(Boolean),
      reasonPerAction: actionTrace.map((item) => ({ action: item.action, status: item.status, stopReason: item.stopReason })),
      stateChangePerAction: actionTrace.map((item) => ({ action: item.action, stateChange: item.stateChange })),
      providerCallsPerAction: actionTrace.map((item) => ({ action: item.action, providerCallsMade: item.providerCallsMade })),
      mutationsPerAction: actionTrace.map((item) => ({ action: item.action, remoteMutationsMade: item.remoteMutationsMade })),
      plannerRecomputedAfterEachAction: actionTrace.map((item) => ({ action: item.action, plannerRecomputedAfterAction: item.plannerRecomputedAfterAction })),
      plannerRecomputations,
      stopReason,
      nextExternalAction,
      durationMs: Date.now() - startedAt,
      capsReached: {
        maxActions: actionTrace.length >= PLANNER_CONTINUITY_POLICY.maxActionsPerInvocation,
        maxProviderActions: providerActionsCompleted >= PLANNER_CONTINUITY_POLICY.maxProviderActionsPerInvocation,
        maxMutations: totalWrites >= PLANNER_CONTINUITY_POLICY.maxMutationsPerInvocation,
        maxDuration: Date.now() - startedAt >= PLANNER_CONTINUITY_POLICY.maxDurationMs,
      },
      repeatedActionGuardTriggered,
    },
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
  const source = schedulerSource(request, dryRun)
  if (source === GITHUB_FALLBACK_SOURCE && dryRun === false) {
    const lease = await recentPrimarySchedulerLease()
    if (lease.primaryRecent) return fallbackLeaseSkipResponse({ id, dryRun, source, lease })
  }
  let status: Partial<CronAutomationStatus> = {}
  try {
    const adaptive = await runPostgameContinuity(
      dryRun,
      source
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
          schedulerOwnership: schedulerOwner(request.method, dryRun, source),
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
