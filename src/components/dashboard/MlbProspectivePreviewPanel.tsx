'use client'

import { useEffect, useState } from 'react'

type PreviewCandidate = {
  id: string
  category: string
  matchup: string
  startTime: string
  market: string
  selection: string
  line: number | null
  odds: number
  modelProbability: number
  impliedProbability: number
  edge: number
  ev: number
  confidence: number
  confidenceLabel: string | null
  reliability: string | null
  reliabilityScore: number | null
  aiRating: number | null
  aiGrade: string | null
  rankingScore: number | null
  featureQuality: number | null
  dataSufficiency: number | null
  positiveFactors: string[]
  negativeFactors: string[]
  missingData: string[]
  marketStability: {
    initialOdds?: number
    latestOdds?: number
    initialLine?: number | null
    latestLine?: number | null
    direction?: string
  } | null
  comparison: {
    probabilityDelta?: number | null
    confidenceDelta?: number | null
    aiRatingDelta?: number | null
    recommendationChanged?: boolean
  } | null
  recommendationStatus: string
  blockers: string[]
  oddsTimestamp: string
  cutoff: string
}

type PreviewResponse = {
  success: boolean
  summary: {
    nextGameTime: string | null
    latestOddsCapture: string | null
    gamesWithOdds: number
    previewCandidates: number
    qualifiedPreviews: number
    watch: number
    analyzedNotRecommended: number
    blocked: number
    officialPicks: number
    nextRequiredCaptureAction: string
  }
  categories: {
    qualifiedPreview: PreviewCandidate[]
    watch: PreviewCandidate[]
    analyzedNotRecommended: PreviewCandidate[]
    blocked: PreviewCandidate[]
  }
}

function formatOdds(value: number) {
  return value > 0 ? `+${value}` : String(value)
}

function formatNumber(value: number | null | undefined, suffix = '') {
  return value === null || value === undefined || Number.isNaN(Number(value))
    ? 'n/a'
    : `${Number(value).toFixed(2).replace(/\.00$/, '')}${suffix}`
}

function marketLabel(value: string) {
  if (value === 'moneyline') return 'Moneyline'
  if (value === 'spread') return 'Run Line'
  if (value === 'total') return 'Total'
  return value
}

function selectionLabel(candidate: PreviewCandidate) {
  if (candidate.market === 'total') {
    return `${candidate.selection} ${candidate.line ?? ''} Total`.trim()
  }
  if (candidate.market === 'spread') {
    const line = candidate.line === null ? '' : candidate.line > 0 ? `+${candidate.line}` : String(candidate.line)
    return `${candidate.selection} ${line} Run Line`.trim()
  }
  return `${candidate.selection} Moneyline`
}

function recommendationSummary(candidate: PreviewCandidate) {
  if (candidate.recommendationStatus === 'QUALIFIED') return 'GOOD BET'
  if (candidate.recommendationStatus === 'BEST_BET_CANDIDATE') return 'GOOD BET'
  if (candidate.recommendationStatus === 'PLAY_OF_DAY_CANDIDATE') return 'GOOD BET'
  if (candidate.recommendationStatus === 'WATCH') return 'WATCH'
  if (candidate.edge <= 0 || candidate.ev <= 0) return 'NO MODELED VALUE'
  return 'PASS'
}

function summaryClass(summary: string) {
  if (summary === 'GOOD BET') return 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
  if (summary === 'WATCH') return 'border-amber-500/40 bg-amber-950/20 text-amber-200'
  if (summary === 'NO MODELED VALUE') return 'border-red-500/40 bg-red-950/20 text-red-200'
  return 'border-slate-700 bg-slate-900 text-slate-300'
}

function valueLabel(candidate: PreviewCandidate) {
  if (candidate.edge >= 5 && candidate.ev >= 4) return 'Strong'
  if (candidate.edge > 0 && candidate.ev > 0) return 'Playable'
  if (candidate.edge > -3 && candidate.ev > -5) return 'Thin'
  return 'Poor'
}

function qualityLabel(value: number | null) {
  if (value === null) return 'Unknown'
  if (value >= 80) return 'Excellent'
  if (value >= 70) return 'Good'
  if (value >= 55) return 'Limited'
  return 'Weak'
}

function aiRatingLabel(value: number | null) {
  if (value === null) return 'Unknown'
  if (value >= 85) return 'Excellent'
  if (value >= 70) return 'Very Good'
  if (value >= 60) return 'Average Confidence'
  if (value >= 50) return 'Weak'
  return 'Poor'
}

function stars(value: number | null) {
  if (value === null) return '☆☆☆☆☆'
  const filled = Math.max(1, Math.min(5, Math.round(value / 20)))
  return `${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}`
}

function confidenceClass(label: string | null) {
  if (label === 'Very High' || label === 'High') return 'bg-emerald-500/15 text-emerald-200'
  if (label === 'Medium') return 'bg-amber-500/15 text-amber-200'
  return 'bg-red-500/15 text-red-200'
}

