import { getAdvancedPredictionFactors } from '@/services/advanced-factors.service'
import { getAIGameAnalysis } from '@/services/ai-game-analysis.service'

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

type GameAnalysis = {
  pick: Pick
  matchup: string
  recommendation: string
  strength: string
  summary: string
  valueRead: string
  riskRead: string
  stakeRead: string
  performanceRead: string
  action: string
  fullAnalysis: string
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

function getBetTiming(pick: Pick) {
  if (
    pick.risk_grade === 'A+' &&
    pick.confidence >= 85 &&
    pick.edge >= 10 &&
    pick.ev >= 15
  ) {
    return 'BET_NOW'
  }

  if (
    ['A+', 'A'].includes(pick.risk_grade ?? '') &&
    pick.confidence >= 75 &&
    pick.ev >= 8
  ) {
    return 'PLAYABLE_NOW'
  }

  if (pick.ev >= 5 && pick.edge >= 5) {
    return 'WAIT_OR_MONITOR'
  }

  return 'AVOID'
}

function getCopilotTone(timing: string) {
  if (timing === 'BET_NOW') return 'Aggressive'
  if (timing === 'PLAYABLE_NOW') return 'Positive'
  if (timing === 'WAIT_OR_MONITOR') return 'Cautious'

  return 'Avoid'
}

function buildPros(pick: Pick, factors: Awaited<ReturnType<typeof getAdvancedPredictionFactors>>) {
  const pros: string[] = []

  if (pick.model_probability > pick.implied_probability) {
    pros.push(
      `Model probability is higher than market implied probability by ${formatPercent(
        pick.edge
      )}.`
    )
  }

  if (pick.ev >= 10) {
    pros.push(`Expected value is strong at ${formatPercent(pick.ev)}.`)
  }

  if (pick.confidence >= 75) {
    pros.push(`Model confidence is high at ${formatPercent(pick.confidence)}.`)
  }

  if (['A+', 'A'].includes(pick.risk_grade ?? '')) {
    pros.push(`Risk grade is ${pick.risk_grade} (${pick.risk_label ?? 'Strong'}).`)
  }

  if ((pick.smart_score ?? 0) >= 75) {
    pros.push(`Smart Score is strong at ${(pick.smart_score ?? 0).toFixed(2)}.`)
  }

  if (factors.pitcherAdvantage > 0) {
    pros.push(`Pitcher matchup adds a positive factor of ${factors.pitcherAdvantage}.`)
  }

  if (factors.weatherImpact > 0) {
    pros.push(`Weather factor is slightly favorable at ${factors.weatherImpact}.`)
  }

  if (pros.length === 0) {
    pros.push('There is some model value, but no major premium factor stands out.')
  }

  return pros
}

function buildCons(pick: Pick, factors: Awaited<ReturnType<typeof getAdvancedPredictionFactors>>) {
  const cons: string[] = []

  if (pick.confidence < 70) {
    cons.push(`Confidence is below premium level at ${formatPercent(pick.confidence)}.`)
  }

  if ((pick.smart_score ?? 0) < 70) {
    cons.push(`Smart Score is not elite at ${(pick.smart_score ?? 0).toFixed(2)}.`)
  }

  if (pick.odds >= 300) {
    cons.push(
      `This is a higher-odds underdog at ${formatOdds(
        pick.odds
      )}, so variance is higher.`
    )
  }

  if (factors.injuryImpact > 0) {
    cons.push(`Injury impact is a negative factor of ${factors.injuryImpact}.`)
  }

  if (factors.pitcherAdvantage < 0) {
    cons.push(`Pitcher matchup is unfavorable by ${Math.abs(factors.pitcherAdvantage)}.`)
  }

  if (factors.weatherImpact < 0) {
    cons.push(`Weather factor is unfavorable at ${factors.weatherImpact}.`)
  }

  if (cons.length === 0) {
    cons.push('No major red flags detected from the current model factors.')
  }

  return cons
}

function buildHiddenRisks(
  pick: Pick,
  factors: Awaited<ReturnType<typeof getAdvancedPredictionFactors>>
) {
  const risks: string[] = []

  if (pick.sport_key !== 'baseball_mlb') {
    risks.push('Advanced pitcher/weather factors may be limited for this sport.')
  }

  if (pick.recommended_pick !== true) {
    risks.push('This pick is not marked as a primary recommended pick.')
  }

  if (pick.odds > 250) {
    risks.push('Large plus-money prices can look attractive but carry high volatility.')
  }

  if (factors.injuryImpact >= 4) {
    risks.push('Injury impact is elevated and could reduce model reliability.')
  }

  if (pick.edge >= 25 && pick.ev >= 50) {
    risks.push(
      'The edge is extremely high, so verify that the odds are still available before betting.'
    )
  }

  if (risks.length === 0) {
    risks.push('Main risk is normal betting variance and possible line movement.')
  }

  return risks
}

function buildCopilotAdvice({
  analysis,
  factors,
}: {
  analysis: GameAnalysis
  factors: Awaited<ReturnType<typeof getAdvancedPredictionFactors>>
}) {
  const pick = analysis.pick
  const timing = getBetTiming(pick)
  const tone = getCopilotTone(timing)

  const pros = buildPros(pick, factors)
  const cons = buildCons(pick, factors)
  const hiddenRisks = buildHiddenRisks(pick, factors)

  const suggestedStake = pick.recommended_stake ?? 0

  const betNowOrWait =
    timing === 'BET_NOW'
      ? 'Bet now if the same line is still available.'
      : timing === 'PLAYABLE_NOW'
        ? 'Playable now, but keep stake disciplined.'
        : timing === 'WAIT_OR_MONITOR'
          ? 'Wait or monitor for a better line before betting.'
          : 'Avoid this pick for now.'

  const professionalRead =
    timing === 'BET_NOW'
      ? `A professional bettor would treat this as a premium value spot because the model edge, EV, confidence and risk grade all align.`
      : timing === 'PLAYABLE_NOW'
        ? `A professional bettor may play this at a reduced stake, especially if the line remains near ${formatOdds(
            pick.odds
          )}.`
        : timing === 'WAIT_OR_MONITOR'
          ? `A professional bettor would likely monitor this for better price confirmation before entering.`
          : `A professional bettor would likely pass unless the market gives a much better price.`

  return {
    id: pick.id,
    team: pick.team,
    opponent: pick.opponent,
    matchup: analysis.matchup,
    sportKey: pick.sport_key,
    sportsbook: pick.sportsbook,
    odds: pick.odds,
    formattedOdds: formatOdds(pick.odds),
    recommendation: analysis.recommendation,
    timing,
    tone,
    betNowOrWait,
    suggestedStake,
    formattedStake: formatMoney(suggestedStake),
    modelProbability: pick.model_probability,
    impliedProbability: pick.implied_probability,
    edge: pick.edge,
    ev: pick.ev,
    confidence: pick.confidence,
    smartScore: pick.smart_score ?? 0,
    riskGrade: pick.risk_grade ?? 'N/A',
    riskLabel: pick.risk_label ?? 'N/A',
    kellyPercent: pick.kelly_percent ?? 0,
    factors,
    pros,
    cons,
    hiddenRisks,
    professionalRead,
    summary: analysis.summary,
    fullAnalysis: analysis.fullAnalysis,
  }
}

export async function getAICopilot() {
  const gameAnalysis = await getAIGameAnalysis()

  const analyses = (gameAnalysis.analyses ?? []) as GameAnalysis[]

  const copilotPicks = await Promise.all(
    analyses.slice(0, 8).map(async (analysis) => {
      const pick = analysis.pick

      const factors = await getAdvancedPredictionFactors({
        sportKey: pick.sport_key,
        gameId: pick.game_id,
        teamName: pick.team,
        opponentName: pick.opponent,
      })

      return buildCopilotAdvice({
        analysis,
        factors,
      })
    })
  )

  const bestAdvice = copilotPicks[0] ?? null

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    analyticsAvailable: gameAnalysis.analyticsAvailable,
    analyticsError: gameAnalysis.analyticsError,
    modelPerformance: gameAnalysis.modelPerformance,
    count: copilotPicks.length,
    bestAdvice,
    picks: copilotPicks,
  }
}