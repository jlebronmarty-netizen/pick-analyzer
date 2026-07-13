'use client'

import { useEffect, useState } from 'react'

type RuntimeResponse = {
  success: boolean
  status: string
  requestId: string
  providerUsage: {
    externalProviderCallsMade: number
  }
  summary: {
    syncJobs: number
    failedJobs: number
    partialJobs: number
    staleRunningJobs: number
    predictions: number
    pendingPredictions: number
    failedValidations: number
    unsettledClosed: number
    warningCount: number
    errorCount: number
    averageJobDurationMs: number
    providers: number
    unavailableProviders: number
  }
  syncJobs: {
    byStatus: { key: string; count: number }[]
    byType: { key: string; count: number }[]
    recentFailures: {
      id: string
      sportKey: string
      jobType: string
      provider: string
      lastError: string | null
      errorCount: number
    }[]
  }
  providers: {
    unavailable: {
      id: string
      name: string
      reason: string | null
    }[]
  }
  warnings: string[]
}

function statusClass(status: string) {
  if (status === 'healthy') return 'text-emerald-300'
  if (status === 'warning') return 'text-amber-300'
  return 'text-red-300'
}

export default function RuntimeObservabilityPanel() {
  const [data, setData] = useState<RuntimeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/observability/runtime', {
        cache: 'no-store',
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(
          json.error?.message ?? json.error ?? 'Unable to load runtime observability'
        )
      }

      setData(json)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load runtime observability'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading && !data) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading Runtime Observability...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-300">
            Runtime Observability
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Operational Health
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Aggregates sync jobs, prediction lifecycle, provider state and recent failures from stored operational data.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className={`text-sm font-black uppercase ${statusClass(data?.status ?? 'error')}`}>
            {data?.status ?? 'unknown'}
          </p>
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 px-4 py-2 text-sm font-bold text-indigo-100 hover:bg-indigo-900/40"
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
        <Stat label="Sync Jobs" value={data?.summary.syncJobs ?? 0} />
        <Stat label="Failures" value={data?.summary.failedJobs ?? 0} />
        <Stat label="Predictions" value={data?.summary.predictions ?? 0} />
        <Stat label="Pending" value={data?.summary.pendingPredictions ?? 0} />
        <Stat label="Provider Calls" value={data?.providerUsage.externalProviderCallsMade ?? 0} />
      </div>

      {data?.warnings.length ? (
        <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
            Warnings
          </p>
          <div className="mt-3 grid gap-2">
            {data.warnings.map((warning) => (
              <p key={warning} className="text-sm text-amber-100">
                {warning}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <List title="Sync Status" rows={data?.syncJobs.byStatus ?? []} />
        <List title="Sync Types" rows={data?.syncJobs.byType ?? []} />
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Unavailable Providers</p>
          <div className="mt-4 grid gap-3">
            {data?.providers.unavailable.length ? (
              data.providers.unavailable.map((provider) => (
                <div
                  key={provider.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
                >
                  <p className="text-sm font-bold text-white">{provider.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {provider.reason ?? 'No reason recorded'}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">
                No unavailable providers in the current registry state.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function List({
  title,
  rows,
}: {
  title: string
  rows: { key: string; count: number }[]
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-sm font-black text-white">{title}</p>
      <div className="mt-4 grid gap-3">
        {rows.length ? (
          rows.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3"
            >
              <p className="text-sm font-bold text-white">{row.key}</p>
              <p className="text-sm text-slate-300">{row.count}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-400">No rows available.</p>
        )}
      </div>
    </div>
  )
}
