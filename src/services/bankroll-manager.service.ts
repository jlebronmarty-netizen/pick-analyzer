import { normalizeBankroll } from '@/services/bankroll.service'
import { calculateStakeFromKelly } from '@/services/bankroll.service'
import { buildPortfolios } from '@/services/portfolio-builder.service'
import { getPlayOfTheDay } from '@/services/play-of-the-day.service'
import { getTopPicks } from '@/services/top-picks.service'

type RiskMode = 'conservative' | 'balanced' | 'aggressive'

type Pick = {
  id: string
  team: string
  opponent: string
  sport_key: string
  sportsbook?: string
  odds: number
  confidence: number
  edge: number
  ev: number
  risk_grade?: string
  risk_label?: string
  kelly_percent?: number
  recommended_stake?: number
  smart_score?: number
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function getRiskMode(value: string | null): RiskMode {
  if (value === 'aggressive') return 'aggressive'
  if (value === 'conservative') return 'conservative'

  return 'balanced'
}

function getMaxDailyExposurePercent(mode: RiskMode) {
  if (mode === 'conservative') return 4
  if (mode === 'aggressive') return 10

  return 6
}

function getPickCapPercent(mode: RiskMode, riskGrade?: string) {
  if (mode === 'conservative') {
    if (riskGrade === 'A+') return 3
    if (riskGrade === 'A') return 2.5
    if (riskGrade === 'B') return 1.5
    return 1
  }

  if (mode === 'aggressive') {
    if (riskGrade === 'A+') return 8
    if (riskGrade === 'A') return 6
    if (riskGrade === 'B') return 4
    if (riskGrade === 'C') return 2
    return 1
  }

  if (riskGrade === 'A+') return 5
  if (riskGrade === 'A') return 4
  if (riskGrade === 'B') return 2.5
  if (riskGrade === 'C') return 1.5

  return 1
}

function getExposureLevel(exposurePercent: number) {
  if (exposurePercent <= 3) return 'LOW'
  if (exposurePercent <= 6) return 'MODERATE'
  if (exposurePercent <= 10) return 'HIGH'

  return 'EXTREME'
}

function getRecommendedAction({
  exposurePercent,
  maxDailyExposurePercent,
  picks,
}: {
  exposurePercent: number
  maxDailyExposurePercent: number
  picks: Pick[]
}) {
  if (!picks.length) {
    return 'No qualified bankroll picks available right now.'
  }

  if (exposurePercent > maxDailyExposurePercent) {
    return 'Reduce exposure before betting. Current stake plan exceeds daily risk limit.'
  }

  if (exposurePercent >= maxDailyExposurePercent * 0.8) {
    return 'Playable, but close to daily exposure limit. Avoid adding extra picks.'
  }

  return 'Stake plan is within disciplined bankroll limits.'
}

function buildStakePlan({
  bankroll,
  riskMode,
  picks,
}: {
  bankroll: number
  riskMode: RiskMode
  picks: Pick[]
}) {
  const maxDailyExposurePercent = getMaxDailyExposurePercent(riskMode)
  const maxDailyExposure = bankroll * (maxDailyExposurePercent / 100)

  const selected = picks
    .filter(
      (pick) =>
        pick.ev >= 5 &&
        pick.edge >= 5 &&
        pick.confidence >= 65 &&
        pick.risk_grade
    )
    .sort(
      (a, b) =>
        (b.smart_score ?? 0) - (a.smart_score ?? 0) ||
        b.confidence - a.confidence ||
        b.ev - a.ev
    )
    .slice(0, riskMode === 'conservative' ? 3 : riskMode === 'balanced' ? 5 : 8)

  let remainingExposure = maxDailyExposure

  const stakePlan = selected.map((pick) => {
    const maxStakePercent = getPickCapPercent(riskMode, pick.risk_grade)

    const calculatedStake = calculateStakeFromKelly({
      bankroll,
      kellyPercent: pick.kelly_percent,
      riskGrade: pick.risk_grade,
      maxStakePercent,
    })

    const stake = round(Math.max(0, Math.min(calculatedStake, remainingExposure)))
    remainingExposure = round(remainingExposure - stake)

    return {
      ...pick,
      maxStakePercent,
      recommendedStake: stake,
      stakePercent: bankroll ? round((stake / bankroll) * 100) : 0,
    }
  })

  const totalStake = round(
    stakePlan.reduce((sum, pick) => sum + pick.recommendedStake, 0)
  )

  const exposurePercent = bankroll ? round((totalStake / bankroll) * 100) : 0

  const expectedProfit = round(
    stakePlan.reduce((sum, pick) => sum + pick.recommendedStake * (pick.ev / 100), 0)
  )

  const bestStake = stakePlan[0] ?? null

  return {
    maxDailyExposurePercent,
    maxDailyExposure: round(maxDailyExposure),
    totalStake,
    exposurePercent,
    exposureLevel: getExposureLevel(exposurePercent),
    expectedProfit,
    expectedRoi: totalStake ? round((expectedProfit / totalStake) * 100) : 0,
    remainingExposure: round(Math.max(0, remainingExposure)),
    overExposure: exposurePercent > maxDailyExposurePercent,
    recommendedAction: getRecommendedAction({
      exposurePercent,
      maxDailyExposurePercent,
      picks: stakePlan,
    }),
    bestStake,
    picks: stakePlan,
  }
}

export async function getBankrollManager({
  amount,
  mode,
}: {
  amount?: unknown
  mode?: string | null
}) {
  const bankroll = normalizeBankroll(amount)
  const riskMode = getRiskMode(mode ?? null)

  const [topPicks, portfolioResult, playResult] = await Promise.all([
    getTopPicks(),
    buildPortfolios(bankroll),
    getPlayOfTheDay(),
  ])

  const sourcePicks = [
    ...(topPicks.bestBets as Pick[]),
    ...(topPicks.topEv as Pick[]),
    ...(topPicks.topConfidence as Pick[]),
  ]

  const unique = new Map<string, Pick>()

  for (const pick of sourcePicks) {
    const key = `${pick.sport_key}:${pick.team}:${pick.opponent}`
    const existing = unique.get(key)

    if (!existing || (pick.smart_score ?? 0) > (existing.smart_score ?? 0)) {
      unique.set(key, pick)
    }
  }

  const stakePlan = buildStakePlan({
    bankroll,
    riskMode,
    picks: [...unique.values()],
  })

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    bankroll,
    riskMode,
    playOfTheDay: playResult.play,
    stakePlan,
    portfolios: portfolioResult.portfolios,
  }
}