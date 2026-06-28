'use client'

import { useEffect, useState } from 'react'

type CopilotPick = {
  id: string
  team: string
  opponent: string
  matchup: string
  sportKey: string
  sportsbook: string
  odds: number
  formattedOdds: string
  recommendation: string
  timing: string
  tone: string
  betNowOrWait: string
  suggestedStake: number
  formattedStake: string
  modelProbability: number
  impliedProbability: number
  edge: number
  ev: number
  confidence: number
  smartScore: number
  riskGrade: string
  riskLabel: string
  kellyPercent: number
  factors: {
    pitcherAdvantage: number
    injuryImpact: number
    weatherImpact: number
  }
  pros: string[]
  cons: string[]
  hiddenRisks: string[]
  professionalRead: string
  summary: string
  fullAnalysis: string
}

type CopilotResponse = {
  success: boolean
  generatedAt: string
  analyticsAvailable: boolean
  analyticsError: string | null
  modelPerformance: {
    picks: number
    settled: number
    pending: number
    wins: number
    losses: number
    pushes?: number
    winRate: number
    profit: number
    roi: number
  }
  count: number
  bestAdvice: CopilotPick | null
  picks: CopilotPick[]
  error?: string
}

function formatPercent(value: number) {
  return `${Number(value).toFixed(2)}%`
}

function timingClass(timing: string) {
  if (timing === 'BET_NOW') return 'bg-emerald-500/15 text-emerald-300'
  if (timing === 'PLAYABLE_NOW') return 'bg-blue-500/15 text-blue-300'
  if (timing === 'WAIT_OR_MONITOR') return 'bg-amber-500/15 text-amber-300'

  return 'bg-red-500/15 text-red-300'
}

function toneClass(tone: string) {
  if (tone === 'Aggressive') return 'text-emerald-300'
  if (tone === 'Positive') return 'text-blue-300'
  if (tone === 'Cautious') return 'text-amber-300'

  return 'text-red-300'
}

function CopilotCard({ pick }: { pick: CopilotPick }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-slate-950/30">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-black text-white">{pick.team} ML</h3>

            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${timingClass(pick.timing)}`}>
              {pick.timing}
            </span>

            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
              {pick.riskGrade} {pick.riskLabel}
            </span>
          </div>

          <p className="mt-2 text-xs text-slate-400">
            vs {pick.opponent} · {pick.sportKey}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {pick.sportsbook} · {pick.formattedOdds}
          </p>
        </div>

        <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-4 text-left lg:text-right">
          <p className="text-xs text-blue-300">AI Copilot</p>
          <p className={`mt-1 text-2xl font-black ${toneClass(pick.tone)}`}>
            {pick.tone}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Stake {pick.formattedStake}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <p className="text-sm leading-6 text-slate-300">{pick.summary}</p>
        <p className="mt-3 text-sm font-semibold text-white">
          {pick.betNowOrWait}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-xs md:grid-cols-5">
        <div className="rounded-lg bg-slate-950/70 p-3">
          <p className="text-slate-500">Model</p>
          <p className="font-bold text-white">{formatPercent(pick.modelProbability)}</p>
        </div>

        <div className="rounded-lg bg-slate-950/70 p-3">
          <p className="text-slate-500">Edge</p>
          <p className="font-bold text-emerald-400">{formatPercent(pick.edge)}</p>
        </div>

        <div className="rounded-lg bg-slate-950/70 p-3">
          <p className="text-slate-500">EV</p>
          <p className="font-bold text-emerald-400">{formatPercent(pick.ev)}</p>
        </div>

        <div className="rounded-lg bg-slate-950/70 p-3">
          <p className="text-slate-500">Confidence</p>
          <p className="font-bold text-white">{formatPercent(pick.confidence)}</p>
        </div>

        <div className="rounded-lg bg-slate-950/70 p-3">
          <p className="text-slate-500">Smart Score</p>
          <p className="font-bold text-white">{pick.smartScore.toFixed(2)}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
            Pros
          </p>

          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {pick.pros.map((item) => (
              <li key={item}>✓ {item}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
            Cons
          </p>

          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {pick.cons.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-red-500/20 bg-red-950/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-300">
            Hidden Risks
          </p>

          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {pick.hiddenRisks.map((item) => (
              <li key={item}>⚠ {item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-blue-500/20 bg-blue-950/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-300">
          Professional Read
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {pick.professionalRead}
        </p>
      </div>
    </div>
  )
}

export default function AICopilotPanel() {
  const [data, setData] = useState<CopilotResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/ai/copilot', {
          cache: 'no-store',
        })

        const json = await response.json()

        if (!response.ok || !json.success) {
          throw new Error(json.error ?? 'Failed to load AI Copilot')
        }

        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown AI Copilot error')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading AI Copilot...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-6 text-sm text-red-300">
        {error}
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">AI Copilot</h2>
        <p className="text-sm text-slate-400">
          Pros, cons, hidden risks, suggested stake and professional betting read.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Picks Analyzed</p>
          <p className="mt-1 text-2xl font-bold text-white">{data.count}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Model Win Rate</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {formatPercent(data.modelPerformance.winRate)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Model ROI</p>
          <p
            className={
              data.modelPerformance.roi >= 0
                ? 'mt-1 text-2xl font-bold text-emerald-400'
                : 'mt-1 text-2xl font-bold text-red-400'
            }
          >
            {formatPercent(data.modelPerformance.roi)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Settled Picks</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {data.modelPerformance.settled}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {data.picks.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
            No AI Copilot picks available yet.
          </div>
        ) : (
          data.picks.map((pick) => (
            <CopilotCard key={pick.id} pick={pick} />
          ))
        )}
      </div>
    </div>
  )
}