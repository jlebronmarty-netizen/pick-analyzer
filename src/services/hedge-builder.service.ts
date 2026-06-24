import { calculateStakeFromKelly } from '@/services/bankroll.service'
import { getTopPicks } from '@/services/top-picks.service'

type HedgePick = {
  id: string
  team: string
  opponent: string
  sport_key: string
  odds: number
  model_probability: number
  implied_probability: number
  confidence: number
  ev: number
  edge: number
  recommended_pick: boolean | null
  risk_grade?: string
  risk_label?: string
  risk_stars?: number
  kelly_percent?: number
  recommended_stake?: number
  smart_score?: number
}

type HedgeRecommendation = {
  primary: HedgePick
  hedge: {
    team: string
    stake: number
    protectionPercent: number
  }
  scenario: {
    primaryStake: number
    hedgeStake: number
    totalExposure: number
    estimatedPrimaryProfit: number
    estimatedHedgeRecovery: number
    bestCaseProfit: number
    worstCaseLoss: number
    netExposureAfterHedge: number
  }
}

function decimalOdds(americanOdds: number) {
  return americanOdds > 0
    ? 1 + americanOdds / 100
    : 1 + 100 / Math.abs(americanOdds)
}

function calculatePrimaryProfit(stake: number, americanOdds: number) {
  const decimal = decimalOdds(americanOdds)

  return Number((stake * (decimal - 1)).toFixed(2))
}

function calculateProtectionPercent(pick: HedgePick) {
  const score = pick.smart_score ?? 0
  const confidence = pick.confidence ?? 0

  if (score >= 90 || confidence >= 90) return 25
  if (score >= 80 || confidence >= 85) return 30
  if (score >= 70 || confidence >= 75) return 35

  return 40
}

function getRecommendationLabel(pick: HedgePick) {
  const score = pick.smart_score ?? 0

  if (score >= 85) return 'Strong hedge setup'
  if (score >= 75) return 'Balanced hedge setup'
  if (score >= 65) return 'Defensive hedge setup'

  return 'High-risk hedge setup'
}

function dedupePicks(picks: HedgePick[]) {
  const seen = new Set<string>()

  return picks.filter((pick) => {
    const key = `${pick.sport_key}:${pick.team}:${pick.opponent}`

    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

function buildHedgeForPick(
  pick: HedgePick,
  bankroll: number
): HedgeRecommendation {
  const primaryStake = calculateStakeFromKelly({
    bankroll,
    kellyPercent: pick.kelly_percent,
    riskGrade: pick.risk_grade,
  })

  const protectionPercent = calculateProtectionPercent(pick)

  const hedgeStake = Number(
    (primaryStake * (protectionPercent / 100)).toFixed(2)
  )

  const estimatedPrimaryProfit = calculatePrimaryProfit(primaryStake, pick.odds)

  const estimatedHedgeRecovery = hedgeStake

  const bestCaseProfit = Number(
    (estimatedPrimaryProfit - hedgeStake).toFixed(2)
  )

  const worstCaseLoss = Number(
    (primaryStake - estimatedHedgeRecovery).toFixed(2)
  )

  const totalExposure = Number((primaryStake + hedgeStake).toFixed(2))

  const netExposureAfterHedge = Number(
    (primaryStake - estimatedHedgeRecovery).toFixed(2)
  )

  return {
    primary: {
      ...pick,
      recommended_stake: primaryStake,
    },
    hedge: {
      team: pick.opponent,
      stake: hedgeStake,
      protectionPercent,
    },
    scenario: {
      primaryStake,
      hedgeStake,
      totalExposure,
      estimatedPrimaryProfit,
      estimatedHedgeRecovery,
      bestCaseProfit,
      worstCaseLoss,
      netExposureAfterHedge,
    },
  }
}

export async function buildHedges(bankroll = 1000) {
  const topPicks = await getTopPicks()

  const sourcePicks = dedupePicks([
    ...(topPicks.bestBets as HedgePick[]),
    ...(topPicks.topConfidence as HedgePick[]),
    ...(topPicks.topEv as HedgePick[]),
  ])

  const qualified = sourcePicks
    .filter(
      (pick) =>
        pick.recommended_pick === true &&
        pick.confidence >= 65 &&
        pick.ev >= 5 &&
        pick.edge >= 5 &&
        pick.odds < 500
    )
    .sort(
      (a, b) =>
        (b.smart_score ?? 0) - (a.smart_score ?? 0) ||
        b.confidence - a.confidence ||
        b.ev - a.ev
    )
    .slice(0, 10)

  const hedges = qualified.map((pick) => ({
    ...buildHedgeForPick(pick, bankroll),
    recommendation: getRecommendationLabel(pick),
  }))

  return {
    success: true,
    bankroll,
    generatedAt: new Date().toISOString(),
    count: hedges.length,
    hedges,
  }
}