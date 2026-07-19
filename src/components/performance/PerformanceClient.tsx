'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'

type ApiData = {
  success: boolean
  publicView: {
    overallAiGrade: string
    trustLabel: string
    settledSample: number
    accuracy: number | null
    recentTrend: string
    modelStatus: string
    lastUpdate: string
    sportComparison: Array<{
      sportKey: string
      label: string
      grade: string
      trustLabel: string
      sample: number
      status: string
    }>
    disclaimer: string
  }
  aiBrain: {
    selected: {
      overallHealth: string
      readiness: { score: number; status: string }
      trustScore: {
        trustScore: number | null
        trustLabel: string
        components: Array<{ key: string; label: string; normalizedScore: number | null; weight: number; availability: string }>
      }
    }
    evolution: Record<string, { period: string; trendDirection: string; sampleCounts: { current: number; previous: number }; trustScore: { currentValue: number | null; absoluteChange: number | null } }>
    dailyReportCard: {
      dimensions: Record<string, { score: number | null; label: string; sampleSize: number; provisional: boolean }>
    }
    goals: {
      goals: Array<{ key: string; label: string; target: number; progressPercentage: number; status: string }>
    }
    maturityPipeline: Record<string, { status: string; score: number }> | null
    trustChange: {
      previous7DayWindow: { direction: string; absoluteChange: number | null; explanation: string }
    }
    internalView: {
      brierScore: number
      logLoss: number
      calibrationError: number
      featureDrift: number
      confidenceDrift: number
      modelDrift: number
      trustComponents: Array<{ key: string; label: string; normalizedScore: number | null; weight: number; availability: string }>
    }
  }
  providerCallsMade: number
  remoteMutationsMade: number
}

const SPORT_OPTIONS = [
  ['all', 'All Sports'],
  ['baseball_mlb', 'MLB'],
  ['basketball_bsn', 'BSN'],
  ['basketball_nba', 'NBA'],
  ['americanfootball_nfl', 'NFL'],
  ['soccer', 'Soccer'],
]

