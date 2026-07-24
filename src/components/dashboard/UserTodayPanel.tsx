'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'
import AiPerformancePreviewCard from '@/components/dashboard/AiPerformancePreviewCard'
import DataFreshnessPreviewCard from '@/components/dashboard/DataFreshnessPreviewCard'

type CategoryCounts = {
  official: number
  aiLeans: number
  watchlist: number
  modelOnly?: number
  pass?: number
  avoid: number
}

type TodayResponse = {
  success: boolean
  status?: 'AVAILABLE' | 'PARTIAL' | 'DEGRADED' | 'UNAVAILABLE'
  generatedAt: string
  operatingDate: string
  nextSlateDate: string | null
  currentGames: number
  upcomingGames: number
  finalGames: number
  lifecycleCounts?: {
    totalScheduledToday: number
    upcoming: number
    live: number
    final: number
    postponed: number
    canceled: number
    suspended: number
    statusUnconfirmed: number
    bettingEligible: number
    bettingLocked: number
    missingMarket: number
  }
  gamesWaitingForOdds: number
  gamesReadyForAnalysis: number
  predictionCandidates: number
  officialPicks: number
  marketIntelligence?: CategoryCounts
  freshness: 'fresh' | 'partial' | 'stale' | 'empty'
  nextAction: string
  summary: {
    recommendation: string
    aiBriefing: string
    currentOperatingDay: string
    nextSlate: string
    marketPrices: string
  }
  currentGameCards: Array<Record<string, any>>
  nextSlateGames: Array<Record<string, any>>
  partial?: boolean
  warnings?: string[]
  errors?: Array<{ dependency: string; message: string; critical: boolean }>
  timing?: { totalMs?: number; dependencies?: Record<string, number>; slowDependencies?: string[] }
  latestOddsTimestamp?: string | null
  nextActionAt?: string | null
  pipeline?: Array<{
    id: string
    label: string
    status: 'Complete' | 'Running' | 'Waiting' | 'Blocked' | 'Not due'
    detail: string
  }>
  sections?: {
    officialPicks?: { status: string; data: OfficialPick[]; reason: string | null }
    aiPicksFeed?: { status: string; data: AiPicksFeed | null; reason: string | null }
    mostLikely?: { status: string; data: IntelligenceRow[]; reason: string | null }
    bestValue?: { status: string; data: IntelligenceRow[]; reason: string | null }
    aiBetFinder?: { status: string; data: IntelligenceRow[]; reason: string | null }
    modelIntelligence?: { status: string; data: any; reason: string | null }
    topOpportunity?: { status: string; data: TopOpportunity | null; reason: string | null }
  }
}

type PipelineTraceDay = {
  date: string
  label?: string
  counts: {
    gamesScheduled: number
    gamesEligibleBeforeStart: number
    oddsSnapshotsAvailable: number
    predictionsGenerated: number
    predictionsValidPregame?: number
    predictionsExcludedAfterCutoff?: number
    currentBoardCandidates: number
    modelOnlyRows: number
    aiLeans: number
    watchlist: number
    bestValue: number
    officialPicks: number
    gamesCompleted: number
    productionPredictionsSettled: number
    learningSamplesQueued: number
    learningSamplesAccepted: number
    learningSamplesRejected: number
    weightUpdates: number
  }
  coverage?: {
    gamesDetected: number
    gamesPredicted: number
    gamesSettled: number
    gamesLearned: number
    gamesMissed: number
    predictionsValidPregame?: number
    predictionsExcludedAfterCutoff?: number
    missReasons: Record<string, number>
    predictionCoveragePct: number | null
    settlementCoveragePct: number | null
    learningDecisionCoveragePct: number | null
    noPostStartPredictions: boolean
    noPostFinalPredictions: boolean
  }
  zeroReasonCodes?: string[]
  gameLifecycles?: Array<Record<string, unknown>>
}

type RecommendationPipelineTraceResponse = {
  success?: boolean
  providerCallsMade?: number
  remoteMutationsMade?: number
  days?: PipelineTraceDay[]
  today?: PipelineTraceDay
  yesterday?: PipelineTraceDay
}

type TopOpportunity = {
  predictionId?: string
  title?: string
  matchup?: string
  marketLabel?: string
  selection?: string
  probability?: number
  calibratedProbability?: number | null
  rawProbability?: number | null
  modelProbability?: number | null
  confidence?: number
  edge?: number | null
  expectedValue?: number | null
  statusLabel?: string
  opportunityCategory?: string
  marketIntelligenceCategory?: string
  canonicalMarketState?: string
  marketValueQuality?: string
  marketFreshnessState?: string
  improvementPath?: string | null
  scheduledTime?: string
  gameTime?: string
  odds?: number | null
  americanOdds?: number | null
  sportsbook?: string | null
  line?: number | null
  oddsAgeMinutes?: number | null
  marketAlignment?: MarketAlignment
  recommendationExplanation?: RecommendationExplanation
}

type MarketAlignment = {
  alignmentStatus?: string
  freshnessStatus?: string
  americanOdds?: number | null
  decimalOdds?: number | null
  sportsbook?: string | null
  modelProbability?: number | null
  marketImpliedProbability?: number | null
  edgePercentagePoints?: number | null
  expectedValuePercent?: number | null
  snapshotEdgePercentagePoints?: number | null
  snapshotExpectedValuePercent?: number | null
  actionableEdgePercentagePoints?: number | null
  actionableExpectedValuePercent?: number | null
  actionableUnavailableReason?: string | null
  marketAgeMinutes?: number | null
  providerSourceAgeMinutes?: number | null
  snapshotIngestionAgeMinutes?: number | null
  risk?: string
  recommendationCategory?: string | null
  calculationVersion?: string
}

type RecommendationEvidenceItem = {
  code?: string
  label?: string
  value?: string | number | null
  severity?: 'positive' | 'neutral' | 'warning' | 'negative'
  sourceField?: string
  text?: string
}

type RecommendationExplanation = {
  explanationVersion?: string
  category?: string
  headline?: string
  summary?: string
  primaryReasons?: RecommendationEvidenceItem[]
  secondaryReasons?: RecommendationEvidenceItem[]
  blockers?: RecommendationEvidenceItem[]
  promotionConditions?: string[]
  riskWarnings?: RecommendationEvidenceItem[]
  evidence?: RecommendationEvidenceItem[]
  alignmentStatus?: string
  freshnessStatus?: string
  confidenceStatus?: string
  valueStatus?: string
  actionLabel?: string
  fairOdds?: number | null
  fairOddsLabel?: string | null
}

type OfficialPick = {
  contractVersion?: string
  status?: string
  predictionId?: string
  eventId?: string
  matchup?: string
  scheduledTime?: string | null
  market?: string
  marketLabel?: string
  period?: string
  selection?: string
  normalizedSelection?: string
  line?: number | null
  americanOdds?: number | null
  sportsbook?: string
  modelProbability?: number | null
  calibratedProbability?: number | null
  impliedProbability?: number | null
  marketImpliedProbability?: number | null
  edgePercentagePoints?: number | null
  expectedValuePercent?: number | null
  confidence?: number | null
  confidenceLabel?: string
  risk?: string
  freshnessStatus?: string
  marketAgeMinutes?: number | null
  maxAllowedAgeMinutes?: number
  oddsSnapshotId?: string | null
  featureSnapshotId?: string | null
  selectedOddsSource?: string
  selectedOddsLineage?: {
    oddsSnapshotId?: string | null
    marketInputTimestamp?: string | null
    marketFreshnessTimestamp?: string | null
    marketFreshnessSource?: string
    providerSourceUpdatedAt?: string | null
    providerFetchedAt?: string | null
    oddsIngestedAt?: string | null
    oddsSnapshotCreatedAt?: string | null
  }
  marketAlignment?: MarketAlignment
  recommendationExplanation?: RecommendationExplanation
  modelFairOdds?: number | null
  modelFairOddsLabel?: string | null
  eligibility?: {
    eligibilityVersion?: string
    thresholdsVersion?: string
    recommendationPolicyStatus?: string
    officialEligibility?: string
    blockers?: string[]
  }
  timestamps?: {
    predictionGeneratedAt?: string | null
    recommendationGeneratedAt?: string | null
    recommendationTimestampSource?: string
    cutoffAt?: string | null
  }
  stakeRecommendation?: {
    status?: string
    reason?: string
    units?: number | null
    kellyFraction?: number | null
  }
  actionLabel?: string
}

type AiPicksFeedItem = {
  id?: string
  contractVersion?: string
  itemType?: 'OFFICIAL_PICK' | 'BEST_BET_TODAY' | 'BEST_VALUE' | 'MOST_LIKELY' | 'WATCH_CLOSELY' | 'HIDDEN_VALUE' | 'AVOID' | 'DATA_RISK' | 'MARKET_UPDATE'
  priority?: number
  actionLabel?: string
  predictionId?: string
  eventId?: string
  matchup?: string
  scheduledTime?: string | null
  market?: string
  marketLabel?: string
  selection?: string
  line?: number | null
  americanOdds?: number | null
  sportsbook?: string
  modelProbability?: number | null
  calibratedProbability?: number | null
  impliedProbability?: number | null
  marketImpliedProbability?: number | null
  edgePercentagePoints?: number | null
  expectedValuePercent?: number | null
  confidence?: number | null
  risk?: string
  freshnessStatus?: string
  marketAgeMinutes?: number | null
  oddsSnapshotId?: string | null
  featureSnapshotId?: string | null
  predictionGeneratedAt?: string | null
  recommendationGeneratedAt?: string | null
  marketInputTimestamp?: string | null
  marketFreshnessTimestamp?: string | null
  marketFreshnessSource?: string
  marketAlignment?: MarketAlignment
  recommendationExplanation?: RecommendationExplanation
  officialPick?: OfficialPick | null
  evidence?: string[]
  warnings?: string[]
  blocker?: string | null
  promotionCondition?: string | null
}

type AiPicksFeed = {
  contractVersion?: string
  status?: string
  generatedAt?: string
  sportKey?: string
  itemCount?: number
  items?: AiPicksFeedItem[]
  emptyState?: {
    headline?: string
    summary?: string
    topOpportunityRetained?: boolean
  } | null
  summary?: Record<string, number>
  guardrails?: {
    providerCallsMade?: number
    remoteMutationsMade?: number
    officialPolicyChanged?: boolean
    recommendationThresholdsChanged?: boolean
    categoryAssignmentsChanged?: boolean
    rankingsChanged?: boolean
    fabricatedMarketMovement?: boolean
  }
}

