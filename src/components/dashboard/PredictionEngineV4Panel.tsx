'use client'

import { useEffect, useState } from 'react'

type V4Pick = {
  team: string
  opponent: string
  sportsbook?: string
  formattedOdds: string
  confidence: number
  ev: number
  edge: number
  aiRating: number
  tier: string
  action: string
  sharpScore: number
  monteCarloScore: number
  reasons: string[]
}

type V4Response = {
  success: boolean
  summary: {
    totalRatings: number
    elite: number
    premium: number
    playable: number
    watch: number
    averageAiRating: number
    monteCarloProbabilityOfProfit: number
    monteCarloAverageRoi: number
    bestPick: V4Pick | null
  }
  elite: V4Pick[]
  premium: V4Pick[]
  playable: V4Pick[]
  ratings: V4Pick[]
}

function pct(value?: number) {
  return `${Number(value ?? 0).toFixed(2)}%`
}

function actionClass(value: string) {
  if (value === 'BET_NOW') return 'text-emerald-300'
  if (value === 'CONSIDER') return 'text-blue-300'
  if (value === 'SMALL_STAKE') return 'text-amber-300'
  return 'text-slate-300'
}

export default function PredictionEngineV4Panel() {
  const [bankroll, setBankroll] = useState(1000)
  const [data, setData] = useState<V4Response | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)

        const response = await fetch(
          `/api/prediction-engine/v4?bankroll=${bankroll}`,
          { cache: 'no-store' }
        )

        const json = await response.json()

        if (json.success) {
          setData(json)
        }
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [bankroll])

  if (loading) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading Prediction Engine V4...
      </section>
    )
  }

  if (!data) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        No Prediction Engine V4 data available.
      </section>
    )
  }

  const best = data.summary.bestPick

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-300">
            Prediction Engine V4
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">
            Unified AI Rating System
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Combines confidence, EV, edge, adaptive score, sharp money and Monte Carlo simulation into one AI Rating.
          </p>
        </div>

        <select
          value={bankroll}
          onChange={(event) => setBankroll(Number(event.target.value))}
          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        >
          <option value={500}>$500 bankroll</option>
          <option value={1000}>$1,000 bankroll</option>
          <option value={2500}>$2,500 bankroll</option>
          <option value={5000}>$5,000 bankroll</option>
        </select>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="Total" value={`${data.summary.totalRatings}`} />
        <Stat label="Elite" value={`${data.summary.elite}`} />
        <Stat label="Premium" value={`${data.summary.premium}`} />
        <Stat label="Playable" value={`${data.summary.playable}`} />
        <Stat label="Avg AI" value={`${data.summary.averageAiRating}`} />
        <Stat label="MC Profit" value={pct(data.summary.monteCarloProbabilityOfProfit)} />
      </div>

      {best && (
        <div className="mt-6 rounded-3xl border border-indigo-500/20 bg-indigo-950/10 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold text-indigo-300">Best V4 Pick</p>

              <h3 className="mt-2 text-3xl font-black text-white">
                {best.team} ML {best.formattedOdds}
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                vs {best.opponent} · {best.sportsbook ?? 'Sportsbook'}
              </p>

              <p className={`mt-3 text-sm font-black ${actionClass(best.action)}`}>
                {best.action.replaceAll('_', ' ')} · {best.tier}
              </p>
            </div>

            <div className="text-right">
              <p className="text-6xl font-black text-white">
                {best.aiRating}
              </p>
              <p className="text-xs text-slate-500">AI Rating</p>
            </div>
          </div>

          <ul className="mt-5 space-y-2 text-sm text-slate-300">
            {best.reasons.map((reason) => (
              <li key={reason}>✓ {reason}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Column title="Elite Picks" picks={data.elite.slice(0, 5)} />
        <Column title="Premium Picks" picks={data.premium.slice(0, 5)} />
        <Column title="Playable Picks" picks={data.playable.slice(0, 5)} />
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function Column({
  title,
  picks,
}: {
  title: string
  picks: V4Pick[]
}) {
  return (
    <div>
      <h3 className="mb-3 font-bold text-white">{title}</h3>

      <div className="space-y-3">
        {picks.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-400">
            No picks in this tier yet.
          </div>
        ) : (
          picks.map((pick) => <PickCard key={`${pick.team}-${pick.opponent}`} pick={pick} />)
        )}
      </div>
    </div>
  )
}

function PickCard({ pick }: { pick: V4Pick }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-white">
            {pick.team} ML {pick.formattedOdds}
          </p>
          <p className="mt-1 text-xs text-slate-400">vs {pick.opponent}</p>
        </div>

        <div className="text-right">
          <p className="text-2xl font-black text-indigo-300">{pick.aiRating}</p>
          <p className={`text-xs font-bold ${actionClass(pick.action)}`}>
            {pick.tier}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <Mini label="EV" value={pct(pick.ev)} />
        <Mini label="Edge" value={pct(pick.edge)} />
        <Mini label="Sharp" value={`${pick.sharpScore}`} />
      </div>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-white">{value}</p>
    </div>
  )
}