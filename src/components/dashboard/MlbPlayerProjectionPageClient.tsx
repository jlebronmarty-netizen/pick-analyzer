'use client'

import { useEffect, useMemo, useState } from 'react'

type Projection = {
  projectionId: string
  playerName: string
  team: string | null
  opponent: string | null
  homeOrAway: string | null
  projectionLabel?: string
  projectionType: string
  expectedValue: number | null
  medianEstimate: number | null
  lowRange: number | null
  highRange: number | null
  confidence: number
  dataSufficiency: number
  featureQuality: number
  lineupOrStarterStatus: string
  lineupOrStarterConfidence: number | null
  exactBlockerReasons: string[]
  probabilityDistribution: { method: string; buckets: Array<{ label: string; probability: number }> }
  explanation: string
}

type ApiData = {
  generatedAt: string
  summary: { eligibleGames: number; playersEvaluated: number; projectionsGenerated: number; pitcherProjections: number; batterProjections: number; blockedProjections: number; averageConfidence: number | null }
  projections: Projection[]
  pitcherProjections: Projection[]
  batterProjections: Projection[]
  currentSlate: { blockerSummary: Record<string, number> }
}

const filters = [
  ['all', 'All'],
  ['pitcher', 'Pitchers'],
  ['batter', 'Batters'],
] as const

function labelize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function ProjectionCard({ item }: { item: Projection }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/75 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{item.team ?? 'Team'} vs {item.opponent ?? 'Opponent'} · {labelize(item.lineupOrStarterStatus)}</p>
          <a href={`/player-projections/${encodeURIComponent(item.projectionId)}`} className="mt-2 block text-lg font-black text-white hover:text-emerald-100">{item.playerName}</a>
          <p className="mt-1 text-sm text-slate-300">{item.projectionLabel ?? labelize(item.projectionType)} <span className="font-black text-emerald-200">{item.expectedValue ?? 'N/A'}</span></p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-black uppercase">
          <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sky-100">Info Only</span>
          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-100">{Math.round(item.confidence)}% Confidence</span>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <p className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">Median <span className="block font-black text-white">{item.medianEstimate ?? 'N/A'}</span></p>
        <p className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">Range <span className="block font-black text-white">{item.lowRange ?? 'N/A'}-{item.highRange ?? 'N/A'}</span></p>
        <p className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">Feature Quality <span className="block font-black text-white">{Math.round(item.featureQuality)}</span></p>
        <p className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">Data Sufficiency <span className="block font-black text-white">{Math.round(item.dataSufficiency)}</span></p>
      </div>
      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{item.probabilityDistribution.method}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {item.probabilityDistribution.buckets.map((bucket) => (
            <p key={bucket.label} className="rounded-lg bg-slate-900 p-2 text-sm text-slate-300">{bucket.label}<span className="block font-black text-white">{Math.round(bucket.probability * 100)}%</span></p>
          ))}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{item.explanation}</p>
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-amber-200">{item.exactBlockerReasons.slice(0, 4).map(labelize).join(' | ')}</p>
    </article>
  )
}

export default function MlbPlayerProjectionPageClient() {
  const [data, setData] = useState<ApiData | null>(null)
  const [active, setActive] = useState<(typeof filters)[number][0]>('all')
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const initialSearch = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('search') : null
    if (initialSearch) setQuery(initialSearch)
    fetch('/api/mlb/player-projections?limit=200', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Player projections failed (${response.status})`)
        return response.json()
      })
      .then((json) => alive && setData(json))
      .catch((loadError) => alive && setError(loadError instanceof Error ? loadError.message : 'Unable to load player projections'))
    return () => {
      alive = false
    }
  }, [])

  const rows = useMemo(() => {
    const source = active === 'pitcher' ? data?.pitcherProjections ?? [] : active === 'batter' ? data?.batterProjections ?? [] : data?.projections ?? []
    const needle = query.trim().toLowerCase()
    return needle ? source.filter((item) => `${item.playerName} ${item.team} ${item.opponent} ${item.projectionType}`.toLowerCase().includes(needle)) : source
  }, [active, data, query])

  if (error) return (
    <main className="min-h-screen bg-slate-950 p-6 text-red-100">
      <a href="/dashboard" className="inline-flex rounded-lg border border-red-400/30 px-4 py-2 text-sm font-bold text-red-100 outline-none focus-visible:ring-2 focus-visible:ring-red-200">Back to Dashboard</a>
      <p className="mt-4">{error}</p>
    </main>
  )
  if (!data) return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-300">
      <a href="/dashboard" className="inline-flex rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">Back to Dashboard</a>
      <p className="mt-4">Loading MLB player projections...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="border-b border-slate-800 pb-6">
          <nav className="mb-4 flex flex-wrap gap-2 text-sm font-bold text-slate-400" aria-label="Breadcrumb">
            <a href="/dashboard" className="text-emerald-200 hover:text-emerald-100">Dashboard</a>
            <span>/</span>
            <span className="text-slate-300">Players</span>
          </nav>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Informational Projection Layer</p>
          <h1 className="mt-2 text-3xl font-black md:text-5xl">MLB Player Projections</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Expected player outcomes, ranges and coarse probability distributions. No sportsbook lines, EV, Best Value, Kelly or Official Picks.</p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-6">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-500">Games</p><p className="text-2xl font-black">{data.summary.eligibleGames}</p></div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-500">Players</p><p className="text-2xl font-black">{data.summary.playersEvaluated}</p></div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-500">Projections</p><p className="text-2xl font-black">{data.summary.projectionsGenerated}</p></div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-500">Pitchers</p><p className="text-2xl font-black">{data.summary.pitcherProjections}</p></div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-500">Batters</p><p className="text-2xl font-black">{data.summary.batterProjections}</p></div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-500">Blocked</p><p className="text-2xl font-black">{data.summary.blockedProjections}</p></div>
        </div>
        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {filters.map(([id, label]) => (
              <button key={id} onClick={() => setActive(id)} className={`rounded-lg border px-4 py-2 text-sm font-black ${active === id ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100' : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>{label}</button>
            ))}
          </div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter player, team or projection" className="w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-bold text-white outline-none focus:border-emerald-400 lg:w-96" />
        </div>
        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          {rows.length ? rows.map((item) => <ProjectionCard key={item.projectionId} item={item} />) : (
            <div className="rounded-lg border border-slate-800 bg-slate-900/75 p-8 text-sm leading-6 text-slate-300">
              <p className="text-lg font-black text-white">No player projections match these filters.</p>
              <p className="mt-2">Current blockers include {Object.entries(data.currentSlate.blockerSummary).slice(0, 4).map(([key, value]) => `${key}: ${value}`).join(', ') || 'no current eligible players'}.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
