'use client'

import { useEffect, useState } from 'react'

type SdkResponse = {
  success: boolean
  status: string
  providerUsage: {
    externalProviderCallsMade: number
  }
  summary: {
    endpoints: number
    requiredEndpoints: number
    optionalEndpoints: number
    capabilities: number
    configuredProviderCapabilities: number
    fixtureValidationErrors: number
    fixtureValidationWarnings: number
  }
  contract: {
    endpoints: Array<{
      name: string
      dataType: string
      required: boolean
      normalizedReturnType: string
    }>
  }
  guardrails: string[]
  error?: string
}

function statusClass(status: string) {
  if (status === 'ready') return 'text-emerald-300'
  if (status === 'degraded') return 'text-amber-300'
  return 'text-red-300'
}

export default function ProviderAdapterSdkPanel() {
  const [data, setData] = useState<SdkResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/providers/sdk', { cache: 'no-store' })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Unable to load Provider Adapter SDK')
      }

      setData(json)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load Provider Adapter SDK'
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
        Loading Provider Adapter SDK...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
            Provider SDK
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Adapter Contract
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Defines provider capabilities, auth, pagination, retry hints and
            normalized return models before live premium data is enabled.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className={`text-sm font-black uppercase ${statusClass(data?.status ?? 'unavailable')}`}>
            {data?.status ?? 'unavailable'}
          </p>
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-sky-500/30 bg-sky-950/30 px-4 py-2 text-sm font-bold text-sky-100 hover:bg-sky-900/40"
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
        <Stat label="Endpoints" value={data?.summary.endpoints ?? 0} />
        <Stat label="Required" value={data?.summary.requiredEndpoints ?? 0} />
        <Stat label="Optional" value={data?.summary.optionalEndpoints ?? 0} />
        <Stat label="Fixture Errors" value={data?.summary.fixtureValidationErrors ?? 0} />
        <Stat
          label="Provider Calls"
          value={data?.providerUsage.externalProviderCallsMade ?? 0}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">SDK Endpoints</p>
          <div className="mt-4 grid gap-3">
            {(data?.contract.endpoints ?? []).slice(0, 9).map((endpoint) => (
              <div
                key={endpoint.name}
                className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-black text-white">{endpoint.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {endpoint.dataType} · {endpoint.normalizedReturnType}
                  </p>
                </div>
                <p className="text-xs font-black uppercase text-slate-400">
                  {endpoint.required ? 'required' : 'optional'}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Guardrails</p>
          <div className="mt-4 grid gap-3">
            {(data?.guardrails ?? []).map((guardrail) => (
              <p
                key={guardrail}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm leading-6 text-slate-300"
              >
                {guardrail}
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
