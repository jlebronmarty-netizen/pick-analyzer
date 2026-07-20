'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'

type Projection = {
  id: string
  entityName: string
  matchup?: string
  scheduledTime?: string | null
  projectionLabel?: string
  projectionKey: string
  projectedValue: number | null
  unit?: string
  predictionInterval: { low: number | null; high: number | null }
  confidence: number
  readiness: string
  starterStatus?: string | null
  participationStatus?: string | null
  rankScore?: number
  rankTier?: string
  rankReasons?: string[]
  rankWarnings?: string[]
  validationWarnings?: string[]
  explanation: string
  projectionFamily: string
}

type ApiData = {
  success: boolean
  generatedAt: string
  summary: { games: number; projections: number; valid: number; userVisible: number; pitcher: number; team: number; batter: number; game: number }
  userBoard: { topProjections: Projection[]; pitchers: Projection[]; teams: Projection[]; batters: Projection[]; games: Projection[] }
  projectionHealth: Record<string, any> & { blockerExplanations?: string[] }
  warnings: string[]
}

const tabs = [
  ['topProjections', 'Top'],
  ['pitchers', 'Pitchers'],
  ['teams', 'Teams'],
  ['batters', 'Batters'],
  ['games', 'Games'],
] as const

function labelize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function timeText(value?: string | null) {
  if (!value) return 'Time pending'
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return 'Time pending'
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Puerto_Rico', timeZoneName: 'short' }).format(parsed)
}

function valueText(item: Projection) {
  if (item.projectedValue === null) return 'N/A'
  if (item.unit === 'PROBABILITY' || item.projectionKey.includes('probability')) return `${Math.round(item.projectedValue)}%`
  return String(item.projectedValue)
}

function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'green' | 'amber' | 'red' | 'slate' | 'blue' }) {
  const styles = {
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    red: 'border-red-500/30 bg-red-500/10 text-red-100',
    blue: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
    slate: 'border-slate-700 bg-slate-900/80 text-slate-100',
  }
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase ${styles[tone]}`}>{children}</span>
}

function tierTone(tier?: string): 'green' | 'amber' | 'red' | 'slate' | 'blue' {
  if (tier === 'ELITE' || tier === 'STRONG') return 'green'
  if (tier === 'MODERATE') return 'blue'
  if (tier === 'LIMITED') return 'amber'
  if (tier === 'BLOCKED') return 'red'
  return 'slate'
}

function ProjectionCard({ item }: { item: Projection }) {
  const range = item.predictionInterval?.low === null || item.predictionInterval?.high === null ? 'Range unavailable' : `${item.predictionInterval.low}-${item.predictionInterval.high}`
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/75 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{timeText(item.scheduledTime)} · {item.matchup ?? 'Matchup pending'}</p>
          <h3 className="mt-2 text-lg font-black text-white">{item.entityName}</h3>
          <p className="mt-1 text-sm text-slate-300">{item.projectionLabel ?? labelize(item.projectionKey)}: <span className="font-black text-emerald-200">{valueText(item)}</span></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={tierTone(item.rankTier)}>{item.rankTier ?? 'Limited'} {item.rankScore ?? 0}</Badge>
          <Badge tone={item.readiness === 'READY' ? 'green' : item.readiness === 'LIMITED' ? 'amber' : 'red'}>{item.readiness}</Badge>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <p className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">Range <span className="block font-black text-white">{range}</span></p>
        <p className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">Confidence <span className="block font-black text-white">{Math.round(item.confidence)}%</span></p>
        <p className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">Status <span className="block font-black text-white">{labelize(item.starterStatus ?? item.participationStatus ?? 'Shadow')}</span></p>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">{item.explanation}</p>
      {(item.validationWarnings?.length || item.rankWarnings?.length) ? (
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-amber-200">{[...(item.validationWarnings ?? []), ...(item.rankWarnings ?? [])].slice(0, 2).map(labelize).join(' | ')}</p>
      ) : null}
    </article>
  )
}

export default function MlbProjectionBoardClient() {
  const [data, setData] = useState<ApiData | null>(null)
  const [active, setActive] = useState<(typeof tabs)[number][0]>('topProjections')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/mlb/projections?includeValidation=true', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Projection board failed (${response.status})`)
        return response.json()
      })
      .then((json) => alive && setData(json))
      .catch((loadError) => alive && setError(loadError instanceof Error ? loadError.message : 'Unable to load projections.'))
    return () => {
      alive = false
    }
  }, [])

  const rows = useMemo(() => {
    const source = data?.userBoard?.[active] ?? []
    const needle = search.trim().toLowerCase()
    return needle ? source.filter((item) => `${item.entityName} ${item.matchup} ${item.projectionKey}`.toLowerCase().includes(needle)) : source
  }, [active, data, search])

  if (error) return <main className="min-h-screen bg-slate-950 p-6 text-red-100">{error}</main>
  if (!data) return <main className="min-h-screen bg-slate-950 p-6 text-slate-300">Loading projection board...</main>

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Shadow Projection Board</p>
            <h1 className="mt-2 text-3xl font-black md:text-5xl">MLB Projections</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Sportsbook-independent statistical projections sorted by evidence strength. No lines, Over/Unders, EV, Kelly or betting recommendations.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone="blue">{data.summary.games} games</Badge>
            <Badge tone="green">{data.summary.userVisible} visible</Badge>
            <Badge tone="slate">{data.summary.valid} valid</Badge>
            <Badge tone="amber">{String(data.projectionHealth?.projectionHistoryAvailability ?? 'History pending')}</Badge>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map(([id, label]) => (
              <button key={id} onClick={() => setActive(id)} className={`rounded-lg border px-4 py-2 text-sm font-black ${active === id ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100' : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>
                {label}
              </button>
            ))}
          </div>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search player, team or game" className="w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-bold text-white outline-none focus:border-emerald-400 lg:w-80" />
        </div>

        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          {rows.length ? rows.map((item) => <ProjectionCard key={item.id} item={item} />) : (
            <div className="rounded-lg border border-slate-800 bg-slate-900/75 p-8 text-sm leading-6 text-slate-300">
              <p className="text-lg font-black text-white">Projection Board is waiting for safe projections.</p>
              <p className="mt-2">No user-visible projections are shown until identity, participation, feature quality, sample size, unit and plausibility gates all pass.</p>
              {data.projectionHealth?.blockerExplanations?.length ? (
                <ul className="mt-4 space-y-2">
                  {data.projectionHealth.blockerExplanations.slice(0, 5).map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