type TopOpportunityResponse = {
  success: boolean
  topPick?: { candidate?: TopOpportunity }
  opportunities?: TopOpportunity[]
}

type IntelligenceRow = {
  id?: string
  predictionId?: string
  eventId?: string
  matchup?: string
  market?: string
  marketLabel?: string
  selection?: string
  sportsbook?: string
  line?: number | null
  probability?: number
  calibratedProbability?: number | null
  rawProbability?: number
  modelProbability?: number | null
  confidence?: number
  edge?: number
  expectedValue?: number
  valueScore?: number
  odds?: number
  americanOdds?: number
  statusLabel?: string
  opportunityCategory?: string
  marketIntelligenceCategory?: string
  semanticLabel?: string
  recommendation?: string
  why?: string
  reasonNotOfficial?: string
  strengths?: string[]
  weaknesses?: string[]
  missingData?: string[]
  blockers?: string[]
  missingInformation?: string[]
  warnings?: string[]
  oddsTimestamp?: string | null
  oddsAgeMinutes?: number | null
  marketAlignment?: MarketAlignment
  recommendationExplanation?: RecommendationExplanation
  modeledValueStatus?: string
  probabilityOrigin?: string
  recommendationPolicyStatus?: string
  officialEligibility?: string
}

type IntelligenceResponse = {
  success: boolean
  summary?: Record<string, any>
  topPick?: { candidate?: IntelligenceRow }
  opportunities?: IntelligenceRow[]
  results?: IntelligenceRow[]
}

const cardMotion = 'transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-xl hover:shadow-black/20'

function dateText(value: string | null) {
  if (!value) return 'Not scheduled'
  return new Date(`${value}T12:00:00.000Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function timeText(value: unknown) {
  if (!value) return 'Time pending'
  const parsed = new Date(String(value))
  if (!Number.isFinite(parsed.getTime())) return 'Time pending'
  return parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Puerto_Rico',
    timeZoneName: 'short',
  })
}

function relativeTime(value: unknown) {
  if (!value) return null
  const parsed = new Date(String(value)).getTime()
  if (!Number.isFinite(parsed)) return null
  const seconds = Math.max(0, Math.round((Date.now() - parsed) / 1000))
  if (seconds < 60) return 'Updated just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `Updated ${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `Updated ${days} day${days === 1 ? '' : 's'} ago`
}

function timestampText(value: unknown, fallback = 'Waiting for next scheduler execution') {
  if (!value) return fallback
  return `${relativeTime(value) ?? 'Updated'} / ${timeText(value)}`
}

function humanStatus(value: unknown) {
  const raw = String(value ?? '').toLowerCase()
  if (raw.includes('unconfirmed')) return 'Status Unconfirmed'
  if (raw.includes('starting_soon')) return 'Starting Soon'
  if (raw.includes('in_progress') || raw.includes('live')) return 'Live'
  if (raw.includes('final') || raw.includes('complete')) return 'Final'
  if (raw.includes('pregame') || raw.includes('scheduled')) return 'Pregame'
  if (raw.includes('postponed')) return 'Postponed'
  if (raw.includes('suspended')) return 'Suspended'
  if (raw.includes('delayed')) return 'Delayed'
  if (raw.includes('canceled') || raw.includes('cancelled')) return 'Canceled'
  if (raw.includes('waiting')) return 'Waiting for Update'
  return 'Tracking'
}

function simpleAction(text: string) {
  const lower = text.toLowerCase()
  if (lower.includes('sync final')) return 'Waiting for final scores.'
  if (lower.includes('morning')) return 'Schedule sync is the next lifecycle step.'
  if (lower.includes('odds')) return 'Waiting for updated betting odds.'
  if (lower.includes('refresh')) return 'The AI will refresh when odds update.'
  return text.replaceAll('_', ' ')
}

function categoryTone(category?: string): 'green' | 'yellow' | 'blue' | 'red' | 'gray' {
  if (category === 'official' || category === 'Official') return 'green'
  if (category === 'ai_lean' || category === 'AI Lean') return 'yellow'
  if (category === 'watchlist' || category === 'Watchlist' || category === 'model_only' || category === 'Model Only' || category === 'pass' || category === 'Pass') return 'blue'
  if (category === 'avoid' || category === 'Avoid') return 'red'
  return 'gray'
}

function toneClasses(tone: 'green' | 'yellow' | 'blue' | 'red' | 'gray') {
  return {
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    yellow: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    blue: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
    red: 'border-red-500/30 bg-red-500/10 text-red-100',
    gray: 'border-slate-700 bg-slate-900/80 text-slate-100',
  }[tone]
}

function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'green' | 'yellow' | 'blue' | 'red' | 'gray' }) {
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${toneClasses(tone)}`}>{children}</span>
}

function formatPercent(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 'Not available'
  const percent = parsed > 0 && parsed <= 1 ? parsed * 100 : parsed
  if (percent < 0) return 'Not available'
  return `${Math.min(100, percent).toFixed(1)}%`
}

function percentNumber(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  const percent = parsed > 0 && parsed <= 1 ? parsed * 100 : parsed
  if (percent < 0) return null
  return Math.min(100, percent)
}

function finiteNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function positiveFiniteNumber(value: unknown) {
  const parsed = finiteNumber(value)
  return parsed !== null && parsed > 0 ? parsed : null
}

function candidateDisplayProbability(candidate: {
  calibratedProbability?: unknown
  rawProbability?: unknown
  modelProbability?: unknown
}) {
  const calibrated = positiveFiniteNumber(candidate.calibratedProbability)
  if (calibrated !== null) return calibrated
  const raw = positiveFiniteNumber(candidate.rawProbability)
  if (raw !== null) return raw
  const model = positiveFiniteNumber(candidate.modelProbability)
  if (model !== null) return model
  return null
}

function topOpportunityProbability(opportunity: TopOpportunity | null) {
  return opportunity ? candidateDisplayProbability(opportunity) : null
}

function mergeTopOpportunityProbability(opportunity: TopOpportunity | null, rows: IntelligenceRow[]) {
  if (!opportunity) return null
  const match = rows.find((row) => row.predictionId && row.predictionId === opportunity.predictionId)
  if (!match) return opportunity
  return {
    ...opportunity,
    calibratedProbability: opportunity.calibratedProbability ?? match.calibratedProbability,
    rawProbability: opportunity.rawProbability ?? match.rawProbability,
    modelProbability: opportunity.modelProbability ?? match.modelProbability,
  }
}

function meterColor(tone: 'green' | 'yellow' | 'blue' | 'red' | 'gray') {
  return {
    green: 'bg-emerald-400',
    yellow: 'bg-amber-300',
    blue: 'bg-sky-300',
    red: 'bg-red-300',
    gray: 'bg-slate-400',
  }[tone]
}

function Meter({ label, value, tone = 'blue' }: { label: string; value: unknown; tone?: 'green' | 'yellow' | 'blue' | 'red' | 'gray' }) {
  const percent = percentNumber(value)
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="text-sm font-black text-white">{formatPercent(value)}</p>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-800" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}>
        {percent !== null && <div className={`h-full rounded-full ${meterColor(tone)} transition-all duration-700 ease-out`} style={{ width: `${percent}%` }} />}
      </div>
    </div>
  )
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-6">
      <p className="text-base font-black text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  )
}

function QuickNumber({ label, value, tone }: { label: string; value: number; tone: 'green' | 'yellow' | 'blue' | 'red' }) {
  const color = {
    green: 'text-emerald-200',
    yellow: 'text-amber-200',
    blue: 'text-sky-200',
    red: 'text-red-200',
  }[tone]
  return (
    <div className={`rounded-lg border border-white/10 bg-slate-950/70 p-4 ${cardMotion}`}>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-black ${color}`}>{value}</p>
    </div>
  )
}

function marketSentiment(data: TodayResponse, counts: CategoryCounts) {
  if (counts.official > 0) return { label: 'AGGRESSIVE', tone: 'green' as const }
  if (counts.aiLeans > 0 || data.gamesReadyForAnalysis > 0 || data.predictionCandidates > 0) return { label: 'SELECTIVE', tone: 'yellow' as const }
  if (data.gamesWaitingForOdds > 0 || data.freshness === 'empty') return { label: 'ODDS PENDING', tone: 'blue' as const }
  return { label: 'DEFENSIVE', tone: 'red' as const }
}

function DecisionHero({ data, counts }: { data: TodayResponse; counts: CategoryCounts }) {
  const decision = data.officialPicks > 0
    ? 'BET TODAY'
    : counts.aiLeans > 0 || counts.watchlist > 0 || data.gamesWaitingForOdds > 0 || data.upcomingGames > 0
      ? 'WAIT FOR ODDS'
      : 'STAY OUT'
  const tone = data.officialPicks > 0 ? 'green' : counts.aiLeans > 0 ? 'yellow' : data.gamesWaitingForOdds > 0 || data.upcomingGames > 0 ? 'blue' : 'gray'
  const sentiment = marketSentiment(data, counts)
  const gamesToday = data.currentGames || data.upcomingGames
  const summary = data.officialPicks > 0
    ? `${data.officialPicks} Official Pick${data.officialPicks === 1 ? '' : 's'} meet the standard.`
    : counts.aiLeans > 0
      ? `${counts.aiLeans} AI Lean${counts.aiLeans === 1 ? '' : 's'} are available, but no Official Pick.`
      : data.gamesWaitingForOdds > 0
        ? 'Sportsbook odds are needed before picks can be finalized.'
        : 'No play meets the Official standard right now.'

  return (
    <section className={`overflow-hidden rounded-lg border p-5 md:p-6 ${toneClasses(tone)} ${cardMotion}`}>
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">AI Market Outlook</p>
          <h2 className="mt-2 text-4xl font-black tracking-normal text-white md:text-6xl">{decision}</h2>
          <p className="mt-3 max-w-2xl text-base font-semibold leading-6 text-slate-100">{summary}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone={sentiment.tone}>Market Mood: {sentiment.label}</Badge>
            <Badge tone="gray">Updated {timeText(data.generatedAt)}</Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-96">
          <QuickNumber label="Official Picks" value={counts.official} tone="green" />
          <QuickNumber label="Games Today" value={gamesToday} tone="blue" />
          <a href="/most-likely" className="col-span-2 inline-flex items-center justify-center rounded-lg bg-white px-4 py-3 text-sm font-black text-slate-950 outline-none transition hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-white sm:col-span-1">View Opportunities</a>
        </div>
      </div>
    </section>
  )
}

