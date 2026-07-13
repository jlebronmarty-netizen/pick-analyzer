'use client'

import { useEffect, useState } from 'react'

type HealthResponse = {
  success: boolean
  status: string
  summary: {
    recentJobs: number
    failedJobs: number
    runningJobs: number
    partialJobs: number
    providerMappings: number
    sportsWithMappings: number
    providersWithMappings: number
  }
  providerUsage: {
    externalProviderCallsMade: number
  }
  warnings: string[]
  error?: string
}

type PlanResponse = {
  success: boolean
  status: string
  validation: {
    valid: boolean
    errors: string[]
    warnings: string[]
  }
  job: {
    totalCheckpoints: number
    executableCheckpoints: number
    blockedCheckpoints: number
  }
  quotaEstimate: {
    estimatedProviderCalls: number
    costTier: string
    quotaImpact: string
    recommendedBatchSizeDays: number
    warning: string
  }
  checkpoints: Array<{
    id: string
    sequence: number
    dataType: string
    scope: string
    dateFrom: string | null
    dateTo: string | null
    status: string
    estimatedProviderCalls: number
  }>
  error?: string
}

type SportsDataIoStatusResponse = {
  success: boolean
  status: string
  providerUsage: {
    externalProviderCallsMade: number
  }
  environment: {
    configured: boolean
    status: string
    envVarName: string | null
  }
  runtime: {
    liveCallsEnabled: boolean
    serverOnly: boolean
    boundedConcurrency: boolean
    timeoutMs: number
  }
  summary: {
    contractEndpoints: number
    domainContracts: number
    fixtureValidationErrors: number
    fixtureValidationWarnings: number
    supportedRuntimeSports: number
  }
  validation: {
    success: boolean
    summary: {
      checks: number
      passed: number
      normalizedEvents: number
      normalizedOdds: number
    }
  }
}

type SportsDataIoPilotPlanResponse = {
  success: boolean
  status: string
  providerUsage: {
    externalProviderCallsMade: number
  }
  guardrails: {
    liveExecutionBlockedInThisModule: boolean
    hardCaps: {
      maximumRequests: number
      maximumRecords: number
      batchSizeDays: number
      concurrencyLimit: number
    }
  }
  job: {
    totalCheckpoints: number
    executableCheckpoints: number
    blockedCheckpoints: number
  }
  estimates: {
    estimatedProviderCalls: number
    estimatedRecords: number
    estimatedQuotaImpact: string
    recommendedBatchSizeDays: number
    recommendedConcurrency: number
  }
  pilot: {
    recommendedScope: string
    recommendedCap: number
    quotaRisk: string
    executionOrder: string[]
    stopConditions: string[]
  }
  checkpoints: Array<{
    id: string
    sequence: number
    domain: string
    status: string
    estimatedRequests: number
    destination: string
  }>
  warnings: string[]
}

function statusClass(status: string) {
  if (status === 'ready' || status === 'planned') return 'text-emerald-300'
  if (
    status === 'watch' ||
    status === 'partial' ||
    status === 'dry_run_ready' ||
    status === 'configured_disabled'
  ) return 'text-amber-300'
  return 'text-red-300'
}

