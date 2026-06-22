import { supabaseAdmin } from '@/lib/supabase-admin'

type PredictionRow = {
  sport_key: string
  team: string
  status: string | null
  result: string | null
  stake: number | null
  profit: number | null
  settled_at: string | null
  commence_time: string | null
}

function getRowResult(row: PredictionRow) {
  return row.status ?? row.result ?? 'pending'
}

function getDateKey(value: string | null) {
  if (!value) return 'Unknown'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }

  return date.toISOString().slice(0, 10)
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function calculateSummary(rows: PredictionRow[]) {
  const settled = rows.filter((row) => getRowResult(row) !== 'pending')
  const wins = settled.filter((row) => getRowResult(row) === 'win').length
  const losses = settled.filter((row) => getRowResult(row) === 'loss').length
  const pushes = settled.filter((row) => getRowResult(row) === 'push').length

  const profit = settled.reduce((sum, row) => sum + Number(row.profit ?? 0), 0)
  const stake = settled.reduce((sum, row) => sum + Number(row.stake ?? 0), 0)

  return {
    picks: rows.length,
    settled: settled.length,
    pending: rows.length - settled.length,
    wins,
    losses,
    pushes,
    winRate: settled.length ? round((wins / settled.length) * 100) : 0,
    profit: round(profit),
    roi: stake ? round((profit / stake) * 100) : 0,
  }
}

function groupBy<T>(
  rows: T[],
  getKey: (row: T) => string
): Array<{ key: string; rows: T[] }> {
  const map = new Map<string, T[]>()

  for (const row of rows) {
    const key = getKey(row)

    if (!map.has(key)) {
      map.set(key, [])
    }

    map.get(key)!.push(row)
  }

  return [...map.entries()].map(([key, groupedRows]) => ({
    key,
    rows: groupedRows,
  }))
}

function buildProfitCurve(rows: PredictionRow[]) {
  const settled = rows
    .filter((row) => getRowResult(row) !== 'pending')
    .sort((a, b) => {
      const aDate = new Date(a.settled_at ?? a.commence_time ?? '').getTime()
      const bDate = new Date(b.settled_at ?? b.commence_time ?? '').getTime()

      return aDate - bDate
    })

  let cumulativeProfit = 0

  return settled.map((row, index) => {
    cumulativeProfit += Number(row.profit ?? 0)

    return {
      index: index + 1,
      date: getDateKey(row.settled_at ?? row.commence_time),
      profit: round(Number(row.profit ?? 0)),
      cumulativeProfit: round(cumulativeProfit),
      team: row.team,
      sport: row.sport_key,
      result: getRowResult(row),
    }
  })
}

function buildDailyPerformance(rows: PredictionRow[]) {
  const settled = rows.filter((row) => getRowResult(row) !== 'pending')

  return groupBy(settled, (row) => getDateKey(row.settled_at ?? row.commence_time))
    .map(({ key, rows: dateRows }) => ({
      date: key,
      ...calculateSummary(dateRows),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function buildSportPerformance(rows: PredictionRow[]) {
  return groupBy(rows, (row) => row.sport_key)
    .map(({ key, rows: sportRows }) => ({
      sport: key,
      ...calculateSummary(sportRows),
    }))
    .sort((a, b) => b.roi - a.roi)
}

function buildTeamPerformance(rows: PredictionRow[]) {
  return groupBy(rows, (row) => row.team)
    .map(({ key, rows: teamRows }) => ({
      team: key,
      ...calculateSummary(teamRows),
    }))
    .filter((row) => row.settled > 0)
    .sort((a, b) => b.profit - a.profit)
}

export async function getAnalyticsCharts() {
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select(
      'sport_key, team, status, result, stake, profit, settled_at, commence_time'
    )

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as PredictionRow[]

  const teamPerformance = buildTeamPerformance(rows)

  return {
    success: true,
    overall: calculateSummary(rows),
    charts: {
      profitCurve: buildProfitCurve(rows),
      dailyPerformance: buildDailyPerformance(rows),
      sportPerformance: buildSportPerformance(rows),
      bestTeams: teamPerformance.slice(0, 10),
      worstTeams: [...teamPerformance].sort((a, b) => a.profit - b.profit).slice(0, 10),
    },
  }
}