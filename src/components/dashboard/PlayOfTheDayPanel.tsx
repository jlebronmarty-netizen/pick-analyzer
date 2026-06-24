'use client'

import { useEffect, useState } from 'react'

type PlayOfTheDay = {
  id: string
  team: string
  opponent: string
  sport_key: string
  odds: number
  formatted_odds: string
  model_probability: number
  implied_probability: number
  confidence: number
  edge: number
  ev: number
  risk_grade?: string
  risk_label?: string
  risk_stars?: number
  kelly_percent?: number
  recommended_stake?: number
  smart_score?: number
  recommendation: string
  reason: string
}

type PlayOfTheDayResponse = {
  success: boolean
  generatedAt: string
  play: PlayOfTheDay | null
  message?: string
  error?: string
}

function formatPercent(value?: number) {
  return `${(value ?? 0).toFixed(2)}%`
}

function formatCurrency(value?: number) {
  return `$${(value ?? 0).toFixed(2)}`
}

function renderStars(stars?: number) {
  return '⭐'.repeat(stars ?? 0)
}

export default function PlayOfTheDayPanel() {
  const [data, setData] = useState<PlayOfTheDayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadPlayOfTheDay() {
      try {
        const response = await fetch('/api/play-of-the-day', {
          cache: 'no-store',
        })

        const json = await response.json()

        if (!response.ok || !json.success) {
          throw new Error(json.error ?? 'Failed to load Play of the Day')
        }

        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    loadPlayOfTheDay()
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading Play of the Day...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-6 text-sm text-red-300">
        {error}
      </div>
    )
  }

  const play = data?.play

  if (!play) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        {data?.message ?? 'No qualified Play of the Day available.'}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6 shadow-lg shadow-emerald-950/20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
            Play of the Day
          </p>

          <h2 className="mt-2 text-3xl font-bold text-white">
            {play.team} ML
          </h2>

          <p className="mt-2 text-sm text-slate-300">
            vs {play.opponent} · {play.sport_key}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
              {play.recommendation}
            </span>

            <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-300">
              {play.risk_grade} {play.risk_label}
            </span>

            <span className="text-xs text-amber-300">
              {renderStars(play.risk_stars)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-right">
          <p className="text-xs text-slate-400">Odds</p>
          <p className="text-3xl font-bold text-white">{play.formatted_odds}</p>
          <p className="mt-2 text-xs text-slate-500">
            Smart Score {play.smart_score?.toFixed(2) ?? '0.00'}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-slate-950/60 p-4">
          <p className="text-xs text-slate-500">Confidence</p>
          <p className="mt-1 text-lg font-bold text-white">
            {formatPercent(play.confidence)}
          </p>
        </div>

        <div className="rounded-xl bg-slate-950/60 p-4">
          <p className="text-xs text-slate-500">Edge</p>
          <p className="mt-1 text-lg font-bold text-emerald-400">
            {formatPercent(play.edge)}
          </p>
        </div>

        <div className="rounded-xl bg-slate-950/60 p-4">
          <p className="text-xs text-slate-500">EV</p>
          <p className="mt-1 text-lg font-bold text-emerald-400">
            {formatPercent(play.ev)}
          </p>
        </div>

        <div className="rounded-xl bg-slate-950/60 p-4">
          <p className="text-xs text-slate-500">Stake</p>
          <p className="mt-1 text-lg font-bold text-white">
            {formatCurrency(play.recommended_stake)}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Why this play?
        </p>

        <p className="mt-2 text-sm text-slate-300">
          {play.reason} Model probability is{' '}
          <span className="font-semibold text-white">
            {formatPercent(play.model_probability)}
          </span>{' '}
          vs market implied probability of{' '}
          <span className="font-semibold text-white">
            {formatPercent(play.implied_probability)}
          </span>.
        </p>
      </div>
    </div>
  )
}