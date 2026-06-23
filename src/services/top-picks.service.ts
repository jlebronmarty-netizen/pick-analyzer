import { supabaseAdmin } from '@/lib/supabase-admin'

type PredictionRow = {
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
  status: string | null
  result: string | null
  created_at?: string | null
}

function getStatus(row: PredictionRow) {
  return row.status ?? row.result ?? 'pending'
}

function isTodayOrFuture(value: string) {
  const now = new Date()
  const gameDate = new Date(value)

  if (Number.isNaN(gameDate.getTime())) return false

  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  return gameDate >= startOfToday
}

function dedupeByGameAndTeam(rows: PredictionRow[]) {
  const seen = new Set<string>()
  const output: PredictionRow[] = []

  for (const row of rows) {
    const key = `${row.game_id}:${row.team}`

    if (seen.has(key)) continue

    seen.add(key)
    output.push(row)
  }

  return output
}

function passesSafetyFilter(row: PredictionRow) {
  if (row.odds >= 3000) return row.model_probability <= 7
  if (row.odds >= 2000) return row.model_probability <= 10
  if (row.odds >= 1500) return row.model_probability <= 12
  if (row.odds >= 1000) return row.model_probability <= 15
  if (row.odds >= 700) return row.model_probability <= 20
  if (row.odds >= 500) return row.model_probability <= 25

  return true
}

function passesBestBetFilter(row: PredictionRow) {
  return (
    row.recommended_pick === true &&
    row.odds < 300 &&
    row.ev >= 5 &&
    row.edge >= 5 &&
    row.confidence >= 65 &&
    passesSafetyFilter(row)
  )
}

function sortByBestBet(a: PredictionRow, b: PredictionRow) {
  return b.confidence - a.confidence || b.ev - a.ev || b.edge - a.edge
}

export async function getTopPicks() {
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select(
      'id, sport_key, game_id, commence_time, home_team, away_team, team, opponent, market, sportsbook, odds, implied_probability, model_probability, edge, ev, confidence, recommended_pick, status, result, created_at'
    )
    .or('status.is.null,status.eq.pending')
    .order('commence_time', { ascending: true })
    .limit(1000)

  if (error) {
    throw new Error(error.message)
  }

  const pendingRows = ((data ?? []) as PredictionRow[]).filter(
    (row) => getStatus(row) === 'pending' && isTodayOrFuture(row.commence_time)
  )

  const rows = dedupeByGameAndTeam(pendingRows)
  const safeRows = rows.filter(passesSafetyFilter)

  const topEv = [...safeRows]
    .filter((row) => row.ev >= 3 && row.edge >= 4 && row.odds < 500)
    .sort((a, b) => b.ev - a.ev)
    .slice(0, 10)

  const topConfidence = [...safeRows]
    .filter((row) => row.confidence >= 60 && row.edge >= 2 && row.odds < 300)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10)

  const bestBets = [...safeRows]
    .filter(passesBestBetFilter)
    .sort(sortByBestBet)
    .slice(0, 10)

  const recommended = safeRows.filter(
    (row) => row.recommended_pick === true && row.odds < 500
  )

  return {
    success: true,
    summary: {
      pendingPicks: rows.length,
      safePendingPicks: safeRows.length,
      recommendedPicks: recommended.length,
      topEvCount: topEv.length,
      topConfidenceCount: topConfidence.length,
      bestBetsCount: bestBets.length,
    },
    topEv,
    topConfidence,
    bestBets,
  }
}