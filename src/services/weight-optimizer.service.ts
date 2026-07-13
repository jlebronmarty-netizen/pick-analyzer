import { supabaseAdmin } from '@/lib/supabase-admin'
import { ModelFactor } from '@/services/model-learning.service'

type CandidateWeights = Record<ModelFactor, number>

type ReplayRow = {
  confidence: number | null
  edge: number | null
  ev: number | null
  odds: number | null
  profit: number | null
  stake: number | null
  status: string | null
  result: string | null
}

const defaultWeights: CandidateWeights = {
  homeAwayAdvantage: 1.05,
  headToHeadAdvantage: 1.15,
  pitcherAdvantage: 1.45,
  injuryImpact: 1.3,
  weatherImpact: 0.75,
}

function resultOf(row: ReplayRow) {
  return row.status ?? row.result ?? 'pending'
}

function safe(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function randomWeight(base: number) {
  return Number((base * (0.8 + Math.random() * 0.4)).toFixed(4))
}

function createCandidate(): CandidateWeights {
  return {
    homeAwayAdvantage: randomWeight(defaultWeights.homeAwayAdvantage),
    headToHeadAdvantage: randomWeight(defaultWeights.headToHeadAdvantage),
    pitcherAdvantage: randomWeight(defaultWeights.pitcherAdvantage),
    injuryImpact: randomWeight(defaultWeights.injuryImpact),
    weatherImpact: randomWeight(defaultWeights.weatherImpact),
  }
}

function replayScore(row: ReplayRow, weights: CandidateWeights) {
  const confidence = safe(row.confidence)
  const edge = safe(row.edge)
  const ev = safe(row.ev)
  const odds = safe(row.odds)

  const favoriteBoost = odds < 0 ? weights.homeAwayAdvantage : 1
  const valueBoost = ev >= 8 ? weights.headToHeadAdvantage : 1
  const edgeBoost = edge >= 6 ? weights.pitcherAdvantage : 1
  const riskPenalty = odds > 250 ? weights.injuryImpact : 1
  const weatherPenalty = odds > 400 ? weights.weatherImpact : 1

  return clamp(
    confidence * 0.45 * favoriteBoost +
      ev * 0.3 * valueBoost +
      edge * 0.25 * edgeBoost -
      riskPenalty * 2 -
      weatherPenalty,
    0,
    100
  )
}

function evaluateCandidate(rows: ReplayRow[], weights: CandidateWeights) {
  const selected = rows
    .map((row) => ({
      row,
      score: replayScore(row, weights),
    }))
    .filter((item) => item.score >= 65)
    .sort((a, b) => b.score - a.score)

  const wins = selected.filter((item) => resultOf(item.row) === 'win').length
  const losses = selected.filter((item) => resultOf(item.row) === 'loss').length

  const stake = selected.reduce((sum, item) => sum + safe(item.row.stake), 0)
  const profit = selected.reduce((sum, item) => sum + safe(item.row.profit), 0)

  const sample = wins + losses
  const roi = stake ? Number(((profit / stake) * 100).toFixed(2)) : 0
  const winRate = sample ? Number(((wins / sample) * 100).toFixed(2)) : 0

  const score =
    roi * 0.55 +
    winRate * 0.35 +
    Math.min(sample, 500) * 0.02

  return {
    sample,
    wins,
    losses,
    roi,
    winRate,
    score: Number(score.toFixed(2)),
  }
}

export async function optimizeModelWeights({
  sportKey = 'baseball_mlb',
  candidates = 100,
}: {
  sportKey?: string
  candidates?: number
} = {}) {
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select('confidence, edge, ev, odds, profit, stake, status, result')
    .eq('sport_key', sportKey)
    .eq('recommended_pick', true)

  if (error) {
    throw new Error(error.message)
  }

  const rows = ((data ?? []) as ReplayRow[]).filter((row) =>
    ['win', 'loss'].includes(resultOf(row))
  )

  let bestWeights = defaultWeights
  let bestResult = evaluateCandidate(rows, defaultWeights)

  const tested = [
    {
      weights: defaultWeights,
      result: bestResult,
    },
  ]

  for (let index = 0; index < candidates; index++) {
    const weights = createCandidate()
    const result = evaluateCandidate(rows, weights)

    tested.push({
      weights,
      result,
    })

    if (result.score > bestResult.score) {
      bestResult = result
      bestWeights = weights
    }
  }

  return {
    success: true,
    sportKey,
    sample: rows.length,
    candidatesTested: tested.length,
    bestWeights,
    bestResult,
    topCandidates: tested
      .sort((a, b) => b.result.score - a.result.score)
      .slice(0, 10),
    generatedAt: new Date().toISOString(),
  }
}