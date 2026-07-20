'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'

type Audit = {
  success: boolean
  generatedAt: string
  certification: {
    productionReady: 'YES' | 'NO'
    closedBetaReady: 'YES' | 'NO'
    recommendedVersion: string
    recommendedGitTag: string
    remainingBlockers: string[]
    estimatedBetaReadiness: string
  }
  scores: Record<string, number>
  checks: Array<{ id: string; label: string; status: string; explanation: string }>
  currentBoardAudit: {
    predictionUniverse: number
    predictionCandidates: number
    officialCandidates: number
    rejectedCandidates: number
    unsupportedMarkets: number
    historicalRows: number
    filteredRows: number
    explanation: string
  }
  marketCoverage: {
    coveragePercent: number
    supportedMarkets: string[]
    unsupportedMarkets: string[]
    rows: Array<{ market: string; supported: boolean; currentStatus: string; storedOdds: number; predictions: number; providerMissing: boolean; modelMissing: boolean; historicalMissing: boolean; settlementMissing: boolean; featureMissing: boolean }>
  }
  officialPickAudit: {
    officialQualifiedPicks: number
    watchCandidates: number
    officialBlockers: Array<{ predictionId: string; matchup: string; market: string; selection: string; primaryBlocker: string }>
  }
  freshnessAudit: {
    status: string
    blockers: string[]
    domains: Array<{ domain: string; status: string; ageMinutes: number | null; message: string }>
  }
  guardrails: Record<string, boolean | number>
}

function tone(value: string | number) {
  const text = String(value).toLowerCase()
  const number = typeof value === 'number' ? value : Number.NaN
  if (text === 'yes' || text === 'pass' || number >= 85) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
  if (text === 'partial' || text === 'insufficient_data' || (Number.isFinite(number) && number >= 65)) return 'border-amber-500/30 bg-amber-500/10 text-amber-100'
  if (text === 'no' || text === 'blocked' || (Number.isFinite(number) && number < 65)) return 'border-red-500/30 bg-red-500/10 text-red-100'
  return 'border-slate-700 bg-slate-900/80 text-slate-100'
}

function Badge({ children }: { children: ReactNode }) {
  const text = String(children ?? '')
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase ${tone(text)}`}>{text.replaceAll('_', ' ')}</span>
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

export default function ProductionReadinessAuditPanel() {
  const [data, setData] = useState<Audit | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/production-readiness/audit', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Audit request failed (${response.status})`)
        return response.json()
      })
      .then((json) => {
        if (alive) setData(json)
      })
      .catch((loadError) => {
        if (alive) setError(loadError instanceof Error ? loadError.message : 'Unable to load production readiness audit.')
      })
    return () => {
      alive = false
    }
  }, [])

  const topBlockers = useMemo(() => data?.officialPickAudit.officialBlockers.slice(0, 5) ?? [], [data])

  if (error) {
    return <section className="rounded-lg border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-100">{error}</section>
  }

  if (!data) {
    return <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-5 text-sm font-bold text-slate-400">Loading production readiness audit...</section>
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Production Readiness</p>
          <h3 className="mt-2 text-2xl font-black text-white">Final Certification Audit</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{data.certification.estimatedBetaReadiness}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Production {data.certification.productionReady}</Badge>
          <Badge>Beta {data.certification.closedBetaReady}</Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Stat label="Overall" value={data.scores.overallProductionReadiness} />
        <Stat label="Consistency" value={data.scores.consistency} />
        <Stat label="AI Brain" value={data.scores.aiBrain} />
        <Stat label="Current Board" value={data.scores.currentBoard} />
        <Stat label="Markets" value={`${data.scores.marketCoverage}%`} />
        <Stat label="Integrity" value={data.scores.predictionIntegrity} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-black text-white">Current Board</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">{data.currentBoardAudit.explanation}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label="Universe" value={data.currentBoardAudit.predictionUniverse} />
            <Stat label="Candidates" value={data.currentBoardAudit.predictionCandidates} />
            <Stat label="Official" value={data.currentBoardAudit.officialCandidates} />
            <Stat label="Filtered" value={data.currentBoardAudit.filteredRows} />
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-black text-white">Official Pick Blockers</p>
          <div className="mt-3 space-y-2">
            {topBlockers.length ? topBlockers.map((item) => (
              <div key={item.predictionId} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-sm font-black text-white">{item.matchup} | {item.market}</p>
                <p className="mt-1 text-sm text-slate-400">{item.primaryBlocker}</p>
              </div>
            )) : <p className="text-sm text-slate-400">No rejected official candidates in the active board.</p>}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-black text-white">Market Coverage</p>
          <div className="mt-3 grid gap-2">
            {data.marketCoverage.rows.map((row) => (
              <div key={row.market} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <div>
                  <p className="text-sm font-black text-white">{row.market.replaceAll('_', ' ')}</p>
                  <p className="mt-1 text-xs text-slate-500">{row.storedOdds} odds | {row.predictions} predictions</p>
                </div>
                <Badge>{row.supported ? 'Supported' : row.currentStatus}</Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-black text-white">Checks</p>
          <div className="mt-3 space-y-2">
            {data.checks.map((check) => (
              <div key={check.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-white">{check.label}</p>
                  <Badge>{check.status}</Badge>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-400">{check.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <p className="text-sm font-black text-amber-100">Remaining Blockers</p>
        <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-100/80">
          {data.certification.remainingBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
        </ul>
      </div>
    </section>
  )
}