function cleanTeamName(value: string) {
  if (value === 'PHI') return 'Philadelphia'
  if (value === 'NYM') return 'New York'
  return value
}

function conversationalFactor(factor: string, market: string) {
  return factor
    .replace('PHI:', 'Philadelphia:')
    .replace('NYM:', 'New York:')
    .replace(/Home split is positive at ([^.]+)\./, 'has played much better at home recently ($1).')
    .replace(/Away split is negative at ([^.]+)\./, 'has struggled away from home recently ($1).')
    .replace(/Rest profile is favorable \(([^)]+)\)\./, 'comes in with useful rest ($1).')
    .replace(/Momentum is negative: Won ([^.]+)\./, 'has struggled over its last 10 games: won $1.')
    .replace(/Recent form: /, market === 'total' ? 'Recent scoring form: ' : 'Recent form: ')
}

function marketReason(candidate: PreviewCandidate) {
  if (candidate.market === 'total') {
    return candidate.edge <= 0
      ? `For ${selectionLabel(candidate)}, the projected scoring environment is not far enough from the sportsbook total to justify a bet.`
      : `For ${selectionLabel(candidate)}, projected runs, offensive form and defensive context create modeled value at the current price.`
  }
  if (candidate.market === 'spread') {
    return candidate.edge <= 0
      ? `For ${selectionLabel(candidate)}, the expected margin does not clear the run-line price with enough cushion.`
      : `For ${selectionLabel(candidate)}, the expected margin, run differential and scoring profile support the price.`
  }
  return candidate.edge <= 0
    ? `For ${selectionLabel(candidate)}, team strength, recent form and venue context do not beat the moneyline price.`
    : `For ${selectionLabel(candidate)}, team strength, recent form, home-field context and price create modeled value.`
}

function missingLabel(value: string) {
  return value
    .replace('starting_pitcher', 'Starting pitcher')
    .replace('confirmed_lineup', 'Confirmed lineup')
    .replace('injury_diagnosis', 'Injury news')
    .replace('weather', 'Weather')
    .replace('bullpen_context', 'Bullpen detail')
    .replace('bullpenProxy', 'Bullpen workload')
}

