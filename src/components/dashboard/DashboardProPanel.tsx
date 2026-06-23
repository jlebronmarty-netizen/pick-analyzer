'use client'

import { useEffect, useState } from 'react'
import DashboardStatCard from './DashboardStatCard'

type Pick = {
  id: string
  sport_key: string
  commence_time: string
  team: string
  opponent: string
  sportsbook: string
  odds: number
  model_probability: number
  edge: number
  ev: number
  confidence: number
}

type TopPicksResponse = {
  success: boolean
  summary: {
    pendingPicks: number
    recommendedPicks: number
    bestBetsCount: number
  }
  bestBets: Pick[]
  topEv: Pick[]
  topConfidence: Pick[]
}

type AnalyticsResponse = {
  success: boolean
  overall: {
    picks: number
    settled: number
    pending: number
    wins: number
    losses: number
    winRate: number
    profit: number
    roi: number
  }
}

function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : `${odds}`
}

function formatPercent(value: number) {
  return `${Number(value).toFixed(2)}%`
}

function formatMoney(value: number) {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(value).toFixed(2)}`
}

function PickRow({ pick }: { pick: Pick }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{pick.team}</p>
          <p className="text-xs text-slate-400">vs {pick.opponent}</p>
          <p className="mt-1 text-xs text-slate-500">{pick.sport_key}</p>
        </div>

        <div className="text-right">
          <p className="font-bold text-white">{formatOdds(pick.odds)}</p>
          <p className="text-xs text-slate-500">{pick.sportsbook}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-slate-500">EV</p>
          <p className="font-semibold text-emerald-400">
            {formatPercent(pick.ev)}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Edge</p>
          <p className="font-semibold text-emerald-400">
            {formatPercent(pick.edge)}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Conf.</p>
          <p className="font-semibold text-white">
            {formatPercent(pick.confidence)}
          </p>
        </div>
      </div>
    </div>
  )
}

function PicksColumn({
  title,
  picks,
}: {
  title: string
  picks: Pick[]
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h3 className="text-lg font-bold text-white">{title}</h3>

      <div className="mt-4 space-y-3">
        {picks.length === 0 ? (
          <p className="text-sm text-slate-400">No picks available.</p>
        ) : (
          picks.slice(0, 5).map((pick) => (
            <PickRow key={`${pick.id}-${pick.team}`} pick={pick} />
          ))
        )}
      </div>
    </div>
  )
}

export default function DashboardProPanel() {
  const [topPicks, setTopPicks] = useState<TopPicksResponse | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [topResponse, analyticsResponse] = await Promise.all([
          fetch('/api/predictions/top', { cache: 'no-store' }),
          fetch('/api/analytics/dashboard', { cache: 'no-store' }),
        ])

        const topJson = await topResponse.json()
        const analyticsJson = await analyticsResponse.json()

        if (!topResponse.ok || !topJson.success) {
          throw new Error(topJson.error ?? 'Failed to load top picks')
        }

        if (!analyticsResponse.ok || !analyticsJson.success) {
          throw new Error(analyticsJson.error ?? 'Failed to load analytics')
        }

        setTopPicks(topJson)
        setAnalytics(analyticsJson)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown dashboard error')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading dashboard pro...
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

  if (!topPicks || !analytics) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <DashboardStatCard
          label="Profit"
          value={formatMoney(analytics.overall.profit)}
          description="Settled recommended picks"
        />
        <DashboardStatCard
          label="ROI"
          value={formatPercent(analytics.overall.roi)}
          description="Return on investment"
        />
        <DashboardStatCard
          label="Win Rate"
          value={formatPercent(analytics.overall.winRate)}
          description={`${analytics.overall.wins}W / ${analytics.overall.losses}L`}
        />
        <DashboardStatCard
          label="Best Bets"
          value={topPicks.summary.bestBetsCount}
          description={`${topPicks.summary.recommendedPicks} recommended picks`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <PicksColumn title="Best Bets" picks={topPicks.bestBets} />
        <PicksColumn title="Top EV" picks={topPicks.topEv} />
        <PicksColumn title="Top Confidence" picks={topPicks.topConfidence} />
      </div>
    </div>
  )
}