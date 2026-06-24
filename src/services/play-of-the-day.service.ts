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
}

function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : `${odds}`
}

function getRecommendation(score: number) {
  if (score >= 80) return 'Strong play'
  if (score >= 70) return 'Playable with discipline'
  return 'Use caution'
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

    if (!existing || (pick.smart_score ?? 0) > (existing.smart_score ?? 0)) {
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
    .sort(
      (a, b) =>
        (b.smart_score ?? 0) - (a.smart_score ?? 0) ||
        b.confidence - a.confidence ||
        b.ev - a.ev
    )

  const play = qualified[0] ?? null

  if (!play) {
    return {
      success: true,
      generatedAt: new Date().toISOString(),
      play: null,
      message: 'No qualified Play of the Day available right now.',
    }
  }

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    play: {
      ...play,
      formatted_odds: formatOdds(play.odds),
      recommendation: getRecommendation(play.smart_score ?? 0),
      reason: 'Highest Smart Score among qualified recommended picks.',
    },
  }
}