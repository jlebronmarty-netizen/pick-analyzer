import { supabaseAdmin } from '@/lib/supabase-admin'
import { probeHistoricalFeatureSchemaCapabilities } from '@/lib/server-schema-capabilities'
import {
  evaluateHistoricalFeatureBacktestEligibility,
  getBacktestInputReadiness,
} from '@/services/historical-feature-generation.service'
import {
  NBA_PREDICTION_MODEL_VERSION,
  NBA_SPORT_KEY,
} from '@/services/nba-prediction-validation.service'

type NbaBacktestFilters = {
  dateFrom?: string | null
  dateTo?: string | null
  market?: string | null
  modelVersion?: string | null
  recommendedOnly?: boolean
}

type PredictionRow = {
  id: string
  sport_key: string
  game_id: string
  commence_time: string | null
  created_at: string | null
  team: string | null
  market: string | null
  sportsbook: string | null
  odds: number | null
  line: number | null
  model_probability: number | null
  implied_probability: number | null
  confidence: number | null
  edge: number | null
  ev: number | null
  recommended_pick: boolean | null
  stake: number | null
  profit: number | null
  status: string | null
  result: string | null
  settled_at: string | null
  lifecycle_status: string | null
  model_version: string | null
  feature_snapshot: Record<string, unknown> | null
  feature_snapshot_id?: string | null
  feature_snapshot_generated_at?: string | null
  feature_set_version?: string | null
  production_eligible?: boolean | null
  trial?: boolean | null
  scrambled?: boolean | null
  validation_warnings: string[] | null
  odds_timestamp: string | null
  generated_at: string | null
  cutoff_at: string | null
}

type SegmentSummary = {
  total: number
  settled: number
  wins: number
  losses: number
  pushes: number
  voids: number
  winRate: number
  roi: number
  profit: number
  units: number
  averageOdds: number
  averageProbability: number
  averageConfidence: number
  averageEdge: number
  averageEv: number
  brierScore: number | null
}

type CalibrationBucket = {
  bucket: string
  min: number
  max: number
  sample: number
  wins: number
  losses: number
  pushes: number
  expectedWinRate: number
  actualWinRate: number
  calibrationError: number
  brierScore: number | null
  recommendation: 'INSUFFICIENT_DATA' | 'CALIBRATED' | 'OVERCONFIDENT' | 'UNDERCONFIDENT'
}

const CALIBRATION_BUCKETS = [
  [0, 49],
  [50, 59],
  [60, 69],
  [70, 79],
  [80, 89],
  [90, 100],
] as const

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function average(values: number[]) {
  return values.length
    ? round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0
}

function getResult(row: PredictionRow) {
  return String(row.result ?? row.status ?? 'pending').toLowerCase()
}

function isSettled(row: PredictionRow) {
  return ['win', 'loss', 'push', 'void'].includes(getResult(row))
}

function isGraded(row: PredictionRow) {
  return ['win', 'loss'].includes(getResult(row))
}

function isValidDate(value: string | null | undefined) {
  if (!value) return false
  return Number.isFinite(new Date(value).getTime())
}

function confidenceBucket(row: PredictionRow) {
  const confidence = safeNumber(row.confidence)
  if (confidence >= 75) return '75+'
  if (confidence >= 65) return '65-74'
  if (confidence >= 55) return '55-64'
  return '<55'
}

function dataSufficiencyBucket(row: PredictionRow) {
  const sufficiency = safeNumber(row.feature_snapshot?.dataSufficiencyScore)
  if (sufficiency >= 80) return '80+'
  if (sufficiency >= 60) return '60-79'
  if (sufficiency >= 40) return '40-59'
  return '<40'
}

function groupRows(rows: PredictionRow[], getKey: (row: PredictionRow) => string) {
  const groups = new Map<string, PredictionRow[]>()

  for (const row of rows) {
    const key = getKey(row)
    groups.set(key, [...(groups.get(key) ?? []), row])
  }

  return Array.from(groups.entries()).map(([key, groupRows]) => ({
    key,
    rows: groupRows,
  }))
}

