import { getTopPicks } from '@/services/top-picks.service'

type PlayPick = {
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
  recommended_pick: boolean | null
  risk_grade?: string
  risk_label?: string
  risk_stars?: number
  kelly_percent?: number
  recommended_stake?: number
  smart_score?: number
  adaptive_score?: number
  adaptive_adjustment?: unknown
}

function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : `${odds}`
}

function getPrimaryScore(pick: PlayPick) {
  return Number(pick.adaptive_score ?? pick.smart_score ?? 0)
}

function getRecommendation(score: number) {
  if (score >= 80) return 'Strong play'
  if (score >= 70) return 'Playable with discipline'
  return 'Use caution'
}

function sortByPlayScore(a: PlayPick, b: PlayPick) {
  return (
    getPrimaryScore(b) - getPrimaryScore(a) ||
    b.confidence - a.confidence ||
    b.ev - a.ev ||
    b.edge - a.edge
  )
}

export async function getPlayOfTheDay() {
  const topPicks = await getTopPicks()

  const candidates = [
    ...(topPicks.bestBets as PlayPick[]),
    ...(topPicks.topConfidence as PlayPick[]),
    ...(topPicks.topEv as PlayPick[]),
  ]

  const unique = new Map<string, PlayPick>()

  for (const pick of candidates) {
    const key = `${pick.sport_key}:${pick.team}:${pick.opponent}`
    const existing = unique.get(key)

    if (!existing || getPrimaryScore(pick) > getPrimaryScore(existing)) {
      unique.set(key, pick)
    }
  }

  const qualified = [...unique.values()]
    .filter(
      (pick) =>
        pick.recommended_pick === true &&
        pick.confidence >= 75 &&
        pick.ev >= 10 &&
        pick.edge >= 8 &&
        pick.odds < 300
    )
    .sort(sortByPlayScore)

  const play = qualified[0] ?? null

  if (!play) {
    return {
      success: true,
      adaptiveWeightsAvailable: topPicks.adaptiveWeightsAvailable,
      generatedAt: new Date().toISOString(),
      play: null,
      message: 'No qualified Play of the Day available right now.',
    }
  }

  const score = getPrimaryScore(play)
  const scoreLabel =
    typeof play.adaptive_score === 'number'
      ? 'Adaptive Score'
      : 'Smart Score'

  return {
    success: true,
    adaptiveWeightsAvailable: topPicks.adaptiveWeightsAvailable,
    generatedAt: new Date().toISOString(),
    play: {
      ...play,
      formatted_odds: formatOdds(play.odds),
      recommendation: getRecommendation(score),
      primary_score: score,
      primary_score_label: scoreLabel,
      reason: `Highest ${scoreLabel} among qualified recommended picks.`,
    },
  }
}