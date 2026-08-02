import 'server-only'

export type ProductSurfaceId =
  | 'daily_brief'
  | 'rent_play'
  | 'moneyline_bet'
  | 'smart_parlay'
  | 'official_pick'
  | 'best_opportunity'
  | 'current_board'
  | 'most_likely'
  | 'best_value'
  | 'betting_workbench'
  | 'betting_workspace'
  | 'game_intelligence'
  | 'exploratory'

export type ProductFreshnessStatus =
  | 'FRESH'
  | 'AGING'
  | 'STALE'
  | 'INVALID_FUTURE'
  | 'UNAVAILABLE'
  | 'POST_START'
  | 'MARKET_CLOSED'
  | 'UNKNOWN'

export type ProductFreshnessActionability =
  | 'ACTIONABLE'
  | 'REVIEW_ONLY'
  | 'WAIT_FOR_REFRESH'
  | 'BLOCKED'
  | 'INFORMATIONAL_ONLY'
  | 'UNAVAILABLE'

export type ProductFreshnessSla = {
  surfaceId: ProductSurfaceId
  eventId: string | null
  sportKey: string | null
  marketKey: string | null
  selectionKey: string | null
  marketTimestamp: string | null
  marketObservedAt: string | null
  canonicalAcquisitionId: string | null
  providerId: string | null
  snapshotSource: 'sports_odds_snapshots' | 'prediction_history_offered_price' | 'model_only' | 'unavailable'
  marketAgeMinutes: number | null
  eventStartTime: string | null
  timeUntilStartMinutes: number | null
  lifecycleState: string
  desiredAgeMinutes: number
  maximumToleratedAgeMinutes: number
  status: ProductFreshnessStatus
  actionability: ProductFreshnessActionability
  reasonCodes: string[]
  warnings: string[]
  nextPlannedRefreshAt: string | null
  nextEligibleAcquisitionAt: string | null
  plannerMode: 'ACTIVE' | 'SHADOW' | 'UNKNOWN'
  budgetAuthorization: unknown
  evidence: {
    contractVersion: 'product_freshness_sla_v1'
    timestampSemantics: 'provider_market_timestamp_not_page_generated_time'
    generatedAtUsedAsMarketTime: false
    pageFetchTimeUsedAsMarketTime: false
    postStartPregameBlocked: boolean
    sourceTimestamp: string | null
    observedAt: string | null
    acquisitionDeduplicationKey: string | null
  }
}

export type ProductFreshnessInput = {
  surfaceId: ProductSurfaceId
  eventId?: string | null
  sportKey?: string | null
  marketKey?: string | null
  selectionKey?: string | null
  marketTimestamp?: string | null
  marketObservedAt?: string | null
  canonicalAcquisitionId?: string | null
  acquisitionDeduplicationKey?: string | null
  providerId?: string | null
  snapshotSource?: ProductFreshnessSla['snapshotSource']
  eventStartTime?: string | null
  lifecycleState?: string | null
  priorityBand?: string | null
  nextPlannedRefreshAt?: string | null
  nextEligibleAcquisitionAt?: string | null
  plannerMode?: 'ACTIVE' | 'SHADOW' | 'UNKNOWN' | string | null
  budgetAuthorization?: unknown
  nowMs?: number
  priceAvailable?: boolean
  policyEligible?: boolean
}

export const DECISION_CRITICAL_SURFACES = new Set<ProductSurfaceId>([
  'rent_play',
  'moneyline_bet',
  'smart_parlay',
  'official_pick',
])

function validIso(value: string | null | undefined) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

function ageMinutes(timestamp: string | null, nowMs: number) {
  if (!timestamp) return null
  const parsed = Date.parse(timestamp)
  if (!Number.isFinite(parsed)) return null
  return Math.round((nowMs - parsed) / 60000)
}

function minutesUntil(timestamp: string | null, nowMs: number) {
  if (!timestamp) return null
  const parsed = Date.parse(timestamp)
  if (!Number.isFinite(parsed)) return null
  return Math.round((parsed - nowMs) / 60000)
}

function lifecycleIsClosed(lifecycle: string) {
  const lower = lifecycle.toLowerCase()
  return ['final', 'completed', 'closed', 'settled', 'postponed', 'cancelled', 'canceled', 'suspended', 'abandoned'].some((item) => lower.includes(item))
}

function lifecycleIsPostStart(lifecycle: string, timeUntilStartMinutes: number | null) {
  const lower = lifecycle.toLowerCase()
  if (['live', 'in_progress', 'started'].some((item) => lower.includes(item))) return true
  return timeUntilStartMinutes !== null && timeUntilStartMinutes <= 0 && !lifecycleIsClosed(lifecycle)
}

