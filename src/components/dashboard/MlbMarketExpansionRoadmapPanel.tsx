'use client'

import { useEffect, useMemo, useState } from 'react'

type Roadmap = {
  generatedAt: string
  baseline: {
    operatingDate: string
    games: number
    oddsRows: number
    predictionRows: number
    currentBoardCandidates: number
    officialPicks: number
    aiLeans: number
    watchlist: number
    avoid: number
    coreFullGameCoveragePercent: number
    broaderMarketGroupCoveragePercent: number
    auditedRegistryCoveragePercent: number
  }
  prioritization: {
    rows: Array<{ family: string; score: number; rank: number; firstRecommendedEpic: boolean }>
  }
  recommendedWaves: Array<{ wave: number; markets: string[]; whyNow: string; complexity: string; expectedOpportunityIncrease: string }>
  recommendedFirstEpic: {
    name: string
    whyFirst: string
    estimatedEngineeringComplexity: string
    expectedUserValue: string
    expectedOpportunityUniverseExpansion: string
  }
  activationByMarket: Array<{ marketId: string; stage: string; nextAction: string }>
  guardrails: Record<string, boolean>
}

function badgeTone(value: string | number) {
  const text = String(value).toLowerCase()
  const num = Number(value)
  if (text.includes('production') || text.includes('ready') || text.includes('low') || num >= 75) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
  if (text.includes('contract') || text.includes('medium') || (Number.isFinite(num) && num >= 50)) return 'border-amber-500/30 bg-amber-500/10 text-amber-100'
  if (text.includes('not') || text.includes('high') || text.includes('very')) return 'border-red-500/30 bg-red-500/10 text-red-100'
  return 'border-slate-700 bg-slate-900/80 text-slate-100'
}

function Badge({ children }: { children: string | number }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase ${badgeTone(children)}`}>{String(children).replaceAll('_', ' ')}</span>
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

export default function MlbMarketExpansionRoadmapPanel() {
  const [data, setData] = useState<Roadmap | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/mlb/markets/expansion-roadmap?includeValidation=true', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Market expansion request failed (${response.status})`)
        return response.json()
      })
      .then((json) => {
        if (alive) setData(json)
      })
      .catch((loadError) => {
        if (alive) setError(loadError instanceof Error ? loadError.message : 'Unable to load MLB market expansion roadmap.')
      })
    return () => {
      alive = false
    }
  }, [])

  const topPriorities = useMemo(() => data?.prioritization.rows.slice(0, 4) ?? [], [data])
  const activationPreview = useMemo(() => data?.activationByMarket.filter((row) => row.stage !== 'PRODUCTION').slice(0, 6) ?? [], [data])

  if (error) return <section className="rounded-lg border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-100">{error}</section>
  if (!data) return <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-5 text-sm font-bold text-slate-400">Loading MLB market expansion roadmap...</section>

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">MLB Market Expansion</p>
          <h3 className="mt-2 text-2xl font-black text-white">Roadmap & Implementation Plan</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Read-only planning surface. Expansion markets remain blocked until provider, data, feature, settlement, replay, shadow and calibration gates pass.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{data.recommendedFirstEpic.name}</Badge>
          <Badge>{data.recommendedFirstEpic.estimatedEngineeringComplexity}</Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Stat label="Games" value={data.baseline.games} />
        <Stat label="Odds Rows" value={data.baseline.oddsRows} />
        <Stat label="Predictions" value={data.baseline.predictionRows} />
        <Stat label="Board" value={data.baseline.currentBoardCandidates} />
        <Stat label="Official" value={data.baseline.officialPicks} />
        <Stat label="Broad Coverage" value={`${data.baseline.broaderMarketGroupCoveragePercent}%`} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-black text-white">Priority Ranking</p>
          <div className="mt-3 space-y-2">
            {topPriorities.map((row) => (
              <div key={row.family} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <div>
                  <p className="text-sm font-black text-white">{row.rank}. {row.family.replaceAll('_', ' ')}</p>
                  <p className="mt-1 text-xs text-slate-500">weighted score {row.score}</p>
                </div>
                {row.firstRecommendedEpic ? <Badge>First Epic</Badge> : <Badge>{row.score}</Badge>}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-black text-white">Recommended First Epic</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">{data.recommendedFirstEpic.whyFirst}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge>{data.recommendedFirstEpic.expectedUserValue}</Badge>
            <Badge>{data.recommendedFirstEpic.expectedOpportunityUniverseExpansion}</Badge>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-black text-white">Implementation Waves</p>
          <div className="mt-3 space-y-2">
            {data.recommendedWaves.map((wave) => (
              <div key={wave.wave} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-black text-white">Wave {wave.wave}</p>
                  <Badge>{wave.complexity}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-400">{wave.markets.join(', ').replaceAll('_', ' ')}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">{wave.whyNow}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-black text-white">Blocked Activation Preview</p>
          <div className="mt-3 space-y-2">
            {activationPreview.map((row) => (
              <div key={row.marketId} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-white">{row.marketId.replaceAll('_', ' ')}</p>
                  <Badge>{row.stage}</Badge>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{row.nextAction}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
