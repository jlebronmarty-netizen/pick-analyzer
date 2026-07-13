'use client'

import { useEffect, useState } from 'react'
import PickExplanationCard from '@/components/dashboard/PickExplanationCard'

type AnyPick = {
  id?: string
  team?: string
  opponent?: string
  odds?: number
  formattedOdds?: string
  formatted_odds?: string
  confidence?: number
  edge?: number
  ev?: number
  smart_score?: number
  smartScore?: number
  risk_grade?: string
  riskGrade?: string
  risk_label?: string
  riskLabel?: string
  recommended_stake?: number
  recommendedStake?: number
  sportsbook?: string
  bestSportsbook?: string
  aiRecommendation?: string
  aiSummary?: string
  explanation?: {
    summary?: string
    recommendation?: string
    biggestRisk?: string
  }
}

type DailyReportResponse = {
  success: boolean
  bankroll: number
  generatedAt: string
  executiveSummary: string
  summary: {
    totalQualifiedPicks: number
    recommendedPicks: number
    bestBets: number
    betNow: number
    sharpSignals: number
    bestSingles: number
    avoidList: number
    averageLineValue: number
    averageSharpConfidence: number
    bankrollExposurePercent: number
    bankrollExposureLevel: string
    clvAverage: number
    calibrationScore: number
    modelStatus: string
  }
  todayCard: {
    playOfTheDay: AnyPick | null
    bestUnderdog: AnyPick | null
    bestFavorite: AnyPick | null
    highestEv: AnyPick | null
    highestConfidence: AnyPick | null
    bestSharp: AnyPick | null
    bestClv: AnyPick | null
  }
  bankrollPlan: {
    maxDailyExposurePercent?: number
    totalStake?: number
    exposurePercent?: number
    exposureLevel?: string
    expectedProfit?: number
    expectedRoi?: number
    remainingExposure?: number
    recommendedAction?: string
    picks?: AnyPick[]
  }
  riskAlerts: string[]
  error?: string
}

function formatMoney(value?: number) {
  return `$${Number(value ?? 0).toFixed(2)}`
}

function formatPercent(value?: number) {
  return `${Number(value ?? 0).toFixed(2)}%`
}

function formatOdds(pick: AnyPick) {
  if (pick.formattedOdds) return pick.formattedOdds
  if (pick.formatted_odds) return pick.formatted_odds

  const odds = Number(pick.odds ?? 0)
  return odds > 0 ? `+${odds}` : `${odds}`
}

function getSmartScore(pick: AnyPick) {
  return Number(pick.smart_score ?? pick.smartScore ?? 0)
}

function getRiskGrade(pick: AnyPick) {
  return pick.risk_grade ?? pick.riskGrade ?? 'N/A'
}

function getRiskLabel(pick: AnyPick) {
  return pick.risk_label ?? pick.riskLabel ?? ''
}

function getStake(pick: AnyPick) {
  return Number(pick.recommended_stake ?? pick.recommendedStake ?? 0)
}

function statusClass(value: string) {
  if (value === 'WELL_CALIBRATED') return 'text-emerald-300'
  if (value === 'NEEDS_MONITORING') return 'text-amber-300'
  if (value === 'NEEDS_RECALIBRATION') return 'text-red-300'
  return 'text-slate-300'
}

function PickMiniCard({
  title,
  pick,
}: {
  title: string
  pick: AnyPick | null
}) {
  const [loadingExplanation, setLoadingExplanation] = useState(false)
  const [aiExplanation, setAiExplanation] = useState<any>(null)

  async function toggleExplanation() {
    if (!pick) return

    if (aiExplanation) {
      setAiExplanation(null)
      return
    }

    try {
      setLoadingExplanation(true)

      const response = await fetch('/api/picks/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify(pick),
      })

      const json = await response.json()

      if (!response.ok || json?.success === false) {
        throw new Error(json?.error ?? 'Unable to explain pick')
      }

      setAiExplanation(json)
    } catch (error) {
      console.error('Daily report pick explanation failed:', error)
    } finally {
      setLoadingExplanation(false)
    }
  }

  if (!pick) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </p>
        <p className="mt-3 text-sm text-slate-400">No pick available.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </p>
          <h3 className="mt-2 text-lg font-black text-white">
            {pick.team} ML
          </h3>
          <p className="mt-1 text-xs text-slate-400">vs {pick.opponent}</p>
        </div>

        <div className="text-right">
          <p className="text-lg font-black text-white">{formatOdds(pick)}</p>
          <p className="text-xs text-slate-500">
            {pick.bestSportsbook ?? pick.sportsbook ?? 'Sportsbook'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-slate-950/70 p-2">
          <p className="text-slate-500">EV</p>
          <p className="font-bold text-emerald-400">{formatPercent(pick.ev)}</p>
        </div>

        <div className="rounded-lg bg-slate-950/70 p-2">
          <p className="text-slate-500">Conf.</p>
          <p className="font-bold text-white">{formatPercent(pick.confidence)}</p>
        </div>

        <div className="rounded-lg bg-slate-950/70 p-2">
          <p className="text-slate-500">Stake</p>
          <p className="font-bold text-white">{formatMoney(getStake(pick))}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
          {getRiskGrade(pick)} {getRiskLabel(pick)}
        </span>
        <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-300">
          Score {getSmartScore(pick).toFixed(2)}
        </span>
      </div>

      {(pick.aiSummary || pick.explanation?.summary) && (
        <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-400">
          {pick.aiSummary ?? pick.explanation?.summary}
        </p>
      )}

      <button
        onClick={toggleExplanation}
        disabled={loadingExplanation}
        className="mt-4 w-full rounded-xl border border-cyan-500/30 bg-cyan-950/20 px-4 py-2 text-xs font-bold text-cyan-300 transition hover:bg-cyan-950/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loadingExplanation
          ? 'Analyzing...'
          : aiExplanation
            ? 'Hide AI Analysis'
            : 'AI Analysis'}
      </button>

      {aiExplanation && (
        <div className="mt-4">
          <PickExplanationCard explanation={aiExplanation} />
        </div>
      )}
    </div>
  )
}

