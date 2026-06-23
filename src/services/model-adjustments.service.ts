export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function getMaxModelProbabilityForOdds(americanOdds: number) {
  if (americanOdds >= 3000) return 7
  if (americanOdds >= 2000) return 9
  if (americanOdds >= 1500) return 11
  if (americanOdds >= 1000) return 13
  if (americanOdds >= 700) return 17
  if (americanOdds >= 500) return 22
  if (americanOdds >= 300) return 35

  return 88
}

export function adjustModelProbabilityForExtremeOdds(
  modelProbability: number,
  americanOdds: number
) {
  const maxProbability = getMaxModelProbabilityForOdds(americanOdds)

  return Number(clamp(modelProbability, 3, maxProbability).toFixed(2))
}

export function adjustConfidenceForRisk(
  confidence: number,
  americanOdds: number
) {
  if (americanOdds >= 1000) return Number(clamp(confidence, 1, 68).toFixed(2))
  if (americanOdds >= 700) return Number(clamp(confidence, 1, 72).toFixed(2))
  if (americanOdds >= 500) return Number(clamp(confidence, 1, 76).toFixed(2))
  if (americanOdds >= 300) return Number(clamp(confidence, 1, 82).toFixed(2))

  return Number(clamp(confidence, 1, 92).toFixed(2))
}

export function adjustEvForDisplay(ev: number, americanOdds: number) {
  if (americanOdds >= 1000) return Number(clamp(ev, -100, 60).toFixed(2))
  if (americanOdds >= 700) return Number(clamp(ev, -100, 70).toFixed(2))
  if (americanOdds >= 500) return Number(clamp(ev, -100, 80).toFixed(2))
  if (americanOdds >= 300) return Number(clamp(ev, -100, 90).toFixed(2))

  return Number(clamp(ev, -100, 100).toFixed(2))
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
  if (americanOdds >= 1000) return false

  if (americanOdds >= 500) {
    return (
      modelProbability <= 22 &&
      edge >= 7 &&
      ev >= 10 &&
      confidence >= 66
    )
  }

  if (americanOdds >= 300) {
    return edge >= 7 && ev >= 8 && confidence >= 67
  }

  return (
    ev >= 5 &&
    edge >= 5 &&
    confidence >= 65 &&
    modelProbability > impliedProbability
  )
}