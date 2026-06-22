import { supabaseAdmin } from '@/lib/supabase-admin'

type PredictionRow = {
  sport_key: string
  team: string
  status: string | null
  result: string | null
  stake: number | null
  profit: number | null
  recommended_pick: boolean | null
}

function getRowResult(row: PredictionRow) {
  return row.status ?? row.result ?? 'pending'
}

function calculateSummary(rows: PredictionRow[]) {
  const settled = rows.filter((row) => getRowResult(row) !== 'pending')
  const wins = settled.filter((row) => getRowResult(row) === 'win').length
  const losses = settled.filter((row) => getRowResult(row) === 'loss').length
  const pushes = settled.filter((row) => getRowResult(row) === 'push').length

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

function groupBy(
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
    .select('sport_key, team, status, result, stake, profit, recommended_pick')

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