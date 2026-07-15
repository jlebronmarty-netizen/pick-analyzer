import { calculateStakeFromKelly } from '@/services/bankroll.service'
import {
  analyzeCorrelation,
  CorrelationResult,
  removeHighlyCorrelatedPicks,
} from '@/services/correlation.service'
import { calculateExposure, ExposureSummary } from '@/services/exposure.service'
import { optimizePortfolio } from '@/services/portfolio-optimizer.service'
import { calculatePortfolioScore } from '@/services/portfolio-scoring.service'
import { getSportsbookIntelligence } from '@/services/sportsbook-intelligence.service'
import { getTopPicks } from '@/services/top-picks.service'

type PortfolioPick = {
  id: string
  team: string
  opponent: string
  sport_key: string
  game_id?: string
  market?: string
  sportsbook?: string
  odds: number
  formattedOdds?: string
  confidence: number
  ev: number
  edge: number
  risk_grade?: string
  risk_label?: string
  kelly_percent?: number
  recommended_stake?: number
  smart_score?: number
  lineValue?: number
  valueGap?: number
  sharpSignal?: boolean
  sharpLabel?: string
  bettingUrgency?: string
  urgencyScore?: number
  bestSportsbook?: string
  formattedBestOdds?: string
  aiRecommendation?: string
  aiSummary?: string
}