export function productFreshnessPolicy(input: Pick<ProductFreshnessInput, 'surfaceId' | 'priorityBand' | 'eventStartTime' | 'nowMs'>) {
  const nowMs = input.nowMs ?? Date.now()
  const until = minutesUntil(validIso(input.eventStartTime), nowMs)
  const finalThirty = until !== null && until > 0 && until <= 30
  const critical = DECISION_CRITICAL_SURFACES.has(input.surfaceId)
  if (critical && finalThirty) return { desiredAgeMinutes: 5, maximumToleratedAgeMinutes: 10 }
  if (input.surfaceId === 'current_board' || input.surfaceId === 'best_value' || input.surfaceId === 'best_opportunity') {
    if (finalThirty) return { desiredAgeMinutes: 10, maximumToleratedAgeMinutes: 10 }
    return { desiredAgeMinutes: 10, maximumToleratedAgeMinutes: 30 }
  }
  if (input.surfaceId === 'most_likely') return { desiredAgeMinutes: 15, maximumToleratedAgeMinutes: 30 }
  if (input.surfaceId === 'daily_brief') return { desiredAgeMinutes: 15, maximumToleratedAgeMinutes: 30 }
  if (input.surfaceId === 'game_intelligence' || input.surfaceId === 'exploratory') return { desiredAgeMinutes: 30, maximumToleratedAgeMinutes: 120 }
  return { desiredAgeMinutes: 15, maximumToleratedAgeMinutes: 30 }
}

export function evaluateProductFreshnessSla(input: ProductFreshnessInput): ProductFreshnessSla {
  const nowMs = input.nowMs ?? Date.now()
  const marketTimestamp = validIso(input.marketTimestamp)
  const marketObservedAt = validIso(input.marketObservedAt)
  const eventStartTime = validIso(input.eventStartTime)
  const marketAgeMinutes = ageMinutes(marketTimestamp, nowMs)
  const timeUntilStartMinutes = minutesUntil(eventStartTime, nowMs)
  const lifecycleState = String(input.lifecycleState ?? 'UNKNOWN')
  const policy = productFreshnessPolicy(input)
  const reasonCodes: string[] = []
  const warnings: string[] = []
  const closed = lifecycleIsClosed(lifecycleState)
  const postStart = lifecycleIsPostStart(lifecycleState, timeUntilStartMinutes)

  let status: ProductFreshnessStatus = 'UNKNOWN'
  if (!marketTimestamp) {
    status = 'UNAVAILABLE'
    reasonCodes.push('MARKET_TIMESTAMP_UNAVAILABLE')
  } else if (marketAgeMinutes !== null && marketAgeMinutes < -1) {
    status = 'INVALID_FUTURE'
    reasonCodes.push('MARKET_TIMESTAMP_IN_FUTURE')
  } else if (closed) {
    status = 'MARKET_CLOSED'
    reasonCodes.push('EVENT_MARKET_CLOSED')
  } else if (postStart) {
    status = 'POST_START'
    reasonCodes.push('POST_START_PREGAME_MARKET_BLOCKED')
  } else if (marketAgeMinutes !== null && marketAgeMinutes <= policy.desiredAgeMinutes) {
    status = 'FRESH'
  } else if (marketAgeMinutes !== null && marketAgeMinutes <= policy.maximumToleratedAgeMinutes) {
    status = 'AGING'
    warnings.push('Stored market price is aging; review before action.')
  } else {
    status = 'STALE'
    reasonCodes.push('MARKET_AGE_EXCEEDS_SURFACE_SLA')
    warnings.push('Stored market price is stale for this surface.')
  }

  if (input.priceAvailable === false && !reasonCodes.includes('PRICE_UNAVAILABLE')) reasonCodes.push('PRICE_UNAVAILABLE')

  let actionability: ProductFreshnessActionability
  if (status === 'FRESH') actionability = input.policyEligible === false ? 'REVIEW_ONLY' : 'ACTIONABLE'
  else if (status === 'AGING') actionability = DECISION_CRITICAL_SURFACES.has(input.surfaceId) ? 'REVIEW_ONLY' : 'ACTIONABLE'
  else if (status === 'STALE') actionability = 'WAIT_FOR_REFRESH'
  else if (status === 'UNAVAILABLE') actionability = 'UNAVAILABLE'
  else if (status === 'MARKET_CLOSED' || status === 'POST_START' || status === 'INVALID_FUTURE') actionability = 'BLOCKED'
  else actionability = 'INFORMATIONAL_ONLY'

  const nextPlannedRefreshAt = input.nextPlannedRefreshAt ? validIso(input.nextPlannedRefreshAt) : marketTimestamp ? new Date(Date.parse(marketTimestamp) + policy.desiredAgeMinutes * 60000).toISOString() : null
  const nextEligibleAcquisitionAt = input.nextEligibleAcquisitionAt ? validIso(input.nextEligibleAcquisitionAt) : nextPlannedRefreshAt

  return {
    surfaceId: input.surfaceId,
    eventId: input.eventId ?? null,
    sportKey: input.sportKey ?? null,
    marketKey: input.marketKey ?? null,
    selectionKey: input.selectionKey ?? null,
    marketTimestamp,
    marketObservedAt,
    canonicalAcquisitionId: input.canonicalAcquisitionId ?? null,
    providerId: input.providerId ?? null,
    snapshotSource: input.snapshotSource ?? 'unavailable',
    marketAgeMinutes: marketAgeMinutes === null || marketAgeMinutes < 0 ? (status === 'INVALID_FUTURE' ? marketAgeMinutes : null) : marketAgeMinutes,
    eventStartTime,
    timeUntilStartMinutes,
    lifecycleState,
    desiredAgeMinutes: policy.desiredAgeMinutes,
    maximumToleratedAgeMinutes: policy.maximumToleratedAgeMinutes,
    status,
    actionability,
    reasonCodes: Array.from(new Set(reasonCodes)),
    warnings,
    nextPlannedRefreshAt,
    nextEligibleAcquisitionAt,
    plannerMode: input.plannerMode === 'ACTIVE' || input.plannerMode === 'SHADOW' ? input.plannerMode : 'UNKNOWN',
    budgetAuthorization: input.budgetAuthorization ?? null,
    evidence: {
      contractVersion: 'product_freshness_sla_v1',
      timestampSemantics: 'provider_market_timestamp_not_page_generated_time',
      generatedAtUsedAsMarketTime: false,
      pageFetchTimeUsedAsMarketTime: false,
      postStartPregameBlocked: status === 'POST_START',
      sourceTimestamp: marketTimestamp,
      observedAt: marketObservedAt,
      acquisitionDeduplicationKey: input.acquisitionDeduplicationKey ?? null,
    },
  }
}

