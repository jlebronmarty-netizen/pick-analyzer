'use client'

import { useEffect, useState } from 'react'

type ProviderSummary = {
  id: string
  name: string
  health: 'healthy' | 'degraded' | 'unavailable'
  costTier: string
  requiresAuth: boolean
  sportCoverage: string[]
  features: string[]
  averageScore: number
  supportedCapabilities: number
  partialCapabilities: number
  unavailableReason: string | null
}

type CapabilitySummary = {
  dataType: string
  supported: number
  partial: number
  unsupported: number
  bestProvider: {
    providerName: string
    sportKey: string
    support: string
    health: string
    totalScore: number
  } | null
}

type IntelligenceResponse = {
  success: boolean
  status: string
  providerUsage: {
    externalProviderCallsMade: number
    source: string
  }
  summary: {
    providers: number
    sports: number
    dataTypes: number
    capabilities: number
    healthyProviders: number
    degradedProviders: number
    unavailableProviders: number
  }
  providers: ProviderSummary[]
  capabilitySummaryByDataType: CapabilitySummary[]
  error?: string
}

type RoutePlanResponse = {
  success: boolean
  supported?: boolean
  selectedProvider: {
    providerName: string
    support: string
    health: string
    totalScore: number
    warnings: string[]
  } | null
  explanation: string[]
}

function statusClass(status: string) {
  if (status === 'healthy') return 'text-emerald-300'
  if (status === 'degraded') return 'text-amber-300'
  return 'text-red-300'
}

export default function ProviderIntelligencePanel() {
  const [data, setData] = useState<IntelligenceResponse | null>(null)
  const [routePlan, setRoutePlan] = useState<RoutePlanResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const [intelligenceResponse, routePlanResponse] = await Promise.all([
        fetch('/api/providers/intelligence', { cache: 'no-store' }),
        fetch(
          '/api/providers/route-plan?sport=basketball_nba&league=nba&dataType=odds&market=moneyline',
          { cache: 'no-store' }
        ),
      ])
      const intelligenceJson = await intelligenceResponse.json()
      const routePlanJson = await routePlanResponse.json()

      if (!intelligenceResponse.ok || !intelligenceJson.success) {
        throw new Error(
          intelligenceJson.error ?? 'Unable to load provider intelligence'
        )
      }

      setData(intelligenceJson)
      setRoutePlan(routePlanJson)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load provider intelligence'
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
        Loading Provider Intelligence...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-300">
            Provider Intelligence
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Capability Routing
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Inventories configured providers, scores capability coverage and plans dry-run routing without external calls.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className={`text-sm font-black uppercase ${statusClass(data?.status ?? 'unavailable')}`}>
            {data?.status ?? 'unavailable'}
          </p>
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-teal-500/30 bg-teal-950/30 px-4 py-2 text-sm font-bold text-teal-100 hover:bg-teal-900/40"
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
        <Stat label="Providers" value={data?.summary.providers ?? 0} />
        <Stat label="Sports" value={data?.summary.sports ?? 0} />
        <Stat label="Data Types" value={data?.summary.dataTypes ?? 0} />
        <Stat label="Capabilities" value={data?.summary.capabilities ?? 0} />
        <Stat
          label="Provider Calls"
          value={data?.providerUsage.externalProviderCallsMade ?? 0}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Provider Scores</p>
          <div className="mt-4 grid gap-3">
            {data?.providers.map((provider) => (
              <div
                key={provider.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-black text-white">{provider.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {provider.sportCoverage.length} sports · {provider.features.join(', ')}
                    </p>
                    {provider.unavailableReason ? (
                      <p className="mt-2 text-xs text-amber-300">
                        {provider.unavailableReason}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-left md:text-right">
                    <p className={`text-sm font-black uppercase ${statusClass(provider.health)}`}>
                      {provider.health}
                    </p>
                    <p className="text-xs text-slate-500">
                      score {provider.averageScore} · {provider.costTier}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Dry-Run Route</p>
          <p className="mt-1 text-xs text-slate-500">
            basketball_nba · odds · moneyline
          </p>

          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Selected Provider
            </p>
            <p className="mt-2 text-xl font-black text-white">
              {routePlan?.selectedProvider?.providerName ?? 'No provider'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {routePlan?.selectedProvider
                ? `${routePlan.selectedProvider.support} · score ${routePlan.selectedProvider.totalScore}`
                : 'Unsupported request'}
            </p>
          </div>

          <div className="mt-4 grid gap-2">
            {(routePlan?.explanation ?? []).slice(0, 5).map((item) => (
              <p key={item} className="text-sm text-slate-300">
                {item}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <p className="text-sm font-black text-white">Capability Summary</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data?.capabilitySummaryByDataType.slice(0, 12).map((item) => (
            <div
              key={item.dataType}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
            >
              <p className="text-sm font-bold text-white">
                {item.dataType.replaceAll('_', ' ')}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {item.supported} supported · {item.partial} partial
              </p>
              <p className="mt-2 text-xs text-teal-200">
                {item.bestProvider?.providerName ?? 'No provider'}
              </p>
            </div>
          ))}
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