function width(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`
}

export default function PerformanceClient() {
  const [sportKey, setSportKey] = useState('all')
  const [data, setData] = useState<ApiData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [advanced, setAdvanced] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      setError(null)
      try {
        const response = await fetch(`/api/performance${sportKey === 'all' ? '' : `?sportKey=${sportKey}`}`, { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error ?? 'Unable to load performance.')
        if (active) setData(json)
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load performance.')
      }
    }
    load()
    return () => {
      active = false
    }
  }, [sportKey])

  const evolutionRows = useMemo(() => {
    if (!data) return []
    return Object.values(data.aiBrain.evolution)
      .filter((item) => item && typeof item === 'object' && 'period' in item)
      .slice(0, 6)
  }, [data])

  if (error) return <main className="min-h-screen bg-slate-950 p-6 text-red-100">{error}</main>
  if (!data) return <main className="min-h-screen bg-slate-950 p-6"><div className="h-96 animate-pulse rounded-lg bg-slate-900" /></main>

  const trust = data.aiBrain.selected.trustScore

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">AI Brain</p>
            <h1 className="mt-2 text-3xl font-black text-white">Performance & Trust</h1>
          </div>
          <select
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-bold text-white"
            value={sportKey}
            onChange={(event) => setSportKey(event.target.value)}
          >
            {SPORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <section className="mt-6 grid gap-4 lg:grid-cols-5">
          <HeroCard label="Overall Grade" value={data.publicView.overallAiGrade} sub={data.aiBrain.selected.overallHealth} />
          <HeroCard label="Trust" value={trust.trustScore === null ? 'n/a' : String(trust.trustScore)} sub={trust.trustLabel} />
          <HeroCard label="Health" value={data.aiBrain.selected.readiness.status} sub={`Readiness ${data.aiBrain.selected.readiness.score}`} />
          <HeroCard label="Learning Trend" value={data.publicView.recentTrend} sub={data.aiBrain.trustChange.previous7DayWindow.explanation} />
          <HeroCard label="Last Updated" value={new Date(data.publicView.lastUpdate).toLocaleDateString()} sub={new Date(data.publicView.lastUpdate).toLocaleTimeString()} />
        </section>

        <p className="mt-4 rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">{data.publicView.disclaimer}</p>

        <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="text-sm font-black text-white">All Sports Summary</h2>
          <div className="mt-3 grid gap-2">
            {data.publicView.sportComparison.map((sport) => (
              <div key={sport.sportKey} className="grid gap-2 rounded-md bg-slate-950/70 px-3 py-2 text-sm md:grid-cols-[1fr_80px_120px_100px_140px]">
                <span className="font-bold text-white">{sport.label}</span>
                <span>{sport.grade}</span>
                <span>{sport.trustLabel}</span>
                <span>{sport.sample} settled</span>
                <span className="text-slate-400">{sport.status}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <Panel title="AI Evolution">
            {evolutionRows.map((item) => (
              <ProgressRow key={item.period} label={item.period} value={item.trustScore.currentValue ?? 0} detail={`${item.trendDirection} / change ${item.trustScore.absoluteChange ?? 'n/a'}`} />
            ))}
          </Panel>

          <Panel title="Daily Report Card">
            {Object.entries(data.aiBrain.dailyReportCard.dimensions).slice(0, 10).map(([key, item]) => (
              <ProgressRow key={key} label={key.replaceAll(/([A-Z])/g, ' $1')} value={item.score ?? 0} detail={`${item.label}${item.provisional ? ' / provisional' : ''}`} />
            ))}
          </Panel>

          <Panel title="Model Maturity Pipeline">
            {data.aiBrain.maturityPipeline ? Object.entries(data.aiBrain.maturityPipeline).map(([key, stage]) => (
              <ProgressRow key={key} label={key.replaceAll('_', ' ')} value={stage.score} detail={stage.status} />
            )) : <p className="text-sm text-slate-400">No maturity pipeline is available for this scope.</p>}
          </Panel>

          <Panel title="Goals & Progress">
            {data.aiBrain.goals.goals.map((goal) => (
              <ProgressRow key={goal.key} label={goal.label} value={goal.progressPercentage} detail={`${goal.status} / target ${goal.target}`} />
            ))}
          </Panel>
        </div>

        <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-black text-white">Advanced Details</h2>
            <button className="rounded-md border border-slate-700 px-3 py-2 text-xs font-black text-slate-100" onClick={() => setAdvanced((value) => !value)}>
              {advanced ? 'Hide' : 'Show'}
            </button>
          </div>
          {advanced ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-md bg-slate-950/70 p-3 text-sm text-slate-300">
                <p>Brier Score: {data.aiBrain.internalView.brierScore}</p>
                <p>Log Loss: {data.aiBrain.internalView.logLoss}</p>
                <p>Calibration Error: {data.aiBrain.internalView.calibrationError}</p>
                <p>Model Drift: {data.aiBrain.internalView.modelDrift}</p>
                <p>Confidence Drift: {data.aiBrain.internalView.confidenceDrift}</p>
                <p>Feature Drift: {data.aiBrain.internalView.featureDrift}</p>
                <p>Provider Calls: {data.providerCallsMade}</p>
                <p>Remote Mutations: {data.remoteMutationsMade}</p>
              </div>
              <div className="space-y-2">
                {data.aiBrain.internalView.trustComponents.map((component) => (
                  <ProgressRow key={component.key} label={component.label} value={component.normalizedScore ?? 0} detail={`${component.availability} / weight ${component.weight}`} />
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}

function HeroCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs text-slate-400">{sub}</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <h2 className="text-sm font-black text-white">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

function ProgressRow({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold capitalize text-slate-100">{label}</span>
        <span className="text-slate-400">{detail}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded bg-slate-800">
        <div className="h-full bg-emerald-400" style={{ width: width(value) }} />
      </div>
    </div>
  )
}
