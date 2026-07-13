import { getTopPicks } from '@/services/top-picks.service'

type LivePick = {
  team: string
  opponent: string
  sport_key?: string
  sportsbook?: string
  odds: number
  confidence: number
  edge: number
  ev: number
  model_probability?: number
  implied_probability?: number
  smart_score?: number
  adaptive_score?: number
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : `${odds}`
}

function decimalOdds(american: number) {
  if (american > 0) return 1 + american / 100
  return 1 + 100 / Math.abs(american)
}

function calculateLiveWinProbability(pick: LivePick) {
  const model = Number(pick.model_probability ?? pick.confidence ?? 0)
  const edge = Number(pick.edge ?? 0)
  const ev = Number(pick.ev ?? 0)
  const adaptive = Number(pick.adaptive_score ?? pick.smart_score ?? 0)

  return round(
    clamp(
      model * 0.55 + adaptive * 0.2 + edge * 0.9 + ev * 0.45,
      1,
      99
    )
  )
}

function calculateMomentum(pick: LivePick) {
  const confidence = Number(pick.confidence ?? 0)
  const ev = Number(pick.ev ?? 0)
  const edge = Number(pick.edge ?? 0)

  return round(clamp(confidence * 0.45 + ev * 1.3 + edge * 1.1, 0, 100))
}

function calculateLiveEv(pick: LivePick, liveProbability: number) {
  const decimal = decimalOdds(Number(pick.odds ?? 0))
  const probability = liveProbability / 100

  return round((probability * (decimal - 1) - (1 - probability)) * 100)
}

function getRecommendation(liveEv: number, winProbability: number) {
  if (liveEv >= 12 && winProbability >= 70) return 'BET_NOW'
  if (liveEv >= 6 && winProbability >= 60) return 'WATCH_CLOSELY'
  if (liveEv >= 0) return 'SMALL_EDGE'
  return 'AVOID'
}

function getRisk(liveEv: number, momentum: number) {
  if (liveEv >= 8 && momentum >= 70) return 'LOW'
  if (liveEv >= 2 && momentum >= 55) return 'MEDIUM'
  return 'HIGH'
}

function getKellyStake({
  bankroll,
  odds,
  probability,
}: {
  bankroll: number
  odds: number
  probability: number
}) {
  const decimal = decimalOdds(odds)
  const p = probability / 100
  const b = decimal - 1
  const q = 1 - p

  const kelly = (b * p - q) / b

  return round(bankroll * clamp(kelly, 0, 0.04))
}

export async function getLiveBettingEngine({
  bankroll = 1000,
}: {
  bankroll?: number
} = {}) {
  const topPicks = await getTopPicks()

  const pool = [...topPicks.bestBets, ...topPicks.topEv, ...topPicks.topConfidence]
    .filter((pick: any, index, arr) => {
      const key = `${pick.team}-${pick.opponent}-${pick.odds}`
      return (
        arr.findIndex(
          (item: any) => `${item.team}-${item.opponent}-${item.odds}` === key
        ) === index
      )
    })
    .slice(0, 20) as LivePick[]

  const opportunities = pool
    .map((pick) => {
      const liveWinProbability = calculateLiveWinProbability(pick)
      const momentumScore = calculateMomentum(pick)
      const liveEv = calculateLiveEv(pick, liveWinProbability)
      const recommendation = getRecommendation(liveEv, liveWinProbability)
      const risk = getRisk(liveEv, momentumScore)
      const liveKellyStake = getKellyStake({
        bankroll,
        odds: Number(pick.odds ?? 0),
        probability: liveWinProbability,
      })

      return {
        ...pick,
        formattedOdds: formatOdds(Number(pick.odds ?? 0)),
        liveWinProbability,
        momentumScore,
        liveEv,
        recommendation,
        risk,
        liveKellyStake,
        cashOutAdvice:
          liveEv < -5
            ? 'Consider avoiding or cashing out if already exposed.'
            : liveEv >= 8
              ? 'Positive live value detected.'
              : 'Hold position or wait for a better price.',
        hedgeAdvice:
          risk === 'HIGH'
            ? 'Hedge only if exposure is already high.'
            : 'No hedge needed at current value.',
      }
    })
    .sort((a, b) => b.liveEv - a.liveEv)

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    bankroll,
    summary: {
      opportunities: opportunities.length,
      betNow: opportunities.filter((item) => item.recommendation === 'BET_NOW').length,
      watch: opportunities.filter((item) => item.recommendation === 'WATCH_CLOSELY').length,
      avoid: opportunities.filter((item) => item.recommendation === 'AVOID').length,
      bestLiveBet: opportunities[0] ?? null,
      averageLiveEv: round(
        opportunities.reduce((sum, item) => sum + item.liveEv, 0) /
          Math.max(opportunities.length, 1)
      ),
    },
    betNow: opportunities.filter((item) => item.recommendation === 'BET_NOW'),
    watchList: opportunities.filter((item) => item.recommendation === 'WATCH_CLOSELY'),
    opportunities,
  }
}