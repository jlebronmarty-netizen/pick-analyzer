import {
  calculatePredictionV2,
  PredictionInput,
  PredictionResult,
} from './prediction-engine-v2'

export type PredictionV3Factors = {
  homeAwayAdvantage?: number
  headToHeadAdvantage?: number
  pitcherAdvantage?: number
  injuryImpact?: number
  weatherImpact?: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function round(value: number) {
  return Number(value.toFixed(2))
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

  const adjustedModel = clamp(base.modelProbability + adjustment, 3, 97)

  const edge = adjustedModel - base.impliedProbability

  const decimalOdds =
    base.odds < 0 ? 1 + 100 / Math.abs(base.odds) : 1 + base.odds / 100

  const ev = adjustedModel / 100 * decimalOdds - 1

  const confidence = clamp(
    base.confidence + adjustment * 0.35 + edge * 0.12,
    1,
    99
  )

  return {
    ...base,
    modelProbability: round(adjustedModel),
    edge: round(edge),
    ev: round(ev * 100),
    confidence: round(confidence),
    recommendedPick:
      ev > 0 &&
      edge > 1.5 &&
      confidence >= 55 &&
      adjustedModel > base.impliedProbability,
  }
}