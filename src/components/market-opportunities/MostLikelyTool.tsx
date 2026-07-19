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
  marketIntelligenceCategory?: 'official' | 'ai_lean' | 'watchlist' | 'avoid'
  opportunityCategory?: 'Official' | 'AI Lean' | 'Watchlist' | 'Avoid'
  statusLabel?: string
  informationalWarning?: string | null
  reasonNotOfficial?: string | null
  boardLabel: string
  currentHistoricalPreviewLabel: string
  modelVersion: string
  featureSetVersion: string
  calibrationStatus: string
  why: string
  warnings: string[]
  blockers?: string[]
  missingData: string[]
  fairOdds?: number | null
  actionability?: string
  featureQuality?: number | null
  dataSufficiency?: number | null
  criticalDataCompleteness?: number | null
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
      rowsBeforeFiltering: number
      rowsAfterMarketFilter: number
      rowsAfterModeFilter: number
      historicalExcluded: number
      settledExcluded: number
      fixtureExcluded: number
      legacyUnlinkedExcluded: number
      staleExcluded: number
      supersededExcluded: number
      duplicatesRemoved: number
      invalidOddsExcluded: number
      afterStartExcluded: number
      liveAlternateExcluded: number
      extremeOddsFlagged: number
      staleOrHistoricalRowsExcluded: number
      anomalousOddsExcluded: number
    }
    currentBoard: {
      uniqueRowsExcluded: number
      exclusionReasonCounts: Record<string, number>
    }
    warning: string
    informationalFallbackUsed?: boolean
    displayMode?: string
  }
  topPick?: {
    type: 'official_pick' | 'most_likely_outcome' | 'none'
    candidate: Opportunity | null
    disclaimer: string
  }
  highestProbabilitySupportedOutcome?: Opportunity | null
  mostLikelyMoneyline?: {
    candidate: Opportunity | null
    probability: number | null
    fairOdds: number | null
    marketOdds: number | null
    ev: number | null
    confidence: number | null
    officialStatus: string
    blockers: string[]
    explanation: unknown
  }
  mostLikelyMoneylineParlay?: {
    legs: Opportunity[]
    rawJointProbability: number | null
    adjustedJointProbability: number | null
    impliedProbability: number | null
    combinedOdds: { decimal: number; american: number | null } | null
    ev: number | null
    confidence: number | null
    independenceAssumed: boolean
    correlationAdjustment: string
    officialStatus: string
    blockers: string[]
    disclaimer: string
  }
  probabilityEducation?: {
    headline: string
    officialSeparation: string
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
    timeZone: 'America/Puerto_Rico',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function recommendationClass(value: string) {
  if (value === 'MODELED VALUE') return 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
  if (value === 'WATCH' || value === 'NOT OFFICIALLY ELIGIBLE') return 'border-amber-500/40 bg-amber-950/20 text-amber-200'
  if (value === 'STALE' || value === 'QUARANTINED' || value === 'UNCALIBRATED') return 'border-orange-500/40 bg-orange-950/20 text-orange-200'
  return 'border-slate-700 bg-slate-900 text-slate-300'
}

function opportunityClass(item: Opportunity) {
  if (item.opportunityCategory === 'Official') return 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
  if (item.opportunityCategory === 'Watchlist') return 'border-sky-500/40 bg-sky-950/20 text-sky-200'
  if (item.opportunityCategory === 'Avoid') return 'border-red-500/40 bg-red-950/20 text-red-200'
  return 'border-amber-500/40 bg-amber-950/20 text-amber-200'
}

function ratingLabel(value: number) {
  if (value >= 85) return 'Excellent'
  if (value >= 70) return 'Very Good'
  if (value >= 60) return 'Average Confidence'
  return 'Low'
}

function stars(value: number) {
  const filled = Math.max(1, Math.min(5, Math.round(Number(value ?? 0) / 20)))
  return `${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}`
}

function selectionLabel(item: Opportunity) {
  if (item.marketLabel === 'Total') return `${item.selection} ${item.line ?? ''} Total`.trim()
  if (item.marketLabel === 'Run Line') {
    const line = item.line === null ? '' : item.line > 0 ? `+${item.line}` : String(item.line)
    return `${item.selection} ${line} Run Line`.trim()
  }
  return `${item.selection} Moneyline`
}

function marketWhy(item: Opportunity) {
  if (item.marketLabel === 'Total') {
    return 'Limited market-specific evidence is available for this total. Review combined scoring trend, combined runs allowed, current total price and missing pitcher/weather/lineup context before treating the under as actionable.'
  }
  if (item.marketLabel === 'Run Line') {
    return `${selectionLabel(item)} is a margin question: expected margin, run differential, cover price and opponent scoring strength matter more than a generic team split.`
  }
  return `${selectionLabel(item)} is a team-side price question: NYM strengths, PHI weaknesses and the current moneyline price decide whether probability becomes value.`
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
    <main className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
        <header className="flex min-w-0 flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <a href="/dashboard" className="text-sm font-bold text-emerald-300 hover:text-emerald-200">
              Back to Dashboard
            </a>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.3em] text-slate-500">
              Optional Tool
            </p>
            <h1 className="mt-2 break-words text-3xl font-black sm:text-4xl">Most Likely</h1>
            <p className="mt-3 max-w-[18rem] break-words text-sm leading-6 text-slate-400 sm:max-w-3xl">
              Probability-first scanner. This answers what is most likely to happen, not what you should automatically bet.
            </p>
          </div>
          <div className="flex w-full max-w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value)}
              className="min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-white"
            >
              {modeOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-white"
            >
              {sortOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </header>

        {error ? <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-red-200">{error}</div> : null}

        <section className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Rows Evaluated" value={data?.summary.rowsBeforeFiltering ?? 0} />
          <Summary label="Current Board Candidates" value={data?.summary.rowsAfterFiltering ?? 0} />
          <Summary label="Unique Rows Excluded" value={data?.summary.currentBoard?.uniqueRowsExcluded ?? 0} />
          <Summary label="Exclusion Reasons Triggered" value={Object.values(data?.summary.currentBoard?.exclusionReasonCounts ?? {}).reduce((sum, value) => sum + Number(value ?? 0), 0)} />
          <Summary label="Provider Calls" value="0" />
        </section>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4 text-sm leading-6 text-amber-100">
          {data?.probabilityEducation?.headline ?? 'High probability does not always mean good betting value. A selection can be very likely and still be a pass because the odds are too expensive.'}
          {data?.summary.informationalFallbackUsed ? (
            <p className="mt-2 font-bold">
              Current Board has no active official candidates, so this page is showing informational stored rankings for review only.
            </p>
          ) : null}
        </div>

        {data && (
          <section className="grid gap-4 lg:grid-cols-3">
            <Spotlight
              title={data.topPick?.type === 'official_pick' ? 'Official Top Pick' : 'Most Likely Outcome'}
              subtitle={data.topPick?.type === 'official_pick' ? 'Official recommendation' : 'Market intelligence - not a recommendation'}
              candidate={data.topPick?.candidate ?? null}
              footer={data.topPick?.disclaimer ?? 'No current supported outcome is available.'}
            />
            <Spotlight
              title="Most Likely Moneyline"
              subtitle="Probability-focused market intelligence"
              candidate={data.mostLikelyMoneyline?.candidate ?? null}
              footer={
                data.mostLikelyMoneyline?.candidate
                  ? `Fair odds ${odds(data.mostLikelyMoneyline.fairOdds)} vs market ${odds(data.mostLikelyMoneyline.marketOdds)}.`
                  : 'No valid moneyline candidate.'
              }
            />
            <ParlaySpotlight parlay={data.mostLikelyMoneylineParlay ?? null} />
          </section>
        )}

        <section className="grid gap-4">
          {(data?.opportunities ?? []).map((item) => (
            <article key={item.id} className="min-w-0 rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="grid min-w-0 gap-5 lg:grid-cols-3">
                <div className="min-w-0">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${opportunityClass(item)}`}>
                    {item.statusLabel ?? item.semanticLabel}
                  </span>
                    <h2 className="mt-3 break-words text-2xl font-black">{selectionLabel(item)}</h2>
                  <p className="mt-1 break-words text-sm text-slate-400">{item.marketLabel} | {item.matchup}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400 sm:grid-cols-3">
                    <span>{time(item.startTime)}</span>
                    <span>{item.eventStatus}</span>
                    <span>{item.currentHistoricalPreviewLabel}</span>
                  </div>
                  {item.informationalWarning ? (
                    <p className="mt-3 whitespace-pre-line rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs font-black text-amber-100">
                      {item.informationalWarning}
                    </p>
                  ) : null}
                  {item.reasonNotOfficial ? (
                    <p className="mt-3 text-sm leading-6 text-amber-100">Reason not official: {item.reasonNotOfficial}</p>
                  ) : null}
                  <p className="mt-3 break-words text-sm leading-6 text-slate-300">{marketWhy(item)}</p>
                </div>

                <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Probability</p>
                  <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 text-center sm:grid-cols-3">
                    <Metric label="Pick Analyzer thinks" value={pct(item.probability)} />
                    <Metric label="Sportsbook thinks" value={pct(item.sportsbookProbability)} />
                    <Metric label="Difference" value={`${item.edge > 0 ? '+' : ''}${pct(item.edge)}`} tone={item.edge > 0 ? 'good' : 'bad'} />
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Bet Context</p>
                  <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <Metric label="Odds" value={`${odds(item.odds)} ${item.sportsbook}`} />
                    <Metric label="Odds Age" value={Number.isFinite(item.oddsAgeMinutes) ? `${item.oddsAgeMinutes}m` : 'n/a'} />
                    <Metric label="Confidence" value={item.confidenceLabel} />
                    <Metric label="Reliability" value={item.reliability} />
                    <Metric label="AI Rating" value={`${stars(item.aiRating)} ${ratingLabel(item.aiRating)}`} />
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
          <summary className="cursor-pointer text-sm font-black">Advanced Details</summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Excluded Markets</p>
              <div className="mt-3 space-y-1 text-sm text-slate-400">
                {(data?.summary.unavailableMarkets ?? []).map((item) => <p key={item}>{item}</p>)}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Exclusion Breakdown</p>
              <div className="mt-3 grid gap-2 text-sm">
                {Object.entries(data?.summary.currentBoard?.exclusionReasonCounts ?? {}).filter(([, value]) => Number(value) > 0).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-xl bg-slate-950/70 px-3 py-2">
                    <span className="text-slate-400">{label}</span>
                    <span className="font-black text-white">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </details>
      </div>
    </main>
  )
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="break-words text-xs font-bold uppercase tracking-[0.08em] text-slate-500 sm:tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  )
}

function Spotlight({
  title,
  subtitle,
  candidate,
  footer,
}: {
  title: string
  subtitle: string
  candidate: Opportunity | null
  footer: string
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">{title}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{subtitle}</p>
      {candidate ? (
        <>
          <h2 className="mt-3 break-words text-xl font-black">{selectionLabel(candidate)}</h2>
          <p className="mt-1 break-words text-sm text-slate-400">{candidate.matchup}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Metric label="Model Probability" value={pct(candidate.probability)} />
            <Metric label="Market Odds" value={odds(candidate.odds)} />
            <Metric label="EV" value={pct(candidate.expectedValue)} tone={candidate.expectedValue > 0 ? 'good' : 'bad'} />
            <Metric label="Official Status" value={candidate.officialEligibility} />
          </div>
          {candidate.probability < 50 ? (
            <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 text-xs leading-5 text-amber-100">
              This is the highest probability among remaining eligible markets, not a claim that the outcome is likely in plain English.
            </p>
          ) : null}
          <p className="mt-3 text-sm leading-6 text-slate-300">{footer}</p>
          {(candidate.blockers ?? []).length ? (
            <p className="mt-2 text-xs text-amber-200">Blocked: {(candidate.blockers ?? []).slice(0, 3).join(', ')}</p>
          ) : null}
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-400">{footer}</p>
      )}
    </article>
  )
}

function ParlaySpotlight({ parlay }: { parlay: Response['mostLikelyMoneylineParlay'] | null }) {
  const legs = parlay?.legs ?? []
  return (
    <article className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Most Likely 2-Leg Moneyline Parlay</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Informational joint probability estimate</p>
      {legs.length >= 2 ? (
        <>
          <div className="mt-3 space-y-2">
            {legs.map((leg) => (
              <p key={leg.id} className="break-words text-sm font-bold text-white">
                {selectionLabel(leg)} <span className="text-slate-500">({pct(leg.probability)})</span>
              </p>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Metric label="Adjusted Joint" value={parlay?.adjustedJointProbability === null ? 'n/a' : pct(parlay?.adjustedJointProbability ?? 0)} />
            <Metric label="Combined Odds" value={odds(parlay?.combinedOdds?.american ?? null)} />
            <Metric label="Parlay EV" value={parlay?.ev === null ? 'n/a' : pct(parlay?.ev ?? 0)} tone={(parlay?.ev ?? 0) > 0 ? 'good' : 'bad'} />
            <Metric label="Confidence" value={parlay?.confidence === null ? 'n/a' : pct(parlay?.confidence ?? 0)} />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">{parlay?.disclaimer}</p>
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-400">Unavailable. Not enough eligible games remain for a two-leg moneyline parlay.</p>
      )}
    </article>
  )
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'good' | 'bad' | 'neutral' }) {
  const color = tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-red-300' : 'text-white'
  return (
    <div className="min-w-0 rounded-xl bg-slate-950/70 p-3">
      <p className="break-words text-xs text-slate-500">{label}</p>
      <p className={`mt-1 break-words font-black ${color}`}>{value}</p>
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
