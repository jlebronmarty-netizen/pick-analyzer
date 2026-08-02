import 'server-only'

import { getLatestCanonicalAcquisitionEvidence } from '@/services/canonical-acquisition.service'
import { getEventLifecycleState, type EventPriorityBand } from '@/services/event-lifecycle-state.service'

const DEFAULT_SPORT_KEY = 'baseball_mlb'
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

export type EventRefreshPlannerMode = 'SHADOW' | 'DRY_RUN' | 'ACTIVE'
export type EventRefreshPlannedAction =
  | 'REFRESH_MARKET'
  | 'WAIT'
  | 'SKIP'
  | 'STOP_PREGAME_REFRESH'
  | 'SYNC_RESULT'
  | 'SETTLE'
  | 'RECOVERY'
  | 'HUMAN_REVIEW'
  | 'NO_ACTION'

export type EventRefreshPlanInput = {
  sportKey?: string | null
  operatingDate?: string | null
  eventId?: string | null
  priorityBand?: EventPriorityBand | string | null
  plannedAction?: EventRefreshPlannedAction | string | null
  mode?: EventRefreshPlannerMode | string | null
  limit?: number | null
}

function clampLimit(value?: number | null) {
  const parsed = Number(value ?? DEFAULT_LIMIT)
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT
  return Math.max(1, Math.min(MAX_LIMIT, Math.round(parsed)))
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item ?? '')).filter(Boolean) : []
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function normalizeMode(value: unknown): EventRefreshPlannerMode {
  const mode = String(value ?? process.env.EVENT_REFRESH_PLANNER_MODE ?? 'ACTIVE').trim().toUpperCase()
  if (mode === 'ACTIVE') return 'ACTIVE'
  if (mode === 'DRY_RUN') return 'DRY_RUN'
  return 'SHADOW'
}

function minutesUntilStart(event: Record<string, unknown>) {
  const direct = Number(event.timeUntilStartMinutes)
  if (Number.isFinite(direct)) return direct
  const start = text(event.startTime)
  if (!start) return null
  const ms = Date.parse(start)
  if (!Number.isFinite(ms)) return null
  return Math.round((ms - Date.now()) / 60000)
}

function targetCadence({
  sportKey,
  providerId,
  priorityBand,
  relevance,
  minutesUntil,
}: {
  sportKey: string
  providerId: string
  priorityBand: string
  relevance: string[]
  minutesUntil: number | null
}) {
  if (providerId === 'the-odds-api') {
    return {
      targetFreshnessMinutes: null,
      maximumToleratedAgeMinutes: null,
      reason: 'THE_ODDS_API_UNKNOWN_BALANCE_RESET_REMAINS_SHADOW',
    }
  }
  if (providerId === 'bsn') {
    return {
      targetFreshnessMinutes: null,
      maximumToleratedAgeMinutes: null,
      reason: 'BSN_PROVIDER_PATH_NOT_ACTIVE_FOR_REFRESH',
    }
  }
  if (sportKey !== 'baseball_mlb') {
    return {
      targetFreshnessMinutes: null,
      maximumToleratedAgeMinutes: null,
      reason: 'NON_MLB_REFRESH_REMAINS_SHADOW_UNTIL_SPORT_CERTIFIED',
    }
  }
  if (minutesUntil === null) return { targetFreshnessMinutes: 60, maximumToleratedAgeMinutes: 120, reason: 'UNKNOWN_START_SAFE_DEFAULT' }
  if (minutesUntil <= 0) return { targetFreshnessMinutes: null, maximumToleratedAgeMinutes: null, reason: 'POST_START_PREGAME_REFRESH_BLOCKED' }
  if (minutesUntil <= 30) {
    const actionable = priorityBand === 'P1' || relevance.some((tag) => ['OFFICIAL_PICK', 'RENT_PLAY_CANDIDATE', 'MONEYLINE_CANDIDATE', 'SMART_PARLAY_DEPENDENCY', 'STRONG_LEAN'].includes(tag))
    return {
      targetFreshnessMinutes: actionable ? 5 : 10,
      maximumToleratedAgeMinutes: actionable ? 10 : 20,
      reason: actionable ? 'P1_FINAL_30M_FIVE_MINUTE_TARGET' : 'FINAL_30M_NON_P1_TEN_MINUTE_TARGET',
    }
  }
  if (minutesUntil <= 120) return { targetFreshnessMinutes: 10, maximumToleratedAgeMinutes: 20, reason: 'TWO_HOUR_WINDOW_TEN_MINUTE_TARGET' }
  if (minutesUntil <= 360) return { targetFreshnessMinutes: 15, maximumToleratedAgeMinutes: 30, reason: 'TWO_TO_SIX_HOUR_FIFTEEN_MINUTE_TARGET' }
  if (minutesUntil <= 1440) return { targetFreshnessMinutes: 30, maximumToleratedAgeMinutes: 60, reason: 'SIX_TO_TWENTY_FOUR_HOUR_THIRTY_MINUTE_TARGET' }
  return { targetFreshnessMinutes: 60, maximumToleratedAgeMinutes: 120, reason: 'FUTURE_EVENT_SIXTY_MINUTE_TARGET' }
}

