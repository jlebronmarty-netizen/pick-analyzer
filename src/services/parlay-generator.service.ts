import {
  analyzeCorrelation,
  removeHighlyCorrelatedPicks,
} from '@/services/correlation.service'
import { getTopPicks } from '@/services/top-picks.service'

type ParlayPick = {
  id: string
  team: string
  opponent: string
  sport_key: string
  game_id?: string
  sportsbook: string
  odds: number
  confidence: number
  ev: number
  edge: number
  risk_grade?: string
  risk_label?: string
  smart_score?: number
  recommended_pick: boolean | null
}

type GeneratedParlay = {
  name: string
  style: 'safe' | 'value' | 'lottery'
  legs: ParlayPick[]
  decimalOdds: number
  americanOdds: number
  estimatedProbability: number
  averageConfidence: number
  averageEv: number
  correlationScore: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  warnings: string[]
}

function decimalOdds(americanOdds: number) {
  return americanOdds > 0
    ? 1 + americanOdds / 100
    : 1 + 100 / Math.abs(americanOdds)
}

function americanFromDecimal(decimal: number) {
  if (decimal >= 2) {
    return Math.round((decimal - 1) * 100)
  }

  return Math.round(-100 / (decimal - 1))
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function average(values: number[]) {
  if (!values.length) return 0

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function buildParlay(
  name: string,
  style: 'safe' | 'value' | 'lottery',
  legs: ParlayPick[]
): GeneratedParlay {
  const decimal = legs.reduce((product, pick) => {
    return product * decimalOdds(pick.odds)
  }, 1)

  const estimatedProbability = legs.reduce((probability, pick) => {
    return probability * ((pick.confidence || 1) / 100)
  }, 1)

  const correlation = analyzeCorrelation(legs)

  return {
    name,
    style,
    legs,
    decimalOdds: round(decimal),
    americanOdds: americanFromDecimal(decimal),
    estimatedProbability: round(estimatedProbability * 100),
    averageConfidence: round(average(legs.map((pick) => pick.confidence))),
    averageEv: round(average(legs.map((pick) => pick.ev))),
    correlationScore: correlation.correlationScore,
    riskLevel: correlation.riskLevel,
    warnings: correlation.warnings,
  }
}

function dedupePicks(picks: ParlayPick[]) {
  const seen = new Set<string>()

  return picks.filter((pick) => {
    const key = `${pick.sport_key}:${pick.team}:${pick.opponent}`

    if (seen.has(key)) return false

    seen.add(key)

    return true
  })
}

export async function generateSmartParlays() {
  const topPicks = await getTopPicks()

  const source = dedupePicks([
    ...(topPicks.bestBets as ParlayPick[]),
    ...(topPicks.topConfidence as ParlayPick[]),
    ...(topPicks.topEv as ParlayPick[]),
  ]).filter(
    (pick) =>
      pick.recommended_pick === true &&
      pick.confidence >= 60 &&
      pick.ev >= 3 &&
      pick.edge >= 4 &&
      pick.odds < 500
  )

  const safeLegs = removeHighlyCorrelatedPicks(
    [...source]
      .filter(
        (pick) =>
          ['A+', 'A'].includes(pick.risk_grade ?? '') &&
          pick.confidence >= 75
      )
      .sort(
        (a, b) =>
          (b.smart_score ?? 0) - (a.smart_score ?? 0) ||
          b.confidence - a.confidence
      ),
    1,
    2
  ).slice(0, 2)

  const valueLegs = removeHighlyCorrelatedPicks(
    [...source]
      .filter((pick) => ['A+', 'A', 'B'].includes(pick.risk_grade ?? ''))
      .sort(
        (a, b) =>
          (b.ev ?? 0) - (a.ev ?? 0) ||
          (b.smart_score ?? 0) - (a.smart_score ?? 0)
      ),
    1,
    3
  ).slice(0, 3)

  const lotteryLegs = removeHighlyCorrelatedPicks(
    [...source]
      .filter(
        (pick) =>
          ['A+', 'A', 'B'].includes(pick.risk_grade ?? '') &&
          pick.odds > 0
      )
      .sort(
        (a, b) =>
          b.odds - a.odds ||
          (b.ev ?? 0) - (a.ev ?? 0)
      ),
    1,
    3
  ).slice(0, 4)

  const parlays: GeneratedParlay[] = []

  if (safeLegs.length >= 2) {
    parlays.push(buildParlay('Safe Parlay', 'safe', safeLegs))
  }

  if (valueLegs.length >= 2) {
    parlays.push(buildParlay('Value Parlay', 'value', valueLegs))
  }

  if (lotteryLegs.length >= 2) {
    parlays.push(buildParlay('Lottery Parlay', 'lottery', lotteryLegs))
  }

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    count: parlays.length,
    parlays,
  }
}