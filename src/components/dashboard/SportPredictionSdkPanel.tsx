'use client'

import { useEffect, useState } from 'react'

type SdkResponse = {
  success: boolean
  status: string
  providerUsage: {
    externalProviderCallsMade: number
  }
  summary: {
    markets: number
    supportedMarkets: number
    unsupportedMarkets: number
    contracts: number
  }
  contracts: Record<string, boolean>
  markets: Array<{
    market: string
    supported: boolean
    requiresLine: boolean
    settlementFamily: string
    warnings: string[]
  }>
  error?: string
}

function statusClass(status: string) {
  if (status === 'ready') return 'text-emerald-300'
  if (status === 'degraded') return 'text-amber-300'
  return 'text-red-300'
}

export default function SportPredictionSdkPanel() {
  const [data, setData] = useState<SdkResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/prediction-sdk', { cache: 'no-store' })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Unable to load Prediction SDK')
      }

      setData(json)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load Prediction SDK'
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
        Loading Shared Prediction SDK...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-300">
            Sport Engine SDK
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Shared Prediction Contracts
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Normalized feature input, prediction output, fair odds, EV, Kelly,
            Smart Ranking, persistence and settlement contracts for sport engines.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className={`text-sm font-black uppercase ${statusClass(data?.status ?? 'unavailable')}`}>
            {data?.status ?? 'unavailable'}
          </p>
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/30 px-4 py-2 text-sm font-bold text-fuchsia-100 hover:bg-fuchsia-900/40"
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
        <Stat label="Markets" value={data?.summary.markets ?? 0} />
        <Stat label="Supported" value={data?.summary.supportedMarkets ?? 0} />
        <Stat label="Contracts" value={data?.summary.contracts ?? 0} />
        <Stat label="Unsupported" value={data?.summary.unsupportedMarkets ?? 0} />
        <Stat
          label="Provider Calls"
          value={data?.providerUsage.externalProviderCallsMade ?? 0}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Market Capabilities</p>
          <div className="mt-4 grid gap-3">
            {(data?.markets ?? []).map((market) => (
              <div
                key={market.market}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-black text-white">{market.market}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {market.settlementFamily} · line required:{' '}
                      {market.requiresLine ? 'yes' : 'no'}
                    </p>
                  </div>
                  <p className={`text-xs font-black uppercase ${market.supported ? 'text-emerald-300' : 'text-red-300'}`}>
                    {market.supported ? 'supported' : 'blocked'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Contracts</p>
          <div className="mt-4 grid gap-3">
            {Object.entries(data?.contracts ?? {}).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm"
              >
                <span className="text-slate-400">{key}</span>
                <span className={value ? 'font-bold text-emerald-300' : 'font-bold text-red-300'}>
                  {value ? 'yes' : 'no'}
                </span>
              </div>
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
