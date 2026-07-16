'use client'

import { useEffect, useState } from 'react'

type ReadinessResponse = {
  success: boolean
  pipeline: {
    sourceCandidateCount: number
    aligned: boolean
    topPicksToBetSlip: boolean
  }
  candidateAudits: Array<{
    id: string
    market: string
    selection: string
    probability: number
    confidence: number
    reliability: number
    aiRating: number
    featureQuality: number | null
    dataSufficiency: number | null
    marketStability: number
    edge: number
    ev: number
    policyStatus: string
    readinessScore: number
    explanation: string[]
  }>
  topPicksReadiness: {
    officialQualifiedPicks: number
    currentStateCorrect: boolean
  }
  betSlipReadiness: {
    mode: string
    noTicketWhenNoQualifiedPicks: boolean
  }
  prospectiveSimulation: {
    policyStatus: string
    topPicksWouldActivate: boolean
    betSlipWouldActivate: boolean
  }
  trustAssessment: {
    probabilityTomorrowRecommendationsTrustworthy: string
  }
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

export default function RecommendationReadinessPanel() {
  const [data, setData] = useState<ReadinessResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const response = await fetch('/api/recommendation-readiness', { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error?.message ?? 'Unable to load recommendation readiness')
        if (active) setData(json)
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load recommendation readiness')
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-300">Recommendation Readiness</p>
          <h3 className="mt-2 text-2xl font-black text-white">Day 1 Quality Gate</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Audits the full path from Current Board through ticket construction. Passing remains the correct answer when no bet qualifies.
          </p>
        </div>
        <a
          href="/api/recommendation-readiness"
          className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800"
        >
          Open Audit
        </a>
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200">{error}</div> : null}

      <div className="mt-5 grid gap-4 md:grid-cols-5">
        <Stat label="Candidates" value={data?.pipeline.sourceCandidateCount ?? '--'} />
        <Stat label="Pipeline" value={data?.pipeline.aligned ? 'Aligned' : '--'} />
        <Stat label="Official Picks" value={data?.topPicksReadiness.officialQualifiedPicks ?? '--'} />
        <Stat label="Bet Slip" value={data?.betSlipReadiness.mode ?? '--'} />
        <Stat label="Simulation" value={data?.prospectiveSimulation.topPicksWouldActivate ? 'Ready' : '--'} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {data?.candidateAudits.map((candidate) => (
          <article key={candidate.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-white">{candidate.selection}</p>
                <p className="mt-1 text-xs text-slate-400">{candidate.market}</p>
              </div>
              <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-black text-slate-200">{candidate.policyStatus}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <Mini label="Prob." value={`${candidate.probability.toFixed(2)}%`} />
              <Mini label="Conf." value={`${candidate.confidence.toFixed(2)}%`} />
              <Mini label="Edge" value={`${candidate.edge.toFixed(2)}%`} />
              <Mini label="EV" value={`${candidate.ev.toFixed(2)}%`} />
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">{candidate.explanation[0]}</p>
          </article>
        ))}
      </div>

      {data ? (
        <p className="mt-5 text-sm leading-6 text-slate-400">
          Trust assessment: {data.trustAssessment.probabilityTomorrowRecommendationsTrustworthy}
        </p>
      ) : null}
    </section>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-900/70 p-3">
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-white">{value}</p>
    </div>
  )
}
