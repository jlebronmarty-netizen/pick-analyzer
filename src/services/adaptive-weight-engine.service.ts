import { supabaseAdmin } from '@/lib/supabase-admin'
import { isProductionEligibleRow } from '@/services/production-data-gate.service'

type PredictionRow = {
  sport_key: string
  odds: number | null
  confidence: number | null
  ev: number | null
  edge: number | null
  profit: number | null
  stake: number | null
  status: string | null
  result: string | null
  production_eligible?: boolean | null
  trial?: boolean | null
  scrambled?: boolean | null
}

type AdaptiveAction =
  | 'INSUFFICIENT_DATA'
  | 'INCREASE_WEIGHT'
  | 'REDUCE_WEIGHT'
  | 'HOLD'

function getResult(row: PredictionRow) {
  return row.status ?? row.result ?? 'pending'
}

function safeNumber(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function calculateRoi(rows: PredictionRow[]) {
  const profit = rows.reduce((sum, row) => sum + safeNumber(row.profit), 0)
  const stake = rows.reduce((sum, row) => sum + safeNumber(row.stake), 0)

  return stake ? Number(((profit / stake) * 100).toFixed(2)) : 0
}

function calculateWinRate(rows: PredictionRow[]) {
  const graded = rows.filter((row) => ['win', 'loss'].includes(getResult(row)))
  if (!graded.length) return 0

  const wins = graded.filter((row) => getResult(row) === 'win').length
  return Number(((wins / graded.length) * 100).toFixed(2))
}

function getSignalScore({
  roi,
  winRate,
  sample,
}: {
  roi: number
  winRate: number
  sample: number
}) {
  if (sample < 25) return 0

  const roiSignal = roi >= 10 ? 2 : roi >= 0 ? 1 : roi <= -10 ? -2 : -1
  const winSignal = winRate >= 55 ? 2 : winRate >= 50 ? 1 : winRate <= 45 ? -2 : -1

  return roiSignal + winSignal
}

function getAdjustment(signal: number) {
  if (signal >= 3) return 1.08
  if (signal >= 1) return 1.03
  if (signal <= -3) return 0.92
  if (signal <= -1) return 0.97

  return 1
}

function getAction(sample: number, multiplier: number): AdaptiveAction {
  if (sample < 25) return 'INSUFFICIENT_DATA'
  if (multiplier > 1) return 'INCREASE_WEIGHT'
  if (multiplier < 1) return 'REDUCE_WEIGHT'
  return 'HOLD'
}

export async function getAdaptiveWeightRecommendations(sportKey = 'baseball_mlb') {
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select('sport_key, odds, confidence, ev, edge, profit, stake, status, result, production_eligible, trial, scrambled')
    .eq('sport_key', sportKey)
    .eq('production_eligible', true)

  if (error) {
    throw new Error(error.message)
  }

  const settled = ((data ?? []) as PredictionRow[]).filter(
    (row) => isProductionEligibleRow(row) && ['win', 'loss'].includes(getResult(row))
  )

  const highConfidence = settled.filter((row) => safeNumber(row.confidence) >= 75)
  const highEv = settled.filter((row) => safeNumber(row.ev) >= 10)
  const highEdge = settled.filter((row) => safeNumber(row.edge) >= 8)
  const favorites = settled.filter((row) => safeNumber(row.odds) < 0)
  const underdogs = settled.filter((row) => safeNumber(row.odds) > 0)

  const groups = [
    { factor: 'confidence', rows: highConfidence },
    { factor: 'ev', rows: highEv },
    { factor: 'edge', rows: highEdge },
    { factor: 'favorites', rows: favorites },
    { factor: 'underdogs', rows: underdogs },
  ]

  const recommendations = groups.map((group) => {
    const roi = calculateRoi(group.rows)
    const winRate = calculateWinRate(group.rows)
    const sample = group.rows.length
    const signal = getSignalScore({ roi, winRate, sample })
    const multiplier = getAdjustment(signal)

    return {
      factor: group.factor,
      sample,
      roi,
      winRate,
      signal,
      multiplier,
      action: getAction(sample, multiplier),
    }
  })

  return {
    success: true,
    sportKey,
    generatedAt: new Date().toISOString(),
    sampleSize: settled.length,
    recommendations,
  }
}
