'use client'

import { useEffect, useState } from 'react'

type InventoryResponse = {
  success: boolean
  providerCallsMade: number
  remoteMutationsMade: number
  inventory: {
    todaysMarkets: number
    supportedMarkets: number
    blockedMarkets: number
    shadowMarkets: number
    productionMarkets: number
  }
  analytics: {
    totalMarkets: number
    canonicalMarketTypes: number
    marketsByReadiness: Record<string, number>
  }
  providerCoverage: {
    providers: string[]
    sportsbooks: string[]
  }
  blockerSummary: Record<string, number>
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

export default function UniversalMarketCoveragePanel() {
  const [data, setData] = useState<InventoryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const response = await fetch('/api/markets/inventory', { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error?.message ?? 'Unable to load market inventory')
        if (active) {
          setData(json)
          setError(null)
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load market inventory')
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Universal Market Intelligence</p>
          <h3 className="mt-2 text-xl font-black text-white">Market Coverage</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Provider-independent inventory for discovered, supported, shadow-ready and blocked markets.
          </p>
        </div>
        <a
          href="/api/markets/inventory"
          className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800"
        >
          Inventory API
        </a>
      </div>

      {error ? <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200">{error}</div> : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Today's Markets" value={data?.inventory.todaysMarkets ?? '...'} />
        <Stat label="Supported" value={data?.inventory.supportedMarkets ?? '...'} />
        <Stat label="Prediction Ready" value={data?.inventory.productionMarkets ?? '...'} />
        <Stat label="Official Pick Ready" value={data?.inventory.productionMarkets ?? '...'} />
        <Stat label="Shadow Markets" value={data?.inventory.shadowMarkets ?? '...'} />
        <Stat label="Blocked Markets" value={data?.inventory.blockedMarkets ?? '...'} />
        <Stat label="Canonical Types" value={data?.analytics.canonicalMarketTypes ?? '...'} />
        <Stat label="Provider Calls" value={data?.providerCallsMade ?? '...'} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Readiness</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            {Object.entries(data?.analytics.marketsByReadiness ?? {}).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2">
                <span className="text-slate-300">{label}</span>
                <span className="font-black text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Provider Status</p>
          <p className="mt-3 text-sm text-slate-300">Providers: {(data?.providerCoverage.providers ?? []).join(', ') || '...'}</p>
          <p className="mt-2 text-sm text-slate-300">Sportsbooks: {(data?.providerCoverage.sportsbooks ?? []).join(', ') || '...'}</p>
          <div className="mt-3 space-y-2 text-xs text-amber-200">
            {Object.entries(data?.blockerSummary ?? {}).filter(([label]) => label !== 'NONE').slice(0, 5).map(([label, value]) => (
              <p key={label}>{label}: {value}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
