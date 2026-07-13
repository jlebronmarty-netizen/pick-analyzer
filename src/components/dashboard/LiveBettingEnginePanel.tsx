'use client'

import { useEffect, useState } from 'react'

type LiveOpportunity = {
  team: string
  opponent: string
  sportsbook?: string
  formattedOdds: string
  confidence: number
  edge: number
  ev: number
  liveWinProbability: number
  momentumScore: number
  liveEv: number
  recommendation: string
  risk: string
  liveKellyStake: number
  cashOutAdvice: string
  hedgeAdvice: string
}

type LiveResponse = {
  success: boolean
  bankroll: number
  summary: {
    opportunities: number
    betNow: number
    watch: number
    avoid: number
    averageLiveEv: number
    bestLiveBet: LiveOpportunity | null
  }
  betNow: LiveOpportunity[]
  watchList: LiveOpportunity[]
  opportunities: LiveOpportunity[]
}

function pct(value?: number) {
  return `${Number(value ?? 0).toFixed(2)}%`
}

function money(value?: number) {
  return `$${Number(value ?? 0).toFixed(2)}`
}

function recClass(value: string) {
  if (value === 'BET_NOW') return 'text-emerald-300'
  if (value === 'WATCH_CLOSELY') return 'text-amber-300'
  if (value === 'SMALL_EDGE') return 'text-blue-300'
  return 'text-red-300'
}

function riskClass(value: string) {
  if (value === 'LOW') return 'text-emerald-300'
  if (value === 'MEDIUM') return 'text-amber-300'
  return 'text-red-300'
}

function label(value: string) {
  return value.replaceAll('_', ' ')
}

export default function LiveBettingEnginePanel() {
  const [bankroll, setBankroll] = useState(1000)
  const [data, setData] = useState<LiveResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)

        const response = await fetch(`/api/live-betting?bankroll=${bankroll}`, {
          cache: 'no-store',
        })

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
        Loading Live Betting Engine...
      </section>
    )
  }

  if (!data) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        No live betting data available.
      </section>
    )
  }

  const best = data.summary.bestLiveBet

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-300">
            Live Betting AI
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">
            Live Value Engine
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Estimates live win probability, momentum, live EV, Kelly stake,
            cash-out advice and hedge signals from current model strength.
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

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Opportunities" value={`${data.summary.opportunities}`} />
        <Stat label="Bet Now" value={`${data.summary.betNow}`} />
        <Stat label="Watch" value={`${data.summary.watch}`} />
        <Stat label="Avoid" value={`${data.summary.avoid}`} />
        <Stat label="Avg Live EV" value={pct(data.summary.averageLiveEv)} />
      </div>

      {best && (
        <div className="mt-6 rounded-3xl border border-orange-500/20 bg-orange-950/10 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold text-orange-300">
                Best Live Opportunity
              </p>

              <h3 className="mt-2 text-3xl font-black text-white">
                {best.team} ML {best.formattedOdds}
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                vs {best.opponent} · {best.sportsbook ?? 'Sportsbook'}
              </p>
            </div>

            <div className="text-right">
              <p className={`text-2xl font-black ${recClass(best.recommendation)}`}>
                {label(best.recommendation)}
              </p>
              <p className={`mt-1 text-sm font-bold ${riskClass(best.risk)}`}>
                {best.risk} Risk
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Mini label="Live Win %" value={pct(best.liveWinProbability)} />
            <Mini label="Momentum" value={pct(best.momentumScore)} />
            <Mini label="Live EV" value={pct(best.liveEv)} />
            <Mini label="Kelly Stake" value={money(best.liveKellyStake)} />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <Advice title="Cash Out AI" value={best.cashOutAdvice} />
            <Advice title="Hedge AI" value={best.hedgeAdvice} />
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Column title="Bet Now" items={data.betNow.slice(0, 5)} />
        <Column title="Watch List" items={data.watchList.slice(0, 5)} />
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

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-white">{value}</p>
    </div>
  )
}

function Advice({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{value}</p>
    </div>
  )
}

function Column({
  title,
  items,
}: {
  title: string
  items: LiveOpportunity[]
}) {
  return (
    <div>
      <h3 className="mb-3 font-bold text-white">{title}</h3>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-400">
            No items in this category yet.
          </div>
        ) : (
          items.map((item) => <LiveCard key={`${item.team}-${item.opponent}`} item={item} />)
        )}
      </div>
    </div>
  )
}

function LiveCard({ item }: { item: LiveOpportunity }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-white">
            {item.team} ML {item.formattedOdds}
          </p>
          <p className="mt-1 text-xs text-slate-400">vs {item.opponent}</p>
        </div>

        <div className="text-right">
          <p className={`text-sm font-black ${recClass(item.recommendation)}`}>
            {label(item.recommendation)}
          </p>
          <p className={`text-xs font-bold ${riskClass(item.risk)}`}>
            {item.risk}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <Mini label="Live EV" value={pct(item.liveEv)} />
        <Mini label="Win %" value={pct(item.liveWinProbability)} />
        <Mini label="Stake" value={money(item.liveKellyStake)} />
      </div>
    </div>
  )
}