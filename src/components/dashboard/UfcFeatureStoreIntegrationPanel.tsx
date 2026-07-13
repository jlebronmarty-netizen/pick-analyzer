'use client'

import { useEffect, useState } from 'react'

type UfcFeatureStoreResponse = {
  success: boolean
  status: string
  providerUsage: { externalProviderCallsMade: number }
  summary: {
    ufcDefinitions: number
    featureSets: number
    readyFeatureSets: number
    partialFeatureSets: number
    previewQuality: number
    previewSufficiency: number
    previewNoLeakage: boolean
    storedEventsRows: number
    storedOddsRows: number
    storedPredictionRows: number
  }
  missingSportSpecificDomains: string[]
  warnings: string[]
  error?: string
}

function statusClass(status: string) {
  if (status === 'ready') return 'text-emerald-300'
  if (status === 'partial' || status === 'degraded') return 'text-amber-300'
  return 'text-red-300'
}

export default function UfcFeatureStoreIntegrationPanel() {
  const [data, setData] = useState<UfcFeatureStoreResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/ufc/features/store', { cache: 'no-store' })
      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Unable to load UFC Feature Store')
      }
      setData(json)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load UFC Feature Store')
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
        Loading UFC Feature Store...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-300">
            UFC Features
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Feature Store Integration
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Verifies UFC can use shared feature contracts while fighter form,
            camp, injury, method and weigh-in gaps remain explicit.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className={`text-sm font-black uppercase ${statusClass(data?.status ?? 'unavailable')}`}>
            {data?.status ?? 'unavailable'}
          </p>
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-2 text-sm font-bold text-red-100 hover:bg-red-900/40"
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
        <Stat label="Definitions" value={data?.summary.ufcDefinitions ?? 0} />
        <Stat label="Partial Sets" value={data?.summary.partialFeatureSets ?? 0} />
        <Stat label="Quality" value={data?.summary.previewQuality ?? 0} />
        <Stat label="Sufficiency" value={data?.summary.previewSufficiency ?? 0} />
        <Stat label="Provider Calls" value={data?.providerUsage.externalProviderCallsMade ?? 0} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Stored Readiness</p>
          <div className="mt-4 grid gap-3">
            <MiniRow label="Events" value={String(data?.summary.storedEventsRows ?? 0)} />
            <MiniRow label="Odds" value={String(data?.summary.storedOddsRows ?? 0)} />
            <MiniRow label="Predictions" value={String(data?.summary.storedPredictionRows ?? 0)} />
            <MiniRow label="No Leakage" value={data?.summary.previewNoLeakage ? 'true' : 'false'} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Missing UFC Domains</p>
          <div className="mt-4 grid gap-3">
            {(data?.missingSportSpecificDomains ?? []).map((domain) => (
              <p key={domain} className="rounded-xl border border-amber-500/20 bg-amber-950/20 px-4 py-3 text-sm font-bold text-amber-100">
                {domain}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <p className="text-sm font-black text-white">Warnings</p>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {(data?.warnings ?? []).slice(0, 4).map((warning) => (
            <p key={warning} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm leading-6 text-slate-300">
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
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
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
