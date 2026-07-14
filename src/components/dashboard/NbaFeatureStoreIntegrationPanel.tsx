'use client'

import { useEffect, useState } from 'react'

type NbaFeatureStoreResponse = {
  success: boolean
  status: string
  providerUsage: {
    externalProviderCallsMade: number
  }
  summary: {
    nbaDefinitions: number
    featureSets: number
    readyFeatureSets: number
    previewQuality: number
    previewSufficiency: number
    previewNoLeakage: boolean
    recentPredictionRows: number
    compatiblePredictionSnapshots: number
    injuryFeedStatus: string
    activeInjuryCount: number
    unresolvedInjuryPlayers: number
    unresolvedInjuryTeams: number
    injuryFreshnessMinutes: number | null
    injuryConfidencePenalty: number
    injuryProductionEligible: boolean
    lineupFeedStatus: string
    playerStatsStatus: string
    playerStatsRows: number
    playerStatsSeasonRows: number
    playerStatsGameRows: number
    playerStatsUnresolvedPlayers: number
    playerStatsTrialRows: number
    playerStatsCanImproveProductionConfidence: boolean
  }
  compatibility: {
    usesExistingPredictionHistoryFeatureSnapshot: boolean
    changesPredictionGeneration: boolean
    requiresMigration: boolean
    durableFeatureStorePersistence: boolean
  }
  warnings: string[]
  error?: string
}

function statusClass(status: string) {
  if (status === 'ready') return 'text-emerald-300'
  if (status === 'degraded') return 'text-amber-300'
  return 'text-red-300'
}

export default function NbaFeatureStoreIntegrationPanel() {
  const [data, setData] = useState<NbaFeatureStoreResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/nba/features/store', {
        cache: 'no-store',
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Unable to load NBA Feature Store')
      }

      setData(json)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load NBA Feature Store'
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
        Loading NBA Feature Store...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-300">
            NBA Features
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Feature Store Integration
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Confirms NBA feature snapshots are compatible with Feature Store
            Core contracts without changing prediction generation.
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
        <Stat label="Definitions" value={data?.summary.nbaDefinitions ?? 0} />
        <Stat label="Ready Sets" value={data?.summary.readyFeatureSets ?? 0} />
        <Stat label="Quality" value={data?.summary.previewQuality ?? 0} />
        <Stat label="Sufficiency" value={data?.summary.previewSufficiency ?? 0} />
        <Stat
          label="Provider Calls"
          value={data?.providerUsage.externalProviderCallsMade ?? 0}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Compatibility</p>
          <div className="mt-4 grid gap-3">
            <MiniRow
              label="Existing Snapshot Column"
              value={
                data?.compatibility.usesExistingPredictionHistoryFeatureSnapshot
                  ? 'yes'
                  : 'no'
              }
            />
            <MiniRow
              label="Changes Prediction Engine"
              value={data?.compatibility.changesPredictionGeneration ? 'yes' : 'no'}
            />
            <MiniRow
              label="Requires Migration"
              value={data?.compatibility.requiresMigration ? 'yes' : 'no'}
            />
            <MiniRow
              label="Preview No Leakage"
              value={data?.summary.previewNoLeakage ? 'true' : 'false'}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Stored Snapshot Readiness</p>
          <div className="mt-4 grid gap-3">
            <MiniRow
              label="Recent Rows"
              value={String(data?.summary.recentPredictionRows ?? 0)}
            />
            <MiniRow
              label="Compatible"
              value={String(data?.summary.compatiblePredictionSnapshots ?? 0)}
            />
          </div>
          <div className="mt-4 grid gap-3">
            {(data?.warnings ?? []).slice(0, 3).map((warning) => (
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

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <p className="text-sm font-black text-white">Injury, Lineup & Player-Stat Confidence</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MiniRow
            label="Injury Feed"
            value={data?.summary.injuryFeedStatus ?? 'unknown'}
          />
          <MiniRow
            label="Active Injuries"
            value={String(data?.summary.activeInjuryCount ?? 0)}
          />
          <MiniRow
            label="Unresolved Players"
            value={String(data?.summary.unresolvedInjuryPlayers ?? 0)}
          />
          <MiniRow
            label="Unresolved Teams"
            value={String(data?.summary.unresolvedInjuryTeams ?? 0)}
          />
          <MiniRow
            label="Freshness"
            value={
              data?.summary.injuryFreshnessMinutes === null ||
              data?.summary.injuryFreshnessMinutes === undefined
                ? 'unavailable'
                : `${data.summary.injuryFreshnessMinutes}m`
            }
          />
          <MiniRow
            label="Confidence Penalty"
            value={String(data?.summary.injuryConfidencePenalty ?? 0)}
          />
          <MiniRow
            label="Production Eligible"
            value={data?.summary.injuryProductionEligible ? 'yes' : 'no'}
          />
          <MiniRow
            label="Lineups"
            value={data?.summary.lineupFeedStatus ?? 'unknown'}
          />
          <MiniRow
            label="Player Stats"
            value={data?.summary.playerStatsStatus ?? 'unknown'}
          />
          <MiniRow
            label="Stat Rows"
            value={String(data?.summary.playerStatsRows ?? 0)}
          />
          <MiniRow
            label="Season/Game"
            value={`${data?.summary.playerStatsSeasonRows ?? 0}/${data?.summary.playerStatsGameRows ?? 0}`}
          />
          <MiniRow
            label="Stat Trial Rows"
            value={String(data?.summary.playerStatsTrialRows ?? 0)}
          />
          <MiniRow
            label="Stat Unresolved"
            value={String(data?.summary.playerStatsUnresolvedPlayers ?? 0)}
          />
          <MiniRow
            label="Stats Lift Confidence"
            value={data?.summary.playerStatsCanImproveProductionConfidence ? 'yes' : 'no'}
          />
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
