import { calculateStakeFromKelly } from '@/services/bankroll.service'
import { analyzeCorrelation, CorrelationResult } from '@/services/correlation.service'
import { calculateExposure, ExposureSummary } from '@/services/exposure.service'
import { optimizePortfolio } from '@/services/portfolio-optimizer.service'
import { calculatePortfolioScore } from '@/services/portfolio-scoring.service'
import { getTopPicks } from '@/services/top-picks.service'

type PortfolioPick = {
  id: string
  team: string
  opponent: string
  sport_key: string
  game_id?: string
  odds: number
  confidence: number
  ev: number
  edge: number
  risk_grade?: string
  kelly_percent?: number
  recommended_stake?: number
  smart_score?: number
}

type Portfolio = {
  name: string
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

function calculateAverageConfidence(picks: PortfolioPick[]) {
  if (!picks.length) return 0

  return Number(
    (
      picks.reduce((sum, pick) => sum + pick.confidence, 0) / picks.length
    ).toFixed(2)
  )
}

function calculateExpectedRoi(picks: PortfolioPick[]) {
  if (!picks.length) return 0

  return Number(
    (picks.reduce((sum, pick) => sum + pick.ev, 0) / picks.length).toFixed(2)
  )
}

function calculateTotalStake(picks: PortfolioPick[]) {
  return Number(
    picks
      .reduce((sum, pick) => sum + (pick.recommended_stake ?? 0), 0)
      .toFixed(2)
  )
}

function calculateExpectedProfit(picks: PortfolioPick[]) {
  return Number(
    picks
      .reduce((sum, pick) => {
        const stake = pick.recommended_stake ?? 0
        return sum + stake * ((pick.ev ?? 0) / 100)
      }, 0)
      .toFixed(2)
  )
}

function applyBankroll(picks: PortfolioPick[], bankroll: number) {
  return picks.map((pick) => ({
    ...pick,
    recommended_stake: calculateStakeFromKelly({
      bankroll,
      kellyPercent: pick.kelly_percent,
      riskGrade: pick.risk_grade,
    }),
  }))
}

function buildPortfolio(
  name: string,
  grades: string[],
  maxPicks: number,
  picks: PortfolioPick[],
  bankroll: number
): Portfolio {
  const candidates = applyBankroll(
    picks
      .filter((pick) => pick.risk_grade && grades.includes(pick.risk_grade))
      .sort(
        (a, b) =>
          (b.smart_score ?? 0) - (a.smart_score ?? 0) ||
          b.confidence - a.confidence ||
          b.ev - a.ev
      ),
    bankroll
  )

  const selected = optimizePortfolio(candidates, bankroll, name).slice(
    0,
    maxPicks
  )

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

  const warnings = [
    ...exposureSummary.warnings,
    ...correlation.warnings,
  ]

  return {
    name,
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

export async function buildPortfolios(bankroll = 1000) {
  const topPicks = await getTopPicks()
  const sourcePicks = topPicks.bestBets as PortfolioPick[]

  const conservative = buildPortfolio(
    'Conservative',
    ['A+', 'A'],
    3,
    sourcePicks,
    bankroll
  )

  const balanced = buildPortfolio(
    'Balanced',
    ['A+', 'A', 'B'],
    5,
    sourcePicks,
    bankroll
  )

  const aggressive = buildPortfolio(
    'Aggressive',
    ['A+', 'A', 'B', 'C'],
    8,
    sourcePicks,
    bankroll
  )

  return {
    success: true,
    bankroll,
    generatedAt: new Date().toISOString(),
    portfolios: {
      conservative,
      balanced,
      aggressive,
    },
  }
}