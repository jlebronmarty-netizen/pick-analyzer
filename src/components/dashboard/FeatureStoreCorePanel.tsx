'use client'

import { useEffect, useState } from 'react'

type FeatureStoreResponse = {
  success: boolean
  status: string
  providerUsage: {
    externalProviderCallsMade: number
  }
  summary: {
    definitions: number
    requiredDefinitions: number
    optionalDefinitions: number
    featureQualityScore: number
    dataSufficiencyScore: number
    noLeakage: boolean
    validationPassed: boolean
  }
  capabilities: Record<string, boolean>
  definitions: Array<{
    key: string
    displayName: string
    version: string
    required: boolean
    maxAgeMinutes: number
    sourceTables: string[]
  }>
  validation: {
    summary: {
      detectedLeakage: boolean
      leakageSnapshotIssues: number
    }
  }
  warnings: string[]
  error?: string
}

function statusClass(status: string) {
  if (status === 'ready') return 'text-emerald-300'
  if (status === 'degraded') return 'text-amber-300'
  return 'text-red-300'
}

export default function FeatureStoreCorePanel() {
  const [data, setData] = useState<FeatureStoreResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/features/store', { cache: 'no-store' })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Unable to load Feature Store Core')
      }

      setData(json)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load Feature Store Core'
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
        Loading Feature Store Core...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
            Feature Store
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Core Definitions
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Versioned pre-event features with freshness, provenance, sample
            size, data quality, cutoff timestamps and leakage validation.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className={`text-sm font-black uppercase ${statusClass(data?.status ?? 'unavailable')}`}>
            {data?.status ?? 'unavailable'}
          </p>
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-900/40"
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
        <Stat label="Definitions" value={data?.summary.definitions ?? 0} />
        <Stat label="Quality" value={data?.summary.featureQualityScore ?? 0} />
        <Stat label="Sufficiency" value={data?.summary.dataSufficiencyScore ?? 0} />
        <Stat
          label="Leakage Test"
          value={data?.summary.validationPassed ? 'pass' : 'check'}
        />
        <Stat
          label="Provider Calls"
          value={data?.providerUsage.externalProviderCallsMade ?? 0}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Feature Definitions</p>
          <div className="mt-4 grid gap-3">
            {(data?.definitions ?? []).map((definition) => (
              <div
                key={definition.key}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-black text-white">
                      {definition.displayName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {definition.key} · v{definition.version} ·{' '}
                      {definition.sourceTables.join(', ')}
                    </p>
                  </div>
                  <p className="text-xs font-black uppercase text-slate-400">
                    {definition.required ? 'required' : 'optional'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Validation</p>
          <div className="mt-4 grid gap-3">
            <MiniRow
              label="No Leakage"
              value={data?.summary.noLeakage ? 'true' : 'false'}
            />
            <MiniRow
              label="Leakage Detected"
              value={data?.validation.summary.detectedLeakage ? 'true' : 'false'}
            />
            <MiniRow
              label="Durable Persistence"
              value={data?.capabilities.durablePersistence ? 'enabled' : 'deferred'}
            />
            <MiniRow
              label="Provider Calls"
              value={String(data?.providerUsage.externalProviderCallsMade ?? 0)}
            />
          </div>

          <div className="mt-4 grid gap-3">
            {(data?.warnings ?? []).map((warning) => (
              <p
                key={warning}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm leading-6 text-slate-300"
              >
                {warning}
              </p>
            ))}
          </div>
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
