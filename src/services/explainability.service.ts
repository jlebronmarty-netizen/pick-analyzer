import { getTopPicks } from '@/services/top-picks.service'

type ExplainablePick = {
  id: string
  team: string
  opponent: string
  sport_key: string
  odds: number
  model_probability: number
  implied_probability: number
  confidence: number
  edge: number
  ev: number
  risk_grade?: string
  risk_label?: string
  risk_stars?: number
  kelly_percent?: number
  recommended_stake?: number
  smart_score?: number
}

type ExplanationFactor = {
  factor: string
  impact: string
  sentiment: 'positive' | 'neutral' | 'negative'
}

function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : `${odds}`
}

function getValueLabel(value: number) {
  if (value >= 80) return 'very strong'
  if (value >= 70) return 'strong'
  if (value >= 60) return 'playable'
  return 'moderate'
}

function buildExplanation(pick: ExplainablePick): ExplanationFactor[] {
  return [
    {
      factor: 'Model Probability',
      impact: `${pick.model_probability.toFixed(2)}% model win probability vs ${pick.implied_probability.toFixed(2)}% implied probability.`,
      sentiment:
        pick.model_probability > pick.implied_probability
          ? 'positive'
          : 'negative',
    },
    {
      factor: 'Edge',
      impact: `${pick.edge.toFixed(2)}% edge over the market.`,
      sentiment: pick.edge >= 5 ? 'positive' : 'neutral',
    },
    {
      factor: 'Expected Value',
      impact: `${pick.ev.toFixed(2)}% EV based on model probability and odds.`,
      sentiment: pick.ev >= 5 ? 'positive' : 'neutral',
    },
    {
      factor: 'Confidence',
      impact: `${pick.confidence.toFixed(2)}% confidence. This is a ${getValueLabel(
        pick.confidence
      )} signal.`,
      sentiment: pick.confidence >= 65 ? 'positive' : 'neutral',
    },
    {
      factor: 'Risk Grade',
      impact: `${pick.risk_grade ?? 'N/A'} ${
        pick.risk_label ?? ''
      } with ${pick.risk_stars ?? 0} stars.`,
      sentiment:
        pick.risk_grade === 'A+' || pick.risk_grade === 'A'
          ? 'positive'
          : pick.risk_grade === 'B'
            ? 'neutral'
            : 'negative',
    },
    {
      factor: 'Kelly Stake',
      impact: `Quarter Kelly recommends ${(
        pick.kelly_percent ?? 0
      ).toFixed(2)}% of bankroll, capped at $${
        pick.recommended_stake?.toFixed(2) ?? '0.00'
      }.`,
      sentiment:
        (pick.kelly_percent ?? 0) > 0 ? 'positive' : 'neutral',
    },
  ]
}

export async function explainTopPicks() {
  const topPicks = await getTopPicks()

  const picks = topPicks.bestBets as ExplainablePick[]

  const explanations = picks.map((pick, index) => ({
    rank: index + 1,
    pick: `${pick.team} ML`,
    matchup: `${pick.team} vs ${pick.opponent}`,
    sport: pick.sport_key,
    odds: formatOdds(pick.odds),
    smartScore: pick.smart_score ?? 0,
    recommendation:
      (pick.smart_score ?? 0) >= 80
        ? 'Strong play'
        : (pick.smart_score ?? 0) >= 70
          ? 'Playable with discipline'
          : 'Use caution',
    summary: `${pick.team} grades as ${
      pick.risk_grade ?? 'N/A'
    }/${pick.risk_label ?? 'Unrated'} with ${
      pick.confidence
    }% confidence, ${pick.edge}% edge and ${pick.ev}% EV.`,
    factors: buildExplanation(pick),
  }))

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    count: explanations.length,
    explanations,
  }
}