function brierScore(rows: PredictionRow[]) {
  const graded = rows.filter(isGraded)
  if (!graded.length) return null

  return round(
    graded.reduce((sum, row) => {
      const probability = safeNumber(row.model_probability) / 100
      const actual = getResult(row) === 'win' ? 1 : 0
      return sum + Math.pow(probability - actual, 2)
    }, 0) / graded.length,
    4
  )
}

function summarize(rows: PredictionRow[]): SegmentSummary {
  const settled = rows.filter(isSettled)
  const graded = settled.filter(isGraded)
  const wins = settled.filter((row) => getResult(row) === 'win').length
  const losses = settled.filter((row) => getResult(row) === 'loss').length
  const pushes = settled.filter((row) => getResult(row) === 'push').length
  const voids = settled.filter((row) => getResult(row) === 'void').length
  const profit = settled.reduce((sum, row) => sum + safeNumber(row.profit), 0)
  const stake = settled.reduce((sum, row) => sum + safeNumber(row.stake, 100), 0)

  return {
    total: rows.length,
    settled: settled.length,
    wins,
    losses,
    pushes,
    voids,
    winRate: graded.length ? round((wins / graded.length) * 100) : 0,
    roi: stake ? round((profit / stake) * 100) : 0,
    profit: round(profit),
    units: round(profit / 100),
    averageOdds: average(rows.map((row) => safeNumber(row.odds))),
    averageProbability: average(rows.map((row) => safeNumber(row.model_probability))),
    averageConfidence: average(rows.map((row) => safeNumber(row.confidence))),
    averageEdge: average(rows.map((row) => safeNumber(row.edge))),
    averageEv: average(rows.map((row) => safeNumber(row.ev))),
    brierScore: brierScore(rows),
  }
}

function calibrationRecommendation(sample: number, error: number): CalibrationBucket['recommendation'] {
  if (sample < 5) return 'INSUFFICIENT_DATA'
  if (error <= -8) return 'OVERCONFIDENT'
  if (error >= 8) return 'UNDERCONFIDENT'
  return 'CALIBRATED'
}

function buildCalibrationBucket(rows: PredictionRow[], min: number, max: number): CalibrationBucket {
  const bucketRows = rows.filter((row) => {
    const probability = safeNumber(row.model_probability)
    return probability >= min && probability <= max
  })
  const graded = bucketRows.filter(isGraded)
  const wins = bucketRows.filter((row) => getResult(row) === 'win').length
  const losses = bucketRows.filter((row) => getResult(row) === 'loss').length
  const pushes = bucketRows.filter((row) => getResult(row) === 'push').length
  const expectedWinRate = average(bucketRows.map((row) => safeNumber(row.model_probability)))
  const actualWinRate = graded.length ? round((wins / graded.length) * 100) : 0
  const calibrationError = round(actualWinRate - expectedWinRate)

  return {
    bucket: `${min}-${max}%`,
    min,
    max,
    sample: bucketRows.length,
    wins,
    losses,
    pushes,
    expectedWinRate,
    actualWinRate,
    calibrationError,
    brierScore: brierScore(bucketRows),
    recommendation: calibrationRecommendation(bucketRows.length, calibrationError),
  }
}

function buildCalibration(rows: PredictionRow[]) {
  const moneylineRows = rows.filter(
    (row) => String(row.market ?? '') === 'moneyline' && ['win', 'loss', 'push'].includes(getResult(row))
  )
  const buckets = CALIBRATION_BUCKETS.map(([min, max]) =>
    buildCalibrationBucket(moneylineRows, min, max)
  )
  const validBuckets = buckets.filter((bucket) => bucket.sample >= 5)
  const averageAbsoluteError = validBuckets.length
    ? average(validBuckets.map((bucket) => Math.abs(bucket.calibrationError)))
    : 0
  const score = validBuckets.length
    ? round(Math.max(0, 100 - averageAbsoluteError * 4))
    : 0

  return {
    sample: moneylineRows.length,
    brierScore: brierScore(moneylineRows),
    score,
    status:
      validBuckets.length === 0
        ? 'INSUFFICIENT_DATA'
        : score >= 80
          ? 'WELL_CALIBRATED'
          : score >= 60
            ? 'NEEDS_MONITORING'
            : 'NEEDS_RECALIBRATION',
    buckets,
  }
}

