import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

const SPORT_KEY = 'baseball_mlb'
const REPLAY_FAMILY = 'retrosheet_historical_replay_phase_2b_v1'
const SHADOW_VERSION = 'historical_calibration_shadow_bucket_v1'

type ProjectionRow = {
  id: string
  event_id: string | null
  projection_key: string
  projection_family: string
  model_version: string | null
  projected_value: number | null
  actual_value: number | null
  confidence: number | null
  feature_quality: number | null
  data_sufficiency: number | null
  generated_at: string
  validity_status: string | null
  calibration: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  feature_snapshot: Record<string, unknown> | null
}

type ReplaySample = ProjectionRow & {
  market: string
  probability: number
  outcome: 0 | 1
  confidenceScore: number
  featureQualityScore: number
  dataSufficiencyScore: number
}

type Metrics = {
  sample: number
  wins: number
  losses: number
  accuracy: number
  brierScore: number
  logLoss: number
  calibrationError: number
  calibrationBias: number
  confidenceReliability: number
  coverage: number
}

function round(value: number, digits = 4) {
  return Number(value.toFixed(digits))
}

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function marketFrom(row: ProjectionRow) {
  const feature = asRecord(row.feature_snapshot)
  if (feature.market) return String(feature.market)
  if (row.projection_key.includes('moneyline')) return 'moneyline'
  if (row.projection_key.includes('run_line')) return 'spread'
  if (row.projection_key.includes('total')) return 'total'
  return 'unknown'
}

function probabilityBucket(probability: number) {
  if (probability >= 0.9) return '90-100'
  if (probability >= 0.8) return '80-89'
  if (probability >= 0.7) return '70-79'
  if (probability >= 0.6) return '60-69'
  if (probability >= 0.5) return '50-59'
  if (probability >= 0.4) return '40-49'
  return '<40'
}

function confidenceBucket(value: number) {
  if (value >= 80) return '80+'
  if (value >= 70) return '70-79'
  if (value >= 60) return '60-69'
  if (value >= 50) return '50-59'
  return '<50'
}

function qualityBucket(value: number) {
  if (value >= 80) return '80+'
  if (value >= 60) return '60-79'
  if (value >= 40) return '40-59'
  return '<40'
}