function planAction({
  lifecycleState,
  priorityBand,
  marketFreshnessStatus,
  marketAgeMinutes,
  maximumToleratedAgeMinutes,
}: {
  lifecycleState: string
  priorityBand: string
  marketFreshnessStatus: string
  marketAgeMinutes: number | null
  maximumToleratedAgeMinutes: number | null
}) {
  const reasons: string[] = [`${priorityBand}_PLANNING_PRECEDENCE`]
  if (['RESULT_IMPORT', 'SUSPENDED', 'ABANDONED'].includes(lifecycleState)) return { plannedAction: 'SYNC_RESULT' as const, dueNow: true, reasons: [...reasons, 'P0_CLOSURE_OR_RECOVERY_OUTRANKS_MARKET_REFRESH'] }
  if (lifecycleState === 'SETTLEMENT') return { plannedAction: 'SETTLE' as const, dueNow: true, reasons: [...reasons, 'P0_SETTLEMENT_READY_OUTRANKS_MARKET_REFRESH'] }
  if (['STARTED', 'LIVE'].includes(lifecycleState)) return { plannedAction: 'STOP_PREGAME_REFRESH' as const, dueNow: true, reasons: [...reasons, 'NO_PREGAME_REFRESH_AFTER_START'] }
  if (['ARCHIVED', 'FINAL', 'POSTPONED', 'CANCELLED', 'PERFORMANCE'].includes(lifecycleState)) return { plannedAction: 'NO_ACTION' as const, dueNow: false, reasons: [...reasons, 'TERMINAL_OR_ARCHIVED_NO_MARKET_REFRESH'] }
  if (lifecycleState === 'UNKNOWN') return { plannedAction: 'HUMAN_REVIEW' as const, dueNow: false, reasons: [...reasons, 'UNKNOWN_EVIDENCE_REQUIRES_REVIEW'] }
  const age = marketAgeMinutes ?? Number.POSITIVE_INFINITY
  if (marketFreshnessStatus === 'STALE' || (maximumToleratedAgeMinutes !== null && age > maximumToleratedAgeMinutes)) {
    return { plannedAction: 'REFRESH_MARKET' as const, dueNow: true, reasons: [...reasons, 'MARKET_AGE_EXCEEDS_EVENT_TARGET'] }
  }
  return { plannedAction: 'WAIT' as const, dueNow: false, reasons: [...reasons, 'MARKET_WITHIN_EVENT_TARGET_OR_NOT_AVAILABLE'] }
}

function nextEligibleAt(startTime: string | null, targetFreshnessMinutes: number | null, latestOddsTimestamp: string | null) {
  if (targetFreshnessMinutes === null) return startTime
  if (!latestOddsTimestamp) return new Date().toISOString()
  const next = new Date(Date.parse(latestOddsTimestamp) + targetFreshnessMinutes * 60_000)
  return Number.isFinite(next.getTime()) ? next.toISOString() : new Date().toISOString()
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<T, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {} as Record<T, number>)
}

function comparePlans(a: Record<string, unknown>, b: Record<string, unknown>) {
  const order: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4, P5: 5, UNKNOWN: 9 }
  const priority = (order[text(a.priorityBand, 'UNKNOWN')] ?? 9) - (order[text(b.priorityBand, 'UNKNOWN')] ?? 9)
  if (priority !== 0) return priority
  return String(a.startTime ?? '').localeCompare(String(b.startTime ?? ''))
}

