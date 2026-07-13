'use client'

import { useEffect, useState } from 'react'

type SteamSignal = {
  id: string
  homeTeam: string | null
  awayTeam: string | null
  market: string
  outcome: string
  signal: 'STEAM_MOVE' | 'MARKET_DRIFT' | 'INSUFFICIENT_HISTORY'
  direction: 'toward_outcome' | 'away_from_outcome' | 'mixed'
  confidence: number
  maxMoveCents: number
  averageMoveCents: number
  alignedBooks: number
  totalBooks: number
  windowMinutes: number
  warnings: string[]
}

type SteamResponse = {
  success: boolean
  status: string
  providerUsage: {
    externalProviderCallsMade: number
  }
  summary: {
    oddsSnapshotsLoaded: number
    sportsbooksTracked: number
    groupsAnalyzed: number
    steamMoves: number
    marketDrift: number
    insufficientHistory: number
    strongestSignal: SteamSignal | null
  }
  warnings: string[]
  signals: SteamSignal[]
  error?: string
}

function signalClass(value: string) {
  if (value === 'STEAM_MOVE' || value === 'signals') return 'text-emerald-300'
  if (value === 'MARKET_DRIFT' || value === 'insufficient_history') {
    return 'text-amber-300'
  }
  return 'text-slate-400'
}

export default function NbaSteamMovePanel() {
  const [data, setData] = useState<SteamResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/nba/markets/steam?limit=10', {
        cache: 'no-store',
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Unable to load NBA steam moves')
      }

      setData(json)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load NBA steam moves'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading && !data) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading NBA steam move detection...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-300">
            NBA Steam Move Detection
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Stored Odds Movement
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Scans persisted odds snapshots for aligned multi-book movement without calling providers.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className={`text-sm font-black uppercase ${signalClass(data?.status ?? 'empty')}`}>
            {data?.status ?? 'empty'}
          </p>
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-orange-500/30 bg-orange-950/30 px-4 py-2 text-sm font-bold text-orange-100 hover:bg-orange-900/40"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Stat label="Snapshots" value={data?.summary.oddsSnapshotsLoaded ?? 0} />
        <Stat label="Books" value={data?.summary.sportsbooksTracked ?? 0} />
        <Stat label="Groups" value={data?.summary.groupsAnalyzed ?? 0} />
        <Stat label="Steam" value={data?.summary.steamMoves ?? 0} />
        <Stat label="Provider Calls" value={data?.providerUsage.externalProviderCallsMade ?? 0} />
      </div>

      {data?.warnings.length ? (
        <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
            Detection Warnings
          </p>
          <div className="mt-3 grid gap-2">
            {data.warnings.map((warning) => (
              <p key={warning} className="text-sm text-amber-100">
                {warning}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3">
        {data?.signals.length ? (
          data.signals.map((signal) => (
            <div
              key={signal.id}
              className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-black text-white">
                    {signal.homeTeam ?? 'NBA'} vs {signal.awayTeam ?? 'Opponent'}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                    {signal.market} · {signal.outcome} · {signal.direction.replaceAll('_', ' ')}
                  </p>
                </div>
                <div className="text-left lg:text-right">
                  <p className={`text-sm font-black ${signalClass(signal.signal)}`}>
                    {signal.signal.replaceAll('_', ' ')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {signal.alignedBooks}/{signal.totalBooks} books aligned
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <Mini label="Confidence" value={signal.confidence} />
                <Mini label="Max Move" value={`${signal.maxMoveCents}`} />
                <Mini label="Avg Move" value={`${signal.averageMoveCents}`} />
                <Mini label="Window" value={`${signal.windowMinutes}m`} />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5 text-sm text-slate-400">
            No stored NBA odds history is available for steam detection yet.
          </div>
        )}
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  )
}
