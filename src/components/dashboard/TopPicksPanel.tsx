'use client'

import { useEffect, useState } from 'react'

type Pick = {
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
}

type TopPicksResponse = {
  success: boolean
  summary: {
    pendingPicks: number
    recommendedPicks: number
    topEvCount: number
    topConfidenceCount: number
    bestBetsCount: number
  }
  topEv: Pick[]
  topConfidence: Pick[]
  bestBets: Pick[]
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatOdds(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`
}

function PickCard({ pick }: { pick: Pick }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{pick.team} ML</p>
          <p className="mt-1 text-xs text-slate-400">
            vs {pick.opponent} · {formatDate(pick.commence_time)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{pick.sport_key}</p>
        </div>

        <div className="text-right">
          <p className="text-sm font-bold text-white">{formatOdds(pick.odds)}</p>
          {pick.recommended_pick && (
            <span className="mt-1 inline-block rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-400">
              Recommended
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
        <div>
          <p className="text-slate-500">Model</p>
          <p className="font-semibold text-white">
            {formatPercent(pick.model_probability)}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Edge</p>
          <p
            className={
              pick.edge >= 0
                ? 'font-semibold text-emerald-400'
                : 'font-semibold text-red-400'
            }
          >
            {formatPercent(pick.edge)}
          </p>
        </div>

        <div>
          <p className="text-slate-500">EV</p>
          <p
            className={
              pick.ev >= 0
                ? 'font-semibold text-emerald-400'
                : 'font-semibold text-red-400'
            }
          >
            {formatPercent(pick.ev)}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Confidence</p>
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
  description,
  picks,
}: {
  title: string
  description: string
  picks: Pick[]
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-white">{title}</h3>
        <p className="text-xs text-slate-400">{description}</p>
      </div>

      {picks.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-400">
          No picks available yet.
        </div>
      ) : (
        <div className="space-y-3">
          {picks.slice(0, 5).map((pick) => (
            <PickCard key={`${pick.id}-${pick.team}`} pick={pick} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function TopPicksPanel() {
  const [data, setData] = useState<TopPicksResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadTopPicks() {
      try {
        const response = await fetch('/api/predictions/top', {
          cache: 'no-store',
        })

        const json = await response.json()

        if (!response.ok || !json.success) {
          throw new Error(json.error ?? 'Failed to load top picks')
        }

        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    loadTopPicks()
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading top picks...
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
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        No top picks data available.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Pending Picks</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {data.summary.pendingPicks}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Recommended</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">
            {data.summary.recommendedPicks}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Top EV</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {data.summary.topEvCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Best Bets</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {data.summary.bestBetsCount}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <PicksColumn
          title="Best Bets Today"
          description="Recommended picks ranked by EV, edge and confidence."
          picks={data.bestBets}
        />

        <PicksColumn
          title="Top EV Picks"
          description="Highest expected value pending picks."
          picks={data.topEv}
        />

        <PicksColumn
          title="Top Confidence"
          description="Highest model confidence pending picks."
          picks={data.topConfidence}
        />
      </div>
    </div>
  )
}