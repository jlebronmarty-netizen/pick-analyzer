'use client'

import { useEffect, useState } from 'react'

type Opportunity = {
  id: string
  matchup: string
  marketLabel: string
  selection: string
  line: number | null
  odds: number | null
  sportsbook: string
  startTime: string | null
  eventStatus: string
  period: string
  probability: number
  sportsbookProbability: number
  edge: number
  expectedValue: number
  confidenceLabel: string
  reliability: string
  reliabilityScore: number
  aiRating: number
  recommendation: string
  recommendationStatus: string
  semanticLabel: string
  officialEligibility: string
  boardLabel: string
  currentHistoricalPreviewLabel: string
  modelVersion: string
  featureSetVersion: string
  calibrationStatus: string
  why: string
  warnings: string[]
  missingData: string[]
  oddsTimestamp: string | null
  oddsAgeMinutes: number
  selectedOddsSnapshotId: string | null
  anomalies: string[]
}

type Response = {
  success: boolean
  boardMode: string
  summary: {
    opportunities: number
    supportedMarkets: string[]
    unavailableMarkets: string[]
    currentSlateStart: string | null
    rowsBeforeFiltering: number
    rowsAfterFiltering: number
    staleHistoricalLegacyExcluded: number
    duplicatesRemoved: number
    anomalousOddsExcluded: number
    anomalousOddsFlagged: number
    audit: {
      historicalExcluded: number
      settledExcluded: number
      legacyUnlinkedExcluded: number
      staleExcluded: number
      duplicatesRemoved: number
      invalidOddsExcluded: number
      afterStartExcluded: number
      liveAlternateExcluded: number
    }
    warning: string
  }
  opportunities: Opportunity[]
}

const sortOptions = [
  ['highest_probability', 'Highest Probability'],
  ['best_value', 'Best Value'],
  ['best_combined', 'Best Combined Score'],
  ['lowest_risk', 'Lowest Risk'],
  ['highest_confidence', 'Highest Confidence'],
  ['newest_odds', 'Newest Odds'],
]

const modeOptions = [
  ['current_board', 'Current Board'],
  ['upcoming', 'Upcoming'],
  ['historical_explorer', 'Historical Explorer'],
  ['all_stored_data', 'All Stored Data'],
]

function odds(value: number | null) {
  if (value === null) return 'n/a'
  return value > 0 ? `+${value}` : String(value)
}

function pct(value: number) {
  return `${Number(value ?? 0).toFixed(1)}%`
}

