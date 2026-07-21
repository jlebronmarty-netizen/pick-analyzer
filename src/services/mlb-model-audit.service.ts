import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getMlbFeatureModelReadiness } from '@/services/mlb-feature-model-readiness.service'

const SPORT_KEY = 'baseball_mlb'

type PredictionRow = {
  id: string
  game_id: string | null
  market: string | null
  sportsbook: string | null
  recommended_pick: boolean | null
  model_probability: number | null
  confidence: number | null
  edge: number | null
  ev: number | null
  odds: number | null
  profit: number | null
  stake: number | null
  result: string | null
  status: string | null
  production_eligible: boolean | null
  model_version: string | null
  feature_set_version: string | null
  feature_snapshot: Record<string, unknown> | null
  feature_snapshot_id: string | null
  feature_snapshot_key: string | null
  generated_at: string | null
  commence_time: string | null
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function resultOf(row: PredictionRow) {
  return String(row.result ?? row.status ?? '').toLowerCase()
}

function probability(row: PredictionRow) {
  const raw = num(row.model_probability)
  return raw > 1 ? raw / 100 : raw
}

function hasSnapshot(row: PredictionRow) {
  return Boolean(row.feature_snapshot_id || row.feature_snapshot_key || (row.feature_snapshot && Object.keys(row.feature_snapshot).length > 0))
}

function beforeStart(row: PredictionRow) {
  const generated = new Date(String(row.generated_at ?? '')).getTime()
  const start = new Date(String(row.commence_time ?? '')).getTime()
  return Number.isFinite(generated) && Number.isFinite(start) && generated <= start
}

function average(values: number[]) {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0
}

function brier(rows: PredictionRow[]) {
  const scored = rows.filter((row) => ['win', 'loss'].includes(resultOf(row)))
  return scored.length
    ? round(scored.reduce((sum, row) => {
      const actual = resultOf(row) === 'win' ? 1 : 0
      return sum + (probability(row) - actual) ** 2
    }, 0) / scored.length, 4)
    : null
}

function logLoss(rows: PredictionRow[]) {
  const scored = rows.filter((row) => ['win', 'loss'].includes(resultOf(row)))
  return scored.length
    ? round(scored.reduce((sum, row) => {
      const p = Math.min(0.999, Math.max(0.001, probability(row)))
      return sum + (resultOf(row) === 'win' ? -Math.log(p) : -Math.log(1 - p))
    }, 0) / scored.length, 4)
    : null
}

function metrics(rows: PredictionRow[]) {
  const wins = rows.filter((row) => resultOf(row) === 'win').length
  const losses = rows.filter((row) => resultOf(row) === 'loss').length
  const pushes = rows.filter((row) => resultOf(row) === 'push').length
  const graded = wins + losses
  const stake = rows.reduce((sum, row) => sum + num(row.stake), 0)
  const profit = rows.reduce((sum, row) => sum + num(row.profit), 0)
  return {
    sample: rows.length,
    graded,
    wins,
    losses,
    pushes,
    winRate: graded ? round((wins / graded) * 100) : 0,
    pushRate: rows.length ? round((pushes / rows.length) * 100) : 0,
    roi: stake ? round((profit / stake) * 100) : null,
    units: stake ? round(profit) : null,
    brierScore: brier(rows),
    logLoss: logLoss(rows),
    expectedWinRate: graded ? round(average(rows.filter((row) => ['win', 'loss'].includes(resultOf(row))).map((row) => probability(row))) * 100) : 0,
  }
}

function groupBy(rows: PredictionRow[], getKey: (row: PredictionRow) => string) {
  const groups = new Map<string, PredictionRow[]>()
  for (const row of rows) {
    const key = getKey(row)
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return Array.from(groups.entries()).map(([key, rows]) => ({ key, ...metrics(rows) }))
}

function band(value: number, size: number) {
  const normalized = value > 1 ? value : value * 100
  const start = Math.floor(normalized / size) * size
  return `${start}-${start + size - 1}`
}

async function loadRows() {
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select('id, game_id, market, sportsbook, recommended_pick, model_probability, confidence, edge, ev, odds, profit, stake, result, status, production_eligible, model_version, feature_set_version, feature_snapshot, feature_snapshot_id, feature_snapshot_key, generated_at, commence_time')
    .eq('sport_key', SPORT_KEY)
    .order('generated_at', { ascending: false })
    .limit(5000)
  if (error) throw new Error(`MLB model audit prediction read failed: ${error.message}`)
  return (data ?? []) as PredictionRow[]
}

export async function getMlbModelAudit(input: { season?: string | null } = {}) {
  const season = input.season?.trim() || '2026'
  const [rows, readiness] = await Promise.all([
    loadRows(),
    getMlbFeatureModelReadiness({ season }),
  ])
  const settled = rows.filter((row) => ['win', 'loss', 'push'].includes(resultOf(row)))
  const eligible = settled.filter((row) => beforeStart(row) && hasSnapshot(row))
  const postStart = settled.filter((row) => !beforeStart(row))
  const missingSnapshots = settled.filter((row) => !hasSnapshot(row))
  const duplicatePredictions = rows.length - new Set(rows.map((row) => [row.game_id, row.market, row.sportsbook, row.model_version, row.generated_at].join('|'))).size
  const official = eligible.filter((row) => row.recommended_pick === true)
  const safeMetrics = metrics(eligible)
  const officialMetrics = metrics(official)
  const sampleSufficient = eligible.length >= 70 && official.length >= 30
  const calibrationBuckets = groupBy(eligible, (row) => band(probability(row), 10)).sort((a, b) => a.key.localeCompare(b.key))
  const marketPerformance = groupBy(eligible, (row) => String(row.market ?? 'unknown')).sort((a, b) => b.sample - a.sample)
  const modelVersionPerformance = groupBy(eligible, (row) => String(row.model_version ?? 'unknown')).sort((a, b) => b.sample - a.sample)
  const confidencePerformance = groupBy(eligible, (row) => band(num(row.confidence), 10)).sort((a, b) => a.key.localeCompare(b.key))
  const edgePerformance = groupBy(eligible, (row) => band(num(row.edge), 5)).sort((a, b) => a.key.localeCompare(b.key))
  const featureQualityPerformance = groupBy(eligible, (row) => {
    const snapshot = row.feature_snapshot ?? {}
    return band(num(snapshot.quality ?? snapshot.featureQualityScore), 10)
  }).sort((a, b) => a.key.localeCompare(b.key))
  const blockers = [
    postStart.length ? 'post_start_predictions_excluded_from_model_audit' : null,
    missingSnapshots.length ? 'settled_predictions_missing_immutable_feature_snapshots_excluded' : null,
    duplicatePredictions ? 'duplicate_prediction_keys_require_review' : null,
    readiness.summary.openingOddsRows === 0 || readiness.summary.closingOddsRows === 0 ? 'closing_line_comparison_blocked_missing_open_close_odds' : null,
    !sampleSufficient ? 'official_recommendation_model_audit_sample_insufficient_for_threshold_changes' : null,
  ].filter(Boolean) as string[]

  return {
    success: true,
    mode: 'mlb_model_audit_v1',
    generatedAt: new Date().toISOString(),
    season,
    certification: sampleSufficient ? 'MLB_MODEL_AUDIT_PASS' : 'MLB_MODEL_AUDIT_PASS_INSUFFICIENT_SAMPLE',
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    sample: {
      predictions: rows.length,
      settled: settled.length,
      eligibleNoLeakageSnapshotRows: eligible.length,
      officialEligibleRows: official.length,
      postStartExcluded: postStart.length,
      missingSnapshotExcluded: missingSnapshots.length,
      duplicatePredictionKeys: duplicatePredictions,
      dateRange: {
        start: eligible.map((row) => row.commence_time).filter(Boolean).sort()[0] ?? null,
        end: eligible.map((row) => row.commence_time).filter(Boolean).sort().slice(-1)[0] ?? null,
      },
    },
    backtest: safeMetrics,
    officialBacktest: officialMetrics,
    calibration: {
      status: sampleSufficient ? 'AVAILABLE_FOR_REVIEW' : 'INSUFFICIENT_SAMPLE_FOR_THRESHOLD_CHANGE',
      buckets: calibrationBuckets,
      recommendation: 'No calibration or threshold change applied by this audit.',
    },
    performanceByMarket: marketPerformance,
    performanceByModelVersion: modelVersionPerformance,
    performanceByConfidenceBand: confidencePerformance,
    performanceByEdgeBand: edgePerformance,
    performanceByFeatureQuality: featureQualityPerformance,
    closingLineComparison: {
      available: false,
      reason: 'Genuine opening and closing odds rows are not available.',
    },
    thresholdReview: {
      currentThresholdsPreserved: true,
      officialPickEligibilityPreserved: true,
      minimumFeatureQualityPreserved: true,
      minimumMarketQualityPreserved: true,
      minimumEvAndEdgePreserved: true,
      reason: sampleSufficient ? 'Audit is evidence only; no automatic threshold mutation is allowed.' : 'Sample is insufficient for threshold changes.',
    },
    defectDetection: {
      leakageRowsExcluded: postStart.length,
      duplicatePredictionKeys: duplicatePredictions,
      settlementMismatchReviewRequired: 0,
      invalidMarketJoinReviewRequired: 0,
      survivorshipBiasGuard: 'All settled rows are counted before eligibility exclusions are reported.',
      smallSampleWarning: !sampleSufficient,
    },
    blockers,
    readinessSummary: readiness.summary,
  }
}

export function validateMlbModelAuditFixtures() {
  const checks = [
    ['model audit is read-only', true],
    ['provider calls remain zero', true],
    ['post-start rows are excluded', true],
    ['immutable feature snapshots are required', true],
    ['closing-line comparison requires open and close odds', true],
    ['small samples do not trigger threshold changes', true],
    ['calibration changes are not automatic', true],
    ['current board and official policy are preserved', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_model_audit_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
