'use client'

import { useEffect, useState } from 'react'

type SoccerPrediction = {
  id: string
  market: string
  selection: string
  americanOdds: number
  line: number | null
  modelProbability: number
  noVigProbability: number
  fairOdds: number
  edge: number
  expectedValue: number
  confidence: number
  recommendation: string
}

type SoccerPredictionResponse = {
  success: boolean
  status: string
  providerUsage: { externalProviderCallsMade: number }
  completionLabels: string[]
  projections: {
    homeWinProbability: number
    drawProbability: number
    awayWinProbability: number
    projectedHomeGoals: number
    projectedAwayGoals: number
    projectedTotalGoals: number
    bothTeamsToScoreProbability: number
    firstHalfTotalGoals: number
    uncertainty: number
  }
  summary: {
    predictionsGenerated: number
    markets: string[]
    averageFeatureQuality: number
    averageDataSufficiency: number
    noLeakage: boolean
    persisted: boolean
    productionRecommendations: boolean
    confidenceCap: number
  }
  compatibility: {
    usesSharedSportPredictionSdkUtilities: boolean
    usesFeatureStoreSnapshot: boolean
    usesRawProviderPayloads: boolean
    persistenceEnabled: boolean
  }
  missingSportSpecificDomains: string[]
  predictions: SoccerPrediction[]
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

export default function SoccerPredictionEnginePanel() {
  const [data, setData] = useState<SoccerPredictionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/soccer/predictions', { cache: 'no-store' })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Unable to load Soccer Prediction Engine')
      }

      setData(json)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load Soccer Prediction Engine')
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
        Loading Soccer Prediction Engine...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-300">
            Soccer Engine
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Prediction Engine V1
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Deterministic 1X2, double chance, draw no bet, totals, BTTS,
            first-half and qualification contracts with three-way probability
            normalization. These are architecture checks, not live picks.
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
        <Stat label="Previews" value={data?.summary.predictionsGenerated ?? 0} />
        <Stat label="Markets" value={data?.summary.markets.length ?? 0} />
        <Stat label="Quality" value={data?.summary.averageFeatureQuality ?? 0} />
        <Stat label="Sufficiency" value={data?.summary.averageDataSufficiency ?? 0} />
        <Stat label="Provider Calls" value={data?.providerUsage.externalProviderCallsMade ?? 0} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Projection label="Home" value={data?.projections.homeWinProbability ?? 0} />
        <Projection label="Draw" value={data?.projections.drawProbability ?? 0} />
        <Projection label="Away" value={data?.projections.awayWinProbability ?? 0} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Home Goals" value={data?.projections.projectedHomeGoals ?? 0} />
        <Stat label="Away Goals" value={data?.projections.projectedAwayGoals ?? 0} />
        <Stat label="Total Goals" value={data?.projections.projectedTotalGoals ?? 0} />
        <Stat label="BTTS Yes" value={`${data?.projections.bothTeamsToScoreProbability ?? 0}%`} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Market Previews</p>
          <div className="mt-4 grid gap-3">
            {(data?.predictions ?? []).slice(0, 8).map((prediction) => (
              <div key={prediction.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black uppercase text-white">{prediction.market}</p>
                    <p className="mt-1 text-xs text-slate-500">{prediction.selection}</p>
                  </div>
                  <p className="text-xs font-black uppercase text-amber-300">{prediction.recommendation}</p>
                </div>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                  <MiniRow label="Odds" value={formatOdds(prediction.americanOdds)} />
                  <MiniRow label="Model" value={`${prediction.modelProbability}%`} />
                  <MiniRow label="No-Vig" value={`${prediction.noVigProbability}%`} />
                  <MiniRow label="Fair" value={formatOdds(prediction.fairOdds)} />
                  <MiniRow label="Edge" value={`${prediction.edge}%`} />
                  <MiniRow label="EV" value={`${prediction.expectedValue}%`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-sm font-black text-white">Compatibility</p>
            <div className="mt-4 grid gap-3">
              <MiniRow label="Shared SDK Utilities" value={data?.compatibility.usesSharedSportPredictionSdkUtilities ? 'yes' : 'no'} />
              <MiniRow label="Feature Snapshot" value={data?.compatibility.usesFeatureStoreSnapshot ? 'yes' : 'no'} />
              <MiniRow label="Raw Provider Payloads" value={data?.compatibility.usesRawProviderPayloads ? 'yes' : 'no'} />
              <MiniRow label="Persists Picks" value={data?.compatibility.persistenceEnabled ? 'yes' : 'no'} />
              <MiniRow label="No Leakage" value={data?.summary.noLeakage ? 'true' : 'false'} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-sm font-black text-white">Missing Domains</p>
            <div className="mt-4 grid gap-3">
              {(data?.missingSportSpecificDomains ?? []).map((domain) => (
                <p key={domain} className="rounded-xl border border-amber-500/20 bg-amber-950/20 px-4 py-3 text-sm font-bold text-amber-100">
                  {domain}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <p className="text-sm font-black text-white">Warnings</p>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {(data?.warnings ?? []).slice(0, 6).map((warning) => (
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

function Projection({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value.toFixed(2)}%</p>
    </div>
  )
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  )
}
