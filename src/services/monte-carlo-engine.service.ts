import { getTopPicks } from '@/services/top-picks.service'

type SimPick = {
  team: string
  opponent: string
  odds: number
  model_probability: number
  confidence: number
  ev: number
  edge: number
  recommended_stake?: number
  adaptive_score?: number
  smart_score?: number
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function decimalOdds(american: number) {
  if (american > 0) return 1 + american / 100
  return 1 + 100 / Math.abs(american)
}

function profitIfWin(stake: number, odds: number) {
  return stake * (decimalOdds(odds) - 1)
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0

  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.floor((p / 100) * (sorted.length - 1))

  return sorted[index] ?? 0
}

function getStake(bankroll: number, pick: SimPick) {
  const recommended = Number(pick.recommended_stake ?? 0)

  if (recommended > 0) {
    return Math.min(recommended, bankroll * 0.03)
  }

  return bankroll * 0.01
}

export async function runMonteCarloSimulation({
  bankroll = 1000,
  simulations = 10000,
  maxPicks = 8,
}: {
  bankroll?: number
  simulations?: number
  maxPicks?: number
} = {}) {
  const topPicks = await getTopPicks()

  const picks = [...topPicks.bestBets, ...topPicks.topEv, ...topPicks.topConfidence]
    .filter((pick: any, index, arr) => {
      const key = `${pick.team}-${pick.opponent}-${pick.odds}`
      return (
        arr.findIndex(
          (item: any) => `${item.team}-${item.opponent}-${item.odds}` === key
        ) === index
      )
    })
    .sort((a: any, b: any) => {
      const scoreA =
        Number(a.adaptive_score ?? a.smart_score ?? 0) +
        Number(a.ev ?? 0) * 0.7 +
        Number(a.confidence ?? 0) * 0.2

      const scoreB =
        Number(b.adaptive_score ?? b.smart_score ?? 0) +
        Number(b.ev ?? 0) * 0.7 +
        Number(b.confidence ?? 0) * 0.2

      return scoreB - scoreA
    })
    .slice(0, maxPicks) as SimPick[]

  const outcomes: number[] = []
  const roiOutcomes: number[] = []
  const drawdowns: number[] = []

  let profitableRuns = 0
  let ruinRuns = 0

  for (let i = 0; i < simulations; i++) {
    let currentBankroll = bankroll
    let peakBankroll = bankroll
    let totalStake = 0
    let totalProfit = 0
    let maxDrawdown = 0

    for (const pick of picks) {
      const stake = getStake(currentBankroll, pick)
      const probability = Number(pick.model_probability ?? pick.confidence ?? 0) / 100
      const won = Math.random() < probability

      totalStake += stake

      if (won) {
        const profit = profitIfWin(stake, Number(pick.odds ?? 0))
        currentBankroll += profit
        totalProfit += profit
      } else {
        currentBankroll -= stake
        totalProfit -= stake
      }

      peakBankroll = Math.max(peakBankroll, currentBankroll)

      const drawdown =
        peakBankroll > 0 ? ((peakBankroll - currentBankroll) / peakBankroll) * 100 : 0

      maxDrawdown = Math.max(maxDrawdown, drawdown)
    }

    const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0

    outcomes.push(totalProfit)
    roiOutcomes.push(roi)
    drawdowns.push(maxDrawdown)

    if (totalProfit > 0) profitableRuns += 1
    if (currentBankroll <= bankroll * 0.75) ruinRuns += 1
  }

  const averageProfit =
    outcomes.reduce((sum, value) => sum + value, 0) / Math.max(outcomes.length, 1)

  const averageRoi =
    roiOutcomes.reduce((sum, value) => sum + value, 0) /
    Math.max(roiOutcomes.length, 1)

  const averageDrawdown =
    drawdowns.reduce((sum, value) => sum + value, 0) /
    Math.max(drawdowns.length, 1)

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    bankroll,
    simulations,
    picksUsed: picks.length,

    summary: {
      averageProfit: round(averageProfit),
      averageRoi: round(averageRoi),
      probabilityOfProfit: round((profitableRuns / simulations) * 100),
      probabilityOfRuin: round((ruinRuns / simulations) * 100),
      averageDrawdown: round(averageDrawdown),
      worstCase: round(percentile(outcomes, 5)),
      medianCase: round(percentile(outcomes, 50)),
      bestCase: round(percentile(outcomes, 95)),
      roiWorstCase: round(percentile(roiOutcomes, 5)),
      roiMedianCase: round(percentile(roiOutcomes, 50)),
      roiBestCase: round(percentile(roiOutcomes, 95)),
    },

    picks: picks.map((pick) => ({
      team: pick.team,
      opponent: pick.opponent,
      odds: pick.odds,
      probability: pick.model_probability,
      confidence: pick.confidence,
      ev: pick.ev,
      edge: pick.edge,
      stake: round(getStake(bankroll, pick)),
      score: round(Number(pick.adaptive_score ?? pick.smart_score ?? 0)),
    })),
  }
}