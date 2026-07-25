'use client'

import { useEffect, useState } from 'react'

type Projection = {
  projectionId: string
  playerId?: string | null
  canonicalPlayerId?: string | null
  eventId?: string | null
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
  historicalStarts?: number | null
  asOfTimestamp?: string | null
  cutoffTimestamp?: string | null
  probabilityDistribution: { method: string; buckets: Array<{ label: string; probability: number }> }
  thresholdProbabilities: Array<{ threshold: number; probabilityAtLeast: number | null }>
  exactBlockerReasons: string[]
  explanation: string
  supportingFeatures: Array<{ feature: string; status: string; contribution: number; explanation: string }>
}

type ApiData = {
  projection: Projection
  relatedProjections?: Projection[]
  comparison?: Projection[]
  history?: { rows: HistoryRow[]; limit: number; source: string }
  performance?: PerformanceMetric | null
  providerCallsMade?: number
  remoteMutationsMade?: number
  settlementAndLearning?: { settlementStatus?: string; learningEvidence?: string; productionWeightsChanged?: boolean; autoPromotionEnabled?: boolean }
}

type HistoryRow = {
  id: string
  event_id: string | null
  projection_key: string | null
  projected_value: number | null
  actual_value: number | null
  error: number | null
  absolute_error: number | null
  confidence: number | null
  model_version: string | null
  readiness: string | null
  shadow_status: string | null
  starter_status: string | null
  generated_at: string | null
  settled_at: string | null
}

type PerformanceMetric = {
  sampleSize?: number
  training?: number
  validation?: number
  holdout?: number
  mae?: number | null
  rmse?: number | null
  brierScore?: number | null
  calibrationError?: number | null
  calibrationBias?: number | null
  distributionFit?: string
}

function display(value: string | number | null | undefined, suffix = '') {
  if (value === null || value === undefined || value === '') return 'N/A'
  if (typeof value === 'number') return Number.isFinite(value) ? `${Number(value.toFixed(2))}${suffix}` : 'N/A'
  return value
}

function dateTime(value: string | null | undefined) {
  if (!value) return 'N/A'
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : 'N/A'
}

function labelize(value: string | null | undefined) {
  return String(value ?? 'unavailable').replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())
}

