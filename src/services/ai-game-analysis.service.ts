import { getAnalyticsDashboard } from '@/services/analytics.service'
import { getTopPicks } from '@/services/top-picks.service'

type Pick = {
  id: string
  sport_key: string
  game_id: string
  commence_time: string
  home_team: string
  away_team: string
  team: string
  opponent: string
  market: string
  sportsbook: string
  odds: number
  implied_probability: number
  model_probability: number
  edge: number
  ev: number
  confidence: number
  recommended_pick: boolean | null
  risk_grade?: string
  risk_label?: string
  risk_stars?: number
  kelly_percent?: number
  recommended_stake?: number
  smart_score?: number
}

type ModelPerformance = {
  picks: number
  settled: number
  pending: number
  wins: number
  losses: number
  pushes?: number
  winRate: number
  profit: number
  roi: number
}

const fallbackModelPerformance: ModelPerformance = {
  picks: 0,
  settled: 0,
  pending: 0,
  wins: 0,
  losses: 0,
  pushes: 0,
  winRate: 0,
  profit: 0,
  roi: 0,
}

function formatOdds(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}

function formatPercent(value?: number) {
  return `${Number(value ?? 0).toFixed(2)}%`
}

function formatMoney(value?: number) {
  return `$${Number(value ?? 0).toFixed(2)}`
}

function getStrengthLabel(pick: Pick) {
  if (
    pick.risk_grade === 'A+' &&
    pick.confidence >= 80 &&
    pick.ev >= 20 &&
    pick.edge >= 10
  ) {
    return 'Elite betting profile'
  }

  if (
    ['A+', 'A'].includes(pick.risk_grade ?? '') &&
    pick.confidence >= 70 &&
    pick.ev >= 10
  ) {
    return 'Strong betting profile'
  }

  if (pick.confidence >= 65 && pick.ev >= 5) {
    return 'Playable betting profile'
  }

  return 'Monitor only'
}

function getFinalRecommendation(pick: Pick) {
  if (
    pick.risk_grade === 'A+' &&
    pick.confidence >= 80 &&
    pick.ev >= 15 &&
    pick.edge >= 8
  ) {
    return 'BET NOW'
  }

  if (
    ['A+', 'A'].includes(pick.risk_grade ?? '') &&
    pick.confidence >= 70 &&
    pick.ev >= 8
  ) {
    return 'PLAYABLE'
  }

  if (pick.ev >= 5 && pick.edge >= 5) {
    return 'MONITOR'
  }

  return 'AVOID'
}

async function getSafeAnalytics() {
  try {
    const analytics = await getAnalyticsDashboard()

    return {
      performance: analytics.overall as ModelPerformance,
      analyticsAvailable: true,
      analyticsError: null as string | null,
    }
  } catch (error) {
    console.error('AI Game Analysis analytics fallback:', error)

    return {
      performance: fallbackModelPerformance,
      analyticsAvailable: false,
      analyticsError:
        error instanceof Error ? error.message : 'Analytics unavailable',
    }
  }
}

function buildAnalysisForPick(pick: Pick, modelPerformance: ModelPerformance) {
  const strength = getStrengthLabel(pick)
  const recommendation = getFinalRecommendation(pick)
  const matchup = `${pick.away_team} @ ${pick.home_team}`

  const summary =
    `${pick.team} ML has a ${strength.toLowerCase()} against ${pick.opponent}. ` +
    `The model gives ${pick.team} a ${formatPercent(
      pick.model_probability
    )} win probability, while the market implies only ${formatPercent(
      pick.implied_probability
    )}.`

  const valueRead =
    `That creates an edge of ${formatPercent(pick.edge)} and an expected value of ` +
    `${formatPercent(pick.ev)} at ${formatOdds(pick.odds)} on ${pick.sportsbook}.`

  const riskRead =
    `Risk grade is ${pick.risk_grade ?? 'N/A'} (${pick.risk_label ?? 'N/A'}), ` +
    `with confidence at ${formatPercent(pick.confidence)} and Smart Score at ` +
    `${Number(pick.smart_score ?? 0).toFixed(2)}.`

  const stakeRead =
    `Kelly-based suggested stake is ${formatMoney(
      pick.recommended_stake
    )}, using a disciplined bankroll approach.`

  const performanceRead =
    modelPerformance.settled > 0
      ? `Current model performance is ${formatPercent(
          modelPerformance.winRate
        )} win rate with ${formatPercent(modelPerformance.roi)} ROI.`
      : 'Model performance data is not available yet for this analysis.'

  const action =
    recommendation === 'BET NOW'
      ? 'This qualifies as a premium play. The edge, EV, confidence and risk grade all support action now.'
      : recommendation === 'PLAYABLE'
        ? 'This is playable, but stake discipline matters. It is not as strong as an elite play.'
        : recommendation === 'MONITOR'
          ? 'This has some value, but it should be monitored for a better line or stronger confirmation.'
          : 'This does not qualify as a premium betting opportunity.'

  return {
    pick,
    matchup,
    recommendation,
    strength,
    summary,
    valueRead,
    riskRead,
    stakeRead,
    performanceRead,
    action,
    fullAnalysis: [
      summary,
      valueRead,
      riskRead,
      stakeRead,
      performanceRead,
      action,
    ].join(' '),
  }
}

export async function getAIGameAnalysis() {
  const [topPicks, analyticsResult] = await Promise.all([
    getTopPicks(),
    getSafeAnalytics(),
  ])

  const candidates = [
    ...(topPicks.bestBets as Pick[]),
    ...(topPicks.topEv as Pick[]),
    ...(topPicks.topConfidence as Pick[]),
  ]

  const unique = new Map<string, Pick>()

  for (const pick of candidates) {
    const key = `${pick.game_id}:${pick.team}`
    const existing = unique.get(key)

    if (!existing || (pick.smart_score ?? 0) > (existing.smart_score ?? 0)) {
      unique.set(key, pick)
    }
  }

  const ranked = [...unique.values()].sort(
    (a, b) =>
      (b.smart_score ?? 0) - (a.smart_score ?? 0) ||
      b.confidence - a.confidence ||
      b.ev - a.ev ||
      b.edge - a.edge
  )

  const analyses = ranked
    .slice(0, 10)
    .map((pick) => buildAnalysisForPick(pick, analyticsResult.performance))

  const best = analyses[0] ?? null

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    analyticsAvailable: analyticsResult.analyticsAvailable,
    analyticsError: analyticsResult.analyticsError,
    modelPerformance: analyticsResult.performance,
    count: analyses.length,
    bestAnalysis: best,
    analyses,
  }
}