'use client'

import { useEffect, useMemo, useState } from 'react'

type Projection = {
  projectionId: string
  playerName: string
  team: string | null
  opponent: string | null
  projectionLabel?: string
  projectionType: string
  expectedValue: number | null
  medianEstimate: number | null
  lowRange: number | null
  highRange: number | null
  confidence: number
  lineupOrStarterStatus: string
  exactBlockerReasons: string[]
  probabilityDistribution: { method: string; buckets: Array<{ label: string; probability: number }> }
  explanation: string
}

type ApiData = {
  success: boolean
  generatedAt: string
  summary: {
    eligibleGames: number
    playersEvaluated: number
    projectionsGenerated: number
    pitcherProjections: number
    batterProjections: number
    blockedProjections: number
    averageConfidence: number | null
  }
  currentSlate: {
    lineupAndStarterCoverage: {
      confirmedStarters: number
      probableStarters: number
      expectedStarters: number
      confirmedLineups: number
      expectedLineups: string
    }
    blockerSummary: Record<string, number>
  }
  projections: Projection[]
  providerCallsMade: number
  remoteMutationsMade: number
}

function Stat({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value ?? 'N/A'}</p>
    </div>
  )
}

export default function MlbPlayerProjectionsPanel() {
  const [data, setData] = useState<ApiData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/mlb/player-projections?limit=80', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Player projections failed (${response.status})`)
        return response.json()
      })
      .then((json) => active && setData(json))
      .catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : 'Unable to load player projections'))
    return () => {
      active = false
    }
  }, [])

  const blockers = useMemo(() => Object.entries(data?.currentSlate.blockerSummary ?? {}).slice(0, 6), [data])

  if (error) return <section className="rounded-lg border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-100">{error}</section>

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">MLB Player Projection Engine</p>
          <h3 className="mt-2 text-xl font-black text-white">Player Projections</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Informational player stat projections with ranges and probability buckets. No sportsbook comparison, EV or Official Picks.
          </p>
        </div>
        <a href="/player-projections" className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800">
          Open Page
        </a>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Players Evaluated" value={data?.summary.playersEvaluated ?? '...'} />
        <Stat label="Pitchers Projected" value={data?.summary.pitcherProjections ?? '...'} />
        <Stat label="Batters Projected" value={data?.summary.batterProjections ?? '...'} />
        <Stat label="Blocked" value={data?.summary.blockedProjections ?? '...'} />
        <Stat label="Confirmed Starters" value={data?.currentSlate.lineupAndStarterCoverage.confirmedStarters ?? '...'} />
        <Stat label="Expected Starters" value={data?.currentSlate.lineupAndStarterCoverage.expectedStarters ?? '...'} />
        <Stat label="Confirmed Lineups" value={data?.currentSlate.lineupAndStarterCoverage.confirmedLineups ?? '...'} />
        <Stat label="Avg Confidence" value={data?.summary.averageConfidence ?? '...'} />
      </div>

      <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Top Blockers</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-amber-200">
          {blockers.length ? blockers.map(([label, value]) => <span key={label} className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">{label}: {value}</span>) : <span>No blockers reported.</span>}
        </div>
      </div>
    </section>
  )
}
