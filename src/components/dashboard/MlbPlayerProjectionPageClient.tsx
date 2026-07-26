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

type PitcherOutsProjection = {
  projectionId: string
  pitcherId: string
  pitcherName: string
  team: string | null
  opponent: string | null
  homeAway: string | null
  starterStatus: string
  projectedOuts: number | null
  projectedInnings: number | null
  projectedPitchCount: number | null
  projectedStrikeouts: number | null
  confidence: number
  confidenceLevel: string
  qualityScore: number
  dataSufficiency: string
  recommendationStatus: 'MODEL_PROJECTION_ONLY'
  overProbabilities: Record<'14.5' | '15.5' | '16.5' | '17.5' | '18.5', number | null>
  underProbabilities: Record<'14.5' | '15.5' | '16.5' | '17.5' | '18.5', number | null>
  mainDrivers: string[]
  mainRisks: string[]
  blockers: string[]
  warnings: string[]
  generatedAt: string
}

type PropLine = {
  sportsbook: string
  line: number
  americanOdds: number | null
  impliedProbability: number | null
}

type PropEdge = {
  modelProbability: number | null
  impliedProbability: number | null
  edgePoints: number | null
  fairAmericanOdds: number | null
}

type PropComparison = {
  comparisonId: string
  projectionId: string
  sportsbook: string | null
  line: number | null
  overLine: PropLine | null
  underLine: PropLine | null
  overEdge: PropEdge | null
  underEdge: PropEdge | null
  bestStatus: string
}

type PropComparisonApiData = {
  generatedAt: string
  summary: { marketRowsEvaluated: number; comparisonsGenerated: number; sportsbooks: number; noPropAvailable: number }
  coverage: { currentStoredRows: number; sportsbooks: string[]; historicalDepth: string }
  comparisons: PropComparison[]
  warnings: string[]
}

type PitcherOutsApiData = {
  generatedAt: string
  summary: { rowsGenerated: number; rowsEligibleForNumericProjection: number; rowsBlocked: number }
  projections: PitcherOutsProjection[]
  warnings: string[]
}