export default function HistoricalImportEnginePanel() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [sportsDataIoStatus, setSportsDataIoStatus] =
    useState<SportsDataIoStatusResponse | null>(null)
  const [sportsDataIoPilot, setSportsDataIoPilot] =
    useState<SportsDataIoPilotPlanResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const [
        healthResponse,
        planResponse,
        sportsDataIoStatusResponse,
        sportsDataIoPilotResponse,
      ] = await Promise.all([
        fetch('/api/historical-import/health', { cache: 'no-store' }),
        fetch('/api/historical-import/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sportKey: 'basketball_nba',
            leagueKey: 'nba',
            dateFrom: '2026-01-01',
            dateTo: '2026-01-07',
            dataTypes: ['schedules', 'scores', 'odds'],
            batchSizeDays: 3,
            dryRun: true,
          }),
        }),
        fetch('/api/providers/sportsdataio/status', { cache: 'no-store' }),
        fetch('/api/historical-import/pilot-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sportKey: 'basketball_nba',
            leagueKey: 'nba',
            dateFrom: '2026-01-01',
            dateTo: '2026-01-03',
            domains: [
              'teams',
              'schedules',
              'completed_games',
              'scores',
              'standings',
              'game_stats',
            ],
          }),
        }),
      ])
      const healthJson = await healthResponse.json()
      const planJson = await planResponse.json()
      const sportsDataIoStatusJson = await sportsDataIoStatusResponse.json()
      const sportsDataIoPilotJson = await sportsDataIoPilotResponse.json()

      if (!healthResponse.ok || !healthJson.success) {
        throw new Error(healthJson.error ?? 'Unable to load import health')
      }

      if (!planResponse.ok || !planJson.success) {
        throw new Error(planJson.error ?? 'Unable to plan historical import')
      }

      if (
        !sportsDataIoStatusResponse.ok ||
        !sportsDataIoStatusJson.success
      ) {
        throw new Error(
          sportsDataIoStatusJson.error ??
            'Unable to load SportsDataIO execution status'
        )
      }

      if (!sportsDataIoPilotResponse.ok || !sportsDataIoPilotJson.success) {
        throw new Error(
          sportsDataIoPilotJson.error ??
            'Unable to load SportsDataIO pilot plan'
        )
      }

      setHealth(healthJson)
      setPlan(planJson)
      setSportsDataIoStatus(sportsDataIoStatusJson)
      setSportsDataIoPilot(sportsDataIoPilotJson)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load historical import engine'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading && !health) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading Historical Import Engine...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Historical Import
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Dry-Run Import Engine
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Plans normalized, resumable historical imports with checkpoints,
            idempotency and quota estimates. Provider execution is disabled in
            Core V1.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className={`text-sm font-black uppercase ${statusClass(health?.status ?? 'blocked')}`}>
            {health?.status ?? 'blocked'}
          </p>
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-900/40"
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
        <Stat label="Recent Jobs" value={health?.summary.recentJobs ?? 0} />
        <Stat label="Mappings" value={health?.summary.providerMappings ?? 0} />
        <Stat label="Checkpoints" value={plan?.job.totalCheckpoints ?? 0} />
        <Stat
          label="Est. Calls"
          value={plan?.quotaEstimate.estimatedProviderCalls ?? 0}
        />
        <Stat
          label="Provider Calls"
          value={health?.providerUsage.externalProviderCallsMade ?? 0}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-white">
              SportsDataIO Execution Readiness
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-indigo-100/80">
              Runtime adapter, pilot planning and execution guardrails are wired
              for future activation. This panel does not expose a live execution
              button in Readiness V1.
            </p>
          </div>
          <p className={`text-xs font-black uppercase ${statusClass(sportsDataIoStatus?.status ?? 'blocked')}`}>
            {sportsDataIoStatus?.status ?? 'blocked'}
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Stat
            label="Domains"
            value={sportsDataIoStatus?.summary.domainContracts ?? 0}
          />
          <Stat
            label="Runtime Checks"
            value={`${sportsDataIoStatus?.validation.summary.passed ?? 0}/${sportsDataIoStatus?.validation.summary.checks ?? 0}`}
          />
          <Stat
            label="Pilot Calls"
            value={sportsDataIoPilot?.estimates.estimatedProviderCalls ?? 0}
          />
          <Stat
            label="Pilot Records"
            value={sportsDataIoPilot?.estimates.estimatedRecords ?? 0}
          />
          <Stat
            label="Live Calls"
            value={
              sportsDataIoStatus?.runtime.liveCallsEnabled
                ? 'Enabled'
                : 'Disabled'
            }
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
            <p className="text-sm font-black text-white">Guardrails</p>
            <div className="mt-4 grid gap-3">
              <MiniRow
                label="Environment"
                value={sportsDataIoStatus?.environment.status ?? 'unknown'}
              />
              <MiniRow
                label="Hard Request Cap"
                value={`${sportsDataIoPilot?.guardrails.hardCaps.maximumRequests ?? 0}`}
              />
              <MiniRow
                label="Concurrency Cap"
                value={`${sportsDataIoPilot?.guardrails.hardCaps.concurrencyLimit ?? 0}`}
              />
              <MiniRow
                label="Quota Risk"
                value={sportsDataIoPilot?.pilot.quotaRisk ?? 'unknown'}
              />
              <MiniRow
                label="Provider Calls Made"
                value={`${sportsDataIoPilot?.providerUsage.externalProviderCallsMade ?? 0}`}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
            <p className="text-sm font-black text-white">
              Recommended Pilot Order
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(sportsDataIoPilot?.pilot.executionOrder ?? []).map((item, index) => (
                <div
                  key={item}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm"
                >
                  <span className="text-slate-500">{index + 1}. </span>
                  <span className="font-bold text-white">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4 text-xs leading-5 text-amber-100">
              {sportsDataIoPilot?.warnings[0] ??
                'No live provider calls are made by this readiness panel.'}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">NBA Sample Plan</p>
          <p className="mt-1 text-xs text-slate-500">
            basketball_nba · Jan 1-7, 2026 · 3-day batches
          </p>

          <div className="mt-4 grid gap-3">
            <MiniRow label="Status" value={plan?.status ?? 'unknown'} />
            <MiniRow
              label="Executable"
              value={String(plan?.job.executableCheckpoints ?? 0)}
            />
            <MiniRow
              label="Blocked"
              value={String(plan?.job.blockedCheckpoints ?? 0)}
            />
            <MiniRow
              label="Quota Impact"
              value={plan?.quotaEstimate.quotaImpact ?? 'none'}
            />
            <MiniRow
              label="Batch Size"
              value={`${plan?.quotaEstimate.recommendedBatchSizeDays ?? 0} days`}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4 text-xs leading-5 text-amber-100">
            {plan?.quotaEstimate.warning ??
              'Dry-run only. No external provider execution is available.'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Planned Checkpoints</p>
          <div className="mt-4 grid gap-3">
            {(plan?.checkpoints ?? []).slice(0, 8).map((checkpoint) => (
              <div
                key={checkpoint.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-black text-white">
                      {checkpoint.sequence}. {checkpoint.dataType}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {checkpoint.scope} · {checkpoint.dateFrom ?? 'season'} to{' '}
                      {checkpoint.dateTo ?? 'season'}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className={`text-xs font-black uppercase ${statusClass(checkpoint.status)}`}>
                      {checkpoint.status}
                    </p>
                    <p className="text-xs text-slate-500">
                      {checkpoint.estimatedProviderCalls} est. call
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {plan?.checkpoints.length === 0 ? (
              <p className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
                No checkpoints planned.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <p className="text-sm font-black text-white">Warnings</p>
        <div className="mt-3 grid gap-2 text-xs text-slate-400">
          {[...(health?.warnings ?? []), ...(plan?.validation.warnings ?? [])]
            .slice(0, 6)
            .map((warning) => (
              <p key={warning} className="leading-5">
                {warning}
              </p>
            ))}
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  )
}