function shortTime(value: string | null) {
  if (!value) return 'None'
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function fullTime(value: string | null, timeZone?: string) {
  if (!value) return 'None'
  return new Date(value).toLocaleString(undefined, {
    timeZone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function CandidateRow({ candidate }: { candidate: PreviewCandidate }) {
  const summary = recommendationSummary(candidate)
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr_1.1fr]">
        <div>
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${summaryClass(summary)}`}>
            {summary}
          </span>
          <h3 className="mt-3 text-xl font-black text-white">
            {selectionLabel(candidate)}
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            {marketLabel(candidate.market)} at {formatOdds(candidate.odds)} | {candidate.matchup}
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {marketReason(candidate)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Model vs Price</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="text-slate-500">Sportsbook thinks</p>
              <p className="mt-1 text-lg font-black text-white">{formatNumber(candidate.impliedProbability, '%')}</p>
            </div>
            <div>
              <p className="text-slate-500">Pick Analyzer thinks</p>
              <p className="mt-1 text-lg font-black text-white">{formatNumber(candidate.modelProbability, '%')}</p>
            </div>
            <div>
              <p className="text-slate-500">Value</p>
              <p className={candidate.edge > 0 ? 'mt-1 text-lg font-black text-emerald-300' : 'mt-1 text-lg font-black text-red-300'}>
                {valueLabel(candidate)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Difference: {formatNumber(candidate.edge, ' pts')}
          </p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Bet Readiness</p>
          <p className="mt-2 text-2xl font-black text-white">{stars(candidate.aiRating)}</p>
          <p className="mt-1 text-sm font-bold text-slate-200">
            AI Rating: {stars(candidate.aiRating)} · {aiRatingLabel(candidate.aiRating)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${confidenceClass(candidate.confidenceLabel)}`}>
              {candidate.confidenceLabel ?? 'Low'} confidence
            </span>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-200">
              Data quality: {qualityLabel(candidate.featureQuality)}
            </span>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-200">
              Coverage: {qualityLabel(candidate.dataSufficiency)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <FactorGroup title="Why We Like It" tone="good" items={candidate.positiveFactors.map((item) => conversationalFactor(item, candidate.market)).slice(0, 3)} empty="No strong positive signal yet." />
        <FactorGroup title="Why We Don't" tone="bad" items={[
          candidate.edge <= 0 ? 'The sportsbook price is too expensive for what the model sees.' : '',
          ...candidate.negativeFactors.map((item) => conversationalFactor(item, candidate.market)),
        ].filter(Boolean).slice(0, 3)} empty="No major red flag from the model." />
        <FactorGroup title="Missing Information" tone="warn" items={candidate.missingData.map(missingLabel).slice(0, 4)} empty="No major missing data called out." />
      </div>

      <details className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
          Advanced Details
        </summary>
        <div className="mt-3 grid gap-2 text-xs md:grid-cols-2 xl:grid-cols-4">
          <Mini label="Internal Status" value={candidate.recommendationStatus} />
          <Mini label="Edge" value={formatNumber(candidate.edge, '%')} />
          <Mini label="EV" value={formatNumber(candidate.ev, '%')} />
          <Mini label="Confidence Score" value={formatNumber(candidate.confidence)} />
          <Mini label="Reliability" value={`${candidate.reliability ?? 'n/a'} (${formatNumber(candidate.reliabilityScore)})`} />
          <Mini label="AI Score" value={`${formatNumber(candidate.aiRating)} (${candidate.aiGrade ?? 'n/a'})`} />
          <Mini label="Rank Score" value={formatNumber(candidate.rankingScore)} />
          <Mini label="Odds Capture" value={shortTime(candidate.oddsTimestamp)} />
          <Mini label="Cutoff" value={shortTime(candidate.cutoff)} />
          <Mini label="Local Cutoff" value={fullTime(candidate.cutoff, 'America/Puerto_Rico')} />
          <Mini label="UTC Cutoff" value={fullTime(candidate.cutoff, 'UTC')} />
          <Mini label="Line Move" value={candidate.marketStability?.direction ?? 'stable'} />
          <Mini label="Data Quality Score" value={formatNumber(candidate.featureQuality)} />
          <Mini label="Coverage Score" value={formatNumber(candidate.dataSufficiency)} />
        </div>
      </details>
    </article>
  )
}

function FactorGroup({
  title,
  items,
  empty,
  tone,
}: {
  title: string
  items: string[]
  empty: string
  tone: 'good' | 'bad' | 'warn'
}) {
  const color =
    tone === 'good'
      ? 'border-emerald-500/20 bg-emerald-950/10 text-emerald-200'
      : tone === 'bad'
        ? 'border-red-500/20 bg-red-950/10 text-red-200'
        : 'border-amber-500/20 bg-amber-950/10 text-amber-200'
  return (
    <div className={`rounded-2xl border p-4 ${color}`}>
      <p className="text-xs font-black uppercase tracking-[0.18em]">{title}</p>
      <div className="mt-3 space-y-2 text-sm leading-5 text-slate-200">
        {items.length ? items.map((item) => <p key={item}>{item}</p>) : <p className="text-slate-400">{empty}</p>}
      </div>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-950/70 p-3">
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-white">{value}</p>
    </div>
  )
}

export default function MlbProspectivePreviewPanel() {
  const [data, setData] = useState<PreviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(
          '/api/predictions/by-sport?sport=baseball_mlb&prospectivePreview=true',
          { cache: 'no-store' }
        )
        const json = await response.json()
        if (!response.ok || !json.success) {
          throw new Error(json.error ?? 'Unable to load MLB model preview')
        }
        setData(json)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load MLB model preview')
      }
    }

    load()
  }, [])

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
            Should I Bet This?
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            Today&apos;s MLB Betting Read
          </h2>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.18em]">
            <span className="rounded-full border border-amber-500/30 px-3 py-1 text-amber-200">
              Preview Only
            </span>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
              Official Picks Off
            </span>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            The model currently believes waiting has the highest expected value. Calibration remains limited.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-slate-500">Games</p>
            <p className="font-bold text-white">{data?.summary.gamesWithOdds ?? 0}</p>
          </div>
          <div>
            <p className="text-slate-500">Analyzed</p>
            <p className="font-bold text-white">{data?.summary.previewCandidates ?? 0}</p>
          </div>
          <div>
            <p className="text-slate-500">Good Bets</p>
            <p className="font-bold text-emerald-300">{data?.summary.qualifiedPreviews ?? 0}</p>
          </div>
          <div>
            <p className="text-slate-500">Next Game</p>
            <p className="font-bold text-white">{shortTime(data?.summary.nextGameTime ?? null)}</p>
          </div>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

      {data && (
        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          {[
            ['Qualified Preview', data.categories.qualifiedPreview],
            ['Watch', data.categories.watch],
            ['No Modeled Value', data.categories.analyzedNotRecommended],
            ['Pass', data.categories.blocked],
          ].map(([label, rows]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-sm font-black text-white">{String(label)}</p>
              <p className="mt-1 text-2xl font-black text-emerald-300">
                {(rows as PreviewCandidate[]).length}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5">
        {(data?.categories.qualifiedPreview ?? []).map((candidate) => (
          <CandidateRow key={candidate.id} candidate={candidate} />
        ))}
        {(data?.categories.watch ?? []).map((candidate) => (
          <CandidateRow key={candidate.id} candidate={candidate} />
        ))}
        {(data?.categories.analyzedNotRecommended ?? []).map((candidate) => (
          <CandidateRow key={candidate.id} candidate={candidate} />
        ))}
        {(data?.categories.blocked ?? []).map((candidate) => (
          <CandidateRow key={candidate.id} candidate={candidate} />
        ))}
      </div>

      {data && (
        <p className="mt-4 text-sm text-slate-400">
          Final Odds Refresh: Recommended 6:45-6:50 PM AST, before 7:00 PM cutoff.
        </p>
      )}
    </section>
  )
}
