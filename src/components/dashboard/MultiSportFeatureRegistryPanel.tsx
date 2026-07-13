'use client'

import { useEffect, useState } from 'react'

type RegistryResponse = {
  success: boolean
  status: string
  providerUsage: {
    externalProviderCallsMade: number
  }
  summary: {
    featureSets: number
    ready: number
    partial: number
    unsupported: number
    definitions: number
    sports: number
    markets: number
  }
  featureSets: Array<{
    id: string
    sportKey: string
    market: string
    status: string
    ready: boolean
    requiredFeatures: string[]
    optionalFeatures: string[]
    warnings: string[]
  }>
  error?: string
}

function statusClass(status: string) {
  if (status === 'ready') return 'text-emerald-300'
  if (status === 'partial') return 'text-amber-300'
  return 'text-red-300'
}

export default function MultiSportFeatureRegistryPanel() {
  const [data, setData] = useState<RegistryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/features/registry', {
        cache: 'no-store',
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Unable to load feature registry')
      }

      setData(json)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load feature registry'
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
        Loading Multi-Sport Feature Registry...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-lime-300">
            Feature Registry
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Sport Feature Sets
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Maps feature definitions into sport, market and model-specific
            requirements with explicit fallback policies.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className={`text-sm font-black uppercase ${statusClass(data?.status ?? 'unsupported')}`}>
            {data?.status ?? 'unsupported'}
          </p>
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-lime-500/30 bg-lime-950/30 px-4 py-2 text-sm font-bold text-lime-100 hover:bg-lime-900/40"
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
        <Stat label="Feature Sets" value={data?.summary.featureSets ?? 0} />
        <Stat label="Ready" value={data?.summary.ready ?? 0} />
        <Stat label="Partial" value={data?.summary.partial ?? 0} />
        <Stat label="Unsupported" value={data?.summary.unsupported ?? 0} />
        <Stat
          label="Provider Calls"
          value={data?.providerUsage.externalProviderCallsMade ?? 0}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {(data?.featureSets ?? []).slice(0, 9).map((set) => (
          <div
            key={set.id}
            className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-black text-white">{set.sportKey}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {set.market} · {set.requiredFeatures.join(', ')}
                </p>
              </div>
              <p className={`text-xs font-black uppercase ${statusClass(set.status)}`}>
                {set.status}
              </p>
            </div>

            {set.warnings.length ? (
              <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 text-xs leading-5 text-amber-100">
                {set.warnings[0]}
              </p>
            ) : (
              <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3 text-xs leading-5 text-emerald-100">
                Feature set ready for contract-level use.
              </p>
            )}
          </div>
        ))}
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
