import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  PRODUCTION_DATA_GATE_V1_POLICY,
  isProductionEligibleRow,
} from '@/services/production-data-gate.service'

type PredictionRow = {
  sport_key: string
  model_probability: number | null
  confidence: number | null
  result: string | null
  status: string | null
  recommended_pick: boolean | null
  odds: number | null
  production_eligible?: boolean | null
  trial?: boolean | null
  scrambled?: boolean | null
}

type CalibrationBucket = {
  bucket: string
  min: number
  max: number
  total: number
  wins: number
  losses: number
  pushes: number
  expectedWinRate: number
  actualWinRate: number
  calibrationError: number
  averageConfidence: number
  averageOdds: number
  recommendation: 'UNDERCONFIDENT' | 'OVERCONFIDENT' | 'CALIBRATED' | 'INSUFFICIENT_DATA'
}

function getResult(row: PredictionRow) {
  return row.status ?? row.result ?? 'pending'
}

function getBucketLabel(min: number, max: number) {
  return `${min}-${max}%`
}

function getCalibrationRecommendation({
  total,
  calibrationError,
}: {
  total: number
  calibrationError: number
}): CalibrationBucket['recommendation'] {
  if (total < 5) return 'INSUFFICIENT_DATA'
  if (calibrationError <= -8) return 'OVERCONFIDENT'
  if (calibrationError >= 8) return 'UNDERCONFIDENT'
  return 'CALIBRATED'
}

function average(values: number[]) {
  if (!values.length) return 0

  return Number(
    (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)
  )
}

function buildBucket(rows: PredictionRow[], min: number, max: number): CalibrationBucket {
  const bucketRows = rows.filter((row) => {
    const probability = Number(row.model_probability ?? 0)

    return probability >= min && probability <= max
  })

  const wins = bucketRows.filter((row) => getResult(row) === 'win').length
  const losses = bucketRows.filter((row) => getResult(row) === 'loss').length
  const pushes = bucketRows.filter((row) => getResult(row) === 'push').length

  const graded = wins + losses

  const actualWinRate = graded
    ? Number(((wins / graded) * 100).toFixed(2))
    : 0

  const expectedWinRate = average(
    bucketRows.map((row) => Number(row.model_probability ?? 0))
  )

  const calibrationError = Number((actualWinRate - expectedWinRate).toFixed(2))

  return {
    bucket: getBucketLabel(min, max),
    min,
    max,
    total: bucketRows.length,
    wins,
    losses,
    pushes,
    expectedWinRate,
    actualWinRate,
    calibrationError,
    averageConfidence: average(
      bucketRows.map((row) => Number(row.confidence ?? 0))
    ),
    averageOdds: average(bucketRows.map((row) => Number(row.odds ?? 0))),
    recommendation: getCalibrationRecommendation({
      total: bucketRows.length,
      calibrationError,
    }),
  }
}

function calculateOverallCalibration(buckets: CalibrationBucket[]) {
  const validBuckets = buckets.filter((bucket) => bucket.total >= 5)

  if (!validBuckets.length) {
    return {
      totalBuckets: buckets.length,
      validBuckets: 0,
      averageCalibrationError: 0,
      calibratedBuckets: 0,
      overconfidentBuckets: 0,
      underconfidentBuckets: 0,
      calibrationScore: 0,
      modelStatus: 'INSUFFICIENT_DATA' as const,
    }
  }

  const averageCalibrationError = average(
    validBuckets.map((bucket) => Math.abs(bucket.calibrationError))
  )

  const calibratedBuckets = validBuckets.filter(
    (bucket) => bucket.recommendation === 'CALIBRATED'
  ).length

  const overconfidentBuckets = validBuckets.filter(
    (bucket) => bucket.recommendation === 'OVERCONFIDENT'
  ).length

  const underconfidentBuckets = validBuckets.filter(
    (bucket) => bucket.recommendation === 'UNDERCONFIDENT'
  ).length

  const calibrationScore = Number(
    Math.max(0, 100 - averageCalibrationError * 4).toFixed(2)
  )

  const modelStatus =
    calibrationScore >= 80
      ? 'WELL_CALIBRATED'
      : calibrationScore >= 60
        ? 'NEEDS_MONITORING'
        : 'NEEDS_RECALIBRATION'

  return {
    totalBuckets: buckets.length,
    validBuckets: validBuckets.length,
    averageCalibrationError,
    calibratedBuckets,
    overconfidentBuckets,
    underconfidentBuckets,
    calibrationScore,
    modelStatus,
  }
}

export async function getModelCalibration() {
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select(
      'sport_key, model_probability, confidence, result, status, recommended_pick, odds, production_eligible, trial, scrambled'
    )
    .eq('production_eligible', true)
    .neq('status', 'pending')

  if (error) {
    throw new Error(error.message)
  }

  const rows = ((data ?? []) as PredictionRow[]).filter(
    (row) => isProductionEligibleRow(row) && ['win', 'loss', 'push'].includes(getResult(row))
  )

  const recommendedRows = rows.filter((row) => row.recommended_pick === true)

  const buckets = [
    buildBucket(recommendedRows, 0, 49),
    buildBucket(recommendedRows, 50, 59),
    buildBucket(recommendedRows, 60, 69),
    buildBucket(recommendedRows, 70, 79),
    buildBucket(recommendedRows, 80, 89),
    buildBucket(recommendedRows, 90, 100),
  ]

  const overall = calculateOverallCalibration(buckets)

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    sample: {
      productionGateMode: PRODUCTION_DATA_GATE_V1_POLICY.mode,
      settledRows: rows.length,
      recommendedSettledRows: recommendedRows.length,
    },
    overall,
    buckets,
  }
}
