import { getTopPicks } from '@/services/top-picks.service'

type SportPick = {
  id: string
  sport_key: string
  commence_time: string
  team: string
  opponent: string
  sportsbook: string
  odds: number
  model_probability: number
  implied_probability: number
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

type SportGroup = {
  sportKey: string
  label: string
  count: number
  picks: SportPick[]
}

function getSportLabel(sportKey: string) {
  const labels: Record<string, string> = {
    baseball_mlb: 'MLB',
    basketball_bsn: 'BSN',
    soccer_epl: 'Soccer',
    americanfootball_nfl: 'NFL',
    americanfootball_ncaaf: 'NCAAF',
  }

  return labels[sportKey] ?? sportKey
}

function getSportOrder(sportKey: string) {
  const order: Record<string, number> = {
    baseball_mlb: 1,
    basketball_bsn: 2,
    soccer_epl: 3,
    americanfootball_nfl: 4,
    americanfootball_ncaaf: 5,
  }

  return order[sportKey] ?? 99
}

function dedupeByTeamOpponent(picks: SportPick[]) {
  const seen = new Set<string>()

  return picks.filter((pick) => {
    const key = `${pick.sport_key}:${pick.team}:${pick.opponent}`

    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

export async function getTopPicksBySport() {
  const topPicks = await getTopPicks()

  const sourcePicks = dedupeByTeamOpponent([
    ...(topPicks.bestBets as SportPick[]),
    ...(topPicks.topConfidence as SportPick[]),
    ...(topPicks.topEv as SportPick[]),
  ])

  const grouped = new Map<string, SportPick[]>()

  for (const pick of sourcePicks) {
    const current = grouped.get(pick.sport_key) ?? []
    current.push(pick)
    grouped.set(pick.sport_key, current)
  }

  const sports: SportGroup[] = [...grouped.entries()]
    .map(([sportKey, picks]) => {
      const sorted = [...picks]
        .sort(
          (a, b) =>
            (b.smart_score ?? 0) - (a.smart_score ?? 0) ||
            b.confidence - a.confidence ||
            b.ev - a.ev
        )
        .slice(0, 5)

      return {
        sportKey,
        label: getSportLabel(sportKey),
        count: sorted.length,
        picks: sorted,
      }
    })
    .sort((a, b) => getSportOrder(a.sportKey) - getSportOrder(b.sportKey))

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    count: sports.length,
    sports,
  }
}