type Portfolio = {
  name: string
  style: string
  expectedRoi: number
  averageConfidence: number
  totalStake: number
  expectedProfit: number
  riskScore: number
  diversificationScore: number
  portfolioScore: number
  correlationScore: number
  correlationRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  correlationWarnings: string[]
  exposureSummary: ExposureSummary
  warnings: string[]
  picks: PortfolioPick[]
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function calculateAverageConfidence(picks: PortfolioPick[]) {
  if (!picks.length) return 0
  return round(picks.reduce((sum, pick) => sum + pick.confidence, 0) / picks.length)
}

function calculateExpectedRoi(picks: PortfolioPick[]) {
  if (!picks.length) return 0
  return round(picks.reduce((sum, pick) => sum + pick.ev, 0) / picks.length)
}

function calculateTotalStake(picks: PortfolioPick[]) {
  return round(
    picks.reduce((sum, pick) => sum + (pick.recommended_stake ?? 0), 0)
  )
}

function calculateExpectedProfit(picks: PortfolioPick[]) {
  return round(
    picks.reduce((sum, pick) => {
      const stake = pick.recommended_stake ?? 0
      return sum + stake * ((pick.ev ?? 0) / 100)
    }, 0)
  )
}

function applyBankroll(
  picks: PortfolioPick[],
  bankroll: number,
  maxStakePercent?: number
) {
  return picks.map((pick) => ({
    ...pick,
    recommended_stake: calculateStakeFromKelly({
      bankroll,
      kellyPercent: pick.kelly_percent,
      riskGrade: pick.risk_grade,
      maxStakePercent,
    }),
  }))
}

function dedupePicks(picks: PortfolioPick[]) {
  const map = new Map<string, PortfolioPick>()

  for (const pick of picks) {
    const key = `${pick.sport_key}:${pick.game_id ?? ''}:${pick.team}:${pick.opponent}`
    const existing = map.get(key)

    const pickScore =
      (pick.urgencyScore ?? 0) +
      (pick.smart_score ?? 0) +
      (pick.lineValue ?? 0) +
      pick.confidence +
      pick.ev

    const existingScore = existing
      ? (existing.urgencyScore ?? 0) +
        (existing.smart_score ?? 0) +
        (existing.lineValue ?? 0) +
        existing.confidence +
        existing.ev
      : -1

    if (!existing || pickScore > existingScore) {
      map.set(key, pick)
    }
  }

  return [...map.values()]
}

function sortPremium(a: PortfolioPick, b: PortfolioPick) {
  return (
    Number(b.bettingUrgency === 'BET_NOW') -
      Number(a.bettingUrgency === 'BET_NOW') ||
    Number(Boolean(b.sharpSignal)) - Number(Boolean(a.sharpSignal)) ||
    (b.urgencyScore ?? 0) - (a.urgencyScore ?? 0) ||
    (b.smart_score ?? 0) - (a.smart_score ?? 0) ||
    (b.lineValue ?? 0) - (a.lineValue ?? 0) ||
    b.confidence - a.confidence ||
    b.ev - a.ev
  )
}

function buildPortfolioFromCandidates({
  name,
  style,
  candidates,
  bankroll,
  maxPicks,
  maxStakePercent,
  maxPerTeam,
  maxPerSport,
}: {
  name: string
  style: string
  candidates: PortfolioPick[]
  bankroll: number
  maxPicks: number
  maxStakePercent?: number
  maxPerTeam?: number
  maxPerSport?: number
}): Portfolio {
  const cleanCandidates = removeHighlyCorrelatedPicks(
    candidates.sort(sortPremium),
    maxPerTeam ?? 1,
    maxPerSport ?? 3
  )

  const staked = applyBankroll(cleanCandidates, bankroll, maxStakePercent)

  const selected = optimizePortfolio(staked, bankroll, name).slice(0, maxPicks)

  const expectedRoi = calculateExpectedRoi(selected)
  const averageConfidence = calculateAverageConfidence(selected)
  const totalStake = calculateTotalStake(selected)
  const expectedProfit = calculateExpectedProfit(selected)
  const exposureSummary = calculateExposure(selected)
  const correlation: CorrelationResult = analyzeCorrelation(selected)

  const scores = calculatePortfolioScore({
    expectedRoi,
    averageConfidence,
    totalStake,
    bankroll,
    exposure: exposureSummary,
  })

  const warnings = [...exposureSummary.warnings, ...correlation.warnings]

  return {
    name,
    style,
    expectedRoi,
    averageConfidence,
    totalStake,
    expectedProfit,
    riskScore: scores.riskScore,
    diversificationScore: scores.diversificationScore,
    portfolioScore: scores.portfolioScore,
    correlationScore: correlation.correlationScore,
    correlationRiskLevel: correlation.riskLevel,
    correlationWarnings: correlation.warnings,
    exposureSummary,
    warnings,
    picks: selected,
  }
}

function convertIntelligencePick(item: any): PortfolioPick {
  return {
    id: item.id ?? `${item.gameId}-${item.team}`,
    team: item.team,
    opponent: item.opponent,
    sport_key: item.sportKey ?? item.sport_key,
    game_id: item.gameId ?? item.game_id,
    market: item.market ?? 'moneyline',
    sportsbook: item.bestSportsbook ?? item.sportsbook,
    odds: item.bestOdds ?? item.odds,
    formattedOdds: item.formattedBestOdds ?? item.formattedOdds,
    confidence: Number(item.confidence ?? 0),
    ev: Number(item.ev ?? 0),
    edge: Number(item.edge ?? 0),
    risk_grade: item.riskGrade ?? item.risk_grade,
    risk_label: item.riskLabel ?? item.risk_label,
    kelly_percent: item.kellyPercent ?? item.kelly_percent,
    recommended_stake: item.recommendedStake ?? item.recommended_stake,
    smart_score: item.smartScore ?? item.smart_score,
    lineValue: item.lineValue,
    valueGap: item.valueGap,
    sharpSignal: item.sharpSignal,
    sharpLabel: item.sharpLabel,
    bettingUrgency: item.bettingUrgency,
    urgencyScore: item.urgencyScore,
    bestSportsbook: item.bestSportsbook,
    formattedBestOdds: item.formattedBestOdds,
    aiRecommendation: item.aiRecommendation,
    aiSummary: item.aiSummary,
  }
}

export async function buildPortfolios(bankroll = 1000) {
  const topPicks = await getTopPicks()
  const officialPickCount = Number(topPicks.summary?.recommendedPicks ?? 0)
  const sportsbook = officialPickCount
    ? await getSportsbookIntelligence({
      sportKey: 'baseball_mlb',
      bankroll,
    })
    : {
        success: true,
        sportKey: 'baseball_mlb',
        bankroll,
        generatedAt: new Date().toISOString(),
        summary: {
          gamesChecked: 0,
          sportsbookMarketsChecked: 0,
          opportunities: 0,
          betNow: 0,
          sharpSignals: 0,
          steamMoves: 0,
          staleLines: 0,
          averageLineValue: 0,
          averageSharpConfidence: 0,
          averageUrgencyScore: 0,
        },
        lists: {
          betNow: [],
          bestOdds: [],
          bestClv: [],
          sharpMoney: [],
          steamMoves: [],
          staleLines: [],
        },
      }

  const standardPicks = dedupePicks([
    ...(topPicks.bestBets as PortfolioPick[]),
    ...(topPicks.topEv as PortfolioPick[]),
    ...(topPicks.topConfidence as PortfolioPick[]),
  ])

  const intelligencePicks = dedupePicks([
    ...sportsbook.lists.betNow.map(convertIntelligencePick),
    ...sportsbook.lists.bestOdds.map(convertIntelligencePick),
    ...sportsbook.lists.sharpMoney.map(convertIntelligencePick),
    ...sportsbook.lists.staleLines.map(convertIntelligencePick),
  ])

  const conservative = buildPortfolioFromCandidates({
    name: 'Conservative',
    style: 'Safest high-confidence singles with low correlation.',
    candidates: standardPicks.filter(
      (pick) =>
        ['A+', 'A'].includes(pick.risk_grade ?? '') &&
        pick.confidence >= 75 &&
        pick.ev >= 5
    ),
    bankroll,
    maxPicks: 3,
    maxStakePercent: 4,
    maxPerTeam: 1,
    maxPerSport: 2,
  })

  const balanced = buildPortfolioFromCandidates({
    name: 'Balanced',
    style: 'Balanced mix of confidence, EV and diversification.',
    candidates: standardPicks.filter(
      (pick) =>
        ['A+', 'A', 'B'].includes(pick.risk_grade ?? '') &&
        pick.confidence >= 65 &&
        pick.ev >= 5
    ),
    bankroll,
    maxPicks: 5,
    maxStakePercent: 5,
    maxPerTeam: 1,
    maxPerSport: 3,
  })

  const aggressive = buildPortfolioFromCandidates({
    name: 'Aggressive',
    style: 'Higher upside plays with stronger EV but more volatility.',
    candidates: standardPicks.filter(
      (pick) =>
        ['A+', 'A', 'B', 'C'].includes(pick.risk_grade ?? '') &&
        pick.ev >= 8
    ),
    bankroll,
    maxPicks: 8,
    maxStakePercent: 6,
    maxPerTeam: 1,
    maxPerSport: 4,
  })

  const sharpMoney = buildPortfolioFromCandidates({
    name: 'Sharp Money',
    style: 'Sportsbook intelligence picks with sharp or stale-line signals.',
    candidates: intelligencePicks.filter(
      (pick) =>
        pick.sharpSignal === true &&
        pick.confidence >= 60 &&
        pick.ev >= 5
    ),
    bankroll,
    maxPicks: 5,
    maxStakePercent: 4,
    maxPerTeam: 1,
    maxPerSport: 3,
  })

  const bestClv = buildPortfolioFromCandidates({
    name: 'Best CLV',
    style: 'Best line-value and expected closing-line opportunities.',
    candidates: intelligencePicks.filter(
      (pick) =>
        (pick.lineValue ?? 0) >= 3 &&
        pick.confidence >= 55 &&
        pick.ev >= 3
    ),
    bankroll,
    maxPicks: 5,
    maxStakePercent: 3,
    maxPerTeam: 1,
    maxPerSport: 3,
  })

  const bestSingles = dedupePicks([...standardPicks, ...intelligencePicks])
    .sort(sortPremium)
    .slice(0, 10)

  const avoidList = dedupePicks([...standardPicks, ...intelligencePicks])
    .filter(
      (pick) =>
        pick.confidence < 60 ||
        pick.ev < 3 ||
        pick.edge < 3 ||
        pick.bettingUrgency === 'AVOID'
    )
    .sort((a, b) => a.confidence - b.confidence || a.ev - b.ev)
    .slice(0, 10)

  return {
    success: true,
    bankroll,
    generatedAt: new Date().toISOString(),
    summary: {
      sourcePicks: standardPicks.length,
      intelligencePicks: intelligencePicks.length,
      bestSingles: bestSingles.length,
      avoidList: avoidList.length,
    },
    portfolios: {
      conservative,
      balanced,
      aggressive,
      sharpMoney,
      bestClv,
    },
    bestSingles,
    avoidList,
  }
}
