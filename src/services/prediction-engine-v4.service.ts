import { getTopPicks } from '@/services/top-picks.service'
import { getSharpMoneyIntelligence } from '@/services/sharp-money-intelligence.service'
import { runMonteCarloSimulation } from '@/services/monte-carlo-engine.service'

function round(value: number) {
  return Number(value.toFixed(2))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : `${odds}`
}

function normalizeKey(team?: string, opponent?: string, odds?: number) {
  return `${team ?? ''}-${opponent ?? ''}-${odds ?? 0}`.toLowerCase()
}

export async function getPredictionEngineV4({
  bankroll = 1000,
}: {
  bankroll?: number
} = {}) {
  const [topPicks, sharpMoney, monteCarlo] = await Promise.all([
    getTopPicks(),
    getSharpMoneyIntelligence(),
    runMonteCarloSimulation({
      bankroll,
      simulations: 3000,
      maxPicks: 8,
    }),
  ])

  const sharpMap = new Map(
    sharpMoney.signals.map((signal: any) => [
      normalizeKey(signal.team, signal.opponent, signal.odds),
      signal,
    ])
  )

  const monteCarloMap = new Map(
    monteCarlo.picks.map((pick: any) => [
      normalizeKey(pick.team, pick.opponent, pick.odds),
      pick,
    ])
  )

  const pool = [
    ...topPicks.bestBets,
    ...topPicks.topEv,
    ...topPicks.topConfidence,
  ].filter((pick: any, index, arr) => {
    const key = normalizeKey(pick.team, pick.opponent, pick.odds)

    return (
      arr.findIndex(
        (item: any) =>
          normalizeKey(item.team, item.opponent, item.odds) === key
      ) === index
    )
  })

  const ratings = pool
    .map((pick: any) => {
      const key = normalizeKey(pick.team, pick.opponent, pick.odds)
      const sharp = sharpMap.get(key) as any
      const sim = monteCarloMap.get(key) as any

      const confidence = Number(pick.confidence ?? 0)
      const ev = Number(pick.ev ?? 0)
      const edge = Number(pick.edge ?? 0)
      const adaptive = Number(pick.adaptive_score ?? pick.smart_score ?? 0)
      const sharpScore = Number(sharp?.sharpScore ?? 0)
      const monteCarloScore = Number(sim?.score ?? adaptive)
      const probability = Number(pick.model_probability ?? confidence)

      const marketEfficiencyPenalty =
        Number(pick.implied_probability ?? 0) > probability ? 8 : 0

      const aiRating = round(
        clamp(
          confidence * 0.18 +
            adaptive * 0.18 +
            ev * 0.22 +
            edge * 0.2 +
            sharpScore * 0.12 +
            monteCarloScore * 0.1 -
            marketEfficiencyPenalty,
          0,
          100
        )
      )

      const tier =
        aiRating >= 85
          ? 'ELITE'
          : aiRating >= 75
            ? 'PREMIUM'
            : aiRating >= 65
              ? 'PLAYABLE'
              : aiRating >= 50
                ? 'WATCH'
                : 'AVOID'

      const action =
        tier === 'ELITE'
          ? 'BET_NOW'
          : tier === 'PREMIUM'
            ? 'CONSIDER'
            : tier === 'PLAYABLE'
              ? 'SMALL_STAKE'
              : tier === 'WATCH'
                ? 'WAIT'
                : 'PASS'

      const reasons = [
        `AI Rating is ${aiRating}/100.`,
        `Model confidence is ${round(confidence)}%.`,
        `Expected value is ${round(ev)}%.`,
        `Model edge is ${round(edge)}%.`,
      ]

      if (sharp) {
        reasons.push(`Sharp money score is ${sharp.sharpScore}/100.`)
      }

      if (sim) {
        reasons.push(`Monte Carlo score contribution is ${sim.score}.`)
      }

      return {
        ...pick,
        formattedOdds: formatOdds(Number(pick.odds ?? 0)),
        aiRating,
        tier,
        action,
        sharpScore,
        monteCarloScore,
        marketEfficiencyPenalty,
        reasons,
      }
    })
    .sort((a: any, b: any) => b.aiRating - a.aiRating)

  const elite = ratings.filter((item: any) => item.tier === 'ELITE')
  const premium = ratings.filter((item: any) => item.tier === 'PREMIUM')
  const playable = ratings.filter((item: any) => item.tier === 'PLAYABLE')
  const watch = ratings.filter((item: any) => item.tier === 'WATCH')

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    bankroll,
    mode: 'prediction_engine_v4',

    summary: {
      totalRatings: ratings.length,
      elite: elite.length,
      premium: premium.length,
      playable: playable.length,
      watch: watch.length,
      bestPick: ratings[0] ?? null,
      averageAiRating: round(
        ratings.reduce((sum: number, item: any) => sum + item.aiRating, 0) /
          Math.max(ratings.length, 1)
      ),
      monteCarloProbabilityOfProfit:
        monteCarlo.summary.probabilityOfProfit,
      monteCarloAverageRoi: monteCarlo.summary.averageRoi,
    },

    elite,
    premium,
    playable,
    watch,
    ratings,
    inputs: {
      topPicksSummary: topPicks.summary,
      sharpMoneySummary: sharpMoney.summary,
      monteCarloSummary: monteCarlo.summary,
    },
  }
}