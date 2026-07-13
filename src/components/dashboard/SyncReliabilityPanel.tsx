'use client'

import { useEffect, useState } from 'react'

type ReliabilityResponse = {
  success: boolean
  requestId: string
  providerUsage: {
    externalProviderCallsMade: number
  }
  primitives: Record<string, boolean>
  defaultPolicy: {
    maxAttempts: number
    baseDelayMs: number
    maxDelayMs: number
    jitterRatio: number
    timeoutMs: number
  }
  sampleRetryDelays: number[]
  sampleCircuitBreaker: {
    status: string
    failures: number
  }
  deterministicRecordRun: {
    success: boolean
    inserted: number
    failed: number
  }
  integrationStatus: string
}

export default function SyncReliabilityPanel() {
  const [data, setData] = useState<ReliabilityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/sync/reliability', {
        cache: 'no-store',
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(
          json.error?.message ?? json.error ?? 'Unable to load sync reliability'
        )
      }

      setData(json)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load sync reliability'
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
        Loading Sync Reliability...
      </section>
    )
  }

  const primitiveCount = data
    ? Object.values(data.primitives).filter(Boolean).length
    : 0

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
            Sync Reliability
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Retry & Isolation Framework
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Shared primitives for bounded concurrency, retry, timeout, circuit breaking, cursors and idempotency.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          className="rounded-xl border border-sky-500/30 bg-sky-950/30 px-4 py-2 text-sm font-bold text-sky-100 hover:bg-sky-900/40"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Stat label="Primitives" value={primitiveCount} />
        <Stat label="Attempts" value={data?.defaultPolicy.maxAttempts ?? 0} />
        <Stat label="Timeout" value={data?.defaultPolicy.timeoutMs ?? 0} />
        <Stat label="Self-Test Failures" value={data?.deterministicRecordRun.failed ?? 0} />
        <Stat label="Provider Calls" value={data?.providerUsage.externalProviderCallsMade ?? 0} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Primitives</p>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {Object.entries(data?.primitives ?? {}).map(([key, enabled]) => (
              <div
                key={key}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
              >
                <p className="text-sm font-bold text-white">
                  {key.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`)}
                </p>
                <p className={enabled ? 'text-xs text-emerald-300' : 'text-xs text-red-300'}>
                  {enabled ? 'available' : 'missing'}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Deterministic Self-Test</p>
          <div className="mt-4 grid gap-3">
            <p className="text-sm text-slate-300">
              Retry delays: {(data?.sampleRetryDelays ?? []).join('ms, ')}ms
            </p>
            <p className="text-sm text-slate-300">
              Circuit breaker: {data?.sampleCircuitBreaker.status ?? 'unknown'} after {data?.sampleCircuitBreaker.failures ?? 0} failures
            </p>
            <p className="text-sm text-slate-300">
              Per-record isolation: {data?.deterministicRecordRun.inserted ?? 0} succeeded, {data?.deterministicRecordRun.failed ?? 0} isolated failure
            </p>
            <p className="text-sm text-slate-500">
              {data?.integrationStatus}
            </p>
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
