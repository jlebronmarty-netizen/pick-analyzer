import { getTopPicks } from '@/services/top-picks.service'
import {
  isOfficialRecommendationStatus,
  RECOMMENDATION_THRESHOLDS_V1,
  type RecommendationStatus,
} from '@/services/recommendation-eligibility-policy.service'

type BetSelection = {
  id?: string
  team: string
  opponent: string
  sportsbook: string
  odds: number
  confidence: number
  edge: number
  ev: number
  model_probability?: number
  smart_score?: number
  adaptive_score?: number
  recommended_stake?: number
  sport_key?: string
  market?: string
  recommendation_status?: RecommendationStatus
  recommendationStatus?: RecommendationStatus
}

type TicketType = 'safe' | 'balanced' | 'high_ev' | 'longshot'

function round(value: number) {
  return Number(value.toFixed(2))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function impliedProbability(odds: number) {
  if (odds > 0) return 100 / (odds + 100)
  return Math.abs(odds) / (Math.abs(odds) + 100)
}

function decimalOdds(american: number) {
  if (american > 0) return 1 + american / 100
  return 1 + 100 / Math.abs(american)
}

function americanFromDecimal(decimal: number) {
  if (decimal >= 2) return round((decimal - 1) * 100)
  return round(-100 / (decimal - 1))
}

function pickScore(pick: BetSelection, mode: TicketType = 'balanced') {
  const adaptive = Number(pick.adaptive_score ?? pick.smart_score ?? 0)
  const confidence = Number(pick.confidence ?? 0)
  const ev = Number(pick.ev ?? 0)
  const edge = Number(pick.edge ?? 0)
  const odds = Number(pick.odds ?? 0)

  if (mode === 'safe') {
    return adaptive * 0.35 + confidence * 0.4 + edge * 0.15 + ev * 0.1
  }

  if (mode === 'high_ev') {
    return adaptive * 0.25 + confidence * 0.2 + edge * 0.2 + ev * 0.35
  }

  if (mode === 'longshot') {
    return adaptive * 0.25 + confidence * 0.2 + ev * 0.3 + Math.max(odds, 0) * 0.03
  }

  return adaptive * 0.35 + confidence * 0.25 + edge * 0.15 + ev * 0.25
}

function detectCorrelation(picks: BetSelection[]) {
  const teams = new Set<string>()
  const games = new Set<string>()
  let duplicates = 0

  for (const pick of picks) {
    const teamKey = `${pick.team}`.toLowerCase()
    const gameKey = [pick.team, pick.opponent]
      .map((value) => `${value}`.toLowerCase().trim())
      .sort()
      .join(' vs ')

    if (teams.has(teamKey)) duplicates += 1
    if (games.has(gameKey)) duplicates += 1

    teams.add(teamKey)
    games.add(gameKey)
  }

  const riskScore = clamp(duplicates * 35, 0, 100)

  return {
    level: riskScore >= 70 ? 'HIGH' : riskScore >= 35 ? 'MEDIUM' : 'LOW',
    score: riskScore,
    notes:
      riskScore > 0
        ? ['Some legs may be related by team or matchup. Review before betting.']
        : ['No obvious same-team or same-game correlation detected.'],
  }
}

function calculateTicket(picks: BetSelection[], bankroll: number, label: string) {
  if (!picks.length) {
    return {
      label,
      legs: 0,
      qualityScore: null,
      riskLevel: 'NO_TICKET',
      riskScore: null,
      correlation: {
        level: 'NOT_APPLICABLE',
        score: null,
        notes: ['No eligible picks are available to build a ticket.'],
      },
      americanOdds: null,
      decimalOdds: null,
      probability: null,
      expectedValue: null,
      averageConfidence: null,
      averageEv: null,
      averageEdge: null,
      recommendedStake: 0,
      estimatedPayout: 0,
      expectedProfit: 0,
      kelly: {
        full: 0,
        half: 0,
        quarter: 0,
      },
      distribution: {
        winProbability: null,
        lossProbability: null,
        estimatedWinProfit: 0,
        estimatedLoss: 0,
      },
      explanation: {
        summary: 'No eligible picks are available to build a ticket.',
        reasons: [
          'Official ticket construction requires at least one qualified pick.',
          'Parlay construction requires at least two qualified, non-correlated legs.',
        ],
      },
      picks,
    }
  }

  let combinedDecimal = 1
  let combinedProbability = 1

  for (const pick of picks) {
    combinedDecimal *= decimalOdds(Number(pick.odds ?? 0))
    combinedProbability *= Number(pick.model_probability ?? pick.confidence ?? 0) / 100
  }

  const americanOdds = americanFromDecimal(combinedDecimal)

  const expectedValue = round(
    (combinedProbability * (combinedDecimal - 1) - (1 - combinedProbability)) *
      100
  )

  const averageConfidence =
    picks.length > 0
      ? picks.reduce((sum, pick) => sum + Number(pick.confidence ?? 0), 0) /
        picks.length
      : 0

  const averageEv =
    picks.length > 0
      ? picks.reduce((sum, pick) => sum + Number(pick.ev ?? 0), 0) / picks.length
      : 0

  const averageEdge =
    picks.length > 0
      ? picks.reduce((sum, pick) => sum + Number(pick.edge ?? 0), 0) /
        picks.length
      : 0

  const averageScore =
    picks.length > 0
      ? picks.reduce(
          (sum, pick) =>
            sum + Number(pick.adaptive_score ?? pick.smart_score ?? 0),
          0
        ) / picks.length
      : 0

  const correlation = detectCorrelation(picks)

  const qualityScore = round(
    clamp(
      averageScore * 0.35 +
        averageConfidence * 0.25 +
        averageEv * 0.25 +
        averageEdge * 0.15 -
        correlation.score * 0.25,
      0,
      100
    )
  )

  const riskScore = round(
    clamp(
      picks.length * 12 +
        Math.max(0, 60 - averageConfidence) +
        correlation.score * 0.45 -
        Math.max(0, averageEv) * 0.15,
      0,
      100
    )
  )

  const riskLevel =
    riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW'

  const baseStakePercent =
    riskLevel === 'LOW' ? 0.025 : riskLevel === 'MEDIUM' ? 0.015 : 0.0075

  const kellyStake = round(
    bankroll *
      clamp(
        (combinedProbability * combinedDecimal - 1) / (combinedDecimal - 1),
        0,
        0.05
      )
  )

  const recommendedStake = round(
    Math.max(1, Math.min(bankroll * baseStakePercent, kellyStake || bankroll * 0.01))
  )

  const payout = round(recommendedStake * combinedDecimal)

  return {
    label,
    legs: picks.length,
    qualityScore,
    riskLevel,
    riskScore,
    correlation,
    americanOdds,
    decimalOdds: round(combinedDecimal),
    probability: round(combinedProbability * 100),
    expectedValue,
    averageConfidence: round(averageConfidence),
    averageEv: round(averageEv),
    averageEdge: round(averageEdge),
    recommendedStake,
    estimatedPayout: payout,
    expectedProfit: round(recommendedStake * (expectedValue / 100)),
    kelly: {
      full: kellyStake,
      half: round(kellyStake * 0.5),
      quarter: round(kellyStake * 0.25),
    },
    distribution: {
      winProbability: round(combinedProbability * 100),
      lossProbability: round((1 - combinedProbability) * 100),
      estimatedWinProfit: round(payout - recommendedStake),
      estimatedLoss: recommendedStake,
    },
    explanation: buildExplanation({
      picks,
      qualityScore,
      riskLevel,
      expectedValue,
      correlationLevel: correlation.level,
    }),
    picks,
  }
}

function buildExplanation({
  picks,
  qualityScore,
  riskLevel,
  expectedValue,
  correlationLevel,
}: {
  picks: BetSelection[]
  qualityScore: number
  riskLevel: string
  expectedValue: number
  correlationLevel: string
}) {
  const bestPick = [...picks].sort(
    (a, b) => pickScore(b, 'balanced') - pickScore(a, 'balanced')
  )[0]

  const reasons = [
    `Ticket quality score is ${qualityScore}/100.`,
    `Projected EV is ${expectedValue.toFixed(2)}%.`,
    `Correlation risk is ${correlationLevel}.`,
  ]

  if (bestPick) {
    reasons.push(
      `${bestPick.team} is the strongest leg by combined adaptive score, EV and confidence.`
    )
  }

  if (riskLevel === 'LOW') {
    reasons.push('Risk profile is favorable for a controlled stake.')
  } else if (riskLevel === 'MEDIUM') {
    reasons.push('Risk profile is playable, but stake should remain conservative.')
  } else {
    reasons.push('Risk profile is aggressive. Use smaller stake sizing.')
  }

  return {
    summary: `${picks.length}-leg ticket graded ${qualityScore}/100 with ${riskLevel} risk and ${expectedValue.toFixed(
      2
    )}% projected EV.`,
    reasons,
  }
}

function buildTicket(
  picks: BetSelection[],
  bankroll: number,
  maxLegs: number,
  mode: TicketType,
  label: string
) {
  const filtered = [...picks]
    .filter((pick) => {
      if (
        !isOfficialRecommendationStatus(
          (pick.recommendation_status ?? pick.recommendationStatus ?? 'INELIGIBLE') as RecommendationStatus
        )
      ) {
        return false
      }
      if (pick.ev < RECOMMENDATION_THRESHOLDS_V1.minimumOfficialEv) return false
      if (pick.edge < RECOMMENDATION_THRESHOLDS_V1.minimumOfficialEdge) return false
      if (mode === 'safe') return pick.odds < 250 && pick.confidence >= 65
      if (mode === 'longshot') return pick.odds > -250
      return true
    })
    .sort((a, b) => pickScore(b, mode) - pickScore(a, mode))
    .slice(0, maxLegs)

  return calculateTicket(filtered, bankroll, label)
}

export async function optimizeBetSlip({
  bankroll = 1000,
  maxLegs = 4,
}: {
  bankroll?: number
  maxLegs?: number
}) {
  const data = await getTopPicks()

  const pool = [...data.bestBets, ...data.topEv, ...data.topConfidence]
    .filter((pick: any, index, arr) => {
      const key = `${pick.team}-${pick.opponent}-${pick.odds}`
      return arr.findIndex((item: any) => `${item.team}-${item.opponent}-${item.odds}` === key) === index
    })
    .map((pick: any) => ({
      ...pick,
      sportsbook: pick.sportsbook ?? 'Sportsbook',
    })) as BetSelection[]

  const noTicket = pool.length === 0

  const balanced = buildTicket(pool, bankroll, maxLegs, 'balanced', 'Balanced Parlay')
  const safe = buildTicket(pool, bankroll, Math.min(maxLegs, 3), 'safe', 'Safe Parlay')
  const highEv = buildTicket(pool, bankroll, maxLegs, 'high_ev', 'High EV Parlay')
  const longshot = buildTicket(pool, bankroll, maxLegs, 'longshot', 'Longshot Value')

  const alternatives = [balanced, safe, highEv, longshot].sort(
    (a, b) => Number(b.qualityScore ?? -1) - Number(a.qualityScore ?? -1)
  )

  const bestTicket = alternatives[0]

  const singles = [...pool]
    .sort((a, b) => pickScore(b, 'balanced') - pickScore(a, 'balanced'))
    .slice(0, 8)
    .map((pick) => ({
      ...pick,
      impliedProbability: round(impliedProbability(pick.odds) * 100),
      score: round(pickScore(pick, 'balanced')),
    }))

  return {
    success: true,
    mode: noTicket ? 'no_ticket' : 'optimized_ticket',
    emptyState: noTicket
      ? {
          message: 'No eligible picks are available to build a ticket.',
          reason:
            'Official picks must satisfy production gate, calibration, quality and value thresholds before optimizer activation.',
        }
      : null,
    generatedAt: new Date().toISOString(),
    bankroll,
    requestedLegs: maxLegs,

    ticketQualityScore: bestTicket.qualityScore,
    riskLevel: bestTicket.riskLevel,
    riskScore: bestTicket.riskScore,
    correlation: bestTicket.correlation,

    recommendedStake: bestTicket.recommendedStake,
    estimatedPayout: bestTicket.estimatedPayout,
    expectedProfit: bestTicket.expectedProfit,

    kelly: bestTicket.kelly,
    distribution: bestTicket.distribution,
    explanation: bestTicket.explanation,

    parlay: bestTicket,
    alternatives,
    singles,
  }
}