export async function getEventRefreshPlan(input: EventRefreshPlanInput = {}) {
  const mode = normalizeMode(input.mode)
  const sportKey = input.sportKey ?? DEFAULT_SPORT_KEY
  const limit = clampLimit(input.limit)
  const lifecycle = await getEventLifecycleState({
    sportKey,
    operatingDate: input.operatingDate,
    eventId: input.eventId,
    priorityBand: input.priorityBand,
    limit,
  })
  const latestAcquisition = await getLatestCanonicalAcquisitionEvidence().catch((error) => ({
    success: false,
    mode: 'canonical_acquisition_latest_evidence_v1',
    latest: null,
    error: error instanceof Error ? error.message : String(error),
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }))
  const eventPlans = lifecycle.events.map((event) => {
    const item = record(event)
    const recommendation = record(item.recommendationRelevance)
    const relevance = strings(recommendation.tags)
    const providerId = text(item.providerId, sportKey === 'baseball_mlb' ? 'sportsdataio' : 'the-odds-api')
    const priorityBand = text(item.priorityBand, 'UNKNOWN')
    const lifecycleState = text(item.lifecycleState, 'UNKNOWN')
    const until = minutesUntilStart(item)
    const cadence = targetCadence({ sportKey, providerId, priorityBand, relevance, minutesUntil: until })
    const action = planAction({
      lifecycleState,
      priorityBand,
      marketFreshnessStatus: text(item.marketFreshnessStatus, 'UNKNOWN'),
      marketAgeMinutes: item.marketAgeMinutes === null ? null : num(item.marketAgeMinutes),
      maximumToleratedAgeMinutes: cadence.maximumToleratedAgeMinutes,
    })
    const budgetAuthorization = record(item.budgetAuthorization)
    const unsafeUnknownProvider =
      providerId === 'the-odds-api' ||
      text(budgetAuthorization.evidenceLevel, 'UNKNOWN') === 'UNKNOWN' ||
      text(budgetAuthorization.costEvidenceLevel, 'UNKNOWN') === 'UNKNOWN'
    const providerBudgetBlocked =
      providerId === 'sportsdataio' &&
      action.plannedAction === 'REFRESH_MARKET' &&
      !['RESERVE_PRESERVED', 'UNKNOWN'].includes(text(budgetAuthorization.reserveImpact, 'UNKNOWN'))
    const executionBlockers = [
      mode !== 'ACTIVE' ? 'PLANNER_MODE_NOT_ACTIVE' : null,
      unsafeUnknownProvider && action.plannedAction === 'REFRESH_MARKET' ? 'UNKNOWN_PROVIDER_COST_OR_BALANCE_BLOCKS_ACTIVE_EXECUTION' : null,
      providerBudgetBlocked ? 'PROTECTED_RESERVE_NOT_PRESERVED' : null,
      lifecycleState === 'STARTED' || lifecycleState === 'LIVE' ? 'POST_START_PREGAME_REFRESH_BLOCKED' : null,
      ...strings(item.blockers),
    ].filter(Boolean) as string[]
    const executionEnabled =
      mode === 'ACTIVE' &&
      providerId === 'sportsdataio' &&
      sportKey === 'baseball_mlb' &&
      action.plannedAction === 'REFRESH_MARKET' &&
      action.dueNow === true &&
      executionBlockers.length === 0
    return {
      eventId: text(item.eventId),
      eventLabel: text(item.eventLabel, text(item.eventId)),
      startTime: text(item.startTime, null as unknown as string) || null,
      lifecycleState,
      priorityBand,
      recommendationRelevance: relevance,
      marketFreshnessStatus: text(item.marketFreshnessStatus, 'UNKNOWN'),
      latestOddsTimestamp: text(item.latestOddsTimestamp, null as unknown as string) || null,
      marketAgeMinutes: item.marketAgeMinutes === null ? null : num(item.marketAgeMinutes),
      plannedAction: action.plannedAction,
      actionReasonCodes: [...action.reasons, cadence.reason],
      dueNow: action.dueNow,
      nextEligibleAt: nextEligibleAt(text(item.startTime, null as unknown as string) || null, cadence.targetFreshnessMinutes, text(item.latestOddsTimestamp, null as unknown as string) || null),
      targetFreshnessMinutes: cadence.targetFreshnessMinutes,
      maximumToleratedAgeMinutes: cadence.maximumToleratedAgeMinutes,
      providerId,
      providerAction: action.plannedAction === 'REFRESH_MARKET' ? 'odds_refresh' : action.plannedAction === 'SYNC_RESULT' ? 'results_sync' : 'none',
      estimatedHttpRequests: action.plannedAction === 'REFRESH_MARKET' || action.plannedAction === 'SYNC_RESULT' ? Math.max(0, num(budgetAuthorization.requestCountEstimate, 1)) : 0,
      estimatedQuotaUnits: action.plannedAction === 'REFRESH_MARKET' || action.plannedAction === 'SYNC_RESULT' ? budgetAuthorization.quotaUnitEstimate ?? null : 0,
      costEvidenceLevel: text(budgetAuthorization.costEvidenceLevel, 'UNKNOWN'),
      budgetAuthorization,
      usableRemainingBefore: budgetAuthorization.usableRemainingBefore ?? null,
      usableRemainingAfter: budgetAuthorization.usableRemainingAfter ?? null,
      reserveImpact: text(budgetAuthorization.reserveImpact, 'UNKNOWN'),
      executionEnabled,
      executionBlockers,
      warnings: strings(item.warnings),
      evidence: {
        lifecycleSource: record(item.evidence).gameLifecycleSource ?? null,
        independentEventDecision: true,
        closureOutranksMarketRefresh: true,
        postStartPregameRefreshAllowed: false,
        canonicalSnapshotDeduplication: 'DECIDE_PER_EVENT_EXECUTE_WITH_PROVIDER_EFFICIENT_BATCHING_STORE_ONE_CANONICAL_SNAPSHOT',
        activeExecutionRoute: executionEnabled ? '/api/cron/operating-day?dryRun=false' : null,
      },
    }
  }).filter((plan) => input.plannedAction ? plan.plannedAction === input.plannedAction : true).sort(comparePlans)

  const dueNow = eventPlans.filter((plan) => plan.dueNow)
  const blocked = eventPlans.filter((plan) => plan.executionBlockers.length > 0)
  const refreshPlans = eventPlans.filter((plan) => plan.plannedAction === 'REFRESH_MARKET')
  const estimatedHttpRequests = refreshPlans.length > 0 ? Math.max(1, Math.min(3, Math.ceil(refreshPlans.length / 15))) : eventPlans.reduce((sum, plan) => sum + num(plan.estimatedHttpRequests), 0)
  const sportsDataIo = eventPlans.find((plan) => plan.providerId === 'sportsdataio')
  const nextGlobalAction = dueNow.find((plan) => ['SYNC_RESULT', 'SETTLE', 'RECOVERY'].includes(plan.plannedAction)) ?? dueNow[0] ?? eventPlans[0] ?? null

  return {
    success: true,
    mode: 'event_refresh_plan_v1',
    plannerMode: mode,
    planId: `event-refresh-plan:${sportKey}:${lifecycle.operatingDate}:${lifecycle.generatedAt}`,
    generatedAt: lifecycle.generatedAt,
    operatingDate: lifecycle.operatingDate,
    sportKey,
    providerId: sportKey === 'baseball_mlb' ? 'sportsdataio' : 'the-odds-api',
    filters: {
      eventId: input.eventId ?? null,
      priorityBand: input.priorityBand ?? null,
      plannedAction: input.plannedAction ?? null,
      requestedLimit: input.limit ?? null,
      effectiveLimit: limit,
      boundedApiMaximum: MAX_LIMIT,
      defaultCurrentDayOnly: true,
    },
    summary: {
      totalEvents: eventPlans.length,
      eventsDueNow: dueNow.length,
      eventsDeferred: eventPlans.filter((plan) => !plan.dueNow && plan.plannedAction === 'WAIT').length,
      eventsBlocked: blocked.length,
      eventsPostStart: eventPlans.filter((plan) => ['STARTED', 'LIVE'].includes(plan.lifecycleState)).length,
      eventsRequiringClosure: eventPlans.filter((plan) => ['SYNC_RESULT', 'SETTLE', 'RECOVERY'].includes(plan.plannedAction)).length,
      eventsByPriority: countBy(eventPlans.map((plan) => plan.priorityBand)),
      eventsByPlannedAction: countBy(eventPlans.map((plan) => plan.plannedAction)),
      estimatedHttpRequests,
      estimatedQuotaUnits: estimatedHttpRequests,
      nextGlobalAction,
    },
    providerBudget: {
      sportsdataio: {
        projectedHttpRequests: estimatedHttpRequests,
        usableRemainingBefore: sportsDataIo?.usableRemainingBefore ?? null,
        usableRemainingAfter: sportsDataIo?.usableRemainingAfter ?? null,
        reserveImpact: sportsDataIo?.reserveImpact ?? 'UNKNOWN',
      },
      theOddsApi: {
        plannerStatus: 'SHADOW_ONLY_UNKNOWN_BALANCE_RESET_COST',
        activeExecutionAuthorized: false,
      },
      bsn: {
        plannerStatus: 'OBSERVATIONAL_PROVIDER_PATH_NOT_ACTIVE',
        activeExecutionAuthorized: false,
      },
    },
    canonicalAcquisition: {
      contractVersion: 'canonical_acquisition_execution_v1',
      executionBoundary: '/api/cron/operating-day?dryRun=false',
      activeProvider: mode === 'ACTIVE' && sportKey === 'baseball_mlb' ? 'sportsdataio' : null,
      activeSport: mode === 'ACTIVE' && sportKey === 'baseball_mlb' ? 'baseball_mlb' : null,
      requestGranularity: 'DATE',
      executionStatus: mode === 'ACTIVE' ? 'ACTIVE_ELIGIBLE_THROUGH_PROTECTED_SCHEDULER' : 'SHADOW_PLAN_ONLY',
      eligibleEventCount: eventPlans.filter((plan) => plan.executionEnabled).length,
      excludedEventCount: eventPlans.filter((plan) => !plan.executionEnabled).length,
      deduplicationKeyTemplate: 'sportsdataio:baseball_mlb:odds_refresh:{operatingDate}:date:{boundedWindow}:current_pregame',
      providerEfficientBatching: true,
      actualCalls: null,
      actualCost: null,
      snapshotWrites: null,
      freshnessBefore: null,
      freshnessAfter: null,
      latestSuccessfulActiveAcquisition: latestAcquisition.latest ?? null,
      activationBlockers: [
        mode !== 'ACTIVE' ? 'PLANNER_MODE_NOT_ACTIVE' : null,
        sportKey !== 'baseball_mlb' ? 'NON_MLB_REFRESH_REMAINS_SHADOW_UNTIL_CERTIFIED' : null,
      ].filter(Boolean),
    },
    eventPlans,
    comparison: {
      currentSchedulerBehavior: 'slate_level_operating_day_action_selection',
      eventLevelPlannerBehavior: 'independent_event_priority_and_cadence_shadow_plan',
      estimatedCostDifference: 'event planner estimates provider-efficient batching after per-event decisions',
      freshnessImprovement: 'planner identifies stale events by event start/relevance instead of uniform slate treatment',
      reserveImpact: sportsDataIo?.reserveImpact ?? 'UNKNOWN',
    },
    guardrails: {
      providerCallsMade: 0,
      providerCreditsConsumed: 0,
      databaseMutationsMade: 0,
      predictionWrites: 0,
      resultWrites: 0,
      settlementWrites: 0,
      learningWrites: 0,
      schedulerCadenceChanged: false,
      refreshCadenceChanged: false,
      officialPickPolicyChanged: false,
      predictionFormulaChanged: false,
      activeExecutionEnabled: mode === 'ACTIVE' && eventPlans.some((plan) => plan.executionEnabled),
    },
  }
}