function time(value: string | null) {
  if (!value) return 'n/a'
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function recommendationClass(value: string) {
  if (value === 'MODELED VALUE') return 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
  if (value === 'WATCH' || value === 'NOT OFFICIALLY ELIGIBLE') return 'border-amber-500/40 bg-amber-950/20 text-amber-200'
  if (value === 'STALE' || value === 'QUARANTINED' || value === 'UNCALIBRATED') return 'border-orange-500/40 bg-orange-950/20 text-orange-200'
  return 'border-slate-700 bg-slate-900 text-slate-300'
}

function ratingLabel(value: number) {
  if (value >= 85) return 'Excellent'
  if (value >= 70) return 'Very Good'
  if (value >= 60) return 'Average'
  return 'Low'
}

export default function MostLikelyTool() {
  const [sort, setSort] = useState('highest_probability')
  const [mode, setMode] = useState('current_board')
  const [data, setData] = useState<Response | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setError(null)
        const response = await fetch(`/api/market-opportunities/most-likely?sort=${sort}&mode=${mode}`, { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error?.message ?? 'Unable to load most likely scanner')
        setData(json)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load most likely scanner')
      }
    }
    load()
  }, [sort, mode])

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <a href="/dashboard" className="text-sm font-bold text-emerald-300 hover:text-emerald-200">
              Back to Dashboard
            </a>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.3em] text-slate-500">
              Optional Tool
            </p>
            <h1 className="mt-2 text-4xl font-black">Most Likely</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Probability-first scanner. This answers what is most likely to happen, not what you should automatically bet.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-white"
            >
              {modeOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-white"
            >
              {sortOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </header>

        {error ? <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-red-200">{error}</div> : null}

        <section className="grid gap-4 md:grid-cols-4">
          <Summary label="Rows Before Filter" value={data?.summary.rowsBeforeFiltering ?? 0} />
          <Summary label="Current Board Rows" value={data?.summary.rowsAfterFiltering ?? 0} />
          <Summary label="Markets Found" value={data?.summary.supportedMarkets.length ?? 0} />
          <Summary label="Provider Calls" value="0" />
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <Summary label="Stale/Historical/Legacy Excluded" value={data?.summary.staleHistoricalLegacyExcluded ?? 0} />
          <Summary label="Duplicates Removed" value={data?.summary.duplicatesRemoved ?? 0} />
          <Summary label="Anomalous Odds Excluded" value={data?.summary.anomalousOddsExcluded ?? 0} />
          <Summary label="Official Picks Changed" value="No" />
        </section>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4 text-sm leading-6 text-amber-100">
          High probability does not always mean good betting value. A selection can be very likely and still be a pass because the odds are too expensive.
        </div>

        <section className="grid gap-4">
          {(data?.opportunities ?? []).map((item) => (
            <article key={item.id} className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="grid gap-5 lg:grid-cols-[1fr_1fr_1fr]">
                <div>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${recommendationClass(item.semanticLabel)}`}>
                    {item.semanticLabel}
                  </span>
                  <h2 className="mt-3 text-2xl font-black">{item.selection} {item.line === null ? '' : item.line}</h2>
                  <p className="mt-1 text-sm text-slate-400">{item.marketLabel} | {item.matchup}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400 sm:grid-cols-3">
                    <span>{time(item.startTime)}</span>
                    <span>{item.eventStatus}</span>
                    <span>{item.currentHistoricalPreviewLabel}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{item.why}</p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Probability</p>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    <Metric label="Pick Analyzer thinks" value={pct(item.probability)} />
                    <Metric label="Sportsbook thinks" value={pct(item.sportsbookProbability)} />
                    <Metric label="Difference" value={`${item.edge > 0 ? '+' : ''}${pct(item.edge)}`} tone={item.edge > 0 ? 'good' : 'bad'} />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Bet Context</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <Metric label="Odds" value={`${odds(item.odds)} ${item.sportsbook}`} />
                    <Metric label="Odds Age" value={Number.isFinite(item.oddsAgeMinutes) ? `${item.oddsAgeMinutes}m` : 'n/a'} />
                    <Metric label="Confidence" value={item.confidenceLabel} />
                    <Metric label="Reliability" value={item.reliability} />
                    <Metric label="AI Rating" value={ratingLabel(item.aiRating)} />
                    <Metric label="Eligibility" value={item.officialEligibility} />
                  </div>
                </div>
              </div>

              <details className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <summary className="cursor-pointer text-sm font-black">Advanced Details</summary>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <Metric label="Model Probability" value={pct(item.probability)} />
                  <Metric label="Expected Value" value={pct(item.expectedValue)} tone={item.expectedValue > 0 ? 'good' : 'bad'} />
                  <Metric label="Reliability Score" value={String(item.reliabilityScore)} />
                  <Metric label="Odds Time" value={time(item.oddsTimestamp)} />
                  <Metric label="Model Version" value={item.modelVersion} />
                  <Metric label="Calibration" value={item.calibrationStatus} />
                  <Metric label="Policy Status" value={item.recommendationStatus} />
                  <Metric label="Period" value={item.period} />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Info title="Warnings" items={item.warnings} empty="No extra warnings." />
                  <Info title="Missing Data" items={item.missingData} empty="No missing data listed." />
                  <Info title="Odds Flags" items={item.anomalies} empty="No odds anomalies." />
                </div>
              </details>
            </article>
          ))}
        </section>

        <details className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <summary className="cursor-pointer text-sm font-black">Excluded Markets</summary>
          <div className="mt-3 space-y-1 text-sm text-slate-400">
            {(data?.summary.unavailableMarkets ?? []).map((item) => <p key={item}>{item}</p>)}
          </div>
        </details>
      </div>
    </main>
  )
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  )
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'good' | 'bad' | 'neutral' }) {
  const color = tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-red-300' : 'text-white'
  return (
    <div className="rounded-xl bg-slate-950/70 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 font-black ${color}`}>{value}</p>
    </div>
  )
}

function Info({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <div className="mt-2 space-y-1 text-sm text-slate-300">
        {items.length ? items.slice(0, 5).map((item) => <p key={item}>{item}</p>) : <p className="text-slate-500">{empty}</p>}
      </div>
    </div>
  )
}
