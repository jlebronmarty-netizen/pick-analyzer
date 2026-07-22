'use client'

import { useEffect, useState } from 'react'
import PickExplanationCard from '@/components/dashboard/PickExplanationCard'

type AdaptiveAdjustment = {
  original?: {
    confidence?: number
    ev?: number
    edge?: number
    smartScore?: number
  }
  adjusted?: {
    confidence?: number
    ev?: number
    edge?: number
    adaptiveScore?: number
  }
  strongestAdjustment?: {
    factor: string
    multiplier: number
  } | null
}

type Pick = {
  id: string
  sport_key: string
  game_id: string
  commence_time: string
  home_team: string
  away_team: string
  team: string
  opponent: string
  market: string
  sportsbook: string
  odds: number
  implied_probability: number
  model_probability: number
  edge: number
  ev: number
  confidence: number
  recommended_pick: boolean | null
  recommendation_status?: string
  recommendation_label?: string
  confidence_label?: string
  reliability_label?: string
  value_label?: string
  qualification_blockers?: string[]
  risk_grade?: string
  risk_label?: string
  smart_score?: number
  adaptive_score?: number
  adaptive_adjustment?: AdaptiveAdjustment
}

type TopPicksResponse = {
  success: boolean
  adaptiveWeightsAvailable?: boolean
  summary: {
    pendingPicks: number
    safePendingPicks?: number
    recommendedPicks: number
    officialQualifiedPicks?: number
    watchCandidates?: number
    calibrationStatus?: string
    automaticProductionApproval?: boolean
    topEvCount: number
    topConfidenceCount: number
    bestBetsCount: number
  }
  topEv: Pick[]
  topConfidence: Pick[]
  bestBets: Pick[]
  bestBetsToday?: {
    displayLabel: string
    recommendationMode: 'official_recommendations' | 'informational_not_recommended'
    providerCallsMade: number
    predictionsRegenerated: boolean
    predictionRegenerationNote: string
    summary: {
      candidatesScanned: number
      officialCandidateCount: number
      positiveValueCount: number
      latestOddsTimestamp: string | null
      officialPicksRemain: number
    }
    topPick: BestBetToday | null
    bestBets: BestBetToday[]
    bestValue: BestBetToday | null
  }
}

