'use client'

import { useEffect, useState } from 'react'

type ApiData = {
  summary: {
    games: number
    eligiblePitchers: number
    eligibleBatters: number
    confirmedStarters: number
    expectedStarters: number
    confirmedLineups: number
    expectedLineups: number
    playerProjectionsGenerated: number
    blockedProjections: number
  }
  blockers: string[]
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-white">{value}</p></div>
}

export default function MlbGameIntelligencePanel() {
  const [data, setData] = useState<ApiData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/mlb/game-intelligence', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Game Intelligence failed (${response.status})`)
        return response.json()
      })
      .then((json) => active && setData(json))
      .catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : 'Unable to load Game Intelligence'))
    return () => {
      active = false
    }
  }, [])

  if (error) return <section className="rounded-lg border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-100">{error}</section>

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Current MLB Lineup Context</p>
          <h3 className="mt-2 text-xl font-black text-white">Game Intelligence</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Starter, expected-lineup and player-projection coverage. Expected lineups are never labelled confirmed.</p>
        </div>
        <a href="/game-intelligence" className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800">Open Page</a>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Games" value={data?.summary.games ?? '...'} />
        <Stat label="Eligible Pitchers" value={data?.summary.eligiblePitchers ?? '...'} />
        <Stat label="Eligible Batters" value={data?.summary.eligibleBatters ?? '...'} />
        <Stat label="Player Projections" value={data?.summary.playerProjectionsGenerated ?? '...'} />
        <Stat label="Confirmed Starters" value={data?.summary.confirmedStarters ?? '...'} />
        <Stat label="Expected Starters" value={data?.summary.expectedStarters ?? '...'} />
        <Stat label="Confirmed Lineups" value={data?.summary.confirmedLineups ?? '...'} />
        <Stat label="Expected Lineups" value={data?.summary.expectedLineups ?? '...'} />
      </div>
      <div className="mt-5 flex flex-wrap gap-2 text-xs font-black uppercase text-amber-100">
        {(data?.blockers ?? []).slice(0, 6).map((blocker) => <span key={blocker} className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">{blocker}</span>)}
      </div>
    </section>
  )
}
