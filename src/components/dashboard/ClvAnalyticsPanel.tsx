'use client'

import { useEffect, useState } from 'react'
import DashboardStatCard from './DashboardStatCard'

type ClvGroup = {
  key: string
  total: number
  averageClv: number
  positiveRate: number
  negativeRate: number
  neutralRate: number
  strongPositiveRate: number
  strongNegativeRate: number
  averageOpeningOdds: number
  averageClosingOdds: number
}

type ClvResponse = {
  success: boolean
  generatedAt: string
  summary: {
    trackedPicks: number
    total: number
    averageClv: number
    positiveRate: number
    negativeRate: number
    neutralRate: number
    strongPositiveRate: number
    strongNegativeRate: number
    averageOpeningOdds: number
    averageClosingOdds: number
  }
  bySport: ClvGroup[]
  bySportsbook: ClvGroup[]
  byConfidence: ClvGroup[]
  bestSportsbooks: ClvGroup[]
  worstSportsbooks: ClvGroup[]
  error?: string
}

function formatPercent(value: number) {
  return `${Number(value).toFixed(2)}%`
}

function formatOdds(value: number) {
  if (value === 0) return '0'

  return value > 0 ? `+${value.toFixed(0)}` : value.toFixed(0)
}

function getClvColor(value: number) {
  if (value > 0) return 'text-emerald-400'
  if (value < 0) return 'text-red-400'

  return 'text-slate-300'
}

function GroupTable({
  title,
  description,
  rows,
}: {
  title: string
  description: string
  rows: ClvGroup[]
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-xs text-slate-400">{description}</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">No CLV data available.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Group</th>
                <th className="py-2">Picks</th>
                <th className="py-2">Avg CLV</th>
                <th className="py-2">Positive</th>
                <th className="py-2">Negative</th>
                <th className="py-2">Neutral</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-slate-800">
                  <td className="py-3 font-medium text-white">{row.key}</td>
                  <td className="py-3 text-slate-300">{row.total}</td>
                  <td className={`py-3 font-semibold ${getClvColor(row.averageClv)}`}>
                    {formatPercent(row.averageClv)}
                  </td>
                  <td className="py-3 text-emerald-400">
                    {formatPercent(row.positiveRate)}
                  </td>
                  <td className="py-3 text-red-400">
                    {formatPercent(row.negativeRate)}
                  </td>
                  <td className="py-3 text-slate-300">
                    {formatPercent(row.neutralRate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SportsbookCards({
  title,
  rows,
}: {
  title: string
  rows: ClvGroup[]
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h3 className="text-lg font-bold text-white">{title}</h3>

      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400">No sportsbook data.</p>
        ) : (
          rows.map((row) => (
            <div
              key={`${title}-${row.key}`}
              className="rounded-lg border border-slate-800 bg-slate-950/70 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{row.key}</p>
                  <p className="text-xs text-slate-500">{row.total} tracked picks</p>
                </div>

                <p className={`text-lg font-bold ${getClvColor(row.averageClv)}`}>
                  {formatPercent(row.averageClv)}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-slate-500">Positive</p>
                  <p className="font-semibold text-emerald-400">
                    {formatPercent(row.positiveRate)}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Negative</p>
                  <p className="font-semibold text-red-400">
                    {formatPercent(row.negativeRate)}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Neutral</p>
                  <p className="font-semibold text-white">
                    {formatPercent(row.neutralRate)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function ClvAnalyticsPanel() {
  const [data, setData] = useState<ClvResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadClv() {
      try {
        const response = await fetch('/api/analytics/clv', {
          cache: 'no-store',
        })

        const json = await response.json()

        if (!response.ok || !json.success) {
          throw new Error(json.error ?? 'Failed to load CLV analytics')
        }

        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown CLV error')
      } finally {
        setLoading(false)
      }
    }

    loadClv()
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading CLV analytics...
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

  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <DashboardStatCard
          label="Average CLV"
          value={formatPercent(data.summary.averageClv)}
          description={`${data.summary.trackedPicks} tracked picks`}
        />

        <DashboardStatCard
          label="Positive CLV"
          value={formatPercent(data.summary.positiveRate)}
          description="Market moved in your favor"
        />

        <DashboardStatCard
          label="Negative CLV"
          value={formatPercent(data.summary.negativeRate)}
          description="Market moved against you"
        />

        <DashboardStatCard
          label="Neutral CLV"
          value={formatPercent(data.summary.neutralRate)}
          description="No major line movement"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashboardStatCard
          label="Average Opening Odds"
          value={formatOdds(data.summary.averageOpeningOdds)}
          description="Average captured line"
        />

        <DashboardStatCard
          label="Average Closing Odds"
          value={formatOdds(data.summary.averageClosingOdds)}
          description="Average latest line"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SportsbookCards title="Best Sportsbooks by CLV" rows={data.bestSportsbooks} />
        <SportsbookCards title="Worst Sportsbooks by CLV" rows={data.worstSportsbooks} />
      </div>

      <GroupTable
        title="CLV by Sport"
        description="Closing line performance grouped by sport."
        rows={data.bySport}
      />

      <GroupTable
        title="CLV by Sportsbook"
        description="Closing line performance grouped by sportsbook."
        rows={data.bySportsbook}
      />

      <GroupTable
        title="CLV by Confidence"
        description="Closing line performance grouped by model confidence bucket."
        rows={data.byConfidence}
      />
    </div>
  )
}