type BestBetToday = {
  rank: number
  predictionId: string
  matchup: string
  scheduledTime: string | null
  marketLabel: string
  selection: string
  line: number | null
  sportsbook: string
  americanOdds: number | null
  modelProbability: number
  calibratedProbability: number | null
  impliedProbability: number
  fairOdds: number | null
  edge: number
  expectedValue: number
  confidence: number
  reliabilityScore: number
  featureQuality: number | null
  dataSufficiency: number | null
  criticalDataCompleteness: number
  starterConfidence: number | null
  windSpeed: number | null
  stadiumId: string | null
  score: number
  official: boolean
  marketIntelligenceCategory?: string
  productCategory?: string
  productStatus?: string
  statusWarning?: string | null
  reasonNotOfficial?: string | null
  recommendationPolicyStatus: string
  drivers: string[]
  riskFactors: string[]
  missingInformation: string[]
  blockers: string[]
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatOdds(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}

function formatPercent(value?: number) {
  return `${Number(value ?? 0).toFixed(2)}%`
}

function formatMaybePercent(value: number | null | undefined) {
  return value === null || value === undefined ? 'n/a' : formatPercent(value)
}

function lineText(value: number | null) {
  if (value === null) return ''
  return value > 0 ? ` ${value}` : ` ${value}`
}

function stars(value?: number) {
  const score = Number(value ?? 0)
  const filled = Math.max(1, Math.min(5, Math.round(score / 20)))
  return `${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}`
}

function plainRecommendation(pick: Pick) {
  if (
    pick.recommendation_status === 'PLAY_OF_DAY_CANDIDATE' ||
    pick.recommendation_status === 'BEST_BET_CANDIDATE' ||
    pick.recommendation_status === 'QUALIFIED'
  ) {
    return 'Recommended'
  }
  if (pick.recommendation_status === 'WATCH') return 'Worth Watching'
  if (pick.edge <= 0 || pick.ev <= 0) return 'No Value'
  return 'Pass'
}

function opportunityLabel(score: number) {
  if (score >= 85) return 'Elite Opportunity'
  if (score >= 70) return 'Strong Opportunity'
  if (score >= 55) return 'Worth Watching'
  return 'Needs More Proof'
}

function categoryClass(category?: BestBetToday['marketIntelligenceCategory']) {
  if (category === 'official') return 'bg-emerald-500/15 text-emerald-300'
  if (category === 'watchlist' || category === 'model_only' || category === 'pass') return 'bg-blue-500/15 text-blue-200'
  if (category === 'avoid') return 'bg-red-500/15 text-red-200'
  return 'bg-amber-500/15 text-amber-200'
}

function scoreClass(value?: number) {
  const score = Number(value ?? 0)

  if (score >= 80) return 'text-emerald-400'
  if (score >= 65) return 'text-amber-300'

  return 'text-slate-300'
}

function factorLabel(value?: string) {
  if (!value) return 'No adjustment'
  if (value === 'confidenceMultiplier') return 'Confidence'
  if (value === 'evMultiplier') return 'EV'
  if (value === 'edgeMultiplier') return 'Edge'
  if (value === 'oddsMultiplier') return 'Odds Style'

  return value
}

function PickCard({ pick }: { pick: Pick }) {
  const [loadingExplanation, setLoadingExplanation] = useState(false)
  const [explanation, setExplanation] = useState<any>(null)

  const adaptiveScore = pick.adaptive_score ?? pick.smart_score ?? 0
  const smartScore = pick.smart_score ?? 0
  const strongest = pick.adaptive_adjustment?.strongestAdjustment

  async function toggleExplanation() {
    if (explanation) {
      setExplanation(null)
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

      setExplanation(json)
    } catch (error) {
      console.error('Pick explanation failed:', error)
    } finally {
      setLoadingExplanation(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-950/20 px-3 py-1 text-xs font-black text-emerald-200">
                {plainRecommendation(pick)}
              </span>
              <p className="text-sm font-semibold text-white">{pick.team} ML</p>

              {pick.risk_grade && (
                <span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-300">
                  {pick.risk_grade} {pick.risk_label ?? ''}
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-slate-400">
              vs {pick.opponent} · {formatDate(pick.commence_time)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {pick.sport_key} · {pick.sportsbook}
            </p>
          </div>

          <div className="text-right">
            <p className="text-sm font-bold text-white">{formatOdds(pick.odds)}</p>
            <p className="mt-1 text-xs font-bold text-amber-200">
              {stars(adaptiveScore)}
            </p>
          </div>
        </div>

        <p className={`mt-4 text-lg font-black ${scoreClass(adaptiveScore)}`}>
          {opportunityLabel(adaptiveScore)}
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-300">
          Pick Analyzer thinks this price is {pick.value_label?.toLowerCase() ?? 'worth reviewing'} with {pick.confidence_label?.toLowerCase() ?? 'model'} confidence.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-slate-900/70 p-3">
            <p className="text-slate-500">Pick Analyzer thinks</p>
            <p className="font-semibold text-white">
              {formatPercent(pick.model_probability)}
            </p>
          </div>

          <div className="rounded-lg bg-slate-900/70 p-3">
            <p className="text-slate-500">Sportsbook thinks</p>
            <p className="font-semibold text-white">
              {formatPercent(pick.implied_probability)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-slate-900/70 p-3">
            <p className="text-slate-500">Confidence</p>
            <p className="font-semibold text-white">
              {pick.confidence_label ?? formatPercent(pick.confidence)}
            </p>
          </div>

          <div className="rounded-lg bg-slate-900/70 p-3">
            <p className="text-slate-500">Risk</p>
            <p className="font-semibold text-white">
              {pick.risk_label ?? pick.reliability_label ?? 'Developing'}
            </p>
          </div>
        </div>

        <details className="mt-4 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            Advanced Details
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
            <Detail label="EV" value={formatPercent(pick.ev)} tone={pick.ev >= 0 ? 'good' : 'bad'} />
            <Detail label="Edge" value={formatPercent(pick.edge)} tone={pick.edge >= 0 ? 'good' : 'bad'} />
            <Detail label="Adaptive" value={adaptiveScore.toFixed(2)} />
            <Detail label="Smart" value={smartScore.toFixed(2)} />
            <Detail label="Internal Status" value={pick.recommendation_status ?? 'n/a'} />
            <Detail label="Reliability" value={pick.reliability_label ?? 'Developing'} />
            <Detail label="Sportsbook" value={pick.sportsbook} />
            <Detail label="Market" value={pick.market} />
          </div>
        </details>

        {strongest && Number(strongest.multiplier) !== 1 && (
          <div className="mt-4 rounded-lg border border-purple-500/20 bg-purple-950/10 p-3">
            <p className="text-xs font-semibold text-purple-300">
              Adaptive Adjustment
            </p>
            <p className="mt-1 text-xs text-slate-300">
              {factorLabel(strongest.factor)} multiplier:{' '}
              <span className="font-bold text-white">
                {Number(strongest.multiplier).toFixed(2)}x
              </span>
            </p>
          </div>
        )}

        <button
          onClick={toggleExplanation}
          disabled={loadingExplanation}
          className="mt-4 w-full rounded-xl border border-cyan-500/30 bg-cyan-950/20 px-4 py-2 text-xs font-bold text-cyan-300 transition hover:bg-cyan-950/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingExplanation
            ? 'Analyzing...'
            : explanation
              ? 'Hide Why'
              : 'Why This Pick?'}
        </button>
      </div>

      {explanation && <PickExplanationCard explanation={explanation} />}
    </div>
  )
}

function PicksColumn({
  title,
  description,
  picks,
}: {
  title: string
  description: string
  picks: Pick[]
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-white">{title}</h3>
        <p className="text-xs text-slate-400">{description}</p>
      </div>

      {picks.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-400">
          No official recommendations in this column. Informational rankings remain available for personal review when grounded candidates exist.
        </div>
      ) : (
        <div className="space-y-3">
          {picks.slice(0, 5).map((pick) => (
            <PickCard key={`${pick.id}-${pick.team}`} pick={pick} />
          ))}
        </div>
      )}
    </div>
  )
}

function BestBetsTodayCard({ bet }: { bet: BestBetToday }) {
  const status = bet.productStatus ?? (bet.official ? 'Official' : 'AI Lean - not a recommendation')
  const category = bet.productCategory ?? (bet.official ? 'Official' : 'AI Lean')
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${categoryClass(bet.marketIntelligenceCategory)}`}>
              {status}
            </span>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300">
              Score {bet.score.toFixed(2)}
            </span>
          </div>
          <p className="mt-3 text-lg font-black text-white">
            #{bet.rank} {bet.selection}{lineText(bet.line)} {bet.marketLabel}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {bet.matchup} · {bet.scheduledTime ? formatDate(bet.scheduledTime) : 'time n/a'}
          </p>
        </div>

        <div className="text-left md:text-right">
          <p className="text-lg font-black text-white">
            {bet.americanOdds === null ? 'N/A' : formatOdds(bet.americanOdds)}
          </p>
          <p className="text-xs text-slate-400">{bet.sportsbook}</p>
        </div>
      </div>

      {bet.statusWarning && (
        <div className="mt-4 whitespace-pre-line rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-xs font-semibold leading-5 text-slate-200">
          {bet.statusWarning}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
        <Detail label="Model" value={formatPercent(bet.modelProbability)} />
        <Detail label="Implied" value={formatPercent(bet.impliedProbability)} />
        <Detail label="EV" value={formatPercent(bet.expectedValue)} tone={bet.expectedValue >= 0 ? 'good' : 'bad'} />
        <Detail label="Edge" value={formatPercent(bet.edge)} tone={bet.edge >= 0 ? 'good' : 'bad'} />
        <Detail label="Confidence" value={formatPercent(bet.confidence)} />
        <Detail label="Feature Quality" value={formatMaybePercent(bet.featureQuality)} />
        <Detail label="Critical Inputs" value={formatPercent(bet.criticalDataCompleteness)} />
        <Detail label="Starter" value={formatMaybePercent(bet.starterConfidence)} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
        <div className="rounded-lg bg-slate-900/70 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Why it ranks</p>
          <ul className="mt-2 space-y-1 text-slate-300">
            {bet.drivers.slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg bg-slate-900/70 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            {category === 'Official' ? 'Risk notes' : 'Why it is not official'}
          </p>
          <ul className="mt-2 space-y-1 text-slate-300">
            {(bet.reasonNotOfficial ? [bet.reasonNotOfficial, ...bet.riskFactors] : bet.riskFactors.length ? bet.riskFactors : ['No additional risk note.']).slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function BestBetsTodaySection({ data }: { data: TopPicksResponse }) {
  const best = data.bestBetsToday
  if (!best) return null
  const notRecommended = best.recommendationMode === 'informational_not_recommended'
  return (
    <div className={notRecommended ? 'rounded-xl border border-amber-500/30 bg-amber-950/10 p-5' : 'rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-5'}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className={notRecommended ? 'text-sm font-black uppercase tracking-[0.18em] text-amber-200' : 'text-sm font-black uppercase tracking-[0.18em] text-emerald-300'}>
            {best.displayLabel}
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            {notRecommended
              ? 'No candidate passed official gates. These are the strongest current AI Leans, Watchlist and Avoid market intelligence rows with blockers shown.'
              : 'Official gates passed. These are the strongest bets from the current supported board.'}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <Detail label="Scanned" value={String(best.summary.candidatesScanned)} />
          <Detail label="Official" value={String(best.summary.officialCandidateCount)} />
          <Detail label="Provider Calls" value={String(best.providerCallsMade)} />
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {best.predictionRegenerationNote}
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {best.bestBets.slice(0, 4).map((bet) => (
          <BestBetsTodayCard key={bet.predictionId} bet={bet} />
        ))}
      </div>
    </div>
  )
}

function Detail({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value?: string
  tone?: 'good' | 'bad' | 'neutral'
}) {
  const color =
    tone === 'good'
      ? 'text-emerald-300'
      : tone === 'bad'
        ? 'text-red-300'
        : 'text-white'
  return (
    <div className="rounded-lg bg-slate-950/70 p-3">
      <p className="text-slate-500">{label}</p>
      <p className={`mt-1 font-bold ${color}`}>{value ?? 'n/a'}</p>
    </div>
  )
}

export default function TopPicksPanel() {
  const [data, setData] = useState<TopPicksResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadTopPicks() {
      try {
        const response = await fetch('/api/predictions/top', {
          cache: 'no-store',
        })

        const json = await response.json()

        if (!response.ok || !json.success) {
          throw new Error(json.error ?? 'Failed to load top picks')
        }

        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    loadTopPicks()
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading top picks...
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

  if (!data) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        No top picks data available.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Pending Picks</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {data.summary.pendingPicks}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Safe To Review</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {data.summary.safePendingPicks ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Good Bets</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">
            {data.summary.recommendedPicks}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Watch</p>
          <p className="mt-1 text-2xl font-bold text-amber-300">
            {data.summary.watchCandidates ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Best Bets</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {data.summary.bestBetsCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">AI Learning</p>
          <p
            className={
              data.adaptiveWeightsAvailable
                ? 'mt-1 text-2xl font-bold text-purple-300'
                : 'mt-1 text-2xl font-bold text-slate-500'
            }
          >
            {data.adaptiveWeightsAvailable ? 'ON' : 'OFF'}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4 text-sm leading-6 text-amber-100">
        Official picks are still off. Pick Analyzer will only show a bet here
        after the model has enough real, calibrated proof.
      </div>

      <BestBetsTodaySection data={data} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <PicksColumn
          title="Best Bets Today"
          description="The clearest bets once official recommendations are enabled."
          picks={data.bestBets}
        />

        <PicksColumn
          title="Top EV Picks"
          description="Prices that could offer the best value."
          picks={data.topEv}
        />

        <PicksColumn
          title="Top Confidence"
          description="Sides the model trusts most."
          picks={data.topConfidence}
        />
      </div>
    </div>
  )
}
