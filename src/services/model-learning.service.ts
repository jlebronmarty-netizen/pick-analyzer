import { supabaseAdmin } from '@/lib/supabase-admin'
import { saveModelVersion } from '@/services/model-versioning.service'
import { getModelCalibration } from '@/services/model-calibration.service'
import { runHistoricalBacktest } from '@/services/model-backtest.service'
import { optimizeModelWeights } from '@/services/weight-optimizer.service'

export type ModelFactor =
  | 'homeAwayAdvantage'
  | 'headToHeadAdvantage'
  | 'pitcherAdvantage'
  | 'injuryImpact'
  | 'weatherImpact'

type PredictionRow = {
  sport_key: string
  result: string | null
  status: string | null
  profit: number | null
  stake: number | null
  recommended_pick: boolean | null
  model_probability: number | null
  confidence: number | null
  edge: number | null
  ev: number | null
}

type ModelWeightRow = {
  sport_key: string
  factor: ModelFactor
  weight: number
  default_weight: number
  sample_size: number
  win_rate: number
  roi: number
}

const defaultWeights: Record<ModelFactor, number> = {
  homeAwayAdvantage: 1.05,
  headToHeadAdvantage: 1.15,
  pitcherAdvantage: 1.45,
  injuryImpact: 1.3,
  weatherImpact: 0.75,
}

const factorList = Object.keys(defaultWeights) as ModelFactor[]

