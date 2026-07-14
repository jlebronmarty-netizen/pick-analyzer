'use client'

import { useEffect, useState } from 'react'

type DataHealth = {
  success: boolean
  season: string
  status: 'healthy' | 'degraded' | 'unavailable'
  issues: string[]
  provider: {
    id: string
    status: string
  }
  coverage: {
    teams: number
    events: number
    results: number
    standings: number
    teamStats: number
    oddsSnapshots: number
  }
  freshness: {
    lastSync: string | null
    lastOddsSnapshot: string | null
  }
  orchestration?: {
    mode: string
    routeCountDelta: number
    defaultProviderCallsAllowed: number
    concurrencyLimit: number
    automaticRetries: boolean
    summary: {
      steps: number
      mutatingSteps: number
      readOnlySteps: number
      readySteps: number
      blockedExternalSteps: number
      protectedSteps: number
    }
    blockers: string[]
  }
  recentJobs: SyncJob[]
}

type SyncJob = {
  id: string
  job_type: string
  status: string
  started_at: string
  completed_at: string | null
  records_fetched: number
  records_updated: number
  error_count: number
  last_error: string | null
}

type SyncResponse = {
  success: boolean
  results?: {
    jobType: string
    success: boolean
    recordsFetched: number
    recordsUpdated: number
    errorCount: number
  }[]
  error?: string
  errors?: string[]
}

function statusClass(status: string) {
  if (status === 'healthy' || status === 'completed') {
    return 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
  }

  if (status === 'degraded' || status === 'partial' || status === 'running') {
    return 'border-amber-500/30 bg-amber-950/20 text-amber-300'
  }

  return 'border-red-500/30 bg-red-950/20 text-red-300'
}

function formatTime(value: string | null) {
  if (!value) return 'Never'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export default function NbaDataSyncPanel() {
  const [health, setHealth] = useState<DataHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)
  const [mode, setMode] = useState('incremental')
  const [season, setSeason] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/nba/data-health', {
        cache: 'no-store',
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Unable to load NBA data health')
      }

      setHealth(json)
      setSeason((current) => current || json.season)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load NBA data health'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function runSync(path: string, label: string) {
    try {
      setRunning(label)
      setMessage(null)
      setError(null)

      const params = new URLSearchParams()
      params.set('mode', mode)
      if (season.trim()) params.set('season', season.trim())

      const response = await fetch(`${path}?${params.toString()}`, {
        method: 'POST',
        cache: 'no-store',
      })
      const json = (await response.json()) as SyncResponse

      if (!response.ok || !json.success) {
        throw new Error(
          json.error ?? json.errors?.join(' ') ?? `${label} failed`
        )
      }

      const total = json.results?.reduce(
        (sum, item) => sum + item.recordsUpdated,
        0
      )

      setMessage(`${label} completed. Updated ${total ?? 0} records.`)
      await load()
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : `${label} failed`
      )
    } finally {
      setRunning(null)
    }
  }

  if (loading && !health) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading NBA Data Sync health...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-300">
            NBA Data Sync V1
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Provider Sync & Data Health
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Synchronizes NBA teams, games, scores, standings, derived team
            stats and odds through the Multi-Sport Engine.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Badge label="Health" value={health?.status ?? 'unavailable'} />
          <Badge label="Provider" value={health?.provider.status ?? 'unknown'} />
          <Badge label="Season" value={health?.season ?? season} />
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-6">
        <Stat label="Teams" value={`${health?.coverage.teams ?? 0}`} />
        <Stat label="Events" value={`${health?.coverage.events ?? 0}`} />
        <Stat label="Results" value={`${health?.coverage.results ?? 0}`} />
        <Stat label="Standings" value={`${health?.coverage.standings ?? 0}`} />
        <Stat label="Team Stats" value={`${health?.coverage.teamStats ?? 0}`} />
        <Stat label="Odds" value={`${health?.coverage.oddsSnapshots ?? 0}`} />
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-[180px_180px_1fr]">
        <label>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Mode
          </span>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="incremental">Incremental</option>
            <option value="today">Today</option>
            <option value="live">Live</option>
            <option value="full">Full</option>
            <option value="historical">Historical</option>
          </select>
        </label>

        <label>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Season
          </span>
          <input
            value={season}
            onChange={(event) => setSeason(event.target.value)}
            placeholder="2025-26"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600"
          />
        </label>

        <div className="flex flex-wrap items-end gap-2">
          <Action
            label="Run All"
            running={running}
            onClick={() => runSync('/api/nba/sync', 'NBA full sync')}
          />
          <Action
            label="Teams"
            running={running}
            onClick={() => runSync('/api/nba/sync/teams', 'Teams sync')}
          />
          <Action
            label="Games"
            running={running}
            onClick={() => runSync('/api/nba/sync/games', 'Games sync')}
          />
          <Action
            label="Stats"
            running={running}
            onClick={() => runSync('/api/nba/sync/stats', 'Stats sync')}
          />
          <Action
            label="Odds"
            running={running}
            onClick={() => runSync('/api/nba/sync/odds', 'Odds sync')}
          />
        </div>
      </div>

      {message ? (
        <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4 text-sm text-emerald-300">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-950/10 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {health?.issues.length ? (
        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5">
          <p className="font-bold text-amber-300">Data Health Issues</p>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            {health.issues.map((issue) => (
              <p key={issue}>{issue}</p>
            ))}
          </div>
        </div>
      ) : null}

      {health?.orchestration ? (
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Daily Orchestration Contract</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <MiniRow label="Steps" value={String(health.orchestration.summary.steps)} />
            <MiniRow label="Ready" value={String(health.orchestration.summary.readySteps)} />
            <MiniRow label="Blocked" value={String(health.orchestration.summary.blockedExternalSteps)} />
            <MiniRow label="Protected" value={String(health.orchestration.summary.protectedSteps)} />
            <MiniRow label="Provider Calls" value={String(health.orchestration.defaultProviderCallsAllowed)} />
            <MiniRow label="Route Delta" value={String(health.orchestration.routeCountDelta)} />
          </div>
          <div className="mt-4 grid gap-2">
            {health.orchestration.blockers.slice(0, 2).map((blocker) => (
              <p
                key={blocker}
                className="rounded-xl border border-amber-500/20 bg-amber-950/10 px-4 py-3 text-sm text-amber-100"
              >
                {blocker}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800">
        <div className="grid grid-cols-[1fr_110px_110px_90px] bg-slate-900 px-4 py-3 text-xs font-bold text-slate-500">
          <span>Job</span>
          <span>Status</span>
          <span>Updated</span>
          <span className="text-right">Errors</span>
        </div>

        {(health?.recentJobs ?? []).slice(0, 8).map((job) => (
          <div
            key={job.id}
            className="grid grid-cols-[1fr_110px_110px_90px] border-t border-slate-800 bg-slate-950/70 px-4 py-3 text-sm"
          >
            <div>
              <p className="font-semibold text-white">{job.job_type}</p>
              <p className="text-xs text-slate-500">
                fetched {job.records_fetched}, updated {job.records_updated}
              </p>
            </div>
            <span
              className={`w-fit rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${statusClass(
                job.status
              )}`}
            >
              {job.status}
            </span>
            <span className="text-slate-400">
              {formatTime(job.completed_at ?? job.started_at)}
            </span>
            <span className="text-right text-slate-300">
              {job.error_count}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
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

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  )
}

function Action({
  label,
  running,
  onClick,
}: {
  label: string
  running: string | null
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={Boolean(running)}
      className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:border-orange-400/60 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {running ? 'Running...' : label}
    </button>
  )
}
