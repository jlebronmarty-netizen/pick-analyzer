export function americanOddsToProbability(odds: number): number {
  if (odds < 0) {
    return Math.abs(odds) / (Math.abs(odds) + 100)
  }

  return 100 / (odds + 100)
}

export function americanOddsToDecimal(odds: number): number {
  if (odds < 0) {
    return 1 + 100 / Math.abs(odds)
  }

  return 1 + odds / 100
}

export function formatProbability(probability: number): string {
  return `${(probability * 100).toFixed(1)}%`
}

export function calculateEV(
  modelProbability: number,
  americanOdds: number
): number {
  const decimalOdds = americanOddsToDecimal(americanOdds)
  return modelProbability * decimalOdds - 1
}

export function formatEV(ev: number): string {
  const sign = ev >= 0 ? '+' : ''
  return `${sign}${(ev * 100).toFixed(1)}%`
}

export function calculateSimpleModelProbability(
  impliedProbability: number
): number {
  return Math.min(impliedProbability + 0.03, 0.95)
}

export function calculateConfidence(edge: number): number {
  const score = 5 + edge * 50
  return Math.max(0, Math.min(10, Number(score.toFixed(1))))
}