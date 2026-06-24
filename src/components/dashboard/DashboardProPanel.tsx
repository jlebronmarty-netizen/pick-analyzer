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
  implied_probability?: number
  edge: number
  ev: number
  confidence: number
  risk_grade?: string
  risk_label?: string
  risk_stars?: number
  kelly_percent?: number
  recommended_stake?: number
  smart_score?: number
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

type SportGroup = {
  sportKey: string
  label: string
  count: number
  picks: Pick[]
}

type BySportResponse = {
  success: boolean
  generatedAt: string
  count: number
  sports: SportGroup[]
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

function renderStars(stars?: number) {
  return '⭐'.repeat(stars ?? 0)
}

function formatStake(value?: number) {
  return `$${(value ?? 0).toFixed(2)}`
}

function PickRow({ pick }: { pick: Pick }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{pick.team} ML</p>
          <p className="text-xs text-slate-400">vs {pick.opponent}</p>
          <p className="mt-1 text-xs text-slate-500">{pick.sport_key}</p>
        </div>

        <div className="text-right">
          <p className="font-bold text-white">{formatOdds(pick.odds)}</p>
          <p className="text-xs text-slate-500">{pick.sportsbook}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-blue-500/15 px-2 py-1 text-xs font-semibold text-blue-300">
          {pick.risk_grade ?? 'N/A'} {pick.risk_label ?? ''}
        </span>

        <span className="text-xs text-amber-300">
          {renderStars(pick.risk_stars)}
        </span>

        <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300">
          Score {pick.smart_score?.toFixed(2) ?? '0.00'}
        </span>
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

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-800 pt-3 text-xs">
        <div>
          <p className="text-slate-500">Kelly</p>
          <p className="font-semibold text-emerald-400">
            {formatPercent(pick.kelly_percent ?? 0)}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Stake</p>
          <p className="font-semibold text-white">
            {formatStake(pick.recommended_stake)}
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

function SportPicksSection({ sports }: { sports: SportGroup[] }) {
  if (sports.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        No sport picks available.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {sports.map((sport) => (
        <div
          key={sport.sportKey}
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white">
                Top {sport.label} Picks
              </h3>
              <p className="text-xs text-slate-400">
                Ranked by Smart Score, confidence, EV and edge.
              </p>
            </div>

            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
              {sport.count} picks
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {sport.picks.length === 0 ? (
              <p className="text-sm text-slate-400">
                No qualified picks available.
              </p>
            ) : (
              sport.picks.map((pick) => (
                <PickRow key={`${sport.sportKey}-${pick.id}`} pick={pick} />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DashboardProPanel() {
  const [topPicks, setTopPicks] = useState<TopPicksResponse | null>(null)
  const [bySport, setBySport] = useState<BySportResponse | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [topResponse, bySportResponse, analyticsResponse] =
          await Promise.all([
            fetch('/api/predictions/top', { cache: 'no-store' }),
            fetch('/api/predictions/by-sport', { cache: 'no-store' }),
            fetch('/api/analytics/dashboard', { cache: 'no-store' }),
          ])

        const topJson = await topResponse.json()
        const bySportJson = await bySportResponse.json()
        const analyticsJson = await analyticsResponse.json()

        if (!topResponse.ok || !topJson.success) {
          throw new Error(topJson.error ?? 'Failed to load top picks')
        }

        if (!bySportResponse.ok || !bySportJson.success) {
          throw new Error(
            bySportJson.error ?? 'Failed to load sport picks'
          )
        }

        if (!analyticsResponse.ok || !analyticsJson.success) {
          throw new Error(analyticsJson.error ?? 'Failed to load analytics')
        }

        setTopPicks(topJson)
        setBySport(bySportJson)
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

      <div className="space-y-3">
        <div>
          <h3 className="text-xl font-bold text-white">
            Top Picks by Sport
          </h3>
          <p className="text-sm text-slate-400">
            Best qualified plays grouped by sport and ranked by Smart Score.
          </p>
        </div>

        <SportPicksSection sports={bySport?.sports ?? []} />
      </div>
    </div>
  )
}