'use client'

import { useEffect, useState } from 'react'

type ApiData = {
  summary: {
    games: number
    confirmedStarters: number
    probableStarters: number
    expectedStarters: number
    questionableStarters: number
    scratchedStarters: number
    unavailableStarters: number
    projectionEligibleStarters: number
    blockedPitcherProjectionSlots: number
  }
  diagnostics: {
    blockerSummary: Record<string, number>
  }
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-white">{value}</p></div>
}

export default function MlbStarterIntelligencePanel() {
  const [data, setData] = useState<ApiData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/mlb/starter-intelligence', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Starter Intelligence failed (${response.status})`)
        return response.json()
      })
      .then((json) => active && setData(json))
      .catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : 'Unable to load Starter Intelligence'))
    return () => {
      active = false
    }
  }, [])

  if (error) return <section className="rounded-lg border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-100">{error}</section>

  const blockers = Object.entries(data?.diagnostics.blockerSummary ?? {}).slice(0, 6)

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">MLB Starter Intelligence</p>
          <h3 className="mt-2 text-xl font-black text-white">Probable Pitcher Recovery</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Canonical starter states, mapping coverage, scratches and pitcher-projection eligibility from stored evidence only.</p>
        </div>
        <a href="/api/mlb/starter-diagnostics" className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800">Diagnostics</a>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Confirmed" value={data?.summary.confirmedStarters ?? '...'} />
        <Stat label="Probable" value={data?.summary.probableStarters ?? '...'} />
        <Stat label="Expected" value={data?.summary.expectedStarters ?? '...'} />
        <Stat label="Unknown" value={data?.summary.unavailableStarters ?? '...'} />
        <Stat label="Questionable" value={data?.summary.questionableStarters ?? '...'} />
        <Stat label="Scratches" value={data?.summary.scratchedStarters ?? '...'} />
        <Stat label="Projection Eligible" value={data?.summary.projectionEligibleStarters ?? '...'} />
        <Stat label="Pitcher Blocks" value={data?.summary.blockedPitcherProjectionSlots ?? '...'} />
      </div>
      <div className="mt-5 flex flex-wrap gap-2 text-xs font-black uppercase text-amber-100">
        {blockers.map(([blocker, count]) => <span key={blocker} className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">{blocker}: {count}</span>)}
      </div>
    </section>
  )
}
