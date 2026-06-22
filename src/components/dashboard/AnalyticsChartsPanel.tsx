'use client'

import { useEffect, useState } from 'react'

type ProfitCurvePoint = {
  index: number
  date: string
  profit: number
  cumulativeProfit: number
  team: string
  sport: string
  result: string
}

type DailyPerformancePoint = {
  date: string
  picks: number
  settled: number
  pending: number
  wins: number
  losses: number
  pushes: number
  winRate: number
  profit: number
  roi: number
}

type SportPerformancePoint = {
  sport: string
  picks: number
  settled: number
  pending: number
  wins: number
  losses: number
  pushes: number
  winRate: number
  profit: number
  roi: number
}

type TeamPerformancePoint = {
  team: string
  picks: number
  settled: number
  pending: number
  wins: number
  losses: number
  pushes: number
  winRate: number
  profit: number
  roi: number
}

type AnalyticsChartsResponse = {
  success: boolean
  overall: {
    picks: number
    settled: number
    pending: number
    wins: number
    losses: number
    pushes: number
    winRate: number
    profit: number
    roi: number
  }
  charts: {
    profitCurve: ProfitCurvePoint[]
    dailyPerformance: DailyPerformancePoint[]
    sportPerformance: SportPerformancePoint[]
    bestTeams: TeamPerformancePoint[]
    worstTeams: TeamPerformancePoint[]
  }
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`
}

function getMaxAbs(values: number[]) {
  const max = Math.max(...values.map((value) => Math.abs(value)), 1)
  return max
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
      {message}
    </div>
  )
}

function ProfitCurve({ data }: { data: ProfitCurvePoint[] }) {
  if (data.length === 0) {
    return <EmptyState message="No settled picks yet for profit curve." />
  }

  const maxAbs = getMaxAbs(data.map((item) => item.cumulativeProfit))

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-4">
        <h3 className="font-semibold text-white">Profit Curve</h3>
        <p className="text-xs text-slate-400">
          Cumulative profit across settled picks.
        </p>
      </div>

      <div className="space-y-3">
        {data.map((item) => {
          const width = Math.max(
            6,
            Math.min(100, (Math.abs(item.cumulativeProfit) / maxAbs) * 100)
          )

          return (
            <div key={`${item.index}-${item.team}`} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-slate-300">
                  #{item.index} {item.team}
                </span>
                <span
                  className={
                    item.cumulativeProfit >= 0
                      ? 'font-semibold text-emerald-400'
                      : 'font-semibold text-red-400'
                  }
                >
                  {formatCurrency(item.cumulativeProfit)}
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={
                    item.cumulativeProfit >= 0
                      ? 'h-full rounded-full bg-emerald-500'
                      : 'h-full rounded-full bg-red-500'
                  }
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DailyPerformance({ data }: { data: DailyPerformancePoint[] }) {
  if (data.length === 0) {
    return <EmptyState message="No daily performance data yet." />
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-4">
        <h3 className="font-semibold text-white">Daily Performance</h3>
        <p className="text-xs text-slate-400">
          Settled picks grouped by settlement date.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Date</th>
              <th className="py-2">Settled</th>
              <th className="py-2">W-L-P</th>
              <th className="py-2">Win Rate</th>
              <th className="py-2">Profit</th>
              <th className="py-2">ROI</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.date} className="border-t border-slate-800">
                <td className="py-3 text-slate-300">{item.date}</td>
                <td className="py-3 text-slate-300">{item.settled}</td>
                <td className="py-3 text-slate-300">
                  {item.wins}-{item.losses}-{item.pushes}
                </td>
                <td className="py-3 text-slate-300">
                  {formatPercent(item.winRate)}
                </td>
                <td
                  className={
                    item.profit >= 0
                      ? 'py-3 font-semibold text-emerald-400'
                      : 'py-3 font-semibold text-red-400'
                  }
                >
                  {formatCurrency(item.profit)}
                </td>
                <td
                  className={
                    item.roi >= 0
                      ? 'py-3 font-semibold text-emerald-400'
                      : 'py-3 font-semibold text-red-400'
                  }
                >
                  {formatPercent(item.roi)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SportPerformance({ data }: { data: SportPerformancePoint[] }) {
  if (data.length === 0) {
    return <EmptyState message="No sport performance data yet." />
  }

  const maxPicks = Math.max(...data.map((item) => item.picks), 1)

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-4">
        <h3 className="font-semibold text-white">Performance by Sport</h3>
        <p className="text-xs text-slate-400">
          Picks, settlement and ROI by sport.
        </p>
      </div>

      <div className="space-y-4">
        {data.map((item) => {
          const width = Math.max(6, (item.picks / maxPicks) * 100)

          return (
            <div key={item.sport} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-slate-300">
                  {item.sport}
                </span>
                <span className="text-slate-400">
                  {item.settled}/{item.picks} settled · ROI{' '}
                  {formatPercent(item.roi)}
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TeamsTable({
  title,
  description,
  data,
}: {
  title: string
  description: string
  data: TeamPerformancePoint[]
}) {
  if (data.length === 0) {
    return <EmptyState message={`No data yet for ${title}.`} />
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-4">
        <h3 className="font-semibold text-white">{title}</h3>
        <p className="text-xs text-slate-400">{description}</p>
      </div>

      <div className="space-y-3">
        {data.map((team) => (
          <div
            key={team.team}
            className="flex items-center justify-between gap-3 rounded-lg bg-slate-950/70 p-3"
          >
            <div>
              <p className="text-sm font-medium text-white">{team.team}</p>
              <p className="text-xs text-slate-400">
                {team.wins}-{team.losses}-{team.pushes} ·{' '}
                {formatPercent(team.winRate)}
              </p>
            </div>

            <div className="text-right">
              <p
                className={
                  team.profit >= 0
                    ? 'text-sm font-semibold text-emerald-400'
                    : 'text-sm font-semibold text-red-400'
                }
              >
                {formatCurrency(team.profit)}
              </p>
              <p className="text-xs text-slate-400">{formatPercent(team.roi)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AnalyticsChartsPanel() {
  const [data, setData] = useState<AnalyticsChartsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCharts() {
      try {
        const response = await fetch('/api/analytics/charts', {
          cache: 'no-store',
        })

        const json = await response.json()

        if (!response.ok || !json.success) {
          throw new Error(json.error ?? 'Failed to load analytics charts')
        }

        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    loadCharts()
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading analytics charts...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-6 text-sm text-red-300">
        {error}
      </div>
    )
  }

  if (!data) {
    return <EmptyState message="No analytics chart data available." />
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ProfitCurve data={data.charts.profitCurve} />
        <DailyPerformance data={data.charts.dailyPerformance} />
      </div>

      <SportPerformance data={data.charts.sportPerformance} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <TeamsTable
          title="Best Teams"
          description="Teams ranked by total profit."
          data={data.charts.bestTeams}
        />

        <TeamsTable
          title="Worst Teams"
          description="Teams ranked by total loss."
          data={data.charts.worstTeams}
        />
      </div>
    </div>
  )
}