function getResult(row: PredictionRow) {
  return row.status ?? row.result ?? 'pending'
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function round(value: number) {
  return Number(value.toFixed(4))
}

function calculatePerformance(rows: PredictionRow[]) {
  const settled = rows.filter((row) =>
    ['win', 'loss', 'push'].includes(getResult(row))
  )

  const wins = settled.filter((row) => getResult(row) === 'win').length
  const losses = settled.filter((row) => getResult(row) === 'loss').length

  const totalStake = settled.reduce(
    (sum, row) => sum + Number(row.stake ?? 0),
    0
  )

  const totalProfit = settled.reduce(
    (sum, row) => sum + Number(row.profit ?? 0),
    0
  )

  return {
    sampleSize: settled.length,
    wins,
    losses,
    winRate: settled.length
      ? Number(((wins / settled.length) * 100).toFixed(2))
      : 0,
    roi: totalStake
      ? Number(((totalProfit / totalStake) * 100).toFixed(2))
      : 0,
  }
}

function getLearningAdjustment({
  weight,
  defaultWeight,
  sampleSize,
  winRate,
  roi,
}: {
  weight: number
  defaultWeight: number
  sampleSize: number
  winRate: number
  roi: number
}) {
  if (sampleSize < 25) {
    return {
      newWeight: weight,
      reason: 'Insufficient sample size for learning adjustment',
    }
  }

  const performanceSignal =
    roi >= 10 && winRate >= 55
      ? 0.03
      : roi >= 0 && winRate >= 50
        ? 0.01
        : roi <= -10 || winRate <= 45
          ? -0.03
          : -0.01

  const learnedWeight = weight + defaultWeight * performanceSignal
  const minWeight = defaultWeight * 0.5
  const maxWeight = defaultWeight * 1.75

  return {
    newWeight: round(clamp(learnedWeight, minWeight, maxWeight)),
    reason:
      performanceSignal > 0
        ? 'Positive performance signal increased factor weight'
        : 'Negative performance signal reduced factor weight',
  }
}

async function ensureWeights(sportKey: string) {
  for (const factor of factorList) {
    await supabaseAdmin.from('model_weights').upsert(
      {
        sport_key: sportKey,
        factor,
        weight: defaultWeights[factor],
        default_weight: defaultWeights[factor],
        adjustment_reason: 'Auto-created default weight',
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'sport_key,factor',
      }
    )
  }
}

export async function getModelWeights(sportKey = 'baseball_mlb') {
  await ensureWeights(sportKey)

  const { data, error } = await supabaseAdmin
    .from('model_weights')
    .select(
      'sport_key, factor, weight, default_weight, sample_size, win_rate, roi'
    )
    .eq('sport_key', sportKey)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as ModelWeightRow[]

  return factorList.reduce(
    (map, factor) => {
      const row = rows.find((item) => item.factor === factor)
      map[factor] = Number(row?.weight ?? defaultWeights[factor])
      return map
    },
    {} as Record<ModelFactor, number>
  )
}

export async function runModelLearning(sportKey = 'baseball_mlb') {
  await ensureWeights(sportKey)

  const { data: predictions, error: predictionError } = await supabaseAdmin
    .from('prediction_history')
    .select(
      'sport_key, result, status, profit, stake, recommended_pick, model_probability, confidence, edge, ev'
    )
    .eq('sport_key', sportKey)
    .eq('recommended_pick', true)

  if (predictionError) {
    throw new Error(predictionError.message)
  }

  const performance = calculatePerformance((predictions ?? []) as PredictionRow[])

  const { data: weights, error: weightError } = await supabaseAdmin
    .from('model_weights')
    .select(
      'sport_key, factor, weight, default_weight, sample_size, win_rate, roi'
    )
    .eq('sport_key', sportKey)

  if (weightError) {
    throw new Error(weightError.message)
  }

  const updates = []

  for (const row of (weights ?? []) as ModelWeightRow[]) {
    const adjustment = getLearningAdjustment({
      weight: Number(row.weight),
      defaultWeight: Number(row.default_weight),
      sampleSize: performance.sampleSize,
      winRate: performance.winRate,
      roi: performance.roi,
    })

    if (adjustment.newWeight !== Number(row.weight)) {
      const { error: historyError } = await supabaseAdmin
        .from('model_weight_history')
        .insert({
          sport_key: row.sport_key,
          factor: row.factor,
          old_weight: Number(row.weight),
          new_weight: adjustment.newWeight,
          sample_size: performance.sampleSize,
          win_rate: performance.winRate,
          roi: performance.roi,
          adjustment_reason: adjustment.reason,
        })

      if (historyError) {
        console.error('Model weight history error:', historyError.message)
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('model_weights')
      .update({
        weight: adjustment.newWeight,
        sample_size: performance.sampleSize,
        win_rate: performance.winRate,
        roi: performance.roi,
        adjustment_reason: adjustment.reason,
        updated_at: new Date().toISOString(),
      })
      .eq('sport_key', row.sport_key)
      .eq('factor', row.factor)

    if (updateError) {
      throw new Error(updateError.message)
    }

    updates.push({
      factor: row.factor,
      oldWeight: Number(row.weight),
      newWeight: adjustment.newWeight,
      changed: adjustment.newWeight !== Number(row.weight),
      reason: adjustment.reason,
    })
  }

  const currentWeights = await getModelWeights(sportKey)

  let modelVersion = null

  try {
    modelVersion = await saveModelVersion({
      sportKey,
      calibrationScore: 0,
      roi: performance.roi,
      winRate: performance.winRate,
      sampleSize: performance.sampleSize,
      weights: currentWeights,
    })
  } catch (error) {
    console.error('Model version save failed:', error)
  }

  return {
    success: true,
    sportKey,
    performance,
    updates,
    modelVersion,
    generatedAt: new Date().toISOString(),
  }
}
export async function rollbackModelVersion(version: number) {
  const { data, error } = await supabaseAdmin
    .from('model_versions')
    .select('*')
    .eq('version', version)
    .single()

  if (error || !data) {
    throw new Error('Version not found')
  }

  const weights = data.weights as Record<string, number>

  for (const factor of Object.keys(weights)) {
    await supabaseAdmin
      .from('model_weights')
      .update({
        weight: weights[factor],
        updated_at: new Date().toISOString(),
        adjustment_reason: `Rollback to version ${version}`,
      })
      .eq('sport_key', data.sport_key)
      .eq('factor', factor)
  }

  return {
    success: true,
    restoredVersion: version,
    restoredWeights: weights,
    generatedAt: new Date().toISOString(),
  }
}
type CandidateWeights = Record<ModelFactor, number>

function randomWeight(base: number) {
  return Number(
    (base * (0.9 + Math.random() * 0.2)).toFixed(4)
  )
}

function randomCandidate(): CandidateWeights {
  return {
    homeAwayAdvantage: randomWeight(defaultWeights.homeAwayAdvantage),
    headToHeadAdvantage: randomWeight(defaultWeights.headToHeadAdvantage),
    pitcherAdvantage: randomWeight(defaultWeights.pitcherAdvantage),
    injuryImpact: randomWeight(defaultWeights.injuryImpact),
    weatherImpact: randomWeight(defaultWeights.weatherImpact),
  }
}
function scoreCandidate(
  roi: number,
  winRate: number,
  calibration: number
) {
  return (
    roi * 0.55 +
    winRate * 0.30 +
    calibration * 0.15
  )
}
export async function runAutoModelTuning(sportKey = 'baseball_mlb') {
  const optimization = await optimizeModelWeights({
    sportKey,
    candidates: 100,
  })

  const bestWeights = optimization.bestWeights

  for (const factor of Object.keys(bestWeights)) {
    await supabaseAdmin
      .from('model_weights')
      .update({
        weight: bestWeights[factor as ModelFactor],
        updated_at: new Date().toISOString(),
        adjustment_reason: 'Auto tuning historical replay',
      })
      .eq('sport_key', sportKey)
      .eq('factor', factor)
  }

  const calibration = await getModelCalibration()

  const version = await saveModelVersion({
    sportKey,
    calibrationScore:
      calibration?.overall?.calibrationScore ??
      0,
    roi: optimization.bestResult.roi ?? 0,
    winRate: optimization.bestResult.winRate ?? 0,
    sampleSize: optimization.bestResult.sample ?? 0,
    weights: bestWeights,
  })

  return {
    success: true,
    sportKey,
    version,
    bestScore: optimization.bestResult.score,
    bestWeights,
    candidatesTested: optimization.candidatesTested,
    backtest: optimization.bestResult,
    topCandidates: optimization.topCandidates,
    generatedAt: new Date().toISOString(),
  }
}