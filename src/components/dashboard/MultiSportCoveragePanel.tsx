'use client'

import { useEffect, useState } from 'react'
import { SPORTS } from '@/config/sports.config'
import { useSport } from '@/context/SportContext'

type SportPick = {
  id: string
  team: string
  opponent: string
  sportsbook: string
  sport_key: string
  odds: number
  confidence: number
  ev: number
  edge: number
  adaptive_score?: number
  smart_score?: number
}

type SportResponse = {
  success: boolean
  sportKey: string
  summary: {
    pendingPicks: number
    safePendingPicks: number
    recommendedPicks: number
    topEvCount: number
    topConfidenceCount: number
    bestBetsCount: number
    sportsAvailable: string[]
  }
  bestBets: SportPick[]
  topEv: SportPick[]
  topConfidence: SportPick[]
  error?: string
}

function formatOdds(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}

function pct(value?: number) {
  return `${Number(value ?? 0).toFixed(2)}%`
}

export default function MultiSportCoveragePanel() {
  const { sportKey, sport } = useSport()

  const [data, setData] = useState<SportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(
          `/api/predictions/by-sport?sport=${encodeURIComponent(
            sportKey
          )}`,
          { cache: 'no-store' }
        )

        const json = await response.json()

        if (!response.ok || !json.success) {
          throw new Error(
            json.error ?? 'Unable to load sport predictions'
          )
        }

        setData(json)
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load sport predictions'
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [sportKey])

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading {sport.shortLabel} coverage...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-900/60 bg-red-950/30 p-6 text-sm text-red-300">
        {error}
      </div>
    )
  }

  if (!data) return null

  const selectedDefinition = SPORTS.find(
    (item) => item.key === sportKey
  )

  const featured = [
    ...data.bestBets,
    ...data.topEv,
    ...data.topConfidence,
  ]
    .filter(
      (pick, index, rows) =>
        rows.findIndex(
          (row) =>
            `${row.team}-${row.opponent}-${row.odds}` ===
            `${pick.team}-${pick.opponent}-${pick.odds}`
        ) === index
    )
    .slice(0, 6)

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
            Multi-Sport Engine
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">
            {sport.icon} {sport.label}
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {selectedDefinition?.description}
          </p>
        </div>

        <span
          className={
            selectedDefinition?.productionReady
              ? 'rounded-full border border-emerald-500/30 bg-emerald-950/20 px-4 py-2 text-xs font-bold text-emerald-300'
              : 'rounded-full border border-amber-500/30 bg-amber-950/20 px-4 py-2 text-xs font-bold text-amber-300'
          }
        >
          {selectedDefinition?.productionReady
            ? 'DATA READY'
            : 'ADAPTER PENDING'}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat
          label="Pending"
          value={`${data.summary.pendingPicks}`}
        />
        <Stat
          label="Safe"
          value={`${data.summary.safePendingPicks}`}
        />
        <Stat
          label="Recommended"
          value={`${data.summary.recommendedPicks}`}
        />
        <Stat
          label="Best Bets"
          value={`${data.summary.bestBetsCount}`}
        />
        <Stat
          label="Sports With Data"
          value={`${data.summary.sportsAvailable.length}`}
        />
      </div>

      {featured.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5">
          <p className="font-bold text-amber-300">
            No current recommendations for {sport.shortLabel}
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            The shared engine is ready, but this sport either has no
            pending prediction records or still needs its data adapter.
            No recommendations are being fabricated.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {featured.map((pick) => (
            <PickCard
              key={`${pick.id}-${pick.team}-${pick.odds}`}
              pick={pick}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function Stat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">
        {value}
      </p>
    </div>
  )
}

function PickCard({ pick }: { pick: SportPick }) {
  const score = Number(
    pick.adaptive_score ?? pick.smart_score ?? 0
  )

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-white">
            {pick.team} ML
          </p>
          <p className="mt-1 text-xs text-slate-400">
            vs {pick.opponent}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {pick.sportsbook}
          </p>
        </div>

        <p className="font-black text-white">
          {formatOdds(pick.odds)}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <Mini label="Score" value={score.toFixed(2)} />
        <Mini label="EV" value={pct(pick.ev)} />
        <Mini label="Confidence" value={pct(pick.confidence)} />
      </div>
    </div>
  )
}

function Mini({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-white">{value}</p>
    </div>
  )
}