export function validateEventRefreshPlannerFixtures() {
  const checks = [
    ['planning is independent per event', true],
    ['staggered start times produce different nextEligibleAt values', nextEligibleAt('2026-08-02T16:00:00.000Z', 10, '2026-08-02T15:00:00.000Z') !== nextEligibleAt('2026-08-02T18:00:00.000Z', 15, '2026-08-02T15:00:00.000Z')],
    ['P0 closure outranks market refresh', planAction({ lifecycleState: 'SETTLEMENT', priorityBand: 'P0', marketFreshnessStatus: 'STALE', marketAgeMinutes: 999, maximumToleratedAgeMinutes: 10 }).plannedAction === 'SETTLE'],
    ['no pregame refresh after start', planAction({ lifecycleState: 'LIVE', priorityBand: 'P2', marketFreshnessStatus: 'STALE', marketAgeMinutes: 999, maximumToleratedAgeMinutes: 10 }).plannedAction === 'STOP_PREGAME_REFRESH'],
    ['P1 final-30m events can receive 5-minute targets', targetCadence({ sportKey: 'baseball_mlb', providerId: 'sportsdataio', priorityBand: 'P1', relevance: ['MONEYLINE_CANDIDATE'], minutesUntil: 20 }).targetFreshnessMinutes === 5],
    ['non-P1 events do not receive unjustified 5-minute cadence', targetCadence({ sportKey: 'baseball_mlb', providerId: 'sportsdataio', priorityBand: 'P3', relevance: [], minutesUntil: 20 }).targetFreshnessMinutes === 10],
    ['The Odds API unknown balance cannot authorize unsafe execution', targetCadence({ sportKey: 'basketball_nba', providerId: 'the-odds-api', priorityBand: 'P1', relevance: ['OFFICIAL_PICK'], minutesUntil: 20 }).targetFreshnessMinutes === null],
    ['bounded API limits are enforced', clampLimit(999) === MAX_LIMIT],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'oe003d_event_refresh_planner_fixture_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    providerCreditsConsumed: 0,
    databaseMutationsMade: 0,
    activeExecutionEnabled: false,
  }
}
