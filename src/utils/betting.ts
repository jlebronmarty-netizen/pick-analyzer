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

export function getPickRating(confidence: number, ev: number): string {
  if (ev <= 0) return 'Pass'
  if (confidence >= 8) return 'Strong Bet'
  if (confidence >= 6.5) return 'Bet'
  return 'Lean'
}

export type PickAnalysis = {
  team: string
  odds: number
  impliedProbability: number
  modelProbability: number
  edge: number
  ev: number
  confidence: number
  rating: string
  hasValue: boolean
}

export function analyzeMoneylinePick(
  team: string,
  odds: number
): PickAnalysis {
  const impliedProbability = americanOddsToProbability(odds)
  const modelProbability = calculateSimpleModelProbability(impliedProbability)
  const edge = modelProbability - impliedProbability
  const ev = calculateEV(modelProbability, odds)
  const confidence = calculateConfidence(edge)

  return {
    team,
    odds,
    impliedProbability,
    modelProbability,
    edge,
    ev,
    confidence,
    rating: getPickRating(confidence, ev),
    hasValue: ev > 0,
  }
}

export function getBestPick(picks: PickAnalysis[]): PickAnalysis | null {
  const valuePicks = picks.filter((pick) => pick.hasValue)

  if (valuePicks.length === 0) {
    return null
  }

  return valuePicks.sort((a, b) => {
    if (b.ev !== a.ev) return b.ev - a.ev
    return b.confidence - a.confidence
  })[0]
}