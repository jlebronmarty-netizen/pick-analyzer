'use client'

import { useEffect, useState } from 'react'

type UfcPrediction = {
  id: string
  market: string
  selection: string
  opponent: string
  americanOdds: number
  line: number | null
  modelProbability: number
  edge: number
  expectedValue: number
  recommendation: string
}

type UfcPredictionResponse = {
  success: boolean
  status: string
  providerUsage: { externalProviderCallsMade: number }
  summary: {
    predictionsGenerated: number
    markets: string[]
    contractOnlyMarkets: number
    averageFeatureQuality: number
    averageDataSufficiency: number
    noLeakage: boolean
    persisted: boolean
    productionRecommendations: boolean
  }
  compatibility: {
    usesSharedSportPredictionSdk: boolean
    usesRawProviderPayloads: boolean
    persistenceEnabled: boolean
    settlementCompatible: boolean
    methodContractsSettlementCompatible: boolean
  }
  predictions: UfcPrediction[]
  warnings: string[]
  error?: string
}

function statusClass(status: string) {
  if (status === 'ready') return 'text-emerald-300'
  if (status === 'partial' || status === 'degraded') return 'text-amber-300'
  return 'text-red-300'
}

function formatOdds(value: number) {
  return value > 0 ? `+${value}` : String(value)
}

export default function UfcPredictionEnginePanel() {
  const [data, setData] = useState<UfcPredictionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/ufc/predictions', { cache: 'no-store' })
      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Unable to load UFC Prediction Engine')
      }
      setData(json)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load UFC Prediction Engine')
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
        Loading UFC Prediction Engine...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-300">
            UFC Engine
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Prediction Engine V1
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Deterministic moneyline and contract-only method previews using
            shared prediction contracts. Method markets are not settlement-ready
            until combat-specific grading exists.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className={`text-sm font-black uppercase ${statusClass(data?.status ?? 'unavailable')}`}>
            {data?.status ?? 'unavailable'}
          </p>
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-orange-500/30 bg-orange-950/30 px-4 py-2 text-sm font-bold text-orange-100 hover:bg-orange-900/40"
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
        <Stat label="Previews" value={data?.summary.predictionsGenerated ?? 0} />
        <Stat label="Markets" value={data?.summary.markets.length ?? 0} />
        <Stat label="Contract Only" value={data?.summary.contractOnlyMarkets ?? 0} />
        <Stat label="Sufficiency" value={data?.summary.averageDataSufficiency ?? 0} />
        <Stat label="Provider Calls" value={data?.providerUsage.externalProviderCallsMade ?? 0} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {(data?.predictions ?? []).map((prediction) => (
          <div key={prediction.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase text-white">
                  {prediction.market}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {prediction.selection} vs {prediction.opponent}
                </p>
              </div>
              <p className="text-xs font-black uppercase text-amber-300">
                {prediction.recommendation}
              </p>
            </div>
            <div className="mt-4 grid gap-3 text-sm">
              <MiniRow label="Odds" value={formatOdds(prediction.americanOdds)} />
              <MiniRow label="Model" value={`${prediction.modelProbability}%`} />
              <MiniRow label="Edge" value={`${prediction.edge}%`} />
              <MiniRow label="EV" value={`${prediction.expectedValue}%`} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Compatibility</p>
          <div className="mt-4 grid gap-3">
            <MiniRow label="Shared SDK" value={data?.compatibility.usesSharedSportPredictionSdk ? 'yes' : 'no'} />
            <MiniRow label="Raw Provider Payloads" value={data?.compatibility.usesRawProviderPayloads ? 'yes' : 'no'} />
            <MiniRow label="Persists Picks" value={data?.compatibility.persistenceEnabled ? 'yes' : 'no'} />
            <MiniRow label="Moneyline Settlement" value={data?.compatibility.settlementCompatible ? 'yes' : 'no'} />
            <MiniRow label="Method Settlement" value={data?.compatibility.methodContractsSettlementCompatible ? 'yes' : 'no'} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Warnings</p>
          <div className="mt-4 grid gap-3">
            {(data?.warnings ?? []).slice(0, 4).map((warning) => (
              <p key={warning} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm leading-6 text-slate-300">
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
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  )
}
