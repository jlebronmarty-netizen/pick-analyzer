'use client'

import { useEffect, useState } from 'react'

type ProfitPoint = {
  index: number
  date: string
  profit: number
  cumulativeProfit: number
  team: string
  sport: string
  result: string
}

type DailyPerformance = {
  date: string
  picks: number
  settled: number
  wins: number
  losses: number
  pushes: number
  winRate: number
  profit: number
  roi: number
}

type SportPerformance = {
  sport: string
  picks: number
  settled: number
  pending: number
  wins: number
  losses: number
  winRate: number
  profit: number
  roi: number
}

type TeamPerformance = {
  team?: string
  key?: string
  picks: number
  settled: number
  wins: number
  losses: number
  winRate: number
  profit: number
  roi: number
}

type ChartsResponse = {
  success: boolean
  charts?: {
    profitCurve: ProfitPoint[]
    dailyPerformance: DailyPerformance[]
    sportPerformance: SportPerformance[]
    bestTeams: TeamPerformance[]
    worstTeams: TeamPerformance[]
  }
}

function money(value: number) {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(value).toFixed(2)}`
}

function percent(value: number) {
  return `${Number(value).toFixed(2)}%`
}

function SimpleBar({
  label,
  value,
  max,
}: {
  label: string
  value: number
  max: number
}) {
  const width = max > 0 ? Math.min(Math.abs(value) / max, 1) * 100 : 0

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="truncate text-slate-400">{label}</span>
        <span className={value >= 0 ? 'text-emerald-400' : 'text-red-400'}>
          {money(value)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-800">
        <div
          className={`h-2 rounded-full ${
            value >= 0 ? 'bg-emerald-500' : 'bg-red-500'
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

function ProfitCurve({ points }: { points: ProfitPoint[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-slate-400">No settled picks yet.</p>
  }

  const values = points.map((p) => p.cumulativeProfit)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const svgPoints = points
    .map((p, index) => {
      const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 100
      const y = 100 - ((p.cumulativeProfit - min) / range) * 100
      return `${x},${y}`
    })
    .join(' ')

  const latest = points[points.length - 1]

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Current Profit</p>
          <p
            className={`text-2xl font-bold ${
              latest.cumulativeProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {money(latest.cumulativeProfit)}
          </p>
        </div>
        <p className="text-xs text-slate-500">{points.length} settled picks</p>
      </div>

      <svg viewBox="0 0 100 100" className="h-56 w-full overflow-visible">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          points={svgPoints}
          className={
            latest.cumulativeProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
          }
        />
      </svg>
    </div>
  )
}

export default function AnalyticsChartsPanel() {
  const [data, setData] = useState<ChartsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/analytics/charts', {
          cache: 'no-store',
        })

        const json = await response.json()

        if (!response.ok || !json.success) {
          throw new Error(json.error ?? 'Failed to load charts')
        }

        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    load()
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

  const charts = data?.charts

  if (!charts) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        No chart data available.
      </div>
    )
  }

  const maxSportProfit = Math.max(
    ...charts.sportPerformance.map((sport) => Math.abs(sport.profit)),
    1
  )

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="text-lg font-bold text-white">Profit Curve</h3>
        <div className="mt-4">
          <ProfitCurve points={charts.profitCurve} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="text-lg font-bold text-white">Sport Performance</h3>
        <div className="mt-4 space-y-4">
          {charts.sportPerformance.map((sport) => (
            <SimpleBar
              key={sport.sport}
              label={`${sport.sport} · ROI ${percent(sport.roi)}`}
              value={sport.profit}
              max={maxSportProfit}
            />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="text-lg font-bold text-white">Best Teams</h3>
        <div className="mt-4 space-y-3">
          {charts.bestTeams.slice(0, 10).map((team) => (
            <div
              key={team.team ?? team.key}
              className="flex items-center justify-between border-b border-slate-800 pb-2 text-sm"
            >
              <span className="text-slate-300">{team.team ?? team.key}</span>
              <span className="font-semibold text-emerald-400">
                {money(team.profit)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="text-lg font-bold text-white">Worst Teams</h3>
        <div className="mt-4 space-y-3">
          {charts.worstTeams.slice(0, 10).map((team) => (
            <div
              key={team.team ?? team.key}
              className="flex items-center justify-between border-b border-slate-800 pb-2 text-sm"
            >
              <span className="text-slate-300">{team.team ?? team.key}</span>
              <span className="font-semibold text-red-400">
                {money(team.profit)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}