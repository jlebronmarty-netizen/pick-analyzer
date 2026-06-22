import { supabaseAdmin } from '@/lib/supabase-admin'

type PredictionRow = {
  sport_key: string
  team: string
  result: string
  stake: number | null
  profit: number | null
  recommended_pick: boolean | null
}

function calculateSummary(rows: PredictionRow[]) {
  const settled = rows.filter((row) => row.result !== 'pending')
  const wins = settled.filter((row) => row.result === 'win').length
  const losses = settled.filter((row) => row.result === 'loss').length
  const pushes = settled.filter((row) => row.result === 'push').length

  const totalProfit = settled.reduce(
    (sum, row) => sum + Number(row.profit ?? 0),
    0
  )

  const totalStake = settled.reduce(
    (sum, row) => sum + Number(row.stake ?? 0),
    0
  )

  return {
    picks: rows.length,
    settled: settled.length,
    pending: rows.length - settled.length,
    wins,
    losses,
    pushes,
    winRate: settled.length
      ? Number(((wins / settled.length) * 100).toFixed(2))
      : 0,
    profit: Number(totalProfit.toFixed(2)),
    roi: totalStake
      ? Number(((totalProfit / totalStake) * 100).toFixed(2))
      : 0,
  }
}

function groupBy<T>(
  rows: PredictionRow[],
  getKey: (row: PredictionRow) => string
) {
  const map = new Map<string, PredictionRow[]>()

  for (const row of rows) {
    const key = getKey(row)

    if (!map.has(key)) {
      map.set(key, [])
    }

    map.get(key)!.push(row)
  }

  return [...map.entries()].map(([key, items]) => ({
    key,
    ...calculateSummary(items),
  }))
}

export async function getAnalyticsDashboard() {
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select('sport_key, team, result, stake, profit, recommended_pick')
    .eq('recommended_pick', true)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as PredictionRow[]

  const overall = calculateSummary(rows)

  const bySport = groupBy(rows, (row) => row.sport_key).sort(
    (a, b) => b.roi - a.roi
  )

  const byTeam = groupBy(rows, (row) => row.team)

  const bestTeams = [...byTeam]
    .filter((row) => row.settled >= 1)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10)

  const worstTeams = [...byTeam]
    .filter((row) => row.settled >= 1)
    .sort((a, b) => a.profit - b.profit)
    .slice(0, 10)

  return {
    success: true,
    overall,
    bySport,
    bestTeams,
    worstTeams,
  }
}