'use client'

import { useEffect, useState } from 'react'

type ReadinessResponse = {
  success: boolean
  providerCallsMade: number
  remoteMutationsMade: number
  summary: {
    propsAudited: number
    settlementReadyProps: number
    currentOddsReadyProps: number
    productionReadyProps: number
    blockedProps: number
    overallStatus: string
  }
  storedCoverage: {
    sportPlayers: number
    playerMappings: number
    currentPropOdds: number
    historicalPropOdds: number
    openingPropOdds: number
    closingPropOdds: number
  }
  blockerSummary: Record<string, number>
  certifications: Record<string, boolean>
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

export default function MlbPlayerPropsReadinessPanel() {
  const [data, setData] = useState<ReadinessResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const response = await fetch('/api/mlb/player-props/readiness', { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error?.message ?? 'Unable to load MLB player props readiness')
        if (active) {
          setData(json)
          setError(null)
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load MLB player props readiness')
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const blockers = Object.entries(data?.blockerSummary ?? {}).slice(0, 6)

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">MLB Player Props</p>
          <h3 className="mt-2 text-xl font-black text-white">Data Readiness Audit</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Audit-only prop coverage for settlement data, player mapping, sportsbook odds and provider blockers.
          </p>
        </div>
        <a
          href="/api/mlb/player-props/readiness"
          className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800"
        >
          Readiness API
        </a>
      </div>

      {error ? <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200">{error}</div> : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Props Audited" value={data?.summary.propsAudited ?? '...'} />
        <Stat label="Settlement Ready" value={data?.summary.settlementReadyProps ?? '...'} />
        <Stat label="Current Odds Ready" value={data?.summary.currentOddsReadyProps ?? '...'} />
        <Stat label="Production Ready" value={data?.summary.productionReadyProps ?? '...'} />
        <Stat label="Blocked Props" value={data?.summary.blockedProps ?? '...'} />
        <Stat label="Stored Prop Odds" value={data?.storedCoverage.historicalPropOdds ?? '...'} />
        <Stat label="Player Mappings" value={data?.storedCoverage.playerMappings ?? '...'} />
        <Stat label="Provider Calls" value={data?.providerCallsMade ?? '...'} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Status</p>
          <p className="mt-3 text-sm font-bold text-amber-100">{data?.summary.overallStatus ?? 'Loading'}</p>
          <p className="mt-2 text-sm text-slate-400">
            Props stay outside predictions, Best Value, Official Picks, Learning Brain and production model weights.
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Top Blockers</p>
          <div className="mt-3 space-y-2 text-xs text-amber-200">
            {blockers.length ? blockers.map(([label, value]) => <p key={label}>{label}: {value}</p>) : <p>No blockers reported.</p>}
          </div>
        </div>
      </div>
    </section>
  )
}