function Stat({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="rounded-lg border border-slate-800 bg-slate-900 p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-white">{display(value)}</p></div>
}

function ProjectionMiniTable({ rows, empty }: { rows: Projection[]; empty: string }) {
  if (!rows.length) return <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">{empty}</p>
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.14em] text-slate-500">
          <tr><th className="py-2">Projection</th><th>Expected</th><th>Range</th><th>Confidence</th><th>Status</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-slate-200">
          {rows.map((row) => (
            <tr key={row.projectionId}>
              <td className="py-3"><a className="font-bold text-white underline decoration-slate-600 underline-offset-4 hover:text-emerald-100" href={`/player-projections/${encodeURIComponent(row.projectionId)}`}>{row.projectionLabel ?? labelize(row.projectionType)}</a></td>
              <td>{display(row.expectedValue)}</td>
              <td>{display(row.lowRange)} to {display(row.highRange)}</td>
              <td>{display(row.confidence, '%')}</td>
              <td>{labelize(row.lineupOrStarterStatus)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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
  const related = data.relatedProjections ?? []
  const comparison = data.comparison ?? []
  const historyRows = data.history?.rows ?? []
  const performance = data.performance
  const currentFamily = projection.projectionType.startsWith('pitcher_') ? 'Pitcher' : 'Batter'
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-6xl">
        <nav className="flex flex-wrap gap-2 text-sm font-bold text-slate-400" aria-label="Breadcrumb">
          <a href="/dashboard" className="text-emerald-200 hover:text-emerald-100">Dashboard</a>
          <span>/</span>
          <a href="/player-projections" className="text-emerald-200 hover:text-emerald-100">Players</a>
          <span>/</span>
          <span className="text-slate-300">Player Detail</span>
        </nav>
        <div className="mt-4 border-b border-slate-800 pb-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Player Projection Detail</p>
          <h1 className="mt-2 text-3xl font-black md:text-5xl">{projection.playerName}</h1>
          <p className="mt-2 text-sm text-slate-400">{projection.team ?? 'Team'} vs {projection.opponent ?? 'Opponent'} - {projection.projectionLabel ?? projection.projectionType}</p>
          <p className="mt-2 text-sm text-slate-500">Canonical player: {projection.canonicalPlayerId ?? projection.playerId ?? 'N/A'} | {currentFamily} projection | provider calls {data.providerCallsMade ?? 0} | remote mutations {data.remoteMutationsMade ?? 0}</p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <Stat label="Expected" value={projection.expectedValue} />
          <Stat label="Median" value={projection.medianEstimate} />
          <Stat label="Range" value={`${projection.lowRange ?? 'N/A'}-${projection.highRange ?? 'N/A'}`} />
          <Stat label="Confidence" value={`${Math.round(projection.confidence)}%`} />
          <Stat label="Feature Quality" value={Math.round(projection.featureQuality)} />
          <Stat label="Data Sufficiency" value={Math.round(projection.dataSufficiency)} />
          <Stat label="Starter Status" value={projection.lineupOrStarterStatus} />
          <Stat label="Batting Order" value={projection.battingOrder ?? 'N/A'} />
          <Stat label="Historical Starts" value={projection.historicalStarts ?? 'N/A'} />
          <Stat label="Last Update" value={projection.asOfTimestamp ? new Date(projection.asOfTimestamp).toLocaleString() : 'N/A'} />
          <Stat label="Projection Cutoff" value={dateTime(projection.cutoffTimestamp)} />
          <Stat label="Sportsbook Value" value="N/A" />
        </div>

        <section className="mt-5 rounded-lg border border-slate-800 bg-slate-900/75 p-5">
          <h2 className="text-xl font-black">Current Projections</h2>
          <p className="mt-1 text-sm text-slate-400">Sports projections only. Sportsbook lines, EV, Kelly and Official Picks are not activated here.</p>
          <div className="mt-4">
            <ProjectionMiniTable rows={related} empty="No additional current projection rows are linked to this player in the bounded current slate." />
          </div>
        </section>

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
          <h2 className="text-xl font-black">Projection History</h2>
          <p className="mt-1 text-sm text-slate-400">Bounded to {data.history?.limit ?? 25} indexed rows from {data.history?.source ?? 'projection history'}.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr><th className="py-2">Date</th><th>Projection</th><th>Expected</th><th>Actual</th><th>Error</th><th>Confidence</th><th>Status</th><th>Model</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {historyRows.length ? historyRows.map((row) => (
                  <tr key={row.id}>
                    <td className="py-3">{dateTime(row.generated_at)}</td>
                    <td>{labelize(row.projection_key)}</td>
                    <td>{display(row.projected_value)}</td>
                    <td>{display(row.actual_value)}</td>
                    <td>{display(row.absolute_error ?? row.error)}</td>
                    <td>{display(row.confidence, '%')}</td>
                    <td>{labelize(row.readiness ?? row.shadow_status ?? row.starter_status)}</td>
                    <td>{row.model_version ?? 'N/A'}</td>
                  </tr>
                )) : <tr><td className="py-3 text-slate-400" colSpan={8}>No stored settled projection history is linked to this player yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-slate-800 bg-slate-900/75 p-5">
          <h2 className="text-xl font-black">Projection Performance</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <Stat label="Sample" value={performance?.sampleSize ?? null} />
            <Stat label="MAE" value={performance?.mae ?? null} />
            <Stat label="RMSE" value={performance?.rmse ?? null} />
            <Stat label="Brier" value={performance?.brierScore ?? null} />
            <Stat label="Calibration Error" value={performance?.calibrationError ?? null} />
            <Stat label="Calibration Bias" value={performance?.calibrationBias ?? null} />
            <Stat label="Holdout" value={performance?.holdout ?? null} />
            <Stat label="Distribution Fit" value={performance?.distributionFit ?? 'N/A'} />
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-slate-800 bg-slate-900/75 p-5">
          <h2 className="text-xl font-black">Same-Game Comparison</h2>
          <p className="mt-1 text-sm text-slate-400">Comparison is bounded to the same game and projection family. It is not a bet recommendation.</p>
          <div className="mt-4">
            <ProjectionMiniTable rows={comparison} empty="No same-game comparison rows are available for this projection family." />
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-slate-800 bg-slate-900/75 p-5">
          <h2 className="text-xl font-black">Readiness</h2>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black uppercase">
            {projection.exactBlockerReasons.map((reason) => <span key={reason} className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-100">{reason}</span>)}
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sky-100">No sportsbook comparison</span>
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sky-100">No Official Pick</span>
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sky-100">{data.settlementAndLearning?.learningEvidence ?? 'Learning evidence pending'}</span>
          </div>
        </section>
      </div>
    </main>
  )
}