function leakageChecks(rows: PredictionRow[]) {
  const cutoffAfterStart = rows.filter(
    (row) =>
      isValidDate(row.cutoff_at) &&
      isValidDate(row.commence_time) &&
      new Date(row.cutoff_at!).getTime() >= new Date(row.commence_time!).getTime()
  ).length
  const generatedAfterStart = rows.filter(
    (row) =>
      isValidDate(row.generated_at) &&
      isValidDate(row.commence_time) &&
      new Date(row.generated_at!).getTime() >= new Date(row.commence_time!).getTime()
  ).length
  const oddsAfterGenerated = rows.filter(
    (row) =>
      isValidDate(row.odds_timestamp) &&
      isValidDate(row.generated_at) &&
      new Date(row.odds_timestamp!).getTime() > new Date(row.generated_at!).getTime()
  ).length
  const missingFeatureSnapshot = rows.filter(
    (row) => !row.feature_snapshot || Object.keys(row.feature_snapshot).length === 0
  ).length
  const missingModelVersion = rows.filter((row) => !row.model_version).length

  return {
    cutoffAfterStart,
    generatedAfterStart,
    oddsAfterGenerated,
    missingFeatureSnapshot,
    missingModelVersion,
    leakageRisk: cutoffAfterStart + generatedAfterStart + oddsAfterGenerated,
  }
}

function warningsFor(rows: PredictionRow[], summary: SegmentSummary, checks: ReturnType<typeof leakageChecks>) {
  const warnings: string[] = []

  if (summary.settled === 0) {
    warnings.push('No settled NBA predictions are available for backtesting yet.')
  } else if (summary.settled < 30) {
    warnings.push('NBA backtest sample is below 30 settled predictions; treat results as directional.')
  }

  if (checks.leakageRisk > 0) {
    warnings.push(`${checks.leakageRisk} NBA prediction rows have timestamp leakage risk.`)
  }
  if (checks.missingFeatureSnapshot > 0) {
    warnings.push(`${checks.missingFeatureSnapshot} NBA prediction rows are missing feature snapshots.`)
  }
  if (checks.missingModelVersion > 0) {
    warnings.push(`${checks.missingModelVersion} NBA prediction rows are missing model version metadata.`)
  }
  if (!rows.some((row) => row.recommended_pick)) {
    warnings.push('No recommended NBA picks are available for recommended-only backtesting.')
  }

  return warnings
}

async function loadRows(filters: NbaBacktestFilters) {
  let query = supabaseAdmin
    .from('prediction_history')
    .select('*')
    .eq('sport_key', NBA_SPORT_KEY)
    .order('commence_time', { ascending: false })
    .limit(5000)

  if (filters.dateFrom) query = query.gte('commence_time', filters.dateFrom)
  if (filters.dateTo) query = query.lte('commence_time', filters.dateTo)
  if (filters.market) query = query.eq('market', filters.market)
  if (filters.modelVersion) query = query.eq('model_version', filters.modelVersion)
  if (filters.recommendedOnly) query = query.eq('recommended_pick', true)

  const { data, error } = await query
  if (error) throw new Error(`Failed to load NBA backtest rows: ${error.message}`)

  return (data ?? []) as PredictionRow[]
}

