'use client'

import { useEffect, useState } from 'react'

type TemporalHealth = {
  success: boolean
  generatedAt: string
  totalGames: number
  correctlyNormalized: number
  legacyRepairCount: number
  prematureLiveCount: number
  staleStatusCount: number
  lifecycleDistribution: Record<string, number>
  eligibilityDistribution: Record<string, number>
  adaptiveExecutionMode: { status: string; explanation: string }
  projectionTemporalIntegrity: { status: string; projectionsChecked: number; invalidProjectionCount: number }
  games: Array<{
    eventId: string
    matchup: string
    displayTime: string | null
    normalizedUtc: string | null
    lifecycle: string
    eligibility: string
    statusSource: string
    statusReason: string
    legacyRepairApplied: boolean
  }>
}

function Badge({ value }: { value: string }) {
  const tone = value.includes('PASS') || value.includes('PREGAME') || value.includes('READY')
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
    : value.includes('UNCONFIRMED') || value.includes('PLANNED')
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
      : 'border-slate-700 bg-slate-950 text-slate-200'
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${tone}`}>{value}</span>
}

export default function MlbTemporalHealthPanel() {
  const [data, setData] = useState<TemporalHealth | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/mlb/temporal-health', { cache: 'no-store' })
      .then((response) => response.json())
      .then((json) => {
        if (!active) return
        if (!json.success) throw new Error(json.error?.message ?? 'Temporal health unavailable.')
        setData(json)
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Temporal health unavailable.')
      })
    return () => {
      active = false
    }
  }, [])

  if (error) return <section className="rounded-lg border border-red-500/20 bg-red-950/20 p-5 text-sm text-red-100">{error}</section>
  if (!data) return <section className="h-44 animate-pulse rounded-lg bg-slate-900" />

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">MLB Temporal Health</p>
          <h3 className="mt-2 text-2xl font-black text-white">{data.totalGames} games checked</h3>
        </div>
        <Badge value={data.prematureLiveCount === 0 ? 'NO PREMATURE LIVE' : `${data.prematureLiveCount} PREMATURE LIVE`} />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
          <p className="text-xs font-black text-slate-500">Normalized</p>
          <p className="mt-1 text-xl font-black text-white">{data.correctlyNormalized}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
          <p className="text-xs font-black text-slate-500">Legacy Repairs</p>
          <p className="mt-1 text-xl font-black text-white">{data.legacyRepairCount}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
          <p className="text-xs font-black text-slate-500">Stale Status</p>
          <p className="mt-1 text-xl font-black text-white">{data.staleStatusCount}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
          <p className="text-xs font-black text-slate-500">Projection Integrity</p>
          <p className="mt-1 text-xl font-black text-white">{data.projectionTemporalIntegrity.status}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(data.lifecycleDistribution).map(([key, value]) => <Badge key={key} value={`${key}: ${value}`} />)}
        {Object.entries(data.eligibilityDistribution).map(([key, value]) => <Badge key={key} value={`${key}: ${value}`} />)}
        <Badge value={data.adaptiveExecutionMode.status} />
      </div>
      <div className="mt-5 grid gap-2">
        {data.games.slice(0, 6).map((game) => (
          <div key={game.eventId} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black text-white">{game.matchup}</p>
              <div className="flex flex-wrap gap-2">
                <Badge value={game.lifecycle} />
                <Badge value={game.eligibility} />
              </div>
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-400">{game.displayTime ?? game.normalizedUtc ?? 'Time pending'}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
