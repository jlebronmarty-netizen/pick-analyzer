export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function getMaxModelProbabilityForOdds(americanOdds: number) {
  if (americanOdds >= 3000) return 7
  if (americanOdds >= 2000) return 10
  if (americanOdds >= 1500) return 12
  if (americanOdds >= 1000) return 15
  if (americanOdds >= 700) return 20
  if (americanOdds >= 500) return 25

  return 97
}

export function adjustModelProbabilityForExtremeOdds(
  modelProbability: number,
  americanOdds: number
) {
  const maxProbability = getMaxModelProbabilityForOdds(americanOdds)

  return Number(clamp(modelProbability, 3, maxProbability).toFixed(2))
}

export function isRecommendedPick({
  americanOdds,
  impliedProbability,
  modelProbability,
  edge,
  ev,
  confidence,
}: {
  americanOdds: number
  impliedProbability: number
  modelProbability: number
  edge: number
  ev: number
  confidence: number
}) {
  if (americanOdds >= 1000) {
    return (
      modelProbability <= 15 &&
      edge >= 6 &&
      ev >= 8 &&
      confidence >= 65
    )
  }

  return (
    ev > 3 &&
    edge > 4 &&
    confidence >= 60 &&
    modelProbability > impliedProbability
  )
}