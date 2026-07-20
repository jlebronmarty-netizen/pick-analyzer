'use client'

import { useEffect, useMemo, useState } from 'react'

type FreshnessItem = {
  domain: string
  label: string
  status: string
  ageMinutes: number | null
  userMessage: string
  actionable: boolean
}

type RefreshPlanItem = {
  domain: string
  label: string
  decision: string
  affectedGames: number
  estimatedProviderCalls: number
  predictionRegenerationNeeded: boolean
  reason: string
}

type AdaptiveStatus = {
  success: boolean
  status: string
  generatedAt: string
  operatingDate: string
  activeSlateDate: string | null
  nextSlateDate: string | null
  currentGames: number
  upcomingGames: number
  gamesWaitingForOdds: number
  gamesReadyForAnalysis: number
  predictionCandidates: number
  officialPicks: number
  nextAction: string
  nextActionAt: string | null
  providerBudget: {
    mode: string
    callsMadeToday: number
    estimatedCallsRemaining: number
    hardRemaining: number
    maxCallsPerAction: number
  }
  schedulerAudit: {
    configuredCronCount: number
    finding: string
    jobs: Array<{ id: string; name: string; path: string; cadence: string; active: boolean; lastRunAt: string | null; status: string; lastFailure: string | null }>
  }
  freshness: FreshnessItem[]
  refreshPlan: RefreshPlanItem[]
  providerCallForecast: {
    estimatedDueNowCalls: number
    budgetAllowsPlan: boolean
    providerCallsAddedByStatusRead: number
  }
  changeEvents: {
    status: string
    events: unknown[]
    explanation: string
  }
  explanations: {
    available: string[]
    pending: string[]
    unsupported: string[]
    userCopy: string[]
  }
  guardrails: {
    providerCallsMade: number
    remoteMutationsMade: number
    predictionMutationsMade: number
    officialThresholdsChanged: boolean
    championRowsMutated: boolean
    v7Promoted: boolean
  }
  warnings: string[]
  blockers: string[]
}

function timeText(value: string | null | undefined) {
  if (!value) return 'Not scheduled'
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return 'Not scheduled'
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Puerto_Rico',
    timeZoneName: 'short',
  })
}

function tone(status: string) {
  const value = status.toLowerCase()
  if (['fresh', 'success', 'normal', 'not_due'].some((item) => value.includes(item))) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
  if (['aging', 'conservative', 'due_soon', 'partial'].some((item) => value.includes(item))) return 'border-amber-500/30 bg-amber-500/10 text-amber-100'
  if (['stale', 'critical', 'blocked', 'exhausted', 'error'].some((item) => value.includes(item))) return 'border-red-500/30 bg-red-500/10 text-red-100'
  return 'border-slate-700 bg-slate-900/80 text-slate-100'
}

function Badge({ value }: { value: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.1em] ${tone(value)}`}>{value.replaceAll('_', ' ')}</span>
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

export default function AdaptiveOperationsPanel() {
  const [data, setData] = useState<AdaptiveStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/operations/adaptive-refresh/status', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`)
        return response.json()
      })
      .then((json) => {
        if (alive) setData(json)
      })
      .catch((loadError) => {
        if (alive) setError(loadError instanceof Error ? loadError.message : 'Unable to load adaptive operations.')
      })
    return () => {
      alive = false
    }
  }, [])

  const dueNow = useMemo(() => data?.refreshPlan.filter((item) => item.decision === 'DUE_NOW') ?? [], [data])

  if (error) {
    return (
      <section className="rounded-lg border border-red-500/30 bg-red-500/10 p-5">
        <p className="text-sm font-black text-red-100">Adaptive Operations unavailable</p>
        <p className="mt-2 text-sm text-red-100/80">{error}</p>
      </section>
    )
  }

  if (!data) {
    return <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-5 text-sm font-bold text-slate-400">Loading adaptive operations...</section>
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Adaptive Operations</p>
          <h3 className="mt-2 text-2xl font-black text-white">Live Freshness & Refresh Plan</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{data.schedulerAudit.finding}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge value={data.status} />
          <Badge value={data.providerBudget.mode} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Current Games" value={data.currentGames} />
        <Stat label="Upcoming" value={data.upcomingGames} />
        <Stat label="Waiting Odds" value={data.gamesWaitingForOdds} />
        <Stat label="Due Calls" value={data.providerCallForecast.estimatedDueNowCalls} />
        <Stat label="Remaining" value={data.providerBudget.estimatedCallsRemaining} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black text-white">Refresh Plan</p>
            <p className="text-xs font-bold text-slate-500">Next: {data.nextAction.replaceAll('_', ' ')}</p>
          </div>
          <div className="mt-4 space-y-3">
            {data.refreshPlan.slice(0, 8).map((item) => (
              <div key={item.domain} className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="text-sm font-black text-white">{item.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{item.reason}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <Badge value={item.decision} />
                  <span className="text-xs font-bold text-slate-500">{item.estimatedProviderCalls} calls</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-black text-white">Data Freshness</p>
          <div className="mt-4 grid gap-3">
            {data.freshness.slice(0, 8).map((item) => (
              <div key={item.domain} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <div>
                  <p className="text-sm font-black text-white">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.ageMinutes === null ? item.userMessage : `${item.ageMinutes} minutes old`}</p>
                </div>
                <Badge value={item.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-black text-white">Scheduler</p>
          <div className="mt-3 space-y-2">
            {data.schedulerAudit.jobs.map((job) => (
              <div key={job.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-white">{job.name}</p>
                  <Badge value={job.active ? 'active' : 'inactive'} />
                </div>
                <p className="mt-1 text-xs text-slate-500">{job.path} | {job.cadence}</p>
                <p className="mt-1 text-xs text-slate-400">Last: {timeText(job.lastRunAt)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-black text-white">Change Events</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">{data.changeEvents.explanation}</p>
          <p className="mt-3 text-3xl font-black text-white">{data.changeEvents.events.length}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-black text-white">Guardrails</p>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p>Provider calls by status read: {data.guardrails.providerCallsMade}</p>
            <p>Prediction mutations: {data.guardrails.predictionMutationsMade}</p>
            <p>Thresholds changed: {String(data.guardrails.officialThresholdsChanged)}</p>
            <p>Champion mutated: {String(data.guardrails.championRowsMutated)}</p>
            <p>V7 promoted: {String(data.guardrails.v7Promoted)}</p>
          </div>
        </div>
      </div>

      {(dueNow.length > 0 || data.warnings.length > 0 || data.blockers.length > 0) && (
        <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-black text-amber-100">Operator Notes</p>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-100/80">
            {[...data.blockers, ...data.warnings].slice(0, 6).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}
    </section>
  )
}
