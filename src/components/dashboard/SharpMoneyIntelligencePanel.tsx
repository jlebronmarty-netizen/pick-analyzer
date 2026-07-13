'use client'

import { useEffect, useState } from 'react'

type SharpSignal = {
  team: string
  opponent: string
  sportsbook?: string
  odds: number
  formattedOdds: string
  confidence: number
  edge: number
  ev: number
  sharpScore: number
  signal: string
  risk: string
  publicPercent: number
  consensusPercent: number
  expectedClosingLineFormatted: string
  valueCents: number
  moves: {
    steamMove: boolean
    reverseLineMovement: boolean
    publicFade: boolean
    valueWindow: boolean
    lateMoneyCandidate: boolean
    lineFreeze: boolean
  }
  reasons: string[]
}

type SharpResponse = {
  success: boolean
  summary: {
    totalSignals: number
    strongSignals: number
    watchList: number
    publicFades: number
    valueWindows: number
    averageSharpScore: number
    bestSignal: SharpSignal | null
  }
  strongSignals: SharpSignal[]
  watchList: SharpSignal[]
  publicFades: SharpSignal[]
  valueWindows: SharpSignal[]
  signals: SharpSignal[]
}

function pct(value?: number) {
  return `${Number(value ?? 0).toFixed(2)}%`
}

function riskClass(value: string) {
  if (value === 'LOW') return 'text-emerald-300'
  if (value === 'MEDIUM') return 'text-amber-300'
  return 'text-red-300'
}

function signalLabel(value: string) {
  return value.replaceAll('_', ' ')
}

export default function SharpMoneyIntelligencePanel() {
  const [data, setData] = useState<SharpResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)

        const response = await fetch('/api/sharp-money', {
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
  }, [])

  if (loading) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading Sharp Money Intelligence...
      </section>
    )
  }

  if (!data) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        No sharp money data available.
      </section>
    )
  }

  const best = data.summary.bestSignal

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-300">
          Sharp Money Intelligence
        </p>

        <h2 className="mt-2 text-3xl font-black text-white">
          Market Movement Scanner
        </h2>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          Detects steam profiles, reverse line movement, public fade spots,
          value windows, line freeze profiles and late money candidates.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="Signals" value={`${data.summary.totalSignals}`} />
        <Stat label="Strong" value={`${data.summary.strongSignals}`} />
        <Stat label="Watch" value={`${data.summary.watchList}`} />
        <Stat label="Public Fades" value={`${data.summary.publicFades}`} />
        <Stat label="Value Windows" value={`${data.summary.valueWindows}`} />
        <Stat label="Avg Score" value={`${data.summary.averageSharpScore}`} />
      </div>

      {best && (
        <div className="mt-6 rounded-3xl border border-fuchsia-500/20 bg-fuchsia-950/10 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold text-fuchsia-300">
                Best Sharp Signal
              </p>

              <h3 className="mt-2 text-3xl font-black text-white">
                {best.team} ML {best.formattedOdds}
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                vs {best.opponent} · {best.sportsbook ?? 'Sportsbook'}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Tag label={signalLabel(best.signal)} />
                <Tag label={`Public ${pct(best.publicPercent)}`} />
                <Tag label={`Consensus ${pct(best.consensusPercent)}`} />
                <Tag label={`Close ${best.expectedClosingLineFormatted}`} />
                <Tag label={`Value ${best.valueCents}¢`} />
              </div>
            </div>

            <div className="text-right">
              <p className="text-5xl font-black text-white">
                {best.sharpScore}
              </p>
              <p className="text-xs text-slate-500">Sharp Score</p>
              <p className={`mt-2 text-sm font-bold ${riskClass(best.risk)}`}>
                {best.risk} Risk
              </p>
            </div>
          </div>

          <ul className="mt-5 space-y-2 text-sm text-slate-300">
            {best.reasons.map((reason) => (
              <li key={reason}>✓ {reason}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SignalColumn title="Strong Sharp Signals" signals={data.strongSignals.slice(0, 5)} />
        <SignalColumn title="Market Watch List" signals={data.watchList.slice(0, 5)} />
        <SignalColumn title="Public Fade Spots" signals={data.publicFades.slice(0, 5)} />
        <SignalColumn title="Value Windows" signals={data.valueWindows.slice(0, 5)} />
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

function Tag({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-fuchsia-500/15 px-3 py-1 text-xs font-semibold text-fuchsia-300">
      {label}
    </span>
  )
}

function SignalColumn({
  title,
  signals,
}: {
  title: string
  signals: SharpSignal[]
}) {
  return (
    <div>
      <h3 className="mb-3 font-bold text-white">{title}</h3>

      <div className="space-y-3">
        {signals.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-400">
            No signals in this category yet.
          </div>
        ) : (
          signals.map((signal) => (
            <SignalCard
              key={`${signal.team}-${signal.opponent}-${signal.odds}`}
              signal={signal}
            />
          ))
        )}
      </div>
    </div>
  )
}

function SignalCard({ signal }: { signal: SharpSignal }) {
  const tags = [
    signal.moves.steamMove ? 'Steam' : null,
    signal.moves.reverseLineMovement ? 'RLM' : null,
    signal.moves.publicFade ? 'Public Fade' : null,
    signal.moves.valueWindow ? 'Value Window' : null,
    signal.moves.lateMoneyCandidate ? 'Late Money' : null,
    signal.moves.lineFreeze ? 'Line Freeze' : null,
  ].filter(Boolean)

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-white">
            {signal.team} ML {signal.formattedOdds}
          </p>
          <p className="mt-1 text-xs text-slate-400">vs {signal.opponent}</p>
          <p className="mt-1 text-xs text-slate-500">
            {signal.sportsbook ?? 'Sportsbook'}
          </p>
        </div>

        <div className="text-right">
          <p className="text-2xl font-black text-fuchsia-300">
            {signal.sharpScore}
          </p>
          <p className={`text-xs font-bold ${riskClass(signal.risk)}`}>
            {signal.risk}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <Mini label="EV" value={pct(signal.ev)} />
        <Mini label="Edge" value={pct(signal.edge)} />
        <Mini label="Value" value={`${signal.valueCents}¢`} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Tag key={tag} label={String(tag)} />
        ))}
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