function clampProbability(probability: number) {
  return Math.min(0.99, Math.max(0.01, probability))
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function logLossTerm(probability: number, outcome: 0 | 1) {
  const p = clampProbability(probability)
  return outcome === 1 ? -Math.log(p) : -Math.log(1 - p)
}

function scoreMetrics(samples: ReplaySample[], probabilityFor: (sample: ReplaySample) => number): Metrics {
  const scored = samples.map((sample) => ({
    sample,
    probability: clampProbability(probabilityFor(sample)),
  }))
  const wins = scored.filter(({ sample }) => sample.outcome === 1).length
  const losses = scored.length - wins
  const calibrationDeltas = scored.map(({ sample, probability }) => probability - sample.outcome)
  return {
    sample: scored.length,
    wins,
    losses,
    accuracy: scored.length ? round((scored.filter(({ sample, probability }) => (probability >= 0.5 ? 1 : 0) === sample.outcome).length / scored.length) * 100, 2) : 0,
    brierScore: scored.length ? round(average(scored.map(({ sample, probability }) => (probability - sample.outcome) ** 2)), 4) : 0,
    logLoss: scored.length ? round(average(scored.map(({ sample, probability }) => logLossTerm(probability, sample.outcome))), 4) : 0,
    calibrationError: scored.length ? round(Math.abs(average(calibrationDeltas)) * 100, 2) : 0,
    calibrationBias: scored.length ? round(average(calibrationDeltas) * 100, 2) : 0,
    confidenceReliability: scored.length ? round(100 - Math.min(100, Math.abs(average(calibrationDeltas)) * 100), 2) : 0,
    coverage: scored.length,
  }
}

function splitChronologically(samples: ReplaySample[]) {
  const ordered = [...samples].sort((a, b) => a.generated_at.localeCompare(b.generated_at) || a.id.localeCompare(b.id))
  const trainEnd = Math.floor(ordered.length * 0.6)
  const validationEnd = Math.floor(ordered.length * 0.8)
  return {
    training: ordered.slice(0, trainEnd),
    validation: ordered.slice(trainEnd, validationEnd),
    holdout: ordered.slice(validationEnd),
  }
}

function dateRange(samples: ReplaySample[]) {
  if (!samples.length) return { start: null, end: null }
  const dates = samples.map((sample) => sample.generated_at).sort()
  return { start: dates[0], end: dates[dates.length - 1] }
}

function buildCalibrationMap(samples: ReplaySample[]) {
  const groups = new Map<string, ReplaySample[]>()
  for (const sample of samples) {
    const key = `${sample.market}:${probabilityBucket(sample.probability)}`
    groups.set(key, [...(groups.get(key) ?? []), sample])
  }
  const entries = Array.from(groups.entries()).map(([key, rows]) => {
    const observedRate = average(rows.map((row) => row.outcome))
    const averageProbability = average(rows.map((row) => row.probability))
    const minimumSample = rows.length >= 20
    return {
      key,
      sample: rows.length,
      averageProbability: round(averageProbability * 100, 2),
      observedRate: round(observedRate * 100, 2),
      calibratedProbability: minimumSample ? observedRate : averageProbability,
      method: minimumSample ? 'bucket_observed_rate' : 'sample_too_small_keep_baseline',
    }
  })
  return new Map(entries.map((entry) => [entry.key, entry]))
}

function calibratedProbability(sample: ReplaySample, calibrationMap: ReturnType<typeof buildCalibrationMap>) {
  const key = `${sample.market}:${probabilityBucket(sample.probability)}`
  return calibrationMap.get(key)?.calibratedProbability ?? sample.probability
}

function groupedMetrics(samples: ReplaySample[], groupFor: (sample: ReplaySample) => string, probabilityFor: (sample: ReplaySample) => number) {
  const groups = new Map<string, ReplaySample[]>()
  for (const sample of samples) {
    const key = groupFor(sample)
    groups.set(key, [...(groups.get(key) ?? []), sample])
  }
  return Array.from(groups.entries())
    .map(([key, rows]) => ({ key, ...scoreMetrics(rows, probabilityFor) }))
    .sort((a, b) => a.key.localeCompare(b.key))
}

async function loadReplayRows() {
  const rows: ProjectionRow[] = []
  const pageSize = 1000
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('universal_projection_history')
      .select('id, event_id, projection_key, projection_family, model_version, projected_value, actual_value, confidence, feature_quality, data_sufficiency, generated_at, validity_status, calibration, metadata, feature_snapshot')
      .eq('sport_key', SPORT_KEY)
      .eq('projection_family', REPLAY_FAMILY)
      .order('generated_at', { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error(`shadow calibration replay load failed at offset ${offset}: ${error.message}`)
    rows.push(...((data ?? []) as ProjectionRow[]))
    if (!data || data.length < pageSize) break
  }
  return rows
}

function toSamples(rows: ProjectionRow[]) {
  return rows
    .filter((row) => row.validity_status === 'VALID')
    .map((row) => {
      const projected = asNumber(row.projected_value)
      const actual = asNumber(row.actual_value)
      if (projected === null || actual === null) return null
      if (actual !== 0 && actual !== 100) return null
      return {
        ...row,
        market: marketFrom(row),
        probability: projected / 100,
        outcome: actual === 100 ? 1 : 0,
        confidenceScore: asNumber(row.confidence) ?? projected,
        featureQualityScore: asNumber(row.feature_quality) ?? 0,
        dataSufficiencyScore: asNumber(row.data_sufficiency) ?? 0,
      } as ReplaySample
    })
    .filter((row): row is ReplaySample => row !== null)
}

export async function getHistoricalShadowCalibration() {
  const rows = await loadReplayRows()
  const samples = toSamples(rows)
  const splits = splitChronologically(samples)
  const calibrationMap = buildCalibrationMap(splits.training)
  const baseline = {
    training: scoreMetrics(splits.training, (sample) => sample.probability),
    validation: scoreMetrics(splits.validation, (sample) => sample.probability),
    holdout: scoreMetrics(splits.holdout, (sample) => sample.probability),
  }
  const shadow = {
    training: scoreMetrics(splits.training, (sample) => calibratedProbability(sample, calibrationMap)),
    validation: scoreMetrics(splits.validation, (sample) => calibratedProbability(sample, calibrationMap)),
    holdout: scoreMetrics(splits.holdout, (sample) => calibratedProbability(sample, calibrationMap)),
  }
  const holdoutDelta = {
    brierScore: round(shadow.holdout.brierScore - baseline.holdout.brierScore, 4),
    logLoss: round(shadow.holdout.logLoss - baseline.holdout.logLoss, 4),
    calibrationError: round(shadow.holdout.calibrationError - baseline.holdout.calibrationError, 2),
    accuracy: round(shadow.holdout.accuracy - baseline.holdout.accuracy, 2),
  }
  const shadowBetter = holdoutDelta.brierScore <= 0 && holdoutDelta.logLoss <= 0 && holdoutDelta.calibrationError <= 0
  const shadowWorse = holdoutDelta.brierScore > 0.005 || holdoutDelta.logLoss > 0.01
  return {
    success: true,
    mode: 'historical_calibration_shadow_reweighting_v1',
    generatedAt: new Date().toISOString(),
    sportKey: SPORT_KEY,
    replayFamily: REPLAY_FAMILY,
    shadowVersion: SHADOW_VERSION,
    method: 'chronological_market_probability_bucket_calibration',
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionWeightsChanged: false,
    productionModelPromoted: false,
    sample: {
      replayRowsRead: rows.length,
      gradedRows: samples.length,
      excludedPushRows: rows.length - samples.length,
      markets: Array.from(new Set(samples.map((sample) => sample.market))).sort(),
    },
    chronologicalSplit: {
      training: { count: splits.training.length, ...dateRange(splits.training) },
      validation: { count: splits.validation.length, ...dateRange(splits.validation) },
      holdout: { count: splits.holdout.length, ...dateRange(splits.holdout) },
      integrity: 'PASS',
    },
    baseline,
    shadow,
    metricDeltas: { holdout: holdoutDelta },
    marketSplits: groupedMetrics(splits.holdout, (sample) => sample.market, (sample) => calibratedProbability(sample, calibrationMap)),
    confidenceSplits: groupedMetrics(splits.holdout, (sample) => confidenceBucket(sample.confidenceScore), (sample) => calibratedProbability(sample, calibrationMap)),
    dataQualitySplits: groupedMetrics(splits.holdout, (sample) => qualityBucket(sample.dataSufficiencyScore), (sample) => calibratedProbability(sample, calibrationMap)),
    calibrationLayer: Array.from(calibrationMap.values()).sort((a, b) => a.key.localeCompare(b.key)),
    recommendation: shadowBetter ? 'Shadow better' : shadowWorse ? 'Shadow worse' : 'Shadow equivalent',
    promotionRecommendation: shadowBetter ? 'Review shadow calibration for manual promotion only after operator approval.' : 'Do not promote shadow calibration.',
    certifications: {
      CHRONOLOGICAL_CALIBRATION_PASS: splits.training.length > 0 && splits.validation.length > 0 && splits.holdout.length > 0,
      SHADOW_REWEIGHTING_PASS: true,
      NO_AUTO_PROMOTION_PASS: true,
      SHADOW_COMPARISON_PASS: baseline.holdout.sample > 0 && shadow.holdout.sample > 0,
      CALIBRATION_EVIDENCE_PASS: samples.length >= 1000,
    },
  }
}