async function loadFeatureSnapshotBacktestCounts() {
  const [
    totalSnapshots,
    trialSnapshots,
    productionSnapshots,
    linkedPredictions,
    settledLinkedPredictions,
    roiEligibleRows,
    clvCandidateRows,
  ] = await Promise.all([
    supabaseAdmin
      .from('historical_feature_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('sport_key', NBA_SPORT_KEY),
    supabaseAdmin
      .from('historical_feature_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('trial', true),
    supabaseAdmin
      .from('historical_feature_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('production_eligible', true),
    supabaseAdmin
      .from('prediction_history')
      .select('id', { count: 'exact', head: true })
      .eq('sport_key', NBA_SPORT_KEY)
      .not('feature_snapshot_id', 'is', null),
    supabaseAdmin
      .from('prediction_history')
      .select('id', { count: 'exact', head: true })
      .eq('sport_key', NBA_SPORT_KEY)
      .not('feature_snapshot_id', 'is', null)
      .in('result', ['win', 'loss', 'push', 'void']),
    supabaseAdmin
      .from('prediction_history')
      .select('id', { count: 'exact', head: true })
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('production_eligible', true)
      .eq('trial', false)
      .eq('scrambled', false)
      .not('feature_snapshot_id', 'is', null)
      .not('odds', 'is', null)
      .in('result', ['win', 'loss', 'push', 'void']),
    supabaseAdmin
      .from('prediction_history')
      .select('id, settlement_details')
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('production_eligible', true)
      .eq('trial', false)
      .eq('scrambled', false)
      .not('feature_snapshot_id', 'is', null)
      .not('odds', 'is', null)
      .limit(5000),
  ])
  const results = [
    totalSnapshots,
    trialSnapshots,
    productionSnapshots,
    linkedPredictions,
    settledLinkedPredictions,
    roiEligibleRows,
    clvCandidateRows,
  ]
  const error = results.find((result) => result.error)?.error
  if (error) throw new Error(`Failed to load feature snapshot backtest counts: ${error.message}`)

  return {
    totalHistoricalFeatureSnapshots: totalSnapshots.count ?? 0,
    trialSnapshots: trialSnapshots.count ?? 0,
    productionEligibleSnapshots: productionSnapshots.count ?? 0,
    linkedPredictions: linkedPredictions.count ?? 0,
    settledLinkedPredictions: settledLinkedPredictions.count ?? 0,
    rowsEligibleForRoi: roiEligibleRows.count ?? 0,
    rowsEligibleForClv: ((clvCandidateRows.data ?? []) as Array<{ settlement_details?: Record<string, unknown> | null }>)
      .filter((row) => Boolean(row.settlement_details?.closingSnapshotId)).length,
  }
}

export async function getNbaBacktest(filters: NbaBacktestFilters = {}) {
  const rows = await loadRows(filters)
  const settled = rows.filter(isSettled)
  const summary = summarize(rows)
  const checks = leakageChecks(rows)
  const calibration = buildCalibration(settled)
  const schemaCapabilities = await probeHistoricalFeatureSchemaCapabilities()
  const featureSnapshotCounts = await loadFeatureSnapshotBacktestCounts()
  const migrationApplied =
    schemaCapabilities.probes.historicalFeatureSnapshots.applied &&
    schemaCapabilities.probes.predictionHistoryFeatureSnapshotLinkage.applied
  const backtestInputReadiness = getBacktestInputReadiness(schemaCapabilities)
  const firstSettled = settled[0]
  const featureSnapshotEligibility = evaluateHistoricalFeatureBacktestEligibility({
    hasSnapshot: Boolean(firstSettled?.feature_snapshot_id),
    hasLineage: Boolean(firstSettled?.feature_snapshot_id && firstSettled?.feature_set_version),
    snapshotGeneratedAt: firstSettled?.feature_snapshot_generated_at ?? null,
    predictionTimestamp: firstSettled?.generated_at ?? firstSettled?.created_at ?? null,
    cutoffTimestamp: firstSettled?.cutoff_at ?? null,
    noLeakage: checks.leakageRisk === 0,
    settled: Boolean(firstSettled),
    hasValidPrice: firstSettled ? Number.isFinite(Number(firstSettled.odds)) : false,
    productionEligible: firstSettled?.production_eligible === true,
    trial: firstSettled?.trial === true,
    scrambled: firstSettled?.scrambled === true,
    sampleSize: settled.length,
    hasClosingSnapshot: false,
    migrationApplied,
  })

  return {
    success: true,
    mode: 'nba_backtesting_v1',
    generatedAt: new Date().toISOString(),
    modelVersion: filters.modelVersion ?? NBA_PREDICTION_MODEL_VERSION,
    filters: {
      dateFrom: filters.dateFrom ?? null,
      dateTo: filters.dateTo ?? null,
      market: filters.market ?? null,
      modelVersion: filters.modelVersion ?? null,
      recommendedOnly: filters.recommendedOnly ?? false,
    },
    sample: {
      totalRows: rows.length,
      settledRows: settled.length,
      recommendedRows: rows.filter((row) => row.recommended_pick).length,
      markets: Array.from(new Set(rows.map((row) => row.market).filter(Boolean))).sort(),
      modelVersions: Array.from(new Set(rows.map((row) => row.model_version).filter(Boolean))).sort(),
    },
    summary,
    schemaCapabilities,
    featureSnapshotCounts,
    backtestInputReadiness,
    featureSnapshotEligibility,
    calibration,
    leakageChecks: checks,
    byMarket: groupRows(rows, (row) => String(row.market ?? 'unknown')).map(({ key, rows }) => ({
      market: key,
      ...summarize(rows),
    })),
    byModelVersion: groupRows(rows, (row) => String(row.model_version ?? 'unknown')).map(({ key, rows }) => ({
      modelVersion: key,
      ...summarize(rows),
    })),
    byConfidence: groupRows(rows, confidenceBucket).map(({ key, rows }) => ({
      bucket: key,
      ...summarize(rows),
    })),
    byDataSufficiency: groupRows(rows, dataSufficiencyBucket).map(({ key, rows }) => ({
      bucket: key,
      ...summarize(rows),
    })),
    warnings: warningsFor(rows, summary, checks),
  }
}

export async function getNbaCalibration(filters: NbaBacktestFilters = {}) {
  const rows = await loadRows(filters)
  const settled = rows.filter(isSettled)
  const calibration = buildCalibration(settled)
  const checks = leakageChecks(rows)
  const schemaCapabilities = await probeHistoricalFeatureSchemaCapabilities()
  const featureSnapshotCounts = await loadFeatureSnapshotBacktestCounts()
  const migrationApplied =
    schemaCapabilities.probes.historicalFeatureSnapshots.applied &&
    schemaCapabilities.probes.predictionHistoryFeatureSnapshotLinkage.applied
  const backtestInputReadiness = getBacktestInputReadiness(schemaCapabilities)
  const firstSettled = settled[0]
  const featureSnapshotEligibility = evaluateHistoricalFeatureBacktestEligibility({
    hasSnapshot: Boolean(firstSettled?.feature_snapshot_id),
    hasLineage: Boolean(firstSettled?.feature_snapshot_id && firstSettled?.feature_set_version),
    snapshotGeneratedAt: firstSettled?.feature_snapshot_generated_at ?? null,
    predictionTimestamp: firstSettled?.generated_at ?? firstSettled?.created_at ?? null,
    cutoffTimestamp: firstSettled?.cutoff_at ?? null,
    noLeakage: checks.leakageRisk === 0,
    settled: Boolean(firstSettled),
    hasValidPrice: firstSettled ? Number.isFinite(Number(firstSettled.odds)) : false,
    productionEligible: firstSettled?.production_eligible === true,
    trial: firstSettled?.trial === true,
    scrambled: firstSettled?.scrambled === true,
    sampleSize: settled.length,
    hasClosingSnapshot: false,
    migrationApplied,
  })

  return {
    success: true,
    mode: 'nba_calibration_v1',
    generatedAt: new Date().toISOString(),
    modelVersion: filters.modelVersion ?? NBA_PREDICTION_MODEL_VERSION,
    filters: {
      dateFrom: filters.dateFrom ?? null,
      dateTo: filters.dateTo ?? null,
      market: filters.market ?? null,
      modelVersion: filters.modelVersion ?? null,
      recommendedOnly: filters.recommendedOnly ?? false,
    },
    sample: {
      totalRows: rows.length,
      settledRows: settled.length,
      moneylineRows: calibration.sample,
    },
    calibration,
    schemaCapabilities,
    featureSnapshotCounts,
    backtestInputReadiness,
    featureSnapshotEligibility,
    leakageChecks: checks,
    warnings: warningsFor(rows, summarize(rows), checks),
  }
}