function CategoryCard({ title, value, tone, icon, href, status, tooltip }: { title: string; value: number; tone: 'green' | 'yellow' | 'blue' | 'red'; icon: string; href: string; status: string; tooltip: string }) {
  return (
    <article className={`rounded-lg border p-5 ${toneClasses(tone)} ${cardMotion}`} title={tooltip}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-slate-950/50 text-sm font-black text-white">{icon}</span>
          <p className="mt-4 text-sm font-black text-white">{title}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${meterColor(tone)}`} />
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-300">{status}</p>
          </div>
        </div>
        <p className="text-4xl font-black text-white">{value}</p>
      </div>
      <a href={href} className="mt-5 inline-flex w-full items-center justify-center rounded-lg border border-white/15 bg-slate-950/50 px-4 py-2 text-sm font-black text-white outline-none transition hover:bg-slate-950/80 focus-visible:ring-2 focus-visible:ring-white">View</a>
    </article>
  )
}

function fieldValue(value: unknown, fallback = 'Pending') {
  const text = String(value ?? '').trim()
  const normalized = text.toLowerCase().replaceAll('_', ' ')
  if (!text) return fallback === 'Pending' ? 'Awaiting update' : fallback
  if (normalized === 'no market') return 'Waiting for sportsbook odds'
  if (normalized === 'not available' || normalized === 'n/a' || normalized === 'unavailable') return 'Not available yet'
  if (normalized === 'pending') return 'Awaiting update'
  if (normalized === 'waiting') return 'Waiting for update'
  return text.replaceAll('_', ' ')
}

function OfficialPickExperienceCard({ picks, reason, topOpportunity }: { picks: OfficialPick[]; reason?: string | null; topOpportunity: TopOpportunity | null }) {
  const pick = picks[0] ?? null
  if (!pick) {
    return (
      <section className={`rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-6 ${cardMotion}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Official Pick</p>
            <h3 className="mt-3 text-3xl font-black text-white">No Official Pick today.</h3>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
              {reason ?? 'No current candidate meets the existing Official Pick policy. The top tracked market remains informational and is not being promoted.'}
            </p>
          </div>
          <Badge tone="green">Policy Preserved</Badge>
        </div>
        {topOpportunity ? (
          <p className="mt-4 rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-sm font-bold text-slate-300">
            Top tracked market is still shown below as informational: {fieldValue(topOpportunity.matchup)} · {fieldValue(topOpportunity.selection)} {fieldValue(topOpportunity.marketLabel)}.
          </p>
        ) : null}
      </section>
    )
  }

  const explanation = pick.recommendationExplanation
  return (
    <section className={`rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-6 ${cardMotion}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Official Pick</p>
          <h3 className="mt-3 text-3xl font-black text-white">{fieldValue(pick.matchup, 'Teams pending')}</h3>
          <p className="mt-2 text-sm font-bold text-emerald-100">{fieldValue(pick.selection)} · {fieldValue(pick.marketLabel)}</p>
        </div>
        <Badge tone="green">{fieldValue(pick.actionLabel, 'Official Pick')}</Badge>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-slate-950/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Price</p>
          <p className="mt-2 text-base font-black text-white">{fieldValue(pick.selection)} {formatAmericanOdds(pick.americanOdds) ?? 'n/a'}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{fieldValue(pick.sportsbook, 'Consensus')}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-slate-950/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Model Fair Odds</p>
          <p className="mt-2 text-base font-black text-white">{fieldValue(pick.modelFairOddsLabel, 'Unavailable')}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">Not an Official threshold</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-slate-950/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Freshness</p>
          <p className="mt-2 text-base font-black text-white">{pick.marketAgeMinutes === null || pick.marketAgeMinutes === undefined ? 'Age pending' : `${Math.round(pick.marketAgeMinutes)} min old`}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{fieldValue(pick.freshnessStatus, 'Pending')}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-slate-950/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Risk</p>
          <p className="mt-2 text-base font-black text-white">{fieldValue(pick.risk, 'Pending')}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{fieldValue(pick.eligibility?.recommendationPolicyStatus, 'Policy pending')}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
        <Meter label="Model Probability" value={pick.modelProbability} tone="blue" />
        <Meter label="Market Implied" value={pick.marketImpliedProbability ?? pick.impliedProbability} tone="yellow" />
        <Meter label="Model Edge" value={pick.edgePercentagePoints} tone="blue" />
        <Meter label="Expected Value" value={pick.expectedValuePercent} tone="green" />
        <Meter label="Confidence" value={pick.confidence} tone="green" />
      </div>
      {explanation?.summary ? (
        <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/70 p-4">
          <p className="text-sm font-black text-white">{fieldValue(explanation.headline, 'Official Pick evidence')}</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{explanation.summary}</p>
        </div>
      ) : null}
      <div className="mt-4 grid gap-3 text-xs font-bold text-slate-500 md:grid-cols-3">
        <p>Odds snapshot: {fieldValue(pick.oddsSnapshotId, 'prediction price')}</p>
        <p>Prediction: {timeText(pick.timestamps?.predictionGeneratedAt)}</p>
        <p>Stake: {pick.stakeRecommendation?.status === 'UNAVAILABLE' ? 'Not attached' : fieldValue(pick.stakeRecommendation?.units)}</p>
      </div>
    </section>
  )
}

function feedTone(item: AiPicksFeedItem) {
  const type = String(item.itemType ?? '').toLowerCase()
  if (type.includes('official') || type.includes('best_bet') || type.includes('best_value')) return 'green'
  if (type.includes('avoid') || type.includes('risk')) return 'red'
  if (type.includes('watch') || type.includes('update')) return 'blue'
  return 'yellow'
}

function feedProbability(item: AiPicksFeedItem) {
  return candidateDisplayProbability({
    calibratedProbability: item.calibratedProbability,
    rawProbability: item.modelProbability,
    modelProbability: item.modelProbability,
  })
}

function feedItemTitle(item: AiPicksFeedItem) {
  const label = fieldValue(item.actionLabel, 'AI Pick')
  return `${label}: ${fieldValue(item.selection, 'Selection pending')}`
}

function AiPicksFeedPanel({ feed, reason, pipelineToday }: { feed: AiPicksFeed | null | undefined; reason?: string | null; pipelineToday?: PipelineTraceDay | null }) {
  const items = Array.isArray(feed?.items) ? feed.items : []
  const traceCounts = pipelineToday?.counts
  const traceReason = traceReasonSummary(pipelineToday)
  const emptyDetail = traceCounts
    ? `${traceCounts.predictionsGenerated} stored prediction${traceCounts.predictionsGenerated === 1 ? '' : 's'} were generated for ${traceCounts.gamesScheduled} scheduled game${traceCounts.gamesScheduled === 1 ? '' : 's'}; ${traceCounts.predictionsValidPregame ?? traceCounts.predictionsGenerated} valid pregame and ${traceCounts.predictionsExcludedAfterCutoff ?? 0} excluded after cutoff. ${traceCounts.bestValue} Best Value candidate${traceCounts.bestValue === 1 ? '' : 's'} and ${traceCounts.officialPicks} Official Pick${traceCounts.officialPicks === 1 ? '' : 's'} passed current gates. ${traceReason ? `Reason codes: ${traceReason}.` : 'No additional miss reason was recorded.'}`
    : reason ?? feed?.emptyState?.summary ?? 'No current-board candidate produced a feed item. No pick is promoted from an empty feed.'
  if (!items.length) {
    return (
      <section className={`rounded-lg border border-slate-800 bg-slate-900/80 p-6 ${cardMotion}`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">AI Picks Feed</p>
            <h3 className="mt-2 text-3xl font-black text-white">{fieldValue(feed?.emptyState?.headline, 'No AI picks feed items')}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              {emptyDetail}
            </p>
          </div>
          <Badge tone="yellow">{fieldValue(feed?.status, 'EMPTY_VALID')}</Badge>
        </div>
      </section>
    )
  }

  return (
    <section className={`rounded-lg border border-slate-800 bg-slate-900/80 p-6 ${cardMotion}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">AI Picks Feed</p>
          <h3 className="mt-2 text-3xl font-black text-white">{items.length} grounded update{items.length === 1 ? '' : 's'}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="blue">{fieldValue(feed?.contractVersion, 'mlb_ai_picks_feed_v1')}</Badge>
          <Badge tone={feed?.guardrails?.providerCallsMade === 0 && feed?.guardrails?.remoteMutationsMade === 0 ? 'green' : 'red'}>Read only</Badge>
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        {items.slice(0, 8).map((item, index) => {
          const alignment = item.marketAlignment
          const explanation = item.recommendationExplanation
          return (
            <article key={item.id ?? `${item.predictionId}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={feedTone(item)}>{fieldValue(item.actionLabel, item.itemType)}</Badge>
                    <Badge tone="gray">{fieldValue(item.marketLabel ?? item.market, 'Market')}</Badge>
                    <Badge tone={item.freshnessStatus === 'STALE' ? 'red' : item.freshnessStatus === 'FRESH' ? 'green' : 'yellow'}>{fieldValue(item.freshnessStatus, 'Freshness pending')}</Badge>
                  </div>
                  <h4 className="mt-3 text-xl font-black text-white">{feedItemTitle(item)}</h4>
                  <p className="mt-1 text-sm text-slate-400">{fieldValue(item.matchup, 'Game pending')} · {timeText(item.scheduledTime)}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{fieldValue(explanation?.headline ?? item.evidence?.[0], 'Stored Current Board evidence.')}</p>
                  {item.blocker || item.promotionCondition ? (
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      {item.blocker ? `Blocker: ${item.blocker}` : 'No blocker'} · {item.promotionCondition ?? 'No promotion condition attached'}
                    </p>
                  ) : null}
                </div>
                <div className="grid min-w-44 gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Price</p>
                    <p className="mt-1 text-base font-black text-white">{marketDisplay(item as Record<string, any>).priceText}</p>
                    <p className="text-xs font-bold text-slate-500">{fieldValue(item.sportsbook, 'Consensus')}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Meter label="Model" value={feedProbability(item)} tone="blue" />
                    <Meter label="Implied" value={alignment?.marketImpliedProbability ?? item.marketImpliedProbability} tone="yellow" />
                    <Meter label="Edge" value={alignment?.edgePercentagePoints ?? item.edgePercentagePoints} tone="blue" />
                    <Meter label="EV" value={alignment?.expectedValuePercent ?? item.expectedValuePercent} tone={Number(alignment?.expectedValuePercent ?? item.expectedValuePercent ?? 0) > 0 ? 'green' : 'red'} />
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Risk {fieldValue(item.risk, 'Pending')} · Market age {compactMarketAge(item)} · Odds snapshot {fieldValue(item.oddsSnapshotId, 'n/a')}
              </p>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function TopOpportunityCard({ opportunity }: { opportunity: TopOpportunity | null }) {
  if (!opportunity) return <EmptyState title="Top Tracked Market" detail="No opportunity is ready to display yet." />
  const category = opportunity.opportunityCategory ?? opportunity.statusLabel ?? 'Tracking'
  const tone = categoryTone(opportunity.marketIntelligenceCategory ?? category)
  const probability = topOpportunityProbability(opportunity)
  const displayMarket = marketDisplay(opportunity)
  const alignment = opportunity.marketAlignment
  const explanation = opportunity.recommendationExplanation
  const aligned = alignment?.alignmentStatus === 'ALIGNED'
  const actionabilityBlocked = Boolean(alignment?.actionableUnavailableReason)
  const title = Number(alignment?.actionableExpectedValuePercent ?? opportunity.expectedValue ?? 0) > 0 && !actionabilityBlocked
    ? 'Top Tracked Market'
    : 'Highest-Ranked Market Under Review'

  return (
    <section className={`rounded-lg border border-slate-800 bg-slate-900/80 p-6 ${cardMotion}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{title}</p>
          <h3 className="mt-3 text-3xl font-black text-white">{fieldValue(opportunity.matchup, 'Teams pending')}</h3>
        </div>
        <Badge tone={tone}>{category}</Badge>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Market</p>
          <p className="mt-2 text-base font-black text-white">{displayMarket.priceText}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{fieldValue(opportunity.marketLabel)}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Sportsbook</p>
          <p className="mt-2 text-base font-black text-white">{fieldValue(displayMarket.sportsbook, 'Consensus')}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Recommendation</p>
          <p className="mt-2 text-base font-black text-white">{category}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Market Age</p>
          <p className="mt-2 text-base font-black text-white">{compactMarketAge(opportunity)}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{fieldValue(alignment?.freshnessStatus, 'Pending')}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
        <Meter label="Probability" value={probability} tone="blue" />
        <Meter label="Market Implied" value={aligned ? alignment?.marketImpliedProbability : null} tone="yellow" />
        <Meter label="Snapshot Edge" value={aligned ? alignment?.snapshotEdgePercentagePoints ?? alignment?.edgePercentagePoints : null} tone="blue" />
        <Meter label={actionabilityBlocked ? 'Actionable EV' : 'Expected Value'} value={actionabilityBlocked ? null : aligned ? alignment?.actionableExpectedValuePercent ?? alignment?.expectedValuePercent : null} tone={Number(alignment?.actionableExpectedValuePercent ?? alignment?.expectedValuePercent ?? 0) > 0 && !actionabilityBlocked ? 'green' : 'red'} />
        <Meter label="Confidence" value={opportunity.confidence} tone={tone} />
      </div>
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        Alignment {fieldValue(alignment?.alignmentStatus, 'Pending')} | Risk {fieldValue(alignment?.risk, riskLabel(opportunity as IntelligenceRow))}
        {actionabilityBlocked ? ` | Actionable value unavailable: ${fieldValue(alignment?.actionableUnavailableReason, 'market input unavailable')}` : ''}
      </p>
      {explanation?.summary ? (
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-black text-white">{fieldValue(explanation.headline, category)}</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{explanation.summary}</p>
          {explanation.promotionConditions?.[0] ? <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{explanation.promotionConditions[0]}</p> : null}
        </div>
      ) : null}
      <div className="mt-5">
        <a href="/most-likely" className="inline-flex rounded-full bg-white px-5 py-2 text-sm font-black text-slate-950 outline-none transition hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-white">View Details</a>
      </div>
    </section>
  )
}

function confidenceLabel(value: number | null) {
  if (value === null) return 'Unavailable'
  if (value >= 96) return 'Elite'
  if (value >= 85) return 'Very High'
  if (value >= 70) return 'High'
  if (value >= 66) return 'Moderate'
  if (value >= 58) return 'Limited'
  return 'Low'
}

function probabilityCategory(value: unknown) {
  const probability = percentNumber(value)
  if (probability === null) return 'Limited'
  if (probability >= 75) return 'Elite Probability'
  if (probability >= 65) return 'High Probability'
  if (probability >= 55) return 'Solid Probability'
  return 'Limited'
}

function riskLabel(row: IntelligenceRow) {
  const confidence = percentNumber(row.confidence)
  const warnings = (row.warnings?.length ?? 0) + (row.weaknesses?.length ?? 0) + (row.missingData?.length ?? 0)
  if (warnings >= 3 || (confidence !== null && confidence < 55)) return 'Elevated'
  if (warnings || (confidence !== null && confidence < 68)) return 'Moderate'
  return 'Controlled'
}

function rowArray(value: unknown) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : []
}

function intelligenceCategory(row: IntelligenceRow): string {
  if (row.recommendationExplanation?.category) return row.recommendationExplanation.category
  if (row.marketIntelligenceCategory) return row.marketIntelligenceCategory
  const official =
    row.officialEligibility === 'OFFICIAL_ELIGIBLE_CANDIDATE' &&
    ['QUALIFIED', 'BEST_BET_CANDIDATE', 'PLAY_OF_DAY_CANDIDATE'].includes(String(row.recommendationPolicyStatus ?? ''))
  if (official) return 'official'

  const rawProbability = candidateDisplayProbability(row) ?? 0
  const confidence = percentNumber(row.confidence) ?? 0
  const edge = Number(row.edge ?? 0)
  const expectedValue = Number(row.expectedValue ?? 0)
  const probabilityOrigin = String(row.probabilityOrigin ?? '').toLowerCase()
  const modelSignal =
    row.modeledValueStatus === 'MODELED_VALUE' ||
    edge > 0 ||
    expectedValue > 0 ||
    (rawProbability >= 45 && confidence >= 45)
  const clearAvoid =
    expectedValue < -20 ||
    edge < -15 ||
    confidence < 40 ||
    probabilityOrigin === 'fallback' ||
    probabilityOrigin === 'unavailable'
  if (modelSignal && !clearAvoid) return 'ai_lean'

  const marketOrContext = [
    ...rowArray(row.blockers),
    ...rowArray(row.missingInformation),
    ...rowArray(row.missingData),
  ].join(' ').toLowerCase()
  if (/lineup|injur|bullpen|weather|market|odds|calibration|starter/.test(marketOrContext) && confidence >= 40 && rawProbability >= 35) {
    return 'watchlist'
  }
  return 'pass'
}

function signedNumber(value: unknown, suffix = '') {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 'n/a'
  return `${parsed > 0 ? '+' : ''}${parsed.toFixed(2)}${suffix}`
}

function marketField(value: unknown) {
  const text = String(value ?? '').trim()
  return text.length ? text : null
}

function numberField(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function hasDisplayMarket(game: Record<string, any>) {
  return Boolean(
    marketField(game.marketLabel) ||
    marketField(game.market) ||
    marketField(game.selection) ||
    marketField(game.sportsbook) ||
    numberField(game.americanOdds ?? game.odds) !== null ||
    numberField(game.line) !== null
  )
}

function formatAmericanOdds(value: unknown) {
  const parsed = numberField(value)
  if (parsed === null) return null
  return `${parsed > 0 ? '+' : ''}${Math.round(parsed)}`
}

function formatMarketLine(value: unknown, game?: Record<string, any>) {
  const parsed = numberField(value)
  if (parsed === null) return null
  const market = String(game?.marketLabel ?? game?.market ?? '').toLowerCase()
  if (parsed === 0 && market.includes('moneyline')) return null
  return `${parsed > 0 ? '+' : ''}${Number.isInteger(parsed) ? parsed.toFixed(0) : parsed.toFixed(1)}`
}

function marketDisplay(game: Record<string, any>) {
  const label = marketField(game.marketLabel ?? game.market) ?? 'Market'
  const selection = marketField(game.selection)
  const line = formatMarketLine(game.line, game)
  const odds = formatAmericanOdds(game.americanOdds ?? game.odds)
  const sportsbook = marketField(game.sportsbook)
  const selectionText = [selection, line].filter(Boolean).join(' ')
  const priceText = odds ? `${selectionText || 'Selection'} (${odds})` : selectionText || 'Selection pending'
  return { label, priceText, sportsbook }
}

function reasonSummary(row: IntelligenceRow) {
  const explanation = row.recommendationExplanation
  if (explanation?.headline) return explanation.headline
  const positives = row.strengths?.filter(Boolean) ?? []
  const why = String(row.why ?? row.reasonNotOfficial ?? row.recommendation ?? row.semanticLabel ?? '').trim()
  if (positives.length) return positives.slice(0, 2).join(' + ')
  if (why) return why
  if (row.missingData?.length) return `Waiting on ${row.missingData.slice(0, 2).join(' and ')}.`
  if (row.weaknesses?.length) return row.weaknesses[0]
  return 'Ranked from stored AI output.'
}

function opportunityKey(row: IntelligenceRow, index: number) {
  return row.id ?? row.predictionId ?? `${row.eventId ?? row.matchup ?? 'row'}-${row.market ?? row.marketLabel ?? 'market'}-${index}`
}

function formatFreshness(row: IntelligenceRow) {
  if (typeof row.oddsAgeMinutes === 'number' && Number.isFinite(row.oddsAgeMinutes)) {
    if (row.oddsAgeMinutes < 60) return `${Math.round(row.oddsAgeMinutes)} min old`
    return `${Math.round(row.oddsAgeMinutes / 60)} hr old`
  }
  if (row.oddsTimestamp) return `Updated ${timeText(row.oddsTimestamp)}`
  return 'Freshness pending'
}

function evidenceText(item: RecommendationEvidenceItem | undefined) {
  if (!item) return null
  const value = item.value === null || item.value === undefined || item.value === '' ? '' : `: ${item.value}`
  return `${fieldValue(item.label, 'Evidence')}${value}`
}

function topBlocker(row: IntelligenceRow) {
  const explanation = row.recommendationExplanation
  return evidenceText(explanation?.blockers?.[0]) ?? evidenceText(explanation?.secondaryReasons?.[0]) ?? evidenceText(explanation?.primaryReasons?.[0])
}

function promotionCondition(row: IntelligenceRow) {
  return row.recommendationExplanation?.promotionConditions?.[0] ?? null
}

function marketMetric(row: { marketAlignment?: MarketAlignment }, key: keyof MarketAlignment, fallback?: unknown) {
  return row.marketAlignment?.[key] ?? fallback
}

function compactMarketAge(row: IntelligenceRow | TopOpportunity | AiPicksFeedItem) {
  const ageFields = row as { oddsAgeMinutes?: unknown; marketAgeMinutes?: unknown }
  const fallbackAge = ageFields.oddsAgeMinutes ?? ageFields.marketAgeMinutes
  const age = numberField(marketMetric(row, 'marketAgeMinutes', fallbackAge))
  if (age === null) return 'n/a'
  if (age < 60) return `${Math.round(age)} min`
  return `${Math.round(age / 60)} hr`
}

function traceReasonSummary(day: PipelineTraceDay | null | undefined) {
  const missReasons = Object.entries(day?.coverage?.missReasons ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => `${reason} (${count})`)
  if (missReasons.length) return missReasons.slice(0, 3).join(', ')
  const zeroReasons = Array.isArray(day?.zeroReasonCodes) ? day.zeroReasonCodes.filter(Boolean) : []
  return zeroReasons.slice(0, 3).join(', ')
}

function TodayStory({ data, mostLikely, bestValue, counts, pipelineToday }: { data: TodayResponse; mostLikely: IntelligenceRow[]; bestValue: IntelligenceRow[]; counts: CategoryCounts; pipelineToday?: PipelineTraceDay | null }) {
  const topProbability = mostLikely[0]
  const topValue = bestValue[0]
  const modelOnlyCount = Number(data.sections?.modelIntelligence?.data?.summary?.modelOutcomes ?? counts.modelOnly ?? 0)
  const traceCounts = pipelineToday?.counts
  const predictionCoverage = pipelineToday?.coverage?.predictionCoveragePct
  const traceReason = traceReasonSummary(pipelineToday)
  const lines = [
    data.summary?.aiBriefing ?? (data.gamesWaitingForOdds > 0
      ? 'Sportsbook odds are still pending, so recommendations stay locked until the board has current prices.'
      : counts.official > 0
        ? `${counts.official} Official Pick${counts.official === 1 ? '' : 's'} passed the production policy.`
        : 'No game currently meets both confidence and value requirements for an Official Pick.'),
    traceCounts
      ? `Pipeline trace found ${traceCounts.gamesScheduled} scheduled game${traceCounts.gamesScheduled === 1 ? '' : 's'}, ${traceCounts.predictionsGenerated} stored prediction${traceCounts.predictionsGenerated === 1 ? '' : 's'} (${traceCounts.predictionsValidPregame ?? traceCounts.predictionsGenerated} valid pregame, ${traceCounts.predictionsExcludedAfterCutoff ?? 0} excluded after cutoff), ${traceCounts.currentBoardCandidates} Current Board candidate${traceCounts.currentBoardCandidates === 1 ? '' : 's'} and ${traceCounts.productionPredictionsSettled} production settlement${traceCounts.productionPredictionsSettled === 1 ? '' : 's'} for the operating day.`
      : null,
    predictionCoverage !== undefined && predictionCoverage !== null
      ? `Prediction coverage is ${predictionCoverage}% by scheduled game; missed-game reasons: ${traceReason || 'none recorded'}.`
      : null,
    topProbability
      ? `The most likely outcome is ${fieldValue(topProbability.selection)} in ${fieldValue(topProbability.matchup)} at ${formatPercent(candidateDisplayProbability(topProbability))}.`
      : modelOnlyCount > 0
        ? `${modelOnlyCount} model-only probabilit${modelOnlyCount === 1 ? 'y is' : 'ies are'} stored; value recommendations are waiting for current market odds.`
      : null,
    topValue && Number(topValue.edge ?? 0) > 0
      ? `The largest value signal is ${fieldValue(topValue.selection)} with ${signedNumber(topValue.edge, ' edge')}.`
      : topValue
        ? 'The strongest value candidates remain below official value standards.'
        : null,
    counts.watchlist > 0 ? `${counts.watchlist} market${counts.watchlist === 1 ? '' : 's'} are on the Watchlist because the AI needs more confirmation.` : null,
  ].filter(Boolean)

  return (
    <section className={`rounded-lg border border-slate-800 bg-slate-900/80 p-6 ${cardMotion}`}>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Today's Story</p>
      <div className="mt-4 grid gap-3">
        {lines.map((line, index) => (
          <p key={index} className="text-base font-semibold leading-7 text-slate-200">{line}</p>
        ))}
      </div>
    </section>
  )
}

function PipelineSummary({ data, counts, pipelineToday }: { data: TodayResponse; counts: CategoryCounts; pipelineToday?: PipelineTraceDay | null }) {
  const pipeline = data.pipeline ?? []
  const byId = new Map(pipeline.map((item) => [item.id, item]))
  const traceCounts = pipelineToday?.counts
  const rows: Array<[string, { status: string; detail: string }]> = [
    ['Odds', byId.get('market_prices') ?? { status: data.latestOddsTimestamp ? 'Complete' : 'Waiting', detail: data.summary.marketPrices }],
    ['Predictions', traceCounts ? { status: traceCounts.predictionsGenerated ? 'Complete' : 'Waiting', detail: traceCounts.predictionsGenerated ? `${traceCounts.predictionsGenerated} stored prediction rows found; ${traceCounts.predictionsValidPregame ?? traceCounts.predictionsGenerated} valid pregame and ${traceCounts.predictionsExcludedAfterCutoff ?? 0} excluded after cutoff.` : 'Waiting for eligible pregame prediction rows.' } : byId.get('predictions') ?? { status: data.predictionCandidates ? 'Complete' : 'Waiting', detail: data.predictionCandidates ? `${data.predictionCandidates} candidates available.` : 'Waiting for odds.' }],
    ['Current Board', traceCounts ? { status: traceCounts.currentBoardCandidates ? 'Complete' : 'Waiting', detail: traceCounts.currentBoardCandidates ? `${traceCounts.currentBoardCandidates} candidates are visible after board gates.` : 'Stored predictions exist, but no candidate passed Current Board gates.' } : byId.get('current_board') ?? { status: data.predictionCandidates ? 'Complete' : 'Waiting', detail: data.predictionCandidates ? 'Candidates are available.' : 'Waiting.' }],
    ['Official Picks', traceCounts ? { status: traceCounts.officialPicks ? 'Complete' : 'Waiting', detail: traceCounts.officialPicks ? `${traceCounts.officialPicks} Official Picks passed policy.` : 'No stored candidate passed Official Pick policy gates.' } : byId.get('recommendations') ?? { status: counts.official ? 'Complete' : 'Waiting', detail: counts.official ? 'Official picks passed policy.' : 'Waiting for prediction and market comparison.' }],
    ['Settlement', traceCounts ? { status: traceCounts.productionPredictionsSettled ? 'Complete' : traceCounts.gamesCompleted ? 'Waiting' : 'Not due', detail: traceCounts.productionPredictionsSettled ? `${traceCounts.productionPredictionsSettled} production predictions settled.` : traceCounts.gamesCompleted ? `${traceCounts.gamesCompleted} completed games are waiting for eligible production settlement evidence.` : 'No completed games require settlement yet.' } : byId.get('settlement') ?? { status: data.finalGames ? 'Waiting' : 'Complete', detail: data.finalGames ? 'Final games are ready for stored settlement checks.' : 'Healthy.' }],
    ['Learning', traceCounts ? { status: traceCounts.learningSamplesQueued ? 'Complete' : 'Not due', detail: traceCounts.learningSamplesQueued ? `${traceCounts.learningSamplesQueued} learning labels queued; ${traceCounts.learningSamplesAccepted} accepted and ${traceCounts.learningSamplesRejected} rejected by evidence checks.` : 'Ready when settled production labels exist; no auto-promotion.' } : byId.get('learning') ?? { status: 'Not due', detail: 'Ready when settled production labels exist; no auto-promotion.' }],
  ]
  return (
    <section className={`rounded-lg border border-slate-800 bg-slate-900/80 p-6 ${cardMotion}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Current AI Pipeline</p>
          <h3 className="mt-2 text-3xl font-black text-white">{fieldValue(data.nextAction, 'Waiting for next scheduler execution')}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">Last odds sync: {timestampText(data.latestOddsTimestamp, 'No stored odds refresh timestamp')}</p>
          <p className="text-sm leading-6 text-slate-400">Next scheduled refresh: {data.nextActionAt ? timeText(data.nextActionAt) : 'Waiting for next scheduler execution'}</p>
        </div>
        <Badge tone={data.status === 'AVAILABLE' ? 'green' : data.status === 'DEGRADED' || data.status === 'UNAVAILABLE' ? 'red' : 'yellow'}>{fieldValue(data.status, 'AVAILABLE')}</Badge>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {rows.map(([label, item]) => {
          const status = String(item.status ?? 'Waiting')
          const tone = status === 'Complete' ? 'green' : status === 'Running' ? 'blue' : status === 'Blocked' ? 'red' : status === 'Not due' ? 'gray' : 'yellow'
          return (
            <div key={String(label)} className={`rounded-lg border p-4 ${toneClasses(tone)}`}>
              <p className="text-xs font-black uppercase tracking-[0.12em] opacity-80">{label}</p>
              <p className="mt-2 text-lg font-black">{status}</p>
              <p className="mt-2 text-xs leading-5 opacity-80">{fieldValue(item.detail, 'Waiting for next scheduler execution')}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function OpportunityRow({ row, rank, mode }: { row: IntelligenceRow; rank: number; mode: 'likely' | 'value' }) {
  const probability = candidateDisplayProbability(row)
  const alignment = row.marketAlignment
  const aligned = alignment?.alignmentStatus === 'ALIGNED'
  const category = mode === 'likely' ? probabilityCategory(probability) : fieldValue(row.opportunityCategory ?? row.statusLabel ?? 'Value Candidate')
  const tone = mode === 'likely'
    ? percentNumber(probability) !== null && percentNumber(probability)! >= 65 ? 'green' : 'blue'
    : Number(row.expectedValue ?? 0) > 0 && Number(row.edge ?? 0) > 0 ? 'green' : 'yellow'
  return (
    <article className={`rounded-lg border border-slate-800 bg-slate-950/70 p-4 ${cardMotion}`}>
      <div className="grid gap-4 lg:grid-cols-[auto_1fr_auto] lg:items-start">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-sm font-black text-white">{rank}</span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-black text-white">{fieldValue(row.selection, 'Selection pending')}</p>
            <Badge tone={tone}>{category}</Badge>
            <Badge tone="gray">{fieldValue(row.marketLabel ?? row.market, 'Market')}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-400">{fieldValue(row.matchup, 'Game pending')}</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">{reasonSummary(row)}</p>
          {mode === 'likely' ? (
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Risk: {riskLabel(row)} · {formatFreshness(row)}</p>
          ) : (
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Edge {signedNumber(row.edge, '%')} · EV {signedNumber(row.expectedValue, '%')} · {formatFreshness(row)}</p>
          )}
        </div>
        <div className="grid min-w-40 gap-3">
          <Meter label="Probability" value={probability} tone="blue" />
          <Meter label="Implied" value={aligned ? alignment?.marketImpliedProbability : null} tone="yellow" />
          <Meter label="Edge" value={aligned ? alignment?.edgePercentagePoints : null} tone="blue" />
          <Meter label="EV" value={aligned ? alignment?.expectedValuePercent : null} tone={Number(alignment?.expectedValuePercent ?? 0) > 0 ? 'green' : 'red'} />
          <Meter label="Confidence" value={row.confidence} tone="green" />
        </div>
      </div>
    </article>
  )
}

function IntelligenceSection({
  title,
  eyebrow,
  rows,
  emptyTitle,
  emptyDetail,
  mode,
}: {
  title: string
  eyebrow: string
  rows: IntelligenceRow[]
  emptyTitle: string
  emptyDetail: string
  mode: 'likely' | 'value'
}) {
  return (
    <section className={`rounded-lg border border-slate-800 bg-slate-900/80 p-6 ${cardMotion}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p>
          <h3 className="mt-2 text-3xl font-black text-white">{title}</h3>
        </div>
        <Badge tone={rows.length ? 'blue' : 'yellow'}>{rows.length ? `${rows.length} shown` : 'Odds pending'}</Badge>
      </div>
      <div className="mt-5 grid gap-3">
        {rows.length ? rows.slice(0, 10).map((row, index) => <OpportunityRow key={opportunityKey(row, index)} row={row} rank={index + 1} mode={mode} />) : (
          <EmptyState title={emptyTitle} detail={emptyDetail} />
        )}
      </div>
    </section>
  )
}

function InsightList({ title, rows, empty, count }: { title: string; rows: IntelligenceRow[]; empty: string; count?: number }) {
  const displayedCount = count ?? rows.length
  return (
    <section className={`rounded-lg border border-slate-800 bg-slate-900/80 p-5 ${cardMotion}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">AI Explanation</p>
          <h3 className="mt-1 text-xl font-black text-white">{title}</h3>
        </div>
        <Badge tone={displayedCount ? categoryTone(title === 'AI Leans' ? 'AI Lean' : title) : 'gray'}>{displayedCount}</Badge>
      </div>
      <div className="mt-4 grid gap-3">
        {rows.length ? rows.map((row, index) => (
          <article key={opportunityKey(row, index)} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-sm font-black text-white">{fieldValue(row.selection)} · {fieldValue(row.marketLabel ?? row.market)}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">{fieldValue(row.matchup)}</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">{reasonSummary(row)}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <p className="text-xs font-bold text-slate-400">Edge {signedNumber(row.marketAlignment?.edgePercentagePoints ?? row.edge, ' pts')}</p>
              <p className="text-xs font-bold text-slate-400">EV {signedNumber(row.marketAlignment?.expectedValuePercent ?? row.expectedValue, '%')}</p>
              <p className="text-xs font-bold text-slate-400">Price {formatAmericanOdds(row.americanOdds ?? row.odds) ?? 'n/a'}</p>
              <p className="text-xs font-bold text-slate-400">{compactMarketAge(row)}</p>
            </div>
            {topBlocker(row) ? <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-200">{topBlocker(row)}</p> : null}
            {promotionCondition(row) ? <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{promotionCondition(row)}</p> : null}
          </article>
        )) : (
          <p className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-sm leading-6 text-slate-400">{empty}</p>
        )}
      </div>
    </section>
  )
}

function AIConfidenceCard({ opportunity }: { opportunity: TopOpportunity | null }) {
  const confidence = percentNumber(opportunity?.confidence)
  const label = confidenceLabel(confidence)
  const tone = confidence === null ? 'gray' : confidence >= 70 ? 'green' : confidence >= 50 ? 'yellow' : 'red'
  return (
    <section className={`rounded-lg border border-slate-800 bg-slate-900/80 p-6 ${cardMotion}`}>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">AI Confidence</p>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-5xl font-black text-white">{confidence === null ? '--' : `${confidence.toFixed(1)}%`}</p>
          <p className="mt-2 text-sm font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>
      <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-800" role="meter" aria-label="AI Confidence" aria-valuemin={0} aria-valuemax={100} aria-valuenow={confidence ?? undefined}>
        {confidence !== null && <div className={`h-full rounded-full ${meterColor(tone)} transition-all duration-700 ease-out`} style={{ width: `${confidence}%` }} />}
      </div>
    </section>
  )
}

function categoryLabel(value: unknown) {
  const raw = String(value ?? '').toLowerCase()
  if (raw === 'official') return 'Official'
  if (raw === 'ai_lean') return 'AI Lean'
  if (raw === 'watchlist') return 'Watchlist'
  if (raw === 'avoid') return 'Avoid'
  return ''
}

function gameCategory(game: Record<string, any>) {
  const lifecycle = String(game.lifecycle ?? game.status ?? '').toUpperCase()
  if (lifecycle === 'FINAL' || lifecycle === 'COMPLETED' || lifecycle === 'COMPLETE') return fieldValue(game.settlementState?.label, 'Awaiting Settlement')
  const bettingEligibility = String(game.bettingEligibility ?? '').toUpperCase()
  const hasMarket = hasDisplayMarket(game)
  if (bettingEligibility === 'LOCKED_AFTER_START') return 'Betting Locked'
  if (bettingEligibility === 'STATUS_UNCONFIRMED') return 'Betting Locked'
  if (bettingEligibility === 'DATA_AGING' || bettingEligibility === 'STALE') return 'Data Aging'
  if (bettingEligibility === 'NO_MARKET' && !hasMarket) return 'Waiting for Odds'
  if (bettingEligibility === 'INSUFFICIENT_DATA') return 'Insufficient Data'
  if (bettingEligibility === 'ELIGIBLE') return 'Operational'
  const eligibility = String(game.eligibility ?? '').toUpperCase()
  if (eligibility === 'LOCKED') return 'Locked'
  if (eligibility === 'STATUS_UNCONFIRMED') return 'Status Unconfirmed'
  if (eligibility === 'STALE') return 'Stale'
  if (eligibility === 'READY') return 'Operational'
  const grounded = categoryLabel(game.marketIntelligenceCategory ?? game.opportunityCategory ?? game.recommendationCategory)
  if (grounded) return grounded
  if (game.oddsPresent === false) return 'Waiting for Odds'
  if (game.predictionReady === false) return 'Tracking'
  return 'Operational'
}

function gameStatusLabel(game: Record<string, any>) {
  const lifecycle = String(game.lifecycle ?? game.status ?? '').toUpperCase()
  const bettingEligibility = String(game.bettingEligibility ?? '').toUpperCase()
  if (lifecycle === 'STATUS_UNCONFIRMED') return 'Status update overdue'
  if ((lifecycle === 'PREGAME' || lifecycle === 'STARTING_SOON') && (bettingEligibility === 'DATA_AGING' || game.statusFresh === false)) return 'Scheduled'
  return humanStatus(game.lifecycle ?? game.status)
}

function GameCard({ game }: { game: Record<string, any> }) {
  const status = gameStatusLabel(game)
  const aiCategory = gameCategory(game)
  const hasMarket = hasDisplayMarket(game)
  const displayMarket = marketDisplay(game)
  const statusTone = status === 'Final' ? 'gray' : status === 'Live' || status === 'Status update overdue' || status === 'Status Unconfirmed' ? 'yellow' : 'blue'
  const categoryCardTone = categoryTone(aiCategory)
  const categoryBadgeTone = aiCategory === 'Waiting for Odds' || aiCategory === 'Data Aging' ? 'yellow' : aiCategory === 'Tracking' || aiCategory === 'Operational' || aiCategory === 'Insufficient Data' ? 'blue' : aiCategory === 'Betting Locked' ? 'red' : categoryCardTone
  const isFinal = status === 'Final'
  const marketUnavailableText = isFinal ? fieldValue(game.settlementState?.label, 'Awaiting Settlement') : 'Waiting for odds'

  return (
    <details className={`group rounded-lg border border-slate-800 bg-slate-950/70 p-4 ${cardMotion}`}>
      <summary className="list-none cursor-pointer">
        <div className="grid gap-4 md:grid-cols-[1.2fr_0.55fr_0.7fr_0.55fr_auto] md:items-center">
          <div>
            <p className="text-xs font-bold text-slate-500">{game.displayTime ?? timeText(game.scheduledTime)}</p>
            <p className="mt-1 text-lg font-black text-white">{fieldValue(game.matchup, 'Matchup pending')}</p>
          </div>
          <Badge tone={statusTone}>{status}</Badge>
          <Badge tone={categoryBadgeTone}>{aiCategory}</Badge>
          <div>
            <p className="text-xs font-bold text-slate-500">{hasMarket ? displayMarket.label : 'Market'}</p>
            <p className="text-sm font-black text-white">{hasMarket ? displayMarket.priceText : marketUnavailableText}</p>
            {displayMarket.sportsbook ? <p className="mt-0.5 text-xs font-bold text-slate-500">{displayMarket.sportsbook}</p> : null}
          </div>
          <span className="text-sm font-bold text-sky-300">Details</span>
        </div>
      </summary>
      <div className="mt-5 grid gap-4 border-t border-slate-800 pt-5 md:grid-cols-2">
        <Meter label="Probability" value={game.probability} tone="blue" />
        <Meter label="Confidence" value={game.confidence} tone="green" />
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Primary Prediction</p>
          <p className="mt-2 text-lg font-black text-white">{hasMarket ? displayMarket.priceText : fieldValue(game.selection, game.marketLabel ?? 'Prediction pending')}</p>
          <p className="mt-1 text-sm text-slate-400">{hasMarket ? displayMarket.label : fieldValue(game.marketLabel, 'Market pending')}</p>
          {displayMarket.sportsbook ? <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{displayMarket.sportsbook}</p> : null}
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Data Quality</p>
          <p className="mt-2 text-lg font-black text-white">{fieldValue(game.dataQuality, 'Limited')}</p>
          <p className="mt-1 text-sm text-slate-400">{fieldValue(game.freshnessSummary, 'Freshness pending')}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 md:col-span-2">
          <p className="text-sm font-black text-white">AI Decision</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {isFinal
              ? `${fieldValue(game.settlementState?.label, 'Awaiting Settlement')}. ${Number(game.settlementState?.settledPredictions ?? 0)} of ${Number(game.settlementState?.totalPredictions ?? 0)} stored prediction rows are terminal for this event.`
              : !hasMarket && game.oddsPresent === false
              ? 'Waiting for sportsbook odds.'
              : game.bettingEligibility === 'LOCKED_AFTER_START' || game.bettingEligibility === 'STATUS_UNCONFIRMED'
                ? fieldValue(game.statusReason, 'Awaiting provider confirmation. Betting is locked until game status is verified.')
              : game.bettingEligibility === 'DATA_AGING' || game.bettingEligibility === 'STALE'
                ? 'Status awaiting refresh. Betting analysis remains gated until market and provider state are current.'
              : game.eligibility === 'LOCKED'
                ? 'Analysis is locked because this game is no longer pregame.'
                : game.eligibility === 'STATUS_UNCONFIRMED'
                  ? fieldValue(game.statusReason, 'Game status is unconfirmed.')
                  : !hasMarket && game.predictionReady === false
                ? 'Tracking current market state.'
                : fieldValue(game.reasonSummary, `${aiCategory} status from the current board.`)}
          </p>
          {game.statusSource && (
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              {fieldValue(game.statusSource)} · {fieldValue(game.normalizedUtc ?? game.scheduledTime, 'Time pending')}
            </p>
          )}
        </div>
      </div>
    </details>
  )
}

function ProgressPipeline({ data }: { data: TodayResponse }) {
  const contractSteps = data.pipeline?.filter((step) => ['schedule', 'market_prices', 'predictions', 'current_board', 'recommendations', 'settlement'].includes(step.id))
  const steps = contractSteps?.length ? contractSteps.map((step) => ({ label: step.label, mark: step.label.slice(0, 1), state: step.status })) : [
    { label: 'Schedule', mark: 'S', state: data.currentGames > 0 || data.upcomingGames > 0 ? 'Complete' : 'Awaiting update' },
    { label: 'Odds', mark: 'O', state: data.gamesWaitingForOdds > 0 || data.freshness === 'empty' ? 'Waiting for odds' : 'Complete' },
    { label: 'Predictions', mark: 'P', state: data.predictionCandidates > 0 ? 'Complete' : data.gamesWaitingForOdds > 0 ? 'Waiting for odds' : 'Updating' },
    { label: 'Picks', mark: 'R', state: data.officialPicks > 0 ? 'Complete' : data.predictionCandidates > 0 ? 'Not due' : 'Awaiting board' },
    { label: 'Results', mark: 'F', state: data.finalGames > 0 ? 'Complete' : data.currentGames > 0 ? 'Not due' : 'Awaiting games' },
  ]
  return (
    <section className={`rounded-lg border border-slate-800 bg-slate-900/80 p-5 ${cardMotion}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Today at a Glance</p>
          <h3 className="mt-1 text-xl font-black text-white">{dateText(data.operatingDate)}</h3>
        </div>
        <Badge tone="gray">{simpleAction(data.nextAction)}</Badge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step) => {
          const tone = step.state === 'Complete' ? 'green' : step.state === 'Updating' || step.state === 'Running' ? 'blue' : step.state === 'Not due' || step.state === 'Not Due' ? 'gray' : step.state === 'Blocked' ? 'red' : 'yellow'
          return (
            <div key={step.label} className={`rounded-lg border border-slate-800 bg-slate-950/70 p-3 ${cardMotion}`} title={step.label}>
              <div className="flex items-center justify-between gap-2">
                <span aria-label={step.label} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-black ${toneClasses(tone)}`}>{step.mark}</span>
                <Badge tone={tone}>{step.state}</Badge>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function HealthCard({ data }: { data: TodayResponse }) {
  const status = data.gamesWaitingForOdds > 0
      ? 'Waiting for Odds'
    : data.freshness === 'stale'
      ? 'Data Aging'
      : data.freshness === 'empty'
        ? 'Waiting for Odds'
        : data.success
          ? 'Healthy'
          : 'Operational Blocker'
  const tone = status === 'Healthy' ? 'green' : status === 'Operational Blocker' ? 'red' : status === 'Waiting for Odds' ? 'yellow' : 'blue'
  const detail = status === 'Waiting for Odds'
    ? 'Market prices are needed before recommendations can be finalized.'
    : status === 'Data Aging'
      ? simpleAction(data.nextAction)
      : status === 'Operational Blocker'
        ? 'The dashboard needs attention before recommendations are reviewed.'
        : 'The main board is ready for review.'
  return (
    <section className={`rounded-lg border p-5 ${toneClasses(tone)} ${cardMotion}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">System Health</p>
          <h3 className="mt-1 text-2xl font-black text-white">{status}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p>
        </div>
        <a href="#advanced-details" className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-slate-950/50 px-4 py-2 text-sm font-black text-white outline-none transition hover:bg-slate-950/80 focus-visible:ring-2 focus-visible:ring-white">Advanced Status</a>
      </div>
    </section>
  )
}

function HistoryCard({ data }: { data: TodayResponse }) {
  const source = data as TodayResponse & { history?: unknown; recentHistory?: unknown; settledHistory?: unknown }
  const history = Array.isArray(source.history)
    ? source.history
    : Array.isArray(source.recentHistory)
      ? source.recentHistory
      : Array.isArray(source.settledHistory)
        ? source.settledHistory
        : []
  if (!history.length) return null
  return (
    <section className={`rounded-lg border border-slate-800 bg-slate-900/80 p-6 ${cardMotion}`}>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">History</p>
      <div className="mt-4 grid gap-3">
        {history.slice(0, 3).map((item, index) => (
          <div key={index} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-sm font-black text-white">{fieldValue((item as Record<string, unknown>).label ?? (item as Record<string, unknown>).title, 'Settled result')}</p>
            <p className="mt-1 text-sm text-slate-400">{fieldValue((item as Record<string, unknown>).summary ?? (item as Record<string, unknown>).result, 'Stored settled history')}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function UserTodayPanel() {
  const [data, setData] = useState<TodayResponse | null>(null)
  const [topOpportunity, setTopOpportunity] = useState<TopOpportunity | null>(null)
  const [mostLikely, setMostLikely] = useState<IntelligenceRow[]>([])
  const [bestValue, setBestValue] = useState<IntelligenceRow[]>([])
  const [aiResults, setAiResults] = useState<IntelligenceRow[]>([])
  const [pipelineToday, setPipelineToday] = useState<PipelineTraceDay | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sectionWarnings, setSectionWarnings] = useState<string[]>([])
  const [slowLoading, setSlowLoading] = useState(false)

  useEffect(() => {
    let active = true
    const slowTimer = window.setTimeout(() => {
      if (active) setSlowLoading(true)
    }, 2500)
    async function optionalJson<T>(url: string): Promise<T | null> {
      try {
        const response = await fetch(url, { cache: 'no-store' })
        if (!response.ok) return null
        return await response.json() as T
      } catch {
        return null
      }
    }
    async function load() {
      try {
        setError(null)
        setSectionWarnings([])
        const tracePromise = optionalJson<RecommendationPipelineTraceResponse>('/api/recommendation-pipeline/trace')
        const todayResponse = await fetch('/api/dashboard/today', { cache: 'no-store' })
        const todayJson = await todayResponse.json()
        if (!todayResponse.ok || todayJson.success === false) throw new Error(todayJson.error?.message ?? todayJson.error ?? 'Unable to load today.')
        if (!active) return
        setData(todayJson)
        const traceJson = await tracePromise
        if (!active) return
        setPipelineToday(traceJson?.today ?? traceJson?.days?.find((day) => String(day.label ?? '').toLowerCase() === 'today') ?? traceJson?.days?.[0] ?? null)

        const embeddedMostLikely = todayJson.sections?.mostLikely?.data
        const embeddedBestValue = todayJson.sections?.bestValue?.data
        const embeddedAi = todayJson.sections?.aiBetFinder?.data
        const embeddedTop = todayJson.sections?.topOpportunity?.data
        const embeddedWarnings = [
          ...(todayJson.partial ? ['Some insights are temporarily unavailable.'] : []),
          ...(todayJson.sections?.mostLikely?.status === 'UNAVAILABLE' ? [todayJson.sections.mostLikely.reason ?? 'Most Likely is temporarily unavailable.'] : []),
          ...(todayJson.sections?.bestValue?.status === 'UNAVAILABLE' ? [todayJson.sections.bestValue.reason ?? 'Best Value is temporarily unavailable.'] : []),
          ...(todayJson.sections?.aiBetFinder?.status === 'UNAVAILABLE' ? [todayJson.sections.aiBetFinder.reason ?? 'AI explanations are temporarily unavailable.'] : []),
        ]

        if (Array.isArray(embeddedMostLikely) || Array.isArray(embeddedBestValue) || Array.isArray(embeddedAi)) {
          setMostLikely(Array.isArray(embeddedMostLikely) ? embeddedMostLikely : [])
          setBestValue(Array.isArray(embeddedBestValue) ? embeddedBestValue : [])
          setAiResults(Array.isArray(embeddedAi) ? embeddedAi : [])
          setTopOpportunity(mergeTopOpportunityProbability(embeddedTop ?? (Array.isArray(embeddedMostLikely) ? embeddedMostLikely[0] : null) ?? null, Array.isArray(embeddedMostLikely) ? embeddedMostLikely : []))
          setSectionWarnings(Array.from(new Set(embeddedWarnings)))
          return
        }

        const [opportunityJson, mostLikelyJson, bestValueJson, aiJson] = await Promise.all([
          optionalJson<TopOpportunityResponse>('/api/market-opportunities/most-likely?sort=highest_probability&mode=current_board&limit=1'),
          optionalJson<IntelligenceResponse>('/api/market-opportunities/most-likely?sort=highest_probability&mode=current_board&limit=10'),
          optionalJson<IntelligenceResponse>('/api/market-opportunities/best-value?mode=current&includePasses=true&limit=10'),
          optionalJson<IntelligenceResponse>('/api/ai-bet-finder?q=best%20opportunities%20today'),
        ])
        if (!active) return
        const loadedMostLikely = mostLikelyJson?.opportunities ?? []
        setTopOpportunity(mergeTopOpportunityProbability(opportunityJson?.topPick?.candidate ?? opportunityJson?.opportunities?.[0] ?? null, loadedMostLikely))
        setMostLikely(loadedMostLikely)
        setBestValue(bestValueJson?.opportunities ?? [])
        setAiResults(aiJson?.results ?? [])
        setSectionWarnings([
          ...(!mostLikelyJson ? ['Most Likely is temporarily unavailable.'] : []),
          ...(!bestValueJson ? ['Best Value is temporarily unavailable.'] : []),
          ...(!aiJson ? ['AI explanations are temporarily unavailable.'] : []),
        ])
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load today.')
      } finally {
        if (active) setSlowLoading(false)
      }
    }
    load()
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 60000)
    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') void load()
    }
    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshOnFocus)
    return () => {
      active = false
      window.clearTimeout(slowTimer)
      window.clearInterval(refreshInterval)
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshOnFocus)
    }
  }, [])

  const games = useMemo(() => {
    const sourceGames = data?.currentGameCards?.length ? data.currentGameCards : data?.nextSlateGames ?? []
    return sourceGames.map((game) => {
      const eventId = String(game.eventId ?? game.id ?? '')
      const candidate = mostLikely.find((row) => row.eventId === eventId) ?? bestValue.find((row) => row.eventId === eventId) ?? null
      if (!candidate) return game
      return {
        ...game,
        probability: game.probability ?? candidate.probability ?? candidate.rawProbability,
        confidence: game.confidence ?? candidate.confidence,
        marketLabel: game.marketLabel ?? candidate.marketLabel,
        market: game.market ?? candidate.market,
        selection: game.selection ?? candidate.selection,
        line: game.line ?? candidate.line,
        americanOdds: game.americanOdds ?? candidate.americanOdds ?? candidate.odds,
        odds: game.odds ?? candidate.odds ?? candidate.americanOdds,
        sportsbook: game.sportsbook ?? candidate.sportsbook,
        marketIntelligenceCategory: game.marketIntelligenceCategory ?? candidate.marketIntelligenceCategory,
        opportunityCategory: game.opportunityCategory ?? candidate.opportunityCategory,
        reasonSummary: game.reasonSummary ?? reasonSummary(candidate),
        dataQuality: game.dataQuality ?? riskLabel(candidate),
        freshnessSummary: game.freshnessSummary ?? formatFreshness(candidate),
      }
    })
  }, [data, mostLikely, bestValue])

  if (error) return <EmptyState title="Today is temporarily unavailable" detail={error} />
  if (!data) {
    return (
      <section className="space-y-5">
        {slowLoading ? <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-sm font-bold text-sky-100">Still loading today's board...</p> : null}
        <div className="h-80 animate-pulse rounded-lg bg-slate-900" />
        <div className="grid gap-4 md:grid-cols-4">
          <div className="h-36 animate-pulse rounded-lg bg-slate-900" />
          <div className="h-36 animate-pulse rounded-lg bg-slate-900" />
          <div className="h-36 animate-pulse rounded-lg bg-slate-900" />
          <div className="h-36 animate-pulse rounded-lg bg-slate-900" />
        </div>
      </section>
    )
  }

  const modelOnlySummaryCount = Number(data.sections?.modelIntelligence?.data?.summary?.modelOutcomes ?? 0)
  const baseCounts = data.marketIntelligence ?? { official: data.officialPicks, aiLeans: 0, watchlist: 0, modelOnly: 0, pass: 0, avoid: 0 }
  const counts = { ...baseCounts, modelOnly: Math.max(Number(baseCounts.modelOnly ?? 0), modelOnlySummaryCount) }
  const officialPickRows = data.sections?.officialPicks?.data ?? []
  const aiPicksFeed = data.sections?.aiPicksFeed?.data ?? null
  const aiLeanRows = aiResults.filter((row) => intelligenceCategory(row) === 'ai_lean').slice(0, 3)
  const categorySourceRows = Array.from(
    new Map([...aiResults, ...mostLikely, ...bestValue].map((row, index) => [opportunityKey(row, index), row])).values()
  )
  const watchRows = categorySourceRows.filter((row) => intelligenceCategory(row) === 'watchlist').slice(0, 3)
  const modelOnlyRows = categorySourceRows.filter((row) => intelligenceCategory(row) === 'model_only').slice(0, 3)
  const avoidRows = categorySourceRows.filter((row) => intelligenceCategory(row) === 'avoid').slice(0, 3)

  return (
    <section className="space-y-6">
      {sectionWarnings.length ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
          {sectionWarnings[0]}
        </div>
      ) : null}
      <DecisionHero data={data} counts={counts} />
      <TodayStory data={data} counts={counts} mostLikely={mostLikely} bestValue={bestValue} pipelineToday={pipelineToday} />
      <PipelineSummary data={data} counts={counts} pipelineToday={pipelineToday} />
      <AiPerformancePreviewCard />
      <DataFreshnessPreviewCard />
      <section className="grid gap-4 lg:grid-cols-6">
        <CategoryCard title="Official Picks" value={counts.official} tone="green" icon="OP" href="/dashboard" status={counts.official ? 'Operational' : 'None'} tooltip="Recommendation-policy picks only." />
        <CategoryCard title="AI Leans" value={counts.aiLeans} tone="yellow" icon="AL" href="/most-likely" status={counts.aiLeans ? 'Available' : 'None'} tooltip="Grounded informational opportunities." />
        <CategoryCard title="Watchlist" value={counts.watchlist} tone="blue" icon="WL" href="/best-value" status={counts.watchlist ? 'Tracking' : 'Clear'} tooltip="Markets to watch without official recommendation status." />
        <CategoryCard title="Model Only" value={counts.modelOnly ?? 0} tone="blue" icon="MO" href="/most-likely" status={counts.modelOnly ? 'Informational' : 'None'} tooltip="Probability views that are not betting recommendations." />
        <CategoryCard title="Pass" value={counts.pass ?? 0} tone="blue" icon="PS" href="/best-value" status={counts.pass ? 'No bet' : 'None'} tooltip="Markets without enough price, freshness, data or policy support." />
        <CategoryCard title="Avoid" value={counts.avoid} tone="red" icon="AV" href="/ai-bet-finder" status={counts.avoid ? 'Avoid' : 'Clear'} tooltip="Materially negative, invalid or unsafe markets only." />
      </section>
      <OfficialPickExperienceCard picks={officialPickRows} reason={data.sections?.officialPicks?.reason} topOpportunity={topOpportunity} />
      <AiPicksFeedPanel feed={aiPicksFeed} reason={data.sections?.aiPicksFeed?.reason} pipelineToday={pipelineToday} />
      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <TopOpportunityCard opportunity={topOpportunity} />
        <AIConfidenceCard opportunity={topOpportunity} />
      </section>
      <IntelligenceSection
        eyebrow="Probability Rankings"
        title="Most Likely"
        rows={mostLikely}
        mode="likely"
        emptyTitle="Most Likely is waiting for grounded probabilities"
        emptyDetail="No current probability-ranked opportunities are visible because current odds or eligible prediction rows are unavailable. This does not create an Official Pick."
      />
      <IntelligenceSection
        eyebrow="Value Rankings"
        title="Best Value"
        rows={bestValue}
        mode="value"
        emptyTitle="No positive-value opportunities today."
        emptyDetail={data.sections?.bestValue?.reason ?? 'The AI did not find a grounded positive-value opportunity that should be highlighted. High probability and good value remain separate.'}
      />
      <section className="grid gap-4 lg:grid-cols-4">
        <InsightList title="AI Leans" rows={aiLeanRows} count={counts.aiLeans} empty="No AI Leans are currently grounded by the board." />
        <InsightList title="Watchlist" rows={watchRows} count={counts.watchlist} empty={counts.watchlist ? 'Watchlist markets are counted on the board; detailed rows are outside the visible top opportunity set.' : 'No watchlist games need monitoring right now.'} />
        <InsightList title="Model Only" rows={modelOnlyRows} count={counts.modelOnly ?? 0} empty={counts.modelOnly ? 'Model-only rows are counted on the board; detailed rows are outside the visible top set.' : 'No model-only rows are currently attached to visible candidates.'} />
        <InsightList title="Avoid" rows={avoidRows} count={counts.avoid} empty={counts.avoid ? 'Avoid markets are counted on the board; detailed rows are outside the visible top opportunity set.' : 'No true avoid markets are currently attached to visible candidates.'} />
      </section>
      <HistoryCard data={data} />
      <section className={`rounded-lg border border-slate-800 bg-slate-900/80 p-6 ${cardMotion}`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Today's Games</p>
            <h3 className="mt-2 text-3xl font-black text-white">{games.length} game{games.length === 1 ? '' : 's'}</h3>
            {data.lifecycleCounts ? (
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">
                Upcoming {data.lifecycleCounts.upcoming} · Live {data.lifecycleCounts.live} · Final {data.lifecycleCounts.final} · Status awaiting update {data.lifecycleCounts.statusUnconfirmed} · Betting locked {data.lifecycleCounts.bettingLocked}
              </p>
            ) : null}
          </div>
          <Badge tone={games.length ? 'blue' : 'yellow'}>{games.length ? 'AI Tracking' : 'Awaiting slate'}</Badge>
        </div>
        <div className="mt-5 grid gap-3">
          {games.length ? games.map((game, index) => <GameCard key={game.eventId ?? game.id ?? `${game.matchup}-${index}`} game={game} />) : (
            <EmptyState title="No visible slate" detail={data.warnings?.[0] ?? 'The current-day slate is unavailable or still being resolved. This is not treated as proof that no MLB games exist today.'} />
          )}
        </div>
      </section>
      <ProgressPipeline data={data} />
      <HealthCard data={data} />
    </section>
  )
}
