'use client'

import { useEffect, useState } from 'react'
import PickExplanationCard from '@/components/dashboard/PickExplanationCard'

type AdaptiveAdjustment = {
  original?: {
    confidence?: number
    ev?: number
    edge?: number
    smartScore?: number
  }
  adjusted?: {
    confidence?: number
    ev?: number
    edge?: number
    adaptiveScore?: number
  }
  strongestAdjustment?: {
    factor: string
    multiplier: number
  } | null
}

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
  recommendation_status?: string
  recommendation_label?: string
  confidence_label?: string
  reliability_label?: string
  value_label?: string
  qualification_blockers?: string[]
  risk_grade?: string
  risk_label?: string
  smart_score?: number
  adaptive_score?: number
  adaptive_adjustment?: AdaptiveAdjustment
}

type TopPicksResponse = {
  success: boolean
  adaptiveWeightsAvailable?: boolean
  summary: {
    pendingPicks: number
    safePendingPicks?: number
    recommendedPicks: number
    officialQualifiedPicks?: number
    watchCandidates?: number
    calibrationStatus?: string
    automaticProductionApproval?: boolean
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

function formatPercent(value?: number) {
  return `${Number(value ?? 0).toFixed(2)}%`
}

function scoreClass(value?: number) {
  const score = Number(value ?? 0)

  if (score >= 80) return 'text-emerald-400'
  if (score >= 65) return 'text-amber-300'

  return 'text-slate-300'
}

function factorLabel(value?: string) {
  if (!value) return 'No adjustment'
  if (value === 'confidenceMultiplier') return 'Confidence'
  if (value === 'evMultiplier') return 'EV'
  if (value === 'edgeMultiplier') return 'Edge'
  if (value === 'oddsMultiplier') return 'Odds Style'

  return value
}

function PickCard({ pick }: { pick: Pick }) {
  const [loadingExplanation, setLoadingExplanation] = useState(false)
  const [explanation, setExplanation] = useState<any>(null)

  const adaptiveScore = pick.adaptive_score ?? pick.smart_score ?? 0
  const smartScore = pick.smart_score ?? 0
  const strongest = pick.adaptive_adjustment?.strongestAdjustment

  async function toggleExplanation() {
    if (explanation) {
      setExplanation(null)
      return
    }

    try {
      setLoadingExplanation(true)

      const response = await fetch('/api/picks/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify(pick),
      })

      const json = await response.json()

      if (!response.ok || json?.success === false) {
        throw new Error(json?.error ?? 'Unable to explain pick')
      }

      setExplanation(json)
    } catch (error) {
      console.error('Pick explanation failed:', error)
    } finally {
      setLoadingExplanation(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-white">{pick.team} ML</p>

              {pick.risk_grade && (
                <span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-300">
                  {pick.risk_grade} {pick.risk_label ?? ''}
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-slate-400">
              vs {pick.opponent} · {formatDate(pick.commence_time)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {pick.sport_key} · {pick.sportsbook}
            </p>
          </div>

          <div className="text-right">
            <p className="text-sm font-bold text-white">{formatOdds(pick.odds)}</p>
            {pick.recommendation_status &&
              pick.recommendation_status !== 'INELIGIBLE' &&
              pick.recommendation_status !== 'ANALYZED_ONLY' && (
              <span className="mt-1 inline-block rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-400">
                {pick.recommendation_label ?? 'Qualified pick'}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
          <div>
            <p className="text-slate-500">Adaptive</p>
            <p className={`font-bold ${scoreClass(adaptiveScore)}`}>
              {adaptiveScore.toFixed(2)}
            </p>
          </div>

          <div>
            <p className="text-slate-500">Smart</p>
            <p className="font-semibold text-white">{smartScore.toFixed(2)}</p>
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
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-slate-900/70 p-3">
            <p className="text-slate-500">Model</p>
            <p className="font-semibold text-white">
              {formatPercent(pick.model_probability)}
            </p>
          </div>

          <div className="rounded-lg bg-slate-900/70 p-3">
            <p className="text-slate-500">Confidence</p>
            <p className="font-semibold text-white">
              {pick.confidence_label ?? formatPercent(pick.confidence)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-slate-900/70 p-3">
            <p className="text-slate-500">Reliability</p>
            <p className="font-semibold text-white">
              {pick.reliability_label ?? 'Developing'}
            </p>
          </div>

          <div className="rounded-lg bg-slate-900/70 p-3">
            <p className="text-slate-500">Value</p>
            <p className="font-semibold text-white">
              {pick.value_label ?? 'Positive value'}
            </p>
          </div>
        </div>

        {strongest && Number(strongest.multiplier) !== 1 && (
          <div className="mt-4 rounded-lg border border-purple-500/20 bg-purple-950/10 p-3">
            <p className="text-xs font-semibold text-purple-300">
              Adaptive Adjustment
            </p>
            <p className="mt-1 text-xs text-slate-300">
              {factorLabel(strongest.factor)} multiplier:{' '}
              <span className="font-bold text-white">
                {Number(strongest.multiplier).toFixed(2)}x
              </span>
            </p>
          </div>
        )}

        <button
          onClick={toggleExplanation}
          disabled={loadingExplanation}
          className="mt-4 w-full rounded-xl border border-cyan-500/30 bg-cyan-950/20 px-4 py-2 text-xs font-bold text-cyan-300 transition hover:bg-cyan-950/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingExplanation
            ? 'Analyzing...'
            : explanation
              ? 'Hide AI Analysis'
              : 'AI Analysis'}
        </button>
      </div>

      {explanation && <PickExplanationCard explanation={explanation} />}
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
          No official picks currently satisfy the model's quality, calibration and value thresholds.
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
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Pending Picks</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {data.summary.pendingPicks}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Safe Pending</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {data.summary.safePendingPicks ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Recommended</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">
            {data.summary.recommendedPicks}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Watch</p>
          <p className="mt-1 text-2xl font-bold text-amber-300">
            {data.summary.watchCandidates ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Best Bets</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {data.summary.bestBetsCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Adaptive</p>
          <p
            className={
              data.adaptiveWeightsAvailable
                ? 'mt-1 text-2xl font-bold text-purple-300'
                : 'mt-1 text-2xl font-bold text-slate-500'
            }
          >
            {data.adaptiveWeightsAvailable ? 'ON' : 'OFF'}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4 text-sm leading-6 text-amber-100">
        No official picks are enabled until production rows pass the shared
        recommendation policy and calibration is no longer probationary.
        Calibration status: {data.summary.calibrationStatus ?? 'probationary'}.
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <PicksColumn
          title="Best Bets Today"
          description="Recommended picks ranked by adaptive score, EV, edge and confidence."
          picks={data.bestBets}
        />

        <PicksColumn
          title="Top EV Picks"
          description="Highest expected value pending picks, adjusted by adaptive scoring."
          picks={data.topEv}
        />

        <PicksColumn
          title="Top Confidence"
          description="Highest model confidence pending picks with adaptive ranking."
          picks={data.topConfidence}
        />
      </div>
    </div>
  )
}
