'use client'

import { useEffect, useState } from 'react'

type Projection = {
  projectionId: string
  playerName: string
  team: string | null
  opponent: string | null
  projectionType: string
  projectionLabel?: string
  expectedValue: number | null
  medianEstimate: number | null
  lowRange: number | null
  highRange: number | null
  confidence: number
  dataSufficiency: number
  featureQuality: number
  lineupOrStarterStatus: string
  lineupStatus?: string | null
  lineupSource?: string | null
  battingOrder?: number | null
  probabilityDistribution: { method: string; buckets: Array<{ label: string; probability: number }> }
  thresholdProbabilities: Array<{ threshold: number; probabilityAtLeast: number | null }>
  exactBlockerReasons: string[]
  explanation: string
  supportingFeatures: Array<{ feature: string; status: string; contribution: number; explanation: string }>
}

type ApiData = {
  projection: Projection
}

function Stat({ label, value }: { label: string; value: string | number | null }) {
  return <div className="rounded-lg border border-slate-800 bg-slate-900 p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-white">{value ?? 'N/A'}</p></div>
}

export default function MlbPlayerProjectionDetailClient({ projectionId }: { projectionId: string }) {
  const [data, setData] = useState<ApiData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch(`/api/mlb/player-projections/${encodeURIComponent(projectionId)}`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Projection detail failed (${response.status})`)
        return response.json()
      })
      .then((json) => active && setData(json))
      .catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : 'Unable to load projection detail'))
    return () => {
      active = false
    }
  }, [projectionId])

  if (error) return <main className="min-h-screen bg-slate-950 p-6 text-red-100">{error}</main>
  if (!data) return <main className="min-h-screen bg-slate-950 p-6 text-slate-300">Loading player projection...</main>

  const projection = data.projection
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-6xl">
        <a href="/player-projections" className="text-sm font-bold text-emerald-200 hover:text-emerald-100">Back to player projections</a>
        <div className="mt-4 border-b border-slate-800 pb-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Player Projection Detail</p>
          <h1 className="mt-2 text-3xl font-black md:text-5xl">{projection.playerName}</h1>
          <p className="mt-2 text-sm text-slate-400">{projection.team ?? 'Team'} vs {projection.opponent ?? 'Opponent'} - {projection.projectionLabel ?? projection.projectionType}</p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <Stat label="Expected" value={projection.expectedValue} />
          <Stat label="Median" value={projection.medianEstimate} />
          <Stat label="Range" value={`${projection.lowRange ?? 'N/A'}-${projection.highRange ?? 'N/A'}`} />
          <Stat label="Confidence" value={`${Math.round(projection.confidence)}%`} />
          <Stat label="Feature Quality" value={Math.round(projection.featureQuality)} />
          <Stat label="Data Sufficiency" value={Math.round(projection.dataSufficiency)} />
          <Stat label="Lineup Status" value={projection.lineupStatus ?? projection.lineupOrStarterStatus} />
          <Stat label="Batting Order" value={projection.battingOrder ?? 'N/A'} />
        </div>

        <section className="mt-5 rounded-lg border border-slate-800 bg-slate-900/75 p-5">
          <h2 className="text-xl font-black">Distribution</h2>
          <p className="mt-1 text-sm text-slate-400">{projection.probabilityDistribution.method}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {projection.probabilityDistribution.buckets.map((bucket) => <Stat key={bucket.label} label={bucket.label} value={`${Math.round(bucket.probability * 100)}%`} />)}
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-slate-800 bg-slate-900/75 p-5">
          <h2 className="text-xl font-black">Projection Evidence</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">{projection.explanation}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {projection.supportingFeatures.map((feature) => (
              <div key={feature.feature} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <p className="text-sm font-black text-white">{feature.feature}</p>
                <p className="mt-1 text-xs font-bold uppercase text-slate-500">{feature.status} - {feature.contribution}</p>
                <p className="mt-2 text-sm text-slate-400">{feature.explanation}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-slate-800 bg-slate-900/75 p-5">
          <h2 className="text-xl font-black">Readiness</h2>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black uppercase">
            {projection.exactBlockerReasons.map((reason) => <span key={reason} className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-100">{reason}</span>)}
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sky-100">No sportsbook comparison</span>
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sky-100">No Official Pick</span>
          </div>
        </section>
      </div>
    </main>
  )
}
