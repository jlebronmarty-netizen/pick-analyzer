'use client'

import { useEffect, useState } from 'react'

type OperationsHealth = {
  success: boolean
  status: string
  generatedAt: string
  operatingDate: string
  scheduler: {
    configured: boolean
    lastCronInvocation: string | null
    nextScheduledRun: string | null
    limitation: string
    schedulerRunning?: boolean
    lastSchedulerRun?: string | null
    lastSchedulerSuccess?: string | null
    lastSchedulerFailure?: string | null
    lastSchedulerFailureReason?: string | null
  }
  refreshOperations?: {
    providerStatus: string
    currentRefreshWindow: string
    health: string
    lastOddsRefresh: string | null
    lastPredictionRefresh: string | null
    lastRecommendationRefresh: string | null
    lastResultsRefresh: string | null
    nextRefreshDue: { domain: string; decision: string; reason: string } | null
    nextRefreshDueAt: string | null
    skippedCalls: number
    skipReason: string | null
  }
  adaptiveExecution: {
    mode: string
    currentRunStatus: string
    nextAction: string
    nextActionAt: string | null
    dueSteps: Array<{ domain: string; label: string; decision: string }>
    planOnly: boolean
  }
  providerBudgets: {
    sportsdataio: {
      status: string
      callsMadeToday: number
      callsMadeLastHour?: number
      estimatedCallsRemaining: number
      hourlyRemaining?: number
      dailyBudget: number
      usagePercent?: number
    }
  }
  projections: {
    userVisible: number
  }
  currentBoard: {
    candidates: number
    officialPicks: number
    latestOddsTimestamp: string | null
    status: string
  }
  migrations: {
    pending: unknown[]
  }
  settlementBacklog: {
    pendingPredictions: number | null
  }
  exactBlockers: string[]
  providerCallsToday: number
  mutationsToday: number
  certification: {
    operationsProductionReady: boolean
    closedBetaOperationsReady: boolean
    reason: string
  }
}

function badgeClass(value: string) {
  const lower = value.toLowerCase()
  if (['healthy', 'success', 'normal', 'applied'].some((item) => lower.includes(item))) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
  if (['partial', 'degraded', 'aging', 'limited'].some((item) => lower.includes(item))) return 'border-amber-500/30 bg-amber-500/10 text-amber-100'
  if (['blocked', 'failed', 'stale', 'missing'].some((item) => lower.includes(item))) return 'border-red-500/30 bg-red-500/10 text-red-100'
  return 'border-slate-700 bg-slate-900/80 text-slate-100'
}

function timeText(value: string | null) {
  if (!value) return 'Not scheduled'
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return 'Unknown'
  return parsed.toLocaleString('en-US', {
    timeZone: 'America/Puerto_Rico',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-slate-200" title={String(value)}>{value}</p>
    </div>
  )
}

export default function OperationsHealthPanel() {
  const [data, setData] = useState<OperationsHealth | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/operations/health', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`)
        return response.json()
      })
      .then((json) => {
        if (active) setData(json)
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load operations health.')
      })
    return () => {
      active = false
    }
  }, [])

  if (error) {
    return (
      <section className="rounded-lg border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-100">
        Operations health unavailable: {error}
      </section>
    )
  }

  if (!data) {
    return <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-5 text-sm font-bold text-slate-400">Loading operations health...</section>
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Operations Control Center</p>
          <h3 className="mt-2 text-2xl font-black text-white">Production Operations Health</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{data.certification.reason}</p>
        </div>
        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${badgeClass(data.status)}`}>
          {data.status}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Stat label="Provider Calls" value={data.providerCallsToday} />
        <Stat label="Mutations" value={data.mutationsToday} />
        <Stat label="Board Candidates" value={data.currentBoard.candidates} />
        <Stat label="Official Picks" value={data.currentBoard.officialPicks} />
        <Stat label="User Projections" value={data.projections.userVisible} />
        <Stat label="Pending Migrations" value={data.migrations.pending.length} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-black text-white">Scheduler</p>
          <p className="mt-3 text-sm text-slate-300">Configured: {String(data.scheduler.configured)}</p>
          <p className="mt-2 text-sm text-slate-300">Last cron: {timeText(data.scheduler.lastCronInvocation)}</p>
          <p className="mt-2 text-sm text-slate-300">Running: {String(data.scheduler.schedulerRunning ?? false)}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{data.scheduler.limitation}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-black text-white">Adaptive Execution</p>
          <p className="mt-3 text-sm text-slate-300">Mode: {data.adaptiveExecution.mode}</p>
          <p className="mt-2 text-sm text-slate-300">Next: {data.adaptiveExecution.nextAction.replaceAll('_', ' ')}</p>
          <p className="mt-2 text-sm text-slate-300">Due steps: {data.adaptiveExecution.dueSteps.length}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-black text-white">Provider Budget</p>
          <p className="mt-3 text-sm text-slate-300">Status: {data.providerBudgets.sportsdataio.status}</p>
          <p className="mt-2 text-sm text-slate-300">
            Remaining: {data.providerBudgets.sportsdataio.estimatedCallsRemaining} / {data.providerBudgets.sportsdataio.dailyBudget}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Hourly: {data.providerBudgets.sportsdataio.callsMadeLastHour ?? 0} used, {data.providerBudgets.sportsdataio.hourlyRemaining ?? 'unknown'} left
          </p>
        </div>
      </div>

      {data.refreshOperations ? (
        <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black text-white">Provider Status</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Adaptive refresh evidence from stored operations health.</p>
            </div>
            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${badgeClass(data.refreshOperations.health)}`}>
              {data.refreshOperations.health}
            </span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Provider" value={data.refreshOperations.providerStatus} />
            <Detail label="Window" value={data.refreshOperations.currentRefreshWindow} />
            <Detail label="Last Odds" value={timeText(data.refreshOperations.lastOddsRefresh)} />
            <Detail label="Last Prediction" value={timeText(data.refreshOperations.lastPredictionRefresh)} />
            <Detail label="Last Recommendation" value={timeText(data.refreshOperations.lastRecommendationRefresh)} />
            <Detail label="Last Results" value={timeText(data.refreshOperations.lastResultsRefresh)} />
            <Detail label="Next Due" value={data.refreshOperations.nextRefreshDue ? `${data.refreshOperations.nextRefreshDue.domain} ${data.refreshOperations.nextRefreshDue.decision}` : timeText(data.refreshOperations.nextRefreshDueAt)} />
            <Detail label="Credits Today" value={`${data.providerBudgets.sportsdataio.callsMadeToday} / ${data.providerBudgets.sportsdataio.dailyBudget}`} />
            <Detail label="Hourly Usage" value={`${data.providerBudgets.sportsdataio.callsMadeLastHour ?? 0} used`} />
            <Detail label="Scheduler" value={data.scheduler.schedulerRunning ? 'Active' : 'Not active'} />
            <Detail label="Last Success" value={timeText(data.scheduler.lastSchedulerSuccess ?? null)} />
            <Detail label="Last Failure" value={data.scheduler.lastSchedulerFailure ? timeText(data.scheduler.lastSchedulerFailure) : 'None'} />
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Skip reason: {data.refreshOperations.skipReason ?? 'None'}; skipped calls: {data.refreshOperations.skippedCalls}
          </p>
        </div>
      ) : null}

      {data.exactBlockers.length ? (
        <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-black text-amber-100">Blockers</p>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-100/80">
            {data.exactBlockers.slice(0, 6).map((blocker) => <li key={blocker}>{blocker}</li>)}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
