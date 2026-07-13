export type AdaptiveFactor =
  | 'confidence'
  | 'ev'
  | 'edge'
  | 'favorites'
  | 'underdogs'

export type AdaptiveWeightRecommendation = {
  factor: AdaptiveFactor | string
  sample: number
  roi: number
  winRate: number
  signal: number
  multiplier: number
  action:
    | 'INSUFFICIENT_DATA'
    | 'INCREASE_WEIGHT'
    | 'REDUCE_WEIGHT'
    | 'HOLD'
}

export type AdaptiveScoringInput = {
  odds: number
  confidence: number
  ev: number
  edge: number
  smartScore?: number
  adaptiveWeights?: {
    recommendations?: AdaptiveWeightRecommendation[]
  } | null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function getMultiplier(
  recommendations: AdaptiveWeightRecommendation[],
  factor: AdaptiveFactor
) {
  const item = recommendations.find((row) => row.factor === factor)

  if (!item) return 1

  if (item.action === 'INSUFFICIENT_DATA') return 1

  return Number(item.multiplier ?? 1)
}

function getOddsStyleFactor(odds: number): AdaptiveFactor {
  return odds < 0 ? 'favorites' : 'underdogs'
}

export function calculateAdaptiveScore(input: AdaptiveScoringInput) {
  const recommendations = input.adaptiveWeights?.recommendations ?? []

  const confidenceMultiplier = getMultiplier(recommendations, 'confidence')
  const evMultiplier = getMultiplier(recommendations, 'ev')
  const edgeMultiplier = getMultiplier(recommendations, 'edge')
  const oddsMultiplier = getMultiplier(
    recommendations,
    getOddsStyleFactor(input.odds)
  )

  const adjustedConfidence = clamp(
    input.confidence * confidenceMultiplier * oddsMultiplier,
    1,
    99
  )

  const adjustedEv = clamp(
    input.ev * evMultiplier * oddsMultiplier,
    -100,
    300
  )

  const adjustedEdge = clamp(
    input.edge * edgeMultiplier * oddsMultiplier,
    -100,
    100
  )

  const baseScore =
    Number(input.smartScore ?? 0) ||
    input.confidence * 0.45 + input.ev * 0.3 + input.edge * 0.25

  const adaptiveScore = clamp(
    baseScore * 0.55 +
      adjustedConfidence * 0.25 +
      adjustedEv * 0.12 +
      adjustedEdge * 0.08,
    0,
    100
  )

  const adjustmentSummary = {
    confidenceMultiplier,
    evMultiplier,
    edgeMultiplier,
    oddsMultiplier,
  }

  const strongestAdjustment = Object.entries(adjustmentSummary).sort(
    ([, a], [, b]) => Math.abs(Number(b) - 1) - Math.abs(Number(a) - 1)
  )[0]

  return {
    original: {
      confidence: round(input.confidence),
      ev: round(input.ev),
      edge: round(input.edge),
      smartScore: round(baseScore),
    },
    adjusted: {
      confidence: round(adjustedConfidence),
      ev: round(adjustedEv),
      edge: round(adjustedEdge),
      adaptiveScore: round(adaptiveScore),
    },
    multipliers: adjustmentSummary,
    strongestAdjustment: strongestAdjustment
      ? {
          factor: strongestAdjustment[0],
          multiplier: Number(strongestAdjustment[1]),
        }
      : null,
  }
}