const filters = [
  ['all', 'All'],
  ['pitcher', 'Pitchers'],
  ['batter', 'Batters'],
  ['pitcherOuts', 'Pitcher Outs'],
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

function percent(value: number | null) {
  return value === null ? 'N/A' : `${Math.round(value * 100)}%`
}

function odds(value: number | null) {
  return value === null ? 'N/A' : value > 0 ? `+${value}` : String(value)
}

function probability(value: number | null) {
  return value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`
}

function PropComparisonPanel({ comparisons }: { comparisons: PropComparison[] }) {
  if (!comparisons.length || comparisons.every((comparison) => comparison.bestStatus === 'NO_PROP_AVAILABLE')) {
    return (
      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Sportsbook Comparison</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">No current recorded-outs sportsbook line is stored for this pitcher. Projection Only. No recommendation.</p>
      </div>
    )
  }
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70">
      <div className="border-b border-slate-800 px-3 py-2">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Sportsbook Comparison</p>
        <p className="mt-1 text-xs font-bold uppercase text-amber-100">Projection Only · No recommendation</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900 text-slate-500">
            <tr>
              {['Sportsbook', 'Line', 'Price', 'Implied', 'Model', 'Difference', 'Fair Odds', 'Status'].map((header) => (
                <th key={header} className="px-3 py-2 font-black uppercase">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparisons.map((comparison) => {
              const line = comparison.overLine ?? comparison.underLine
              const edge = comparison.overEdge ?? comparison.underEdge
              return (
                <tr key={comparison.comparisonId} className="border-t border-slate-800">
                  <td className="px-3 py-2">{comparison.sportsbook ?? 'N/A'}</td>
                  <td className="px-3 py-2">{comparison.line ?? 'N/A'}</td>
                  <td className="px-3 py-2">{odds(line?.americanOdds ?? null)}</td>
                  <td className="px-3 py-2">{probability(edge?.impliedProbability ?? null)}</td>
                  <td className="px-3 py-2">{probability(edge?.modelProbability ?? null)}</td>
                  <td className="px-3 py-2">{edge?.edgePoints === null || edge?.edgePoints === undefined ? 'N/A' : `${edge.edgePoints.toFixed(1)} pts`}</td>
                  <td className="px-3 py-2">{odds(edge?.fairAmericanOdds ?? null)}</td>
                  <td className="px-3 py-2">{labelize(comparison.bestStatus)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PitcherOutsCard({ item, comparisons }: { item: PitcherOutsProjection; comparisons: PropComparison[] }) {
  const thresholds = ['14.5', '15.5', '16.5', '17.5', '18.5'] as const
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/75 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-slate-500">{item.team ?? 'Team'} vs {item.opponent ?? 'Opponent'} · {labelize(item.starterStatus)}</p>
          <p className="mt-2 text-lg font-black text-white">{item.pitcherName}</p>
          <p className="mt-1 text-sm text-slate-300">Projected outs <span className="font-black text-emerald-200">{item.projectedOuts ?? 'N/A'}</span></p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-black uppercase">
          <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sky-100">Projection Only</span>
          <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-amber-100">Not a betting recommendation</span>
          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-100">Market comparison</span>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <p className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">Innings <span className="block font-black text-white">{item.projectedInnings ?? 'N/A'}</span></p>
        <p className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">Pitch Count <span className="block font-black text-white">{item.projectedPitchCount ?? 'N/A'}</span></p>
        <p className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">Strikeouts <span className="block font-black text-white">{item.projectedStrikeouts ?? 'N/A'}</span></p>
        <p className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">Confidence <span className="block font-black text-white">{item.confidenceLevel} · {Math.round(item.confidence)}</span></p>
      </div>
      <details className="mt-4 rounded-lg border border-slate-800 bg-slate-950/70 p-3" open>
        <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-slate-400">Outs Probability</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          {thresholds.map((line) => (
            <p key={line} className="rounded-lg bg-slate-900 p-2 text-sm text-slate-300">O/U {line}<span className="block font-black text-white">Over {percent(item.overProbabilities[line])}</span><span className="block text-slate-400">Under {percent(item.underProbabilities[line])}</span></p>
          ))}
        </div>
      </details>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs font-black uppercase text-emerald-300">Main Drivers</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{item.mainDrivers.length ? item.mainDrivers.join(' | ') : 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs font-black uppercase text-amber-200">Main Risks</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{item.mainRisks.length ? item.mainRisks.join(' | ') : item.blockers.slice(0, 3).map(labelize).join(' | ') || 'N/A'}</p>
        </div>
      </div>
      <PropComparisonPanel comparisons={comparisons} />
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Generated {item.generatedAt} · Quality {Math.round(item.qualityScore)} · {labelize(item.dataSufficiency)}</p>
    </article>
  )
}

export default function MlbPlayerProjectionPageClient() {
  const [data, setData] = useState<ApiData | null>(null)
  const [pitcherOutsData, setPitcherOutsData] = useState<PitcherOutsApiData | null>(null)
  const [propComparisonData, setPropComparisonData] = useState<PropComparisonApiData | null>(null)
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
    fetch('/api/mlb/pitchers/projections?limit=200', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Pitcher outs projections failed (${response.status})`)
        return response.json()
      })
      .then((json) => alive && setPitcherOutsData(json))
      .catch(() => alive && setPitcherOutsData({ generatedAt: new Date().toISOString(), summary: { rowsGenerated: 0, rowsEligibleForNumericProjection: 0, rowsBlocked: 0 }, projections: [], warnings: ['Pitcher outs projections unavailable.'] }))
    fetch('/api/mlb/player-props?limit=500', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Player prop comparisons failed (${response.status})`)
        return response.json()
      })
      .then((json) => alive && setPropComparisonData(json))
      .catch(() => alive && setPropComparisonData({
        generatedAt: new Date().toISOString(),
        summary: { marketRowsEvaluated: 0, comparisonsGenerated: 0, sportsbooks: 0, noPropAvailable: 0 },
        coverage: { currentStoredRows: 0, sportsbooks: [], historicalDepth: 'UNAVAILABLE' },
        comparisons: [],
        warnings: ['Player prop comparison unavailable.'],
      }))
    return () => {
      alive = false
    }
  }, [])

  const rows = useMemo(() => {
    const source = active === 'pitcher' ? data?.pitcherProjections ?? [] : active === 'batter' ? data?.batterProjections ?? [] : active === 'pitcherOuts' ? [] : data?.projections ?? []
    const needle = query.trim().toLowerCase()
    return needle ? source.filter((item) => `${item.playerName} ${item.team} ${item.opponent} ${item.projectionType}`.toLowerCase().includes(needle)) : source
  }, [active, data, query])

  const pitcherOutRows = useMemo(() => {
    const source = pitcherOutsData?.projections ?? []
    const needle = query.trim().toLowerCase()
    return needle ? source.filter((item) => `${item.pitcherName} ${item.team} ${item.opponent} ${item.starterStatus}`.toLowerCase().includes(needle)) : source
  }, [pitcherOutsData, query])

  const comparisonsByProjection = useMemo(() => {
    const map = new Map<string, PropComparison[]>()
    for (const comparison of propComparisonData?.comparisons ?? []) {
      map.set(comparison.projectionId, [...(map.get(comparison.projectionId) ?? []), comparison])
    }
    return map
  }, [propComparisonData])

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
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Expected player outcomes, ranges and coarse probability distributions. Player prop comparisons are projection-only, with no sportsbook recommendations, staking, Kelly or portfolio selections.</p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-6">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-500">Games</p><p className="text-2xl font-black">{data.summary.eligibleGames}</p></div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-500">Players</p><p className="text-2xl font-black">{data.summary.playersEvaluated}</p></div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-500">Projections</p><p className="text-2xl font-black">{data.summary.projectionsGenerated}</p></div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-500">Pitchers</p><p className="text-2xl font-black">{data.summary.pitcherProjections}</p></div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-500">Batters</p><p className="text-2xl font-black">{data.summary.batterProjections}</p></div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-500">Pitcher Outs</p><p className="text-2xl font-black">{pitcherOutsData?.summary.rowsEligibleForNumericProjection ?? 0}</p></div>
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
          {active === 'pitcherOuts' && pitcherOutRows.length ? pitcherOutRows.map((item) => <PitcherOutsCard key={item.projectionId} item={item} comparisons={comparisonsByProjection.get(item.projectionId) ?? []} />) : active === 'pitcherOuts' ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/75 p-8 text-sm leading-6 text-slate-300">
              <p className="text-lg font-black text-white">No grounded MLB pitcher outs projections are available.</p>
              <p className="mt-2">{pitcherOutsData?.warnings?.join(' ') || 'Projection unavailable until mapped probable or confirmed starters have enough recorded-outs history.'}</p>
            </div>
          ) : rows.length ? rows.map((item) => <ProjectionCard key={item.projectionId} item={item} />) : (
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