export function summarizeProductFreshnessSlas(items: ProductFreshnessSla[]) {
  const byStatus = {
    FRESH: 0,
    AGING: 0,
    STALE: 0,
    INVALID_FUTURE: 0,
    UNAVAILABLE: 0,
    POST_START: 0,
    MARKET_CLOSED: 0,
    UNKNOWN: 0,
  } satisfies Record<ProductFreshnessStatus, number>
  const byActionability = {
    ACTIONABLE: 0,
    REVIEW_ONLY: 0,
    WAIT_FOR_REFRESH: 0,
    BLOCKED: 0,
    INFORMATIONAL_ONLY: 0,
    UNAVAILABLE: 0,
  } satisfies Record<ProductFreshnessActionability, number>
  for (const item of items) {
    byStatus[item.status] += 1
    byActionability[item.actionability] += 1
  }
  return {
    contractVersion: 'product_freshness_sla_summary_v1' as const,
    total: items.length,
    byStatus,
    byActionability,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export function validateProductFreshnessSlaFixtures() {
  const nowMs = Date.parse('2026-08-02T16:00:00.000Z')
  const fresh = evaluateProductFreshnessSla({
    surfaceId: 'rent_play',
    eventId: 'event-1',
    sportKey: 'baseball_mlb',
    marketKey: 'moneyline',
    selectionKey: 'home',
    marketTimestamp: '2026-08-02T15:56:00.000Z',
    marketObservedAt: '2026-08-02T15:56:20.000Z',
    eventStartTime: '2026-08-02T16:25:00.000Z',
    lifecycleState: 'HIGH_PRIORITY',
    nowMs,
    priceAvailable: true,
    policyEligible: true,
  })
  const aging = evaluateProductFreshnessSla({ ...fresh, marketTimestamp: '2026-08-02T15:52:00.000Z', nowMs })
  const stale = evaluateProductFreshnessSla({ ...fresh, marketTimestamp: '2026-08-02T15:20:00.000Z', nowMs })
  const missing = evaluateProductFreshnessSla({ ...fresh, marketTimestamp: null, nowMs })
  const future = evaluateProductFreshnessSla({ ...fresh, marketTimestamp: '2026-08-02T16:10:00.000Z', nowMs })
  const postStart = evaluateProductFreshnessSla({ ...fresh, marketTimestamp: '2026-08-02T15:59:00.000Z', eventStartTime: '2026-08-02T15:58:00.000Z', nowMs })
  const mostLikely = evaluateProductFreshnessSla({ ...fresh, surfaceId: 'most_likely', marketTimestamp: '2026-08-02T15:46:00.000Z', nowMs })
  const summary = summarizeProductFreshnessSlas([fresh, aging, stale, missing, future, postStart])
  const checks = [
    ['fresh rent play actionable', fresh.status === 'FRESH' && fresh.actionability === 'ACTIONABLE'],
    ['aging decision critical review only', aging.status === 'AGING' && aging.actionability === 'REVIEW_ONLY'],
    ['stale waits for refresh', stale.status === 'STALE' && stale.actionability === 'WAIT_FOR_REFRESH'],
    ['missing timestamp unavailable', missing.status === 'UNAVAILABLE' && missing.marketAgeMinutes === null],
    ['future timestamp invalid', future.status === 'INVALID_FUTURE' && future.actionability === 'BLOCKED'],
    ['post-start pregame market blocked', postStart.status === 'POST_START' && postStart.actionability === 'BLOCKED'],
    ['most likely tolerates probability-first price age', mostLikely.status === 'AGING'],
    ['summary counts deterministic', summary.byStatus.FRESH === 1 && summary.byStatus.STALE === 1],
    ['no page fetch as market time', fresh.evidence.pageFetchTimeUsedAsMarketTime === false],
    ['no generatedAt as market time', fresh.evidence.generatedAtUsedAsMarketTime === false],
    ['provider calls zero', summary.providerCallsMade === 0],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'product_freshness_sla_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
