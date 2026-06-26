import { normalizeBankroll } from '@/services/bankroll.service'
import { buildPortfolios } from '@/services/portfolio-builder.service'

type SimulationPick = {
  team: string
  opponent: string
  odds: number
  confidence: number
  recommended_stake?: number
}

type SimulationPortfolio = {
  name: string
  totalStake: number
  expectedProfit: number
  expectedRoi: number
  averageConfidence: number
  portfolioScore: number
  riskScore: number
  diversificationScore: number
  picks: SimulationPick[]
}

function decimalOdds(americanOdds: number) {
  return americanOdds > 0
    ? 1 + americanOdds / 100
    : 1 + 100 / Math.abs(americanOdds)
}

function calculateProfit(stake: number, americanOdds: number) {
  return stake * (decimalOdds(americanOdds) - 1)
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function simulateOnce(startingBankroll: number, picks: SimulationPick[]) {
  let bankroll = startingBankroll

  for (const pick of picks) {
    const stake = pick.recommended_stake ?? 0
    const winProbability = Math.min(Math.max(pick.confidence / 100, 0.01), 0.99)
    const random = Math.random()

    if (random <= winProbability) {
      bankroll += calculateProfit(stake, pick.odds)
    } else {
      bankroll -= stake
    }
  }

  return round(bankroll)
}

function summarizeResults(results: number[], startingBankroll: number) {
  const sorted = [...results].sort((a, b) => a - b)
  const total = results.reduce((sum, value) => sum + value, 0)

  const expectedBankroll = round(total / results.length)
  const bestCase = round(sorted[sorted.length - 1] ?? startingBankroll)
  const worstCase = round(sorted[0] ?? startingBankroll)

  const riskOfLoss =
    results.filter((value) => value < startingBankroll).length / results.length

  const riskOfRuin =
    results.filter((value) => value <= startingBankroll * 0.5).length /
    results.length

  return {
    expectedBankroll,
    expectedProfit: round(expectedBankroll - startingBankroll),
    averageReturn: round(((expectedBankroll - startingBankroll) / startingBankroll) * 100),
    bestCase,
    worstCase,
    riskOfLoss: round(riskOfLoss * 100),
    riskOfRuin: round(riskOfRuin * 100),
  }
}

function runSimulation({
  portfolio,
  startingBankroll,
  simulations,
}: {
  portfolio: SimulationPortfolio
  startingBankroll: number
  simulations: number
}) {
  const results = Array.from({ length: simulations }, () =>
    simulateOnce(startingBankroll, portfolio.picks)
  )

  return {
    portfolioUsed: portfolio.name,
    portfolioScore: portfolio.portfolioScore,
    riskScore: portfolio.riskScore,
    diversificationScore: portfolio.diversificationScore,
    totalStake: portfolio.totalStake,
    expectedPortfolioProfit: portfolio.expectedProfit,
    expectedPortfolioRoi: portfolio.expectedRoi,
    averageConfidence: portfolio.averageConfidence,
    simulations,
    ...summarizeResults(results, startingBankroll),
  }
}

export async function runPortfolioSimulator({
  bankroll,
  simulations,
}: {
  bankroll?: unknown
  simulations?: unknown
}) {
  const startingBankroll = normalizeBankroll(bankroll)

  const safeSimulations = Math.min(
    Math.max(Number(simulations) || 1000, 100),
    10000
  )

  const portfolioResult = await buildPortfolios(startingBankroll)

  const portfolios = portfolioResult.portfolios as {
    conservative: SimulationPortfolio
    balanced: SimulationPortfolio
    aggressive: SimulationPortfolio
  }

  return {
    success: true,
    startingBankroll,
    simulations: safeSimulations,
    generatedAt: new Date().toISOString(),
    results: {
      conservative: runSimulation({
        portfolio: portfolios.conservative,
        startingBankroll,
        simulations: safeSimulations,
      }),
      balanced: runSimulation({
        portfolio: portfolios.balanced,
        startingBankroll,
        simulations: safeSimulations,
      }),
      aggressive: runSimulation({
        portfolio: portfolios.aggressive,
        startingBankroll,
        simulations: safeSimulations,
      }),
    },
  }
}