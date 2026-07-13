'use client'

import { useEffect, useState } from 'react'

type MlbPrediction = {
  id: string
  market: string
  selection: string
  opponent: string
  americanOdds: number
  line: number | null
  modelProbability: number
  impliedProbability: number
  edge: number
  expectedValue: number
  confidence: number
  recommendation: string
  featureQualityScore: number
  dataSufficiencyScore: number
}

type MlbPredictionResponse = {
  success: boolean
  status: string
  providerUsage: {
    externalProviderCallsMade: number
  }
  completionLabels: string[]
  summary: {
    predictionsGenerated: number
    recommended: number
    markets: string[]
    averageFeatureQuality: number
    averageDataSufficiency: number
    noLeakage: boolean
    persisted: boolean
    productionRecommendations: boolean
  }
  compatibility: {
    usesSharedSportPredictionSdk: boolean
    usesFeatureStoreSnapshot: boolean
    usesRawProviderPayloads: boolean
    requiresMigration: boolean
    persistenceEnabled: boolean
    settlementCompatible: boolean
  }
  predictions: MlbPrediction[]
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

export default function MlbPredictionEnginePanel() {
  const [data, setData] = useState<MlbPredictionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/mlb/predictions', {
        cache: 'no-store',
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Unable to load MLB Prediction Engine')
      }

      setData(json)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load MLB Prediction Engine'
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
        Loading MLB Prediction Engine...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-lime-300">
            MLB Engine
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Prediction Engine V1
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Deterministic moneyline, run line and total previews using the
            Shared Prediction SDK and MLB Feature Store contracts. These are
            architecture checks, not live betting recommendations.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className={`text-sm font-black uppercase ${statusClass(data?.status ?? 'unavailable')}`}>
            {data?.status ?? 'unavailable'}
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
        <Stat label="Previews" value={data?.summary.predictionsGenerated ?? 0} />
        <Stat label="Markets" value={data?.summary.markets.length ?? 0} />
        <Stat label="Quality" value={data?.summary.averageFeatureQuality ?? 0} />
        <Stat label="Sufficiency" value={data?.summary.averageDataSufficiency ?? 0} />
        <Stat
          label="Provider Calls"
          value={data?.providerUsage.externalProviderCallsMade ?? 0}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {(data?.predictions ?? []).map((prediction) => (
          <div
            key={prediction.id}
            className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
          >
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
              <MiniRow label="Line" value={prediction.line === null ? '-' : String(prediction.line)} />
              <MiniRow label="Model" value={`${prediction.modelProbability}%`} />
              <MiniRow label="Implied" value={`${prediction.impliedProbability}%`} />
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
            <MiniRow
              label="Shared SDK"
              value={data?.compatibility.usesSharedSportPredictionSdk ? 'yes' : 'no'}
            />
            <MiniRow
              label="Feature Snapshot"
              value={data?.compatibility.usesFeatureStoreSnapshot ? 'yes' : 'no'}
            />
            <MiniRow
              label="Raw Provider Payloads"
              value={data?.compatibility.usesRawProviderPayloads ? 'yes' : 'no'}
            />
            <MiniRow
              label="Persists Picks"
              value={data?.compatibility.persistenceEnabled ? 'yes' : 'no'}
            />
            <MiniRow
              label="No Leakage"
              value={data?.summary.noLeakage ? 'true' : 'false'}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Warnings</p>
          <div className="mt-4 grid gap-3">
            {(data?.warnings ?? []).slice(0, 4).map((warning) => (
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
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  )
}
