import 'server-only'

export type FreshnessStatus = 'FRESH' | 'AGING' | 'STALE' | 'MISSING' | 'UNSUPPORTED' | 'INVALID_TIMESTAMP'

export type FreshnessClass =
  | 'schedule'
  | 'market_prices'
  | 'predictions'
  | 'recommendations'
  | 'projections'
  | 'confirmed_lineups'
  | 'current_board'
  | 'official_picks'
  | 'adaptive_refresh'
  | 'operations_status'

export type FreshnessPolicy = {
  dataClass: FreshnessClass
  thresholdMinutes: number | null
  staleMinutes: number | null
  supported: boolean
  reason: string
}

export const MLB_FRESHNESS_POLICY_REGISTRY: Record<FreshnessClass, FreshnessPolicy> = {
  schedule: { dataClass: 'schedule', thresholdMinutes: 12 * 60, staleMinutes: 24 * 60, supported: true, reason: 'Schedule should be refreshed around daily slate rollover.' },
  market_prices: { dataClass: 'market_prices', thresholdMinutes: 90, staleMinutes: 6 * 60, supported: true, reason: 'Pregame prices age quickly near first pitch.' },
  predictions: { dataClass: 'predictions', thresholdMinutes: 6 * 60, staleMinutes: 24 * 60, supported: true, reason: 'Predictions should follow current odds and feature snapshots.' },
  recommendations: { dataClass: 'recommendations', thresholdMinutes: 6 * 60, staleMinutes: 24 * 60, supported: true, reason: 'Recommendation policy is evaluated from stored prediction rows.' },
  projections: { dataClass: 'projections', thresholdMinutes: 6 * 60, staleMinutes: 24 * 60, supported: true, reason: 'Statistical projections should be generated before game start.' },
  confirmed_lineups: { dataClass: 'confirmed_lineups', thresholdMinutes: null, staleMinutes: null, supported: false, reason: 'Confirmed MLB lineup ingestion is not available under the current plan.' },
  current_board: { dataClass: 'current_board', thresholdMinutes: 90, staleMinutes: 6 * 60, supported: true, reason: 'Current Board freshness follows selected odds and prediction timestamps.' },
  official_picks: { dataClass: 'official_picks', thresholdMinutes: 6 * 60, staleMinutes: 24 * 60, supported: true, reason: 'Official pick state is policy-derived and remains zero unless gates pass.' },
  adaptive_refresh: { dataClass: 'adaptive_refresh', thresholdMinutes: 60, staleMinutes: 12 * 60, supported: true, reason: 'Adaptive refresh is a planning layer over the operating-day scheduler.' },
  operations_status: { dataClass: 'operations_status', thresholdMinutes: 30, staleMinutes: 6 * 60, supported: true, reason: 'Operations status should reflect recent stored lifecycle checks.' },
}

export function evaluateFreshness({
  dataClass,
  sourceTimestamp,
  now = new Date(),
}: {
  dataClass: FreshnessClass
  sourceTimestamp: string | null | undefined
  now?: Date
}) {
  const policy = MLB_FRESHNESS_POLICY_REGISTRY[dataClass]
  if (!policy.supported) {
    return {
      dataClass,
      ageMinutes: null,
      thresholdMinutes: policy.thresholdMinutes,
      sourceTimestamp: sourceTimestamp ?? null,
      normalizedTimestamp: null,
      status: 'UNSUPPORTED' as const,
      reason: policy.reason,
      nextRefreshDueAt: null,
    }
  }
  if (!sourceTimestamp) {
    return {
      dataClass,
      ageMinutes: null,
      thresholdMinutes: policy.thresholdMinutes,
      sourceTimestamp: null,
      normalizedTimestamp: null,
      status: 'MISSING' as const,
      reason: `${dataClass} timestamp is missing.`,
      nextRefreshDueAt: null,
    }
  }
  const parsed = new Date(sourceTimestamp)
  if (!Number.isFinite(parsed.getTime())) {
    return {
      dataClass,
      ageMinutes: null,
      thresholdMinutes: policy.thresholdMinutes,
      sourceTimestamp,
      normalizedTimestamp: null,
      status: 'INVALID_TIMESTAMP' as const,
      reason: `${dataClass} timestamp is invalid.`,
      nextRefreshDueAt: null,
    }
  }
  const ageMinutes = Math.max(0, Math.round((now.getTime() - parsed.getTime()) / 60000))
  const status: FreshnessStatus =
    policy.thresholdMinutes !== null && ageMinutes <= policy.thresholdMinutes
      ? 'FRESH'
      : policy.staleMinutes !== null && ageMinutes <= policy.staleMinutes
        ? 'AGING'
        : 'STALE'
  return {
    dataClass,
    ageMinutes,
    thresholdMinutes: policy.thresholdMinutes,
    sourceTimestamp,
    normalizedTimestamp: parsed.toISOString(),
    status,
    reason: status === 'STALE' ? `${dataClass} is older than ${policy.staleMinutes} minutes.` : policy.reason,
    nextRefreshDueAt: policy.thresholdMinutes === null ? null : new Date(parsed.getTime() + policy.thresholdMinutes * 60000).toISOString(),
  }
}

export function validateMlbFreshnessPolicyFixtures() {
  const now = new Date('2026-07-19T16:00:00.000Z')
  const fresh = evaluateFreshness({ dataClass: 'market_prices', sourceTimestamp: '2026-07-19T15:00:00.000Z', now })
  const aging = evaluateFreshness({ dataClass: 'market_prices', sourceTimestamp: '2026-07-19T13:00:00.000Z', now })
  const stale = evaluateFreshness({ dataClass: 'market_prices', sourceTimestamp: '2026-07-19T08:00:00.000Z', now })
  const missing = evaluateFreshness({ dataClass: 'predictions', sourceTimestamp: null, now })
  const unsupported = evaluateFreshness({ dataClass: 'confirmed_lineups', sourceTimestamp: null, now })
  const invalid = evaluateFreshness({ dataClass: 'schedule', sourceTimestamp: 'bad', now })
  const checks = [
    ['fresh status', fresh.status === 'FRESH'],
    ['aging status', aging.status === 'AGING'],
    ['stale status', stale.status === 'STALE'],
    ['missing status', missing.status === 'MISSING'],
    ['unsupported status', unsupported.status === 'UNSUPPORTED'],
    ['invalid timestamp status', invalid.status === 'INVALID_TIMESTAMP'],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_freshness_policy_fixtures_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
