import {
  calculatePredictionV2,
  PredictionInput,
  PredictionResult,
} from './prediction-engine-v2'
import {
  adjustModelProbabilityForExtremeOdds,
  clamp,
  isRecommendedPick,
} from '@/services/model-adjustments.service'

export type { PredictionInput, PredictionResult } from './prediction-engine-v2'

export type TeamStatsInput = {
  team_name: string
  sport_key: string
  season: number
  wins: number | null
  losses: number | null
  ties: number | null
  home_wins: number | null
  home_losses: number | null
  away_wins: number | null
  away_losses: number | null
  last_5_wins: number | null
  last_5_losses: number | null
  last_10_wins: number | null
  last_10_losses: number | null
  streak: number | null
  win_percentage: number | null
}

export type TeamMatchupInput = {
  sport_key: string
  team_a: string
  team_b: string
  games_played: number | null
  team_a_wins: number | null
  team_b_wins: number | null
}

export type PredictionV3Factors = {
  homeAwayAdvantage?: number
  headToHeadAdvantage?: number
  pitcherAdvantage?: number
  injuryImpact?: number
  weatherImpact?: number
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function getDecimalOdds(americanOdds: number) {
  return americanOdds < 0
    ? 1 + 100 / Math.abs(americanOdds)
    : 1 + americanOdds / 100
}

export function calculatePredictionV3(
  input: PredictionInput,
  factors: PredictionV3Factors = {}
): PredictionResult {
  const base = calculatePredictionV2(input)

  const adjustment =
    (factors.homeAwayAdvantage ?? 0) +
    (factors.headToHeadAdvantage ?? 0) +
    (factors.pitcherAdvantage ?? 0) -
    (factors.injuryImpact ?? 0) +
    (factors.weatherImpact ?? 0)

  const rawModelProbability = clamp(base.modelProbability + adjustment, 3, 97)

  const adjustedModelProbability = adjustModelProbabilityForExtremeOdds(
    rawModelProbability,
    base.odds
  )

  const edge = adjustedModelProbability - base.impliedProbability
  const decimalOdds = getDecimalOdds(base.odds)
  const ev = (adjustedModelProbability / 100) * decimalOdds - 1

  const confidence = clamp(
    base.confidence + adjustment * 0.35 + edge * 0.12,
    1,
    99
  )

  const roundedModelProbability = round(adjustedModelProbability)
  const roundedEdge = round(edge)
  const roundedEv = round(ev * 100)
  const roundedConfidence = round(confidence)

  return {
    ...base,
    modelProbability: roundedModelProbability,
    edge: roundedEdge,
    ev: roundedEv,
    confidence: roundedConfidence,
    recommendedPick: isRecommendedPick({
      americanOdds: base.odds,
      impliedProbability: base.impliedProbability,
      modelProbability: roundedModelProbability,
      edge: roundedEdge,
      ev: roundedEv,
      confidence: roundedConfidence,
    }),
  }
}