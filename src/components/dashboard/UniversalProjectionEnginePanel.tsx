'use client'

import { useEffect, useMemo, useState } from 'react'

type ProjectionResponse = {
  success: boolean
  generatedAt: string
  summary: {
    games: number
    projections: number
    userVisible?: number
    team: number
    game: number
    pitcher: number
    batter: number
    ready: number
    limited: number
    blocked: number
    averageConfidence: number | null
    averageFeatureQuality: number | null
    averageDataSufficiency: number | null
  }
  selectedDate?: string
  projectionHealth?: {
    validProjections?: number
    userVisibleProjections?: number
    blockerSummary?: Record<string, number>
    blockerExplanations?: string[]
    persistenceStatus?: string
    settlementStatus?: string
  }
  temporalSafety?: {
    totalGamesDiscovered?: number
    projectionEligibleGames?: number
    excludedGames?: Array<{ eventId: string; matchup: string; lifecycle: string; reason: string }>
  }
  prohibitedOutputs: {
    bettingRecommendations: boolean
    officialPicks: boolean
    ev: boolean
    kelly: boolean
    sportsbookLineComparison: boolean
  }
  validation: { success: boolean; passed: number; failed: number }
  persistence: { attempted: number; insertedOrUpdated: number; dryRun: boolean; warning: string | null }
  projections: Array<{ id: string; entityName: string; projectionKey: string; projectedValue: number | null; confidence: number; readiness: string; explanation: string }>
  warnings: string[]
}

function Badge({ children, tone = 'slate' }: { children: string | number; tone?: 'green' | 'amber' | 'red' | 'slate' }) {
  const styles = {
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    red: 'border-red-500/30 bg-red-500/10 text-red-100',
    slate: 'border-slate-700 bg-slate-900/80 text-slate-100',
  }
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase ${styles[tone]}`}>{children}</span>
}

function Stat({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value ?? 'N/A'}</p>
    </div>
  )
}

export default function UniversalProjectionEnginePanel() {
  const [data, setData] = useState<ProjectionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/mlb/projections?includeValidation=true', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Projection request failed (${response.status})`)
        return response.json()
      })
      .then((json) => {
        if (alive) setData(json)
      })
      .catch((loadError) => {
        if (alive) setError(loadError instanceof Error ? loadError.message : 'Unable to load projection engine.')
      })
    return () => {
      alive = false
    }
  }, [])

  const examples = useMemo(() => data?.projections.slice(0, 6) ?? [], [data])

  if (error) return <section className="rounded-lg border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-100">{error}</section>
  if (!data) return <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-5 text-sm font-bold text-slate-400">Loading projection engine...</section>

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Universal Projection Engine</p>
          <h3 className="mt-2 text-2xl font-black text-white">MLB Projection Layer</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Sportsbook-independent statistical projections for teams, pitchers, batters and games. No odds, EV, Kelly or Official Picks are generated.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={data.validation.success ? 'green' : 'amber'}>{data.validation.success ? 'Validated' : 'Partial'}</Badge>
          <Badge tone="green">No sportsbook dependency</Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Stat label="Games" value={data.summary.games} />
        <Stat label="Projections" value={data.summary.projections} />
        <Stat label="Visible" value={data.summary.userVisible ?? data.projectionHealth?.userVisibleProjections ?? 0} />
        <Stat label="Team" value={data.summary.team} />
        <Stat label="Pitcher" value={data.summary.pitcher} />
        <Stat label="Batter" value={data.summary.batter} />
      </div>

      {(data.summary.userVisible ?? data.projectionHealth?.userVisibleProjections ?? 0) === 0 ? (
        <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-black text-amber-100">Projection visibility is blocked by safety gates.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(data.projectionHealth?.blockerSummary ?? {}).filter(([, value]) => Number(value) > 0).map(([key, value]) => (
              <Stat key={key} label={key.replaceAll(/([A-Z])/g, ' $1').trim()} value={String(value)} />
            ))}
          </div>
          <div className="mt-3 space-y-1 text-sm text-amber-100">
            {(data.projectionHealth?.blockerExplanations ?? ['No projection is visible until identity, participation, feature quality, data sufficiency, unit and plausibility gates pass.']).slice(0, 5).map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-black text-white">Guardrails</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={data.prohibitedOutputs.bettingRecommendations ? 'red' : 'green'}>No recommendations</Badge>
            <Badge tone={data.prohibitedOutputs.officialPicks ? 'red' : 'green'}>No official picks</Badge>
            <Badge tone={data.prohibitedOutputs.ev ? 'red' : 'green'}>No EV</Badge>
            <Badge tone={data.prohibitedOutputs.kelly ? 'red' : 'green'}>No Kelly</Badge>
            <Badge tone={data.prohibitedOutputs.sportsbookLineComparison ? 'red' : 'green'}>No line comparison</Badge>
          </div>
          <p className="mt-3 text-sm text-slate-400">History persistence is dry-run by default. Migration-backed storage is separate from prediction history.</p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-black text-white">Projection Examples</p>
          <div className="mt-3 space-y-2">
            {examples.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-white">{item.entityName}</p>
                  <Badge tone={item.readiness === 'READY' ? 'green' : item.readiness === 'LIMITED' ? 'amber' : 'red'}>{item.readiness}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-300">{item.projectionKey.replaceAll('_', ' ')}: {item.projectedValue ?? 'N/A'} / confidence {item.confidence}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