export default function DailyReportPanel() {
  const [bankroll, setBankroll] = useState(1000)
  const [data, setData] = useState<DailyReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)

        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => controller.abort(), 20000)

        const response = await fetch(`/api/daily-report/fast?bankroll=${bankroll}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        window.clearTimeout(timeoutId)

        const json = await response.json()

        if (!response.ok || !json.success) {
          throw new Error(json.error ?? 'Failed to load daily report')
        }

        setData(json)
      } catch (err) {
        setError(
          err instanceof DOMException && err.name === 'AbortError'
            ? 'Daily Report is taking too long. Other dashboard sections will continue loading.'
            : err instanceof Error
              ? err.message
              : 'Unknown daily report error'
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [bankroll])

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading AI Daily Report...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-900/60 bg-red-950/40 p-6 text-sm text-red-300">
        {error}
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-blue-500/20 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950/30 p-6 shadow-xl shadow-blue-950/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-300">
              AI Daily Report
            </p>
            <h2 className="mt-3 text-3xl font-black text-white">
              Today&apos;s Betting Command Center
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
              {data.executiveSummary}
            </p>
          </div>

          <select
            value={bankroll}
            onChange={(event) => setBankroll(Number(event.target.value))}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          >
            <option value={500}>$500 bankroll</option>
            <option value={1000}>$1,000 bankroll</option>
            <option value={2500}>$2,500 bankroll</option>
            <option value={5000}>$5,000 bankroll</option>
            <option value={10000}>$10,000 bankroll</option>
          </select>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs text-slate-500">Qualified</p>
            <p className="mt-1 text-2xl font-black text-white">
              {data.summary.totalQualifiedPicks}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs text-slate-500">BET NOW</p>
            <p className="mt-1 text-2xl font-black text-emerald-400">
              {data.summary.betNow}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs text-slate-500">Sharp</p>
            <p className="mt-1 text-2xl font-black text-blue-300">
              {data.summary.sharpSignals}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs text-slate-500">Exposure</p>
            <p className="mt-1 text-2xl font-black text-white">
              {formatPercent(data.summary.bankrollExposurePercent)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs text-slate-500">Line Value</p>
            <p className="mt-1 text-2xl font-black text-white">
              {formatPercent(data.summary.averageLineValue)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs text-slate-500">CLV Avg</p>
            <p className="mt-1 text-2xl font-black text-white">
              {formatPercent(data.summary.clvAverage)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs text-slate-500">Calibration</p>
            <p className="mt-1 text-2xl font-black text-white">
              {data.summary.calibrationScore.toFixed(0)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs text-slate-500">Model</p>
            <p className={`mt-1 text-xs font-black ${statusClass(data.summary.modelStatus)}`}>
              {data.summary.modelStatus}
            </p>
          </div>
        </div>
      </div>

      {data.riskAlerts.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4">
          <p className="text-sm font-bold text-amber-300">Risk Alerts</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-100">
            {data.riskAlerts.map((alert) => (
              <li key={alert}>• {alert}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <PickMiniCard title="Play of the Day" pick={data.todayCard.playOfTheDay} />
        <PickMiniCard title="Best Favorite" pick={data.todayCard.bestFavorite} />
        <PickMiniCard title="Best Underdog" pick={data.todayCard.bestUnderdog} />
        <PickMiniCard title="Highest EV" pick={data.todayCard.highestEv} />
        <PickMiniCard title="Best Sharp Play" pick={data.todayCard.bestSharp} />
        <PickMiniCard title="Best CLV Play" pick={data.todayCard.bestClv} />
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Bankroll Plan</h2>
            <p className="text-sm text-slate-400">
              {data.bankrollPlan.recommendedAction}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs text-slate-500">Daily Exposure</p>
            <p className="text-2xl font-black text-white">
              {formatMoney(data.bankrollPlan.totalStake)} ·{' '}
              {formatPercent(data.bankrollPlan.exposurePercent)}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(data.bankrollPlan.picks ?? []).slice(0, 6).map((pick) => (
            <PickMiniCard
              key={`${pick.team}-${pick.opponent}-${pick.odds}`}
              title="Stake Plan"
              pick={pick}
            />
          ))}
        </div>
      </div>
    </div>
  )
}