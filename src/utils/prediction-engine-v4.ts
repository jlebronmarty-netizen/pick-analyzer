import {
  calculatePredictionV3,
  PredictionInput,
  PredictionResult,
  PredictionV3Factors,
} from './prediction-engine-v3'

import {
  adjustConfidenceForRisk,
  adjustEvForDisplay,
  adjustModelProbabilityForExtremeOdds,
  clamp,
  isRecommendedPick,
} from '@/services/model-adjustments.service'

export type {
  PredictionInput,
  PredictionResult,
  PredictionV3Factors,
  TeamMatchupInput,
  TeamStatsInput,
} from './prediction-engine-v3'

function round(value: number) {
  return Number(value.toFixed(2))
}

function getDecimalOdds(americanOdds: number) {
  return americanOdds < 0
    ? 1 + 100 / Math.abs(americanOdds)
    : 1 + americanOdds / 100
}

function calculateWeightedFactorAdjustment(
  factors: PredictionV3Factors
) {
  const homeAway = (factors.homeAwayAdvantage ?? 0) * 1.05

  const headToHead =
    (factors.headToHeadAdvantage ?? 0) * 1.15

  const pitcher =
    (factors.pitcherAdvantage ?? 0) * 1.45

  const injury =
    (factors.injuryImpact ?? 0) * 1.3

  const weather =
    (factors.weatherImpact ?? 0) * 0.75

  return (
    homeAway +
    headToHead +
    pitcher -
    injury +
    weather
  )
}

export function calculatePredictionV4(
  input: PredictionInput,
  factors: PredictionV3Factors = {}
): PredictionResult {
  const base = calculatePredictionV3(input, factors)

  const weightedAdjustment =
    calculateWeightedFactorAdjustment(factors)

  const rawModelProbability = clamp(
    base.modelProbability + weightedAdjustment * 0.45,
    3,
    97
  )

  const adjustedModelProbability =
    adjustModelProbabilityForExtremeOdds(
      rawModelProbability,
      base.odds
    )

  const edge =
    adjustedModelProbability -
    base.impliedProbability

  const decimalOdds = getDecimalOdds(base.odds)

  const ev =
    (adjustedModelProbability / 100) *
      decimalOdds -
    1

  const confidence = clamp(
    base.confidence +
      weightedAdjustment * 0.4 +
      edge * 0.08,
    1,
    99
  )

  const roundedModelProbability = round(
    adjustedModelProbability
  )

  const roundedEdge = round(edge)

  const roundedEv = adjustEvForDisplay(
    round(ev * 100),
    base.odds
  )

  const roundedConfidence =
    adjustConfidenceForRisk(
      round(confidence),
      base.odds
    )

  return {
    ...base,
    modelProbability: roundedModelProbability,
    edge: roundedEdge,
    ev: roundedEv,
    confidence: roundedConfidence,
    recommendedPick: isRecommendedPick({
      americanOdds: base.odds,
      impliedProbability: base.impliedProbability,
      modelProbability:
        roundedModelProbability,
      edge: roundedEdge,
      ev: roundedEv,
      confidence: roundedConfidence,
    }),
  }
}