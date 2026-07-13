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

export type PredictionV4Weights = {
  homeAwayAdvantage?: number
  headToHeadAdvantage?: number
  pitcherAdvantage?: number
  injuryImpact?: number
  weatherImpact?: number
}

const defaultWeights: Required<PredictionV4Weights> = {
  homeAwayAdvantage: 1.05,
  headToHeadAdvantage: 1.15,
  pitcherAdvantage: 1.45,
  injuryImpact: 1.3,
  weatherImpact: 0.75,
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function getDecimalOdds(americanOdds: number) {
  return americanOdds < 0
    ? 1 + 100 / Math.abs(americanOdds)
    : 1 + americanOdds / 100
}

function getWeight(
  weights: PredictionV4Weights | undefined,
  key: keyof PredictionV4Weights
) {
  return weights?.[key] ?? defaultWeights[key]
}

function calculateWeightedFactorAdjustment(
  factors: PredictionV3Factors,
  weights?: PredictionV4Weights
) {
  const homeAway =
    (factors.homeAwayAdvantage ?? 0) *
    getWeight(weights, 'homeAwayAdvantage')

  const headToHead =
    (factors.headToHeadAdvantage ?? 0) *
    getWeight(weights, 'headToHeadAdvantage')

  const pitcher =
    (factors.pitcherAdvantage ?? 0) *
    getWeight(weights, 'pitcherAdvantage')

  const injury =
    (factors.injuryImpact ?? 0) *
    getWeight(weights, 'injuryImpact')

  const weather =
    (factors.weatherImpact ?? 0) *
    getWeight(weights, 'weatherImpact')

  return homeAway + headToHead + pitcher - injury + weather
}

export function calculatePredictionV4(
  input: PredictionInput,
  factors: PredictionV3Factors = {},
  weights?: PredictionV4Weights
): PredictionResult {
  const base = calculatePredictionV3(input, factors)

  const weightedAdjustment = calculateWeightedFactorAdjustment(
    factors,
    weights
  )

  const rawModelProbability = clamp(
    base.modelProbability + weightedAdjustment * 0.45,
    3,
    97
  )

  const adjustedModelProbability = adjustModelProbabilityForExtremeOdds(
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

  const roundedModelProbability = round(adjustedModelProbability)
  const roundedEdge = round(edge)

  const roundedEv = adjustEvForDisplay(
    round(ev * 100),
    base.odds
  )

  const roundedConfidence = adjustConfidenceForRisk(
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
      modelProbability: roundedModelProbability,
      edge: roundedEdge,
      ev: roundedEv,
      confidence: roundedConfidence,
    }),
  }
}