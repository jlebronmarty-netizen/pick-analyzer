'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'
import {
  buildOfficialPickReadiness,
  normalizeBestOpportunity,
  type NormalizedBestOpportunity,
  type OfficialPickReadiness,
  type ReadinessState,
} from '@/components/dashboard/today-opportunity-readiness'
import {
  buildAiDecisionPresentation,
  type ActionabilityPresentation,
  type ActionabilityState,
  type AiDecisionPresentation,
  type ConvictionLabel,
} from '@/components/dashboard/today-ai-decision-presentation'

type Tone = 'green' | 'yellow' | 'blue' | 'red' | 'gray'
type Verdict = 'BET' | 'REVIEW' | 'WAIT' | 'PASS'
type DecisionDetailTab = 'why' | 'risks' | 'readiness'

type PerformanceSnapshot = {
  trustLabel: string
  accuracy: number | null
  recentTrend: string
  providerCallsMade: number
  remoteMutationsMade: number
}

type Selector = {
  status?: 'AVAILABLE' | 'EMPTY' | 'BLOCKED'
  eventId?: string | null
  matchup?: string | null
  market?: string | null
  marketLabel?: string | null
  selection?: string | null
  line?: number | null
  metricName?: string
  metricValue?: number | null
  modelProbability?: number | null
  confidence?: number | null
  priceState?: string
  americanOdds?: number | null
  sportsbook?: string | null
  impliedProbability?: number | null
  edge?: number | null
  expectedValue?: number | null
  freshness?: 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN_TIMESTAMP'
  blocker?: string | null
  rankingReason?: string
}

type TodayResponse = {
  success: boolean
  status?: 'AVAILABLE' | 'PARTIAL' | 'DEGRADED' | 'UNAVAILABLE'
  generatedAt?: string
  operatingDate?: string
  currentGames?: number
  upcomingGames?: number
  gamesWaitingForOdds?: number
  gamesReadyForAnalysis?: number
  predictionCandidates?: number
  officialPicks?: number
  freshness?: 'fresh' | 'partial' | 'stale' | 'empty'
  nextAction?: string
  latestOddsTimestamp?: string | null
  nextActionAt?: string | null
  summary?: {
    recommendation?: string
    aiBriefing?: string
    marketPrices?: string
    nextSlate?: string
  }
  groundedOpportunitySummary?: {
    groundedRows?: number
    groundedPricedOpportunities?: number
    actionableOpportunities?: number
    officialPicks?: number
    reasonCounts?: Record<string, number>
  }
  warnings?: string[]
  errors?: Array<{ dependency?: string; message?: string; critical?: boolean }>
  timing?: { totalMs?: number; slowDependencies?: string[] }
  viewModel?: {
    generatedAt?: string
    selectors?: {
      highestProjectedOutcome?: Selector
      highestRankedPricedMarket?: Selector
      mostLikelySummary?: { selector?: Selector }
      bestAvailableValue?: Selector
      bestValueSemantics?: {
        candidatesWithPositiveEv?: number
        candidatesPassingPolicy?: number
        primaryRejectionReason?: string
      }
      currentBoardSummary?: {
        candidates?: number
        displayableMarkets?: number
        directlyPricedCandidates?: number
      }
      marketFreshnessSummary?: {
        state?: 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN_TIMESTAMP'
        latestOddsTimestamp?: string | null
        staleBlockers?: number
      }
      gameCoverageSummary?: {
        gamesWithNoStoredOdds?: number
        gamesWithPartialCoverage?: number
      }
    }
  }
  sections?: {
    officialPicks?: { status?: string; data?: unknown[]; reason?: string | null }
    groundedOpportunities?: { status?: string; data?: Array<Record<string, unknown>>; reason?: string | null }
    mostLikely?: { status?: string; data?: Array<Record<string, unknown>>; reason?: string | null }
    bestValue?: { status?: string; data?: Array<Record<string, unknown>>; reason?: string | null }
    topOpportunity?: { status?: string; data?: Record<string, unknown> | null; reason?: string | null }
  }
  providerCallsMade?: number
  remoteMutationsMade?: number
}

type Opportunity = {
  source: string
  status: 'official' | 'not_official'
  sport: string
  event: string
  selection: string
  market: string
  odds: number | null
  sportsbook: string
  modelProbability: number | null
  impliedProbability: number | null
  edge: number | null
  expectedValue: number | null
  confidence: number | null
  freshness: string
  dataQuality: string
  reason: string
  updatedAt: string | null
}

type AlternativeCard = {
  label: string
  title: string
  market: string
  probability: number | null
  badge: string
  href: string
}

const toneClasses: Record<Tone, string> = {
  green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
  yellow: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  blue: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
  red: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
  gray: 'border-slate-700 bg-slate-900/80 text-slate-100',
}

const convictionTone: Record<ConvictionLabel, Tone> = {
  'VERY HIGH': 'green',
  HIGH: 'green',
  MODERATE: 'yellow',
  LOW: 'yellow',
  AVOID: 'red',
  UNAVAILABLE: 'gray',
}

const actionabilityTone: Record<ActionabilityState, Tone> = {
  'ACT NOW': 'green',
  ACTIONABLE: 'green',
  'REVIEW FIRST': 'yellow',
  WAIT: 'yellow',
  'DO NOT ACT': 'red',
  UNAVAILABLE: 'gray',
}

const decisionDetailTabs: Array<{ id: DecisionDetailTab; label: string }> = [
  { id: 'why', label: 'Why' },
  { id: 'risks', label: 'Risks' },
  { id: 'readiness', label: 'Readiness' },
]

function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex max-w-full items-center rounded-full border px-3 py-1 text-xs font-black uppercase ${toneClasses[tone]}`}>{children}</span>
}

function labelize(value: unknown, fallback = 'Not yet available') {
  const text = String(value ?? '').trim()
  if (!text || text === 'null' || text === 'undefined') return fallback
  return text.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function pct(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 'Not yet available'
  const percent = parsed > 0 && parsed <= 1 ? parsed * 100 : parsed
  return `${percent.toFixed(1)}%`
}

function odds(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 'Not yet available'
  return parsed > 0 ? `+${parsed}` : String(parsed)
}

function signedPct(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 'Not yet available'
  return `${parsed > 0 ? '+' : ''}${parsed.toFixed(2)}%`
}

function dateTime(value: unknown, fallback = 'Update time unavailable') {
  if (!value) return fallback
  const parsed = new Date(String(value))
  if (!Number.isFinite(parsed.getTime())) return fallback
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Puerto_Rico',
    timeZoneName: 'short',
  })
}

function relativeTime(value: unknown) {
  if (!value) return 'Update time unavailable'
  const parsed = new Date(String(value)).getTime()
  if (!Number.isFinite(parsed)) return 'Update time unavailable'
  const diffMinutes = Math.round((Date.now() - parsed) / 60000)
  if (diffMinutes < -1) return 'Timestamp ahead of system clock'
  if (diffMinutes < 1) return 'Updated just now'
  if (diffMinutes < 60) return `Updated ${diffMinutes} min ago`
  const hours = Math.round(diffMinutes / 60)
  if (hours < 24) return `Updated ${hours} hr ago`
  return dateTime(value)
}

function numberOrNull(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function selectorExpectedValue(selector: Selector) {
  const explicit = numberOrNull(selector.expectedValue)
  if (explicit !== null) return explicit
  const metricName = String(selector.metricName ?? '').toLowerCase()
  if (metricName.includes('expected value') || metricName === 'ev' || metricName.includes(' ev')) {
    return numberOrNull(selector.metricValue)
  }
  return null
}

function marketTimestampFor(data: TodayResponse) {
  return data.latestOddsTimestamp ?? data.viewModel?.selectors?.marketFreshnessSummary?.latestOddsTimestamp ?? null
}

function marketFreshnessDisplay(data: TodayResponse, opportunity: Opportunity | null): { label: string; detail: string; tone: Tone } {
  const timestamp = opportunity?.updatedAt ?? marketTimestampFor(data)
  if (!timestamp) return { label: 'Market timestamp unavailable', detail: 'Page/API fetch time is not used as odds freshness.', tone: 'gray' }
  const parsed = new Date(String(timestamp)).getTime()
  if (!Number.isFinite(parsed)) return { label: 'Market timestamp invalid', detail: 'Stored odds timestamp could not be parsed.', tone: 'red' }
  const ageMinutes = Math.round((Date.now() - parsed) / 60000)
  if (ageMinutes < -1) return { label: 'Market timestamp invalid', detail: 'Stored odds timestamp is ahead of the system clock.', tone: 'red' }
  if (ageMinutes <= 10) return { label: 'FRESH', detail: `Market ${relativeTime(timestamp)}`, tone: 'green' }
  if (ageMinutes <= 60) return { label: 'AGING', detail: `Market ${relativeTime(timestamp)}`, tone: 'yellow' }
  return { label: 'STALE', detail: `Market ${relativeTime(timestamp)}`, tone: 'red' }
}

function toneForVerdict(verdict: Verdict): Tone {
  if (verdict === 'BET') return 'green'
  if (verdict === 'REVIEW' || verdict === 'WAIT') return 'yellow'
  return 'gray'
}

function selectorAvailable(selector: Selector | undefined) {
  return Boolean(selector && selector.status === 'AVAILABLE' && selector.selection)
}

function opportunityFromSelector(source: string, selector: Selector, data: TodayResponse): Opportunity {
  const official = Number(data.officialPicks ?? 0) > 0 && source === 'Official Pick'
  return {
    source,
    status: official ? 'official' : 'not_official',
    sport: 'MLB',
    event: labelize(selector.matchup, 'Event not yet available'),
    selection: labelize(selector.selection, 'Selection not yet available'),
    market: labelize(selector.marketLabel ?? selector.market, 'Market not yet available'),
    odds: selector.americanOdds ?? null,
    sportsbook: labelize(selector.sportsbook, 'Sportsbook unavailable'),
    modelProbability: selector.modelProbability ?? null,
    impliedProbability: selector.impliedProbability ?? null,
    edge: selector.edge ?? null,
    expectedValue: selectorExpectedValue(selector),
    confidence: selector.confidence ?? null,
    freshness: labelize(selector.freshness ?? selector.priceState, 'Freshness unavailable'),
    dataQuality: selector.status === 'AVAILABLE' ? 'Stored market evidence' : 'Evidence incomplete',
    reason: official
      ? 'This opportunity is marked official by the existing production policy.'
      : labelize(selector.blocker ?? selector.rankingReason ?? data.summary?.recommendation, 'Not an Official Pick under the existing production policy.'),
    updatedAt: marketTimestampFor(data),
  }
}

function bestOpportunity(data: TodayResponse): Opportunity | null {
  const selectors = data.viewModel?.selectors
  const officialRow = data.sections?.officialPicks?.data?.[0] as Record<string, unknown> | undefined
  if (officialRow && Number(data.officialPicks ?? 0) > 0) {
    return {
      source: 'Official Pick',
      status: 'official',
      sport: labelize(officialRow.sportKey ?? officialRow.sport ?? 'MLB'),
      event: labelize(officialRow.matchup ?? officialRow.eventLabel, 'Event not yet available'),
      selection: labelize(officialRow.selection, 'Selection not yet available'),
      market: labelize(officialRow.marketLabel ?? officialRow.market, 'Market not yet available'),
      odds: Number.isFinite(Number(officialRow.americanOdds)) ? Number(officialRow.americanOdds) : null,
      sportsbook: labelize(officialRow.sportsbook, 'Sportsbook unavailable'),
      modelProbability: Number.isFinite(Number(officialRow.modelProbability)) ? Number(officialRow.modelProbability) : null,
      impliedProbability: Number.isFinite(Number(officialRow.marketImpliedProbability ?? officialRow.impliedProbability)) ? Number(officialRow.marketImpliedProbability ?? officialRow.impliedProbability) : null,
      edge: Number.isFinite(Number(officialRow.edgePercentagePoints ?? officialRow.edge)) ? Number(officialRow.edgePercentagePoints ?? officialRow.edge) : null,
      expectedValue: Number.isFinite(Number(officialRow.expectedValuePercent ?? officialRow.expectedValue)) ? Number(officialRow.expectedValuePercent ?? officialRow.expectedValue) : null,
      confidence: Number.isFinite(Number(officialRow.confidence)) ? Number(officialRow.confidence) : null,
      freshness: labelize(officialRow.freshnessStatus, 'Freshness unavailable'),
      dataQuality: 'Official Pick evidence',
      reason: 'This satisfies the existing Official Pick production policy.',
      updatedAt: String(officialRow.timestamps && typeof officialRow.timestamps === 'object' ? (officialRow.timestamps as Record<string, unknown>).oddsSnapshotAt ?? '' : ''),
    }
  }
  if (selectorAvailable(selectors?.bestAvailableValue)) return opportunityFromSelector('Best Value', selectors!.bestAvailableValue!, data)
  if (selectorAvailable(selectors?.highestRankedPricedMarket)) return opportunityFromSelector('Highest Ranked Priced Market', selectors!.highestRankedPricedMarket!, data)
  if (selectorAvailable(selectors?.mostLikelySummary?.selector)) return opportunityFromSelector('Most Likely', selectors!.mostLikelySummary!.selector!, data)
  if (selectorAvailable(selectors?.highestProjectedOutcome)) return opportunityFromSelector('Highest Projected Outcome', selectors!.highestProjectedOutcome!, data)

  const grounded = data.sections?.groundedOpportunities?.data?.[0]
  if (!grounded) return null
  return {
    source: 'Grounded Opportunity',
    status: 'not_official',
    sport: labelize(grounded.sport ?? grounded.sportKey ?? 'MLB'),
    event: labelize(grounded.matchup ?? grounded.eventLabel, 'Event not yet available'),
    selection: labelize(grounded.selection, 'Selection not yet available'),
    market: labelize(grounded.marketLabel ?? grounded.market, 'Market not yet available'),
    odds: Number.isFinite(Number(grounded.odds ?? grounded.americanOdds)) ? Number(grounded.odds ?? grounded.americanOdds) : null,
    sportsbook: labelize(grounded.sportsbook, 'Sportsbook unavailable'),
    modelProbability: Number.isFinite(Number(grounded.modelProbability ?? grounded.probability)) ? Number(grounded.modelProbability ?? grounded.probability) : null,
    impliedProbability: Number.isFinite(Number(grounded.impliedProbability)) ? Number(grounded.impliedProbability) : null,
    edge: Number.isFinite(Number(grounded.edge)) ? Number(grounded.edge) : null,
    expectedValue: Number.isFinite(Number(grounded.expectedValue)) ? Number(grounded.expectedValue) : null,
    confidence: Number.isFinite(Number(grounded.confidence)) ? Number(grounded.confidence) : null,
    freshness: labelize(grounded.freshness, 'Freshness unavailable'),
    dataQuality: 'Stored grounded evidence',
    reason: labelize(grounded.reasonNotOfficial ?? grounded.blocker ?? grounded.why, 'Not an Official Pick under the existing production policy.'),
    updatedAt: String(grounded.updatedAt ?? grounded.oddsTimestamp ?? ''),
  }
}

function verdictFor(data: TodayResponse, opportunity: Opportunity | null): { label: Verdict; detail: string; officialStatus: string } {
  const officialPicks = Number(data.officialPicks ?? 0)
  const freshness = String(data.freshness ?? data.viewModel?.selectors?.marketFreshnessSummary?.state ?? '').toLowerCase()
  const waitingForOdds = Number(data.gamesWaitingForOdds ?? 0)
  if (officialPicks > 0) return { label: 'BET', detail: `${officialPicks} Official Pick${officialPicks === 1 ? '' : 's'} passed the existing production gates.`, officialStatus: 'Official Pick available' }
  if (freshness.includes('stale') || waitingForOdds > 0) return { label: 'WAIT', detail: waitingForOdds > 0 ? 'The slate is waiting on market prices before action should be considered.' : 'Stored market evidence is stale, so the safest conclusion is to wait for refresh.', officialStatus: 'No Official Pick' }
  if (opportunity) return { label: 'REVIEW', detail: 'A best available opportunity exists, but it is not an Official Pick under the current policy.', officialStatus: 'No Official Pick' }
  return { label: 'PASS', detail: 'No eligible supported opportunity is currently visible from the Today contract.', officialStatus: 'No Official Pick' }
}

function reasonList(data: TodayResponse, opportunity: Opportunity | null) {
  const why: string[] = []
  const risks: string[] = []
  if (opportunity?.modelProbability !== null && opportunity?.modelProbability !== undefined) why.push(`Model probability is available at ${pct(opportunity.modelProbability)}.`)
  if (opportunity?.edge !== null && opportunity?.edge !== undefined && Number(opportunity.edge) > 0) why.push(`Model edge is positive at ${signedPct(opportunity.edge)}.`)
  if (opportunity?.expectedValue !== null && opportunity?.expectedValue !== undefined && Number(opportunity.expectedValue) > 0) why.push(`Expected value is positive at ${signedPct(opportunity.expectedValue)}.`)

  if (opportunity?.status !== 'official') risks.push(opportunity?.reason ?? 'This is not an Official Pick.')
  if (String(data.freshness ?? '').toLowerCase() === 'stale') risks.push('Market evidence is stale.')
  if (Number(data.gamesWaitingForOdds ?? 0) > 0) risks.push(`${data.gamesWaitingForOdds} game${data.gamesWaitingForOdds === 1 ? '' : 's'} are waiting for stored odds.`)
  for (const warning of data.warnings ?? []) risks.push(labelize(warning))

  return {
    why: why.length ? why.slice(0, 3) : ['The Today contract has no extra explanation fields for this opportunity yet.'],
    risks: risks.length ? risks.slice(0, 3) : ['No additional risk text was returned by the current Today contract.'],
  }
}

function shortTitle(text: string, fallback: string) {
  const trimmed = text.replace(/\.$/, '').trim()
  if (!trimmed) return fallback
  const words = trimmed.split(/\s+/).slice(0, 4).join(' ')
  return words.length > 32 ? `${words.slice(0, 29)}...` : words
}

function compactCards(items: string[], kind: 'why' | 'risk') {
  return items.slice(0, 3).map((item, index) => ({
    key: `${kind}-${index}-${item}`,
    icon: kind === 'why' ? `W${index + 1}` : `R${index + 1}`,
    title: shortTitle(item, kind === 'why' ? 'Supporting signal' : 'Risk check'),
    detail: item,
  }))
}

function rowText(row: Record<string, unknown>, keys: string[], fallback: string) {
  for (const key of keys) {
    const value = row[key]
    if (value !== null && value !== undefined && String(value).trim()) return labelize(value, fallback)
  }
  return fallback
}

function rowNumber(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const parsed = Number(row[key])
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function alternativesFromRows(label: string, rows: Array<Record<string, unknown>> | undefined, href: string, fallback?: Selector): AlternativeCard[] {
  const cards = (rows ?? []).slice(0, 3).map((row, index) => ({
    label,
    title: rowText(row, ['selection', 'team', 'normalizedSelection'], `${label} ${index + 1}`),
    market: rowText(row, ['marketLabel', 'market'], 'Market unavailable'),
    probability: rowNumber(row, ['modelProbability', 'model_probability', 'probability']),
    badge: index === 0 ? 'Top' : 'Alt',
    href,
  }))
  if (cards.length || !fallback?.selection) return cards
  return [{
    label,
    title: labelize(fallback.selection, `${label} 1`),
    market: labelize(fallback.marketLabel ?? fallback.market, 'Market unavailable'),
    probability: fallback.modelProbability ?? null,
    badge: 'Top',
    href,
  }]
}

function readinessPercent(readiness: OfficialPickReadiness) {
  if (!readiness.knownApplicableRequirements) return 0
  return Math.round((readiness.requirementsMet / readiness.knownApplicableRequirements) * 100)
}

function performanceFromPayload(payload: unknown): PerformanceSnapshot | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as Record<string, unknown>
  const view = data.publicView && typeof data.publicView === 'object' ? data.publicView as Record<string, unknown> : {}
  const accuracy = Number(view.accuracy)
  return {
    trustLabel: labelize(view.trustLabel, 'Trust unavailable'),
    accuracy: Number.isFinite(accuracy) ? accuracy : null,
    recentTrend: labelize(view.recentTrend, 'Trend unavailable'),
    providerCallsMade: Number(data.providerCallsMade ?? 0),
    remoteMutationsMade: Number(data.remoteMutationsMade ?? 0),
  }
}

function SummaryMetric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p> : null}
    </article>
  )
}

const readinessTone: Record<ReadinessState, Tone> = {
  PASS: 'green',
  FAIL: 'red',
  PENDING: 'yellow',
  NOT_APPLICABLE: 'gray',
  NOT_AVAILABLE: 'gray',
}

function CompactBar({ label, value, max = 100, tone = 'blue' }: { label: string; value: number | null; max?: number; tone?: Tone }) {
  const width = value === null ? 0 : Math.max(0, Math.min(100, (value / max) * 100))
  const fill = tone === 'green' ? 'bg-emerald-400' : tone === 'yellow' ? 'bg-amber-300' : tone === 'red' ? 'bg-rose-400' : 'bg-sky-400'
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-300">
        <span>{label}</span>
        <span>{value === null ? 'Unavailable' : pct(value)}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-800" aria-hidden="true">
        <div className={`h-2 rounded-full ${fill}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function EvidenceGraphics({ opportunity }: { opportunity: NormalizedBestOpportunity | null }) {
  if (!opportunity) {
    return (
      <article className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
        <p className="text-sm font-black text-white">Evidence unavailable</p>
        <p className="mt-2 text-xs leading-5 text-slate-400">No probability, edge, EV or freshness graphic is rendered without a normalized opportunity.</p>
      </article>
    )
  }
  const edgeTone: Tone = opportunity.edge === null ? 'gray' : opportunity.edge > 0 ? 'green' : opportunity.edge < 0 ? 'red' : 'yellow'
  const evTone: Tone = opportunity.expectedValue === null ? 'gray' : opportunity.expectedValue > 0 ? 'green' : opportunity.expectedValue < 0 ? 'red' : 'yellow'
  return (
    <div className="grid gap-3 lg:grid-cols-3" data-b3-evidence-graphics="true">
      <article className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
        <p className="text-sm font-black text-white">Probability vs Implied</p>
        {opportunity.modelProbability !== null && opportunity.impliedProbability !== null ? (
          <div className="mt-4 space-y-4" aria-label="Model probability compared with implied probability">
            <CompactBar label="Model" value={opportunity.modelProbability} tone="green" />
            <CompactBar label="Implied" value={opportunity.impliedProbability} />
          </div>
        ) : (
          <p className="mt-2 text-xs leading-5 text-slate-400">Both probabilities are required before this comparison is shown.</p>
        )}
      </article>
      <article className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
        <p className="text-sm font-black text-white">Edge / EV</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone={edgeTone}>Edge {signedPct(opportunity.edge)}</Badge>
          <Badge tone={evTone}>EV {signedPct(opportunity.expectedValue)}</Badge>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-400">Missing values stay unavailable and are never treated as zero.</p>
      </article>
      <article className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
        <p className="text-sm font-black text-white">Freshness / Quality</p>
        <p className="mt-3 text-lg font-black text-white">{opportunity.freshnessStatus}</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">{opportunity.dataQualityStatus}</p>
      </article>
    </div>
  )
}

function ReadinessRows({ readiness }: { readiness: OfficialPickReadiness }) {
  return (
    <details className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3" data-b3-readiness-gates="true">
      <summary className="cursor-pointer text-sm font-black text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
        View readiness gates
      </summary>
      <div className="mt-4 space-y-3">
        {readiness.rows.map((row) => (
          <div key={row.id} className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950/80 p-3 md:grid-cols-[9rem_1fr]">
            <Badge tone={readinessTone[row.state]}>{row.state}</Badge>
            <div>
              <p className="text-sm font-black text-white">{row.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{row.explanation}</p>
              <p className="mt-2 text-xs font-bold text-slate-500">Current: {row.currentValue} / Required: {row.requiredValue}</p>
            </div>
          </div>
        ))}
      </div>
    </details>
  )
}

function InsightGrid({ title, items, tone, compact = false }: { title: string; items: ReturnType<typeof compactCards>; tone: Tone; compact?: boolean }) {
  return (
    <article className={`rounded-lg border border-slate-800 bg-slate-900/80 ${compact ? 'p-4' : 'p-5'}`} data-b4-insight-section={title.toLowerCase()}>
      <h2 className={`${compact ? 'text-lg' : 'text-xl'} font-black text-white`}>{title}</h2>
      <div className={`mt-4 grid gap-3 ${compact ? '' : 'md:grid-cols-3'}`}>
        {items.map((item) => (
          <div key={item.key} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-black ${toneClasses[tone]}`}>
                {item.icon}
              </span>
              <p className="text-sm font-black text-white">{item.title}</p>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">{item.detail}</p>
          </div>
        ))}
      </div>
    </article>
  )
}

function DecisionStatusCards({ decision }: { decision: AiDecisionPresentation }) {
  const conviction = decision.conviction
  const actionability = decision.actionability
  return (
    <div className="grid gap-3 md:gap-4 lg:grid-cols-2" data-b5-conviction-actionability="true" data-b6-compact-conviction-actionability="true">
      <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-4 md:p-5" data-b2-conviction-shell="true" data-b5-conviction-card="true">
        <p className="sr-only">B2 does not create a new conviction formula. B5 keeps Conviction categorical and presentation-only.</p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">AI Conviction</p>
            <h3 className="mt-2 text-2xl font-black text-white md:text-3xl">{conviction.label}</h3>
          </div>
          <Badge tone={convictionTone[conviction.label]}>Categorical</Badge>
        </div>
        <div className="mt-4 h-2 rounded-full bg-slate-800" aria-label={`AI Conviction is ${conviction.label}`}>
          <div className={`h-2 rounded-full ${convictionTone[conviction.label] === 'green' ? 'bg-violet-300' : convictionTone[conviction.label] === 'yellow' ? 'bg-amber-300' : convictionTone[conviction.label] === 'red' ? 'bg-rose-400' : 'bg-slate-500'}`} />
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300 md:mt-4 md:line-clamp-none">{conviction.rationale}</p>
        <div className="mt-3 flex flex-wrap gap-2 md:mt-4">
          {conviction.evidence.map((item) => <Badge key={item} tone="blue">{item}</Badge>)}
        </div>
        <details className="mt-3 md:mt-4">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.14em] text-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-sky-300">Limiting factor</summary>
          <p className="mt-2 text-sm leading-6 text-slate-400">{conviction.limitingFactor}</p>
        </details>
      </article>

      <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-4 md:p-5" data-b2-actionability-shell="true" data-b5-actionability-card="true">
        <p className="sr-only">This state is backed by verdict and freshness context plus existing B3 readiness evidence.</p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">Actionability</p>
            <h3 className="mt-2 text-2xl font-black text-white md:text-3xl">{actionability.state}</h3>
          </div>
          <Badge tone={actionabilityTone[actionability.state]}>Now</Badge>
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300 md:mt-4 md:line-clamp-none">{actionability.rationale}</p>
        <details className="mt-3 md:mt-4">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.14em] text-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-sky-300">Action detail</summary>
          <p className="mt-2 text-sm leading-6 text-slate-400">Primary blocker: {actionability.primaryBlocker}</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">Next review: {actionability.nextReviewAt ? dateTime(actionability.nextReviewAt) : 'No specific review time exposed.'}</p>
        </details>
      </article>
    </div>
  )
}

function StickyVerdictStrip({ verdict, status, tone }: { verdict: Verdict; status: string; tone: Tone }) {
  return (
    <div
      className={`sticky top-[73px] z-10 rounded-lg border px-3 py-2 shadow-lg shadow-slate-950/20 md:hidden ${toneClasses[tone]}`}
      data-b6-sticky-verdict-strip="true"
      style={{ marginTop: 'calc(env(safe-area-inset-top, 0px) * 0)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">Today</p>
          <p className="truncate text-lg font-black text-white">{verdict}</p>
        </div>
        <p className="min-w-0 flex-1 text-right text-xs font-bold leading-5 text-slate-100">{status}</p>
      </div>
    </div>
  )
}

function MobileDecisionDetails({
  activeTab,
  onTabChange,
  whyCards,
  riskCards,
  readiness,
  actionability,
}: {
  activeTab: DecisionDetailTab
  onTabChange: (tab: DecisionDetailTab) => void
  whyCards: ReturnType<typeof compactCards>
  riskCards: ReturnType<typeof compactCards>
  readiness: OfficialPickReadiness
  actionability: ActionabilityPresentation
}) {
  const urgentRisk = actionability.state === 'DO NOT ACT' || actionability.state === 'WAIT'
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-4 md:hidden" data-b6-mobile-decision-segments="true">
      {urgentRisk ? (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100" data-b6-risk-summary="true">
          {actionability.primaryBlocker}
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-1" role="tablist" aria-label="Decision details">
        {decisionDetailTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`decision-detail-${tab.id}`}
            className={`min-h-11 rounded-lg px-2 text-sm font-black outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${activeTab === tab.id ? 'bg-sky-500/20 text-white' : 'bg-slate-950 text-slate-300'}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {activeTab === 'why' ? (
          <div id="decision-detail-why" role="tabpanel" aria-labelledby="Why">
            <InsightGrid title="Why" items={whyCards} tone="green" compact />
          </div>
        ) : null}
        {activeTab === 'risks' ? (
          <div id="decision-detail-risks" role="tabpanel" aria-labelledby="Risks">
            <InsightGrid title="Risks" items={riskCards} tone="yellow" compact />
          </div>
        ) : null}
        {activeTab === 'readiness' ? (
          <div id="decision-detail-readiness" role="tabpanel" aria-labelledby="Readiness">
            <ReadinessProgress readiness={readiness} compact />
          </div>
        ) : null}
      </div>
    </section>
  )
}

function AiExplanationCard({ decision }: { decision: AiDecisionPresentation }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-5" data-b5-ai-explanation="true">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-200">AI Explanation</p>
      <h2 className="mt-2 text-2xl font-black text-white">Decision summary</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">{decision.explanation.verdictSummary}</p>
      <p className="mt-4 text-sm leading-6 text-slate-400">{decision.explanation.officialStatusExplanation}</p>
    </article>
  )
}

function ChangeMindPanel({ decision }: { decision: AiDecisionPresentation }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-4 md:p-5" data-b5-change-mind="true" data-b6-change-mind-compact="true">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">What Would Change My Mind?</p>
      <h2 className="mt-2 text-xl font-black text-white md:text-2xl">Observable conditions</h2>
      <div className="mt-4 space-y-2 md:space-y-3" role="list" aria-label="Evidence-backed conditions that could change the decision">
        {decision.changeConditions.map((condition) => (
          <div key={condition.conditionId} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 md:p-4" role="listitem">
            <p className="text-sm font-black text-white">{condition.currentState}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{condition.possibleChange} {condition.expectedEffect}</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{condition.qualifier}</p>
          </div>
        ))}
      </div>
    </article>
  )
}

function ReadinessProgress({ readiness, compact = false }: { readiness: OfficialPickReadiness; compact?: boolean }) {
  const percent = readinessPercent(readiness)
  return (
    <article className={`rounded-lg border border-slate-800 bg-slate-900/80 ${compact ? 'p-4' : 'p-5'}`} data-b4-readiness-progress="true">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Readiness</p>
          <h2 className={`${compact ? 'mt-1 text-xl' : 'mt-2 text-2xl'} font-black text-white`}>Requirements</h2>
        </div>
        <p className={`${compact ? 'text-2xl' : 'text-3xl'} font-black text-white`}>{readiness.requirementsMet} / {readiness.knownApplicableRequirements}</p>
      </div>
      <div className="mt-4 h-3 rounded-full bg-slate-800" aria-label={`${readiness.requirementsMet} of ${readiness.knownApplicableRequirements} known readiness requirements passed`}>
        <div className="h-3 rounded-full bg-emerald-400" style={{ width: `${percent}%` }} />
      </div>
      <div className={`mt-4 grid gap-2 ${compact ? '' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
        {readiness.rows.slice(0, 8).map((row) => (
          <div key={row.id} className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-bold text-slate-300">{row.label}</span>
            <Badge tone={readinessTone[row.state]}>{row.state}</Badge>
          </div>
        ))}
      </div>
      <ReadinessRows readiness={readiness} />
    </article>
  )
}

function PremiumMetric({ label, value, detail, tone = 'gray', priority = false }: { label: string; value: string; detail?: string; tone?: Tone; priority?: boolean }) {
  return (
    <article className={`rounded-lg border border-slate-800 bg-slate-950/70 ${priority ? 'p-3 md:p-4' : 'p-4'}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500 md:text-xs md:tracking-[0.14em]">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3 md:mt-3">
        <p className={`${priority ? 'text-lg md:text-2xl' : 'text-2xl'} break-words font-black text-white`}>{value}</p>
        <span className={`h-2.5 w-2.5 rounded-full ${tone === 'green' ? 'bg-emerald-400' : tone === 'yellow' ? 'bg-amber-300' : tone === 'red' ? 'bg-rose-400' : tone === 'blue' ? 'bg-sky-400' : 'bg-slate-500'}`} />
      </div>
      {detail ? <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p> : null}
    </article>
  )
}

function AlternativesPreview({ cards }: { cards: AlternativeCard[] }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-5" data-b4-alternatives-preview="true">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-200">Alternatives</p>
          <h2 className="mt-2 text-2xl font-black text-white">Top review paths</h2>
        </div>
        <div className="flex gap-2">
          <a href="/most-likely" className="rounded-full border border-slate-700 px-3 py-2 text-xs font-black text-slate-200 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-sky-300">Most Likely - View All</a>
          <a href="/best-value" className="rounded-full border border-slate-700 px-3 py-2 text-xs font-black text-slate-200 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-sky-300">Best Value - View All</a>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3" data-b6-mobile-alternatives-preview="true">
        {cards.slice(0, 6).map((card, index) => (
          <a key={`${card.label}-${index}-${card.title}`} href={card.href} className={`${index > 2 ? 'hidden md:block' : ''} rounded-lg border border-slate-800 bg-slate-950/70 p-4 outline-none hover:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-300`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{card.label}</p>
              <Badge tone={card.label === 'Best Value' ? 'green' : 'blue'}>{card.badge}</Badge>
            </div>
            <p className="mt-3 text-lg font-black text-white">{card.title}</p>
            <p className="mt-1 text-sm font-bold text-slate-300">{card.market}</p>
            <div className="mt-4">
              <CompactBar label="Probability" value={card.probability} tone="green" />
            </div>
          </a>
        ))}
      </div>
    </article>
  )
}

function PerformanceSnapshotCard({ snapshot }: { snapshot: PerformanceSnapshot | null }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-5" data-b4-performance-snapshot="true">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">Performance Snapshot</p>
          <h2 className="mt-2 text-2xl font-black text-white">Trust, accuracy, trend</h2>
        </div>
        <a href="/performance" className="rounded-full border border-violet-400/30 px-4 py-2 text-xs font-black text-violet-100 hover:bg-violet-500/10 focus-visible:ring-2 focus-visible:ring-violet-300">Open Performance -&gt;</a>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <PremiumMetric label="Trust" value={snapshot?.trustLabel ?? 'Loading'} detail="Cutoff-safe production scope" tone="blue" />
        <PremiumMetric label="Accuracy" value={snapshot?.accuracy === null || snapshot?.accuracy === undefined ? 'N/A' : pct(snapshot.accuracy)} detail="Official performance sample" tone={snapshot?.accuracy === null || snapshot?.accuracy === undefined ? 'gray' : 'green'} />
        <PremiumMetric label="Recent Trend" value={snapshot?.recentTrend ?? 'Loading'} detail={`Provider calls ${snapshot?.providerCallsMade ?? 0}; mutations ${snapshot?.remoteMutationsMade ?? 0}`} tone="yellow" />
      </div>
    </article>
  )
}

function Skeleton() {
  return (
    <section className="space-y-4 pb-6 md:space-y-5" aria-busy="true" aria-label="Loading today's decision" data-b6-mobile-loading-state="true">
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 md:p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Today</p>
        <div className="mt-4 h-8 max-w-md rounded bg-slate-800 md:h-10" />
        <div className="mt-3 h-4 max-w-2xl rounded bg-slate-800" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="h-56 rounded-lg border border-slate-800 bg-slate-900/70 md:h-80" />
        <div className="h-40 rounded-lg border border-slate-800 bg-slate-900/70 md:h-80" />
      </div>
    </section>
  )
}

export default function TodayDecisionPanel() {
  const [data, setData] = useState<TodayResponse | null>(null)
  const [performance, setPerformance] = useState<PerformanceSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeDetailTab, setActiveDetailTab] = useState<DecisionDetailTab>('why')

  useEffect(() => {
    let active = true
    fetch('/api/dashboard/today', { cache: 'no-store' })
      .then(async (response) => {
        const json = await response.json()
        if (!response.ok) throw new Error(json?.error ?? 'Today is temporarily unavailable.')
        if (active) setData(json)
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Today is temporarily unavailable.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    fetch('/api/performance', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null
        return response.json()
      })
      .then((json) => {
        if (active) setPerformance(performanceFromPayload(json))
      })
      .catch(() => {
        if (active) setPerformance(null)
      })
    return () => {
      active = false
    }
  }, [])

  const opportunity = useMemo(() => data ? bestOpportunity(data) : null, [data])
  const normalizedOpportunity = useMemo(() => data ? normalizeBestOpportunity(data) : null, [data])
  const readiness = useMemo(() => buildOfficialPickReadiness(normalizedOpportunity), [normalizedOpportunity])
  const decisionPresentation = useMemo(() => data ? buildAiDecisionPresentation({
    opportunity: normalizedOpportunity,
    readiness,
    freshnessStatus: data.viewModel?.selectors?.marketFreshnessSummary?.state ?? data.freshness ?? 'unknown',
    nextActionAt: data.nextActionAt,
    warnings: data.warnings,
  }) : null, [data, normalizedOpportunity, readiness])
  const verdict = useMemo(() => data ? verdictFor(data, opportunity) : null, [data, opportunity])
  const reasons = useMemo(() => {
    if (decisionPresentation) {
      return {
        why: decisionPresentation.explanation.supportingReasons,
        risks: decisionPresentation.explanation.risks,
      }
    }
    return data ? reasonList(data, opportunity) : { why: [], risks: [] }
  }, [data, opportunity, decisionPresentation])
  const whyCards = useMemo(() => compactCards(reasons.why, 'why'), [reasons.why])
  const riskCards = useMemo(() => compactCards(reasons.risks, 'risk'), [reasons.risks])

  if (loading) return <Skeleton />
  if (error || !data || !verdict || !decisionPresentation) {
    return (
      <section className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100 md:p-6" data-b6-mobile-error-state="true">
        <p className="text-xs font-black uppercase tracking-[0.24em]">Today unavailable</p>
        <h1 className="mt-2 text-2xl font-black text-white md:text-3xl">The daily decision shell could not load.</h1>
        <p className="mt-2 text-sm leading-6">{error ?? 'The Today contract did not return usable data.'}</p>
        <a href="/ai-operations" className="mt-4 inline-flex rounded-lg border border-amber-300/40 px-4 py-2 text-sm font-black text-amber-50 outline-none hover:bg-amber-500/10 focus-visible:ring-2 focus-visible:ring-amber-200">Open Operations</a>
      </section>
    )
  }

  const verdictTone = toneForVerdict(verdict.label)
  const marketFreshness = marketFreshnessDisplay(data, opportunity)
  const alternatives = [
    ['Most Likely', data.viewModel?.selectors?.mostLikelySummary?.selector?.selection, '/most-likely'],
    ['Best Value', data.viewModel?.selectors?.bestAvailableValue?.selection, '/best-value'],
    ['Performance', 'Trust and results', '/performance'],
  ] as const
  const opportunityAlternatives = [
    ...alternativesFromRows('Most Likely', data.sections?.mostLikely?.data, '/most-likely', data.viewModel?.selectors?.mostLikelySummary?.selector),
    ...alternativesFromRows('Best Value', data.sections?.bestValue?.data, '/best-value', data.viewModel?.selectors?.bestAvailableValue),
  ].slice(0, 6)

  return (
    <section className="space-y-4 pb-4 md:space-y-6" data-b2-today-shell="true" data-b3-best-opportunity-readiness="true" data-b4-decision-cockpit="true" data-b6-mobile-decision-experience="true">
      <StickyVerdictStrip verdict={verdict.label} status={decisionPresentation.actionability.state} tone={verdictTone} />

      <div className={`rounded-lg border p-4 md:p-8 ${toneClasses[verdictTone]}`} data-b2-verdict-label={verdict.label} data-b4-verdict-hero="true" data-b6-mobile-verdict-hero="true">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-300">Today&apos;s Verdict</p>
            <h1 className="mt-2 text-4xl font-black tracking-normal text-white sm:text-6xl md:mt-3 md:text-7xl">{verdict.label}</h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-100 md:mt-4 md:text-lg md:leading-8">{verdict.detail}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={verdictTone}>{verdict.officialStatus}</Badge>
            <Badge tone={opportunity?.status === 'official' ? 'green' : 'yellow'}>
              {opportunity?.status === 'official' ? 'Official Pick' : 'Best Available - Not Official'}
            </Badge>
            <Badge tone="blue">Page {relativeTime(data.generatedAt)}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
        <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-4 md:p-7" data-b2-best-opportunity="true" data-b4-best-opportunity-hero="true" data-b6-mobile-best-opportunity-hero="true">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-300">Today&apos;s Best Opportunity</p>
              {opportunity ? (
                <>
                  <h2 className="mt-3 break-words text-3xl font-black text-white md:mt-4 md:text-5xl">{opportunity.selection}</h2>
                  <p className="mt-3 break-words text-base font-bold text-slate-200 md:text-lg">{opportunity.sport} / {opportunity.event}</p>
                  <p className="mt-2 text-base font-semibold text-sky-100">{opportunity.market} / {odds(opportunity.odds)}</p>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 md:mt-4">{opportunity.reason}</p>
                </>
              ) : (
                <>
                  <h2 className="mt-3 text-3xl font-black text-white md:mt-4 md:text-5xl">No eligible opportunity visible.</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    The Today contract did not expose a supported market opportunity. This state does not fabricate a pick.
                  </p>
                </>
              )}
            </div>
            <Badge tone={opportunity?.status === 'official' ? 'green' : opportunity ? 'yellow' : 'gray'}>
              {opportunity?.status === 'official' ? 'Official Pick' : opportunity ? 'Best Available - Not Official' : 'No Opportunity'}
            </Badge>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-2 md:mt-7 md:gap-3 xl:grid-cols-4" data-b4-compact-metrics="true" data-b6-primary-metrics="true">
            <PremiumMetric label="Probability" value={pct(opportunity?.modelProbability)} tone="green" priority />
            <PremiumMetric label="Implied" value={pct(opportunity?.impliedProbability)} tone="blue" priority />
            <PremiumMetric label="Edge" value={signedPct(opportunity?.edge)} tone={Number(opportunity?.edge) > 0 ? 'green' : 'gray'} priority />
            <PremiumMetric label="EV" value={signedPct(opportunity?.expectedValue)} tone={Number(opportunity?.expectedValue) > 0 ? 'green' : 'gray'} priority />
            <PremiumMetric label="Confidence" value={pct(opportunity?.confidence)} tone="yellow" priority />
            <PremiumMetric label="Market Freshness" value={marketFreshness.label} detail={marketFreshness.detail} tone={marketFreshness.tone} priority />
            <PremiumMetric label="Current Odds" value={odds(opportunity?.odds)} detail={opportunity?.sportsbook} tone="blue" />
            <PremiumMetric label="Data Quality" value={opportunity?.dataQuality ?? 'Not yet available'} tone="blue" />
          </div>
          <div className="mt-5 hidden md:block">
            <EvidenceGraphics opportunity={normalizedOpportunity} />
          </div>
        </article>

        <aside className="hidden gap-4 md:grid">
          <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-5" data-b2-readiness-shell="true">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Official Pick Readiness</p>
            <h3 className="mt-2 text-2xl font-black text-white">{readiness.status === 'OFFICIAL' ? 'Official' : readiness.status === 'NO_OPPORTUNITY' ? 'No Opportunity' : 'Not Official'}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Structured gate progress was deferred to B3 and is now shown from existing evidence. {readiness.summary}
            </p>
            <div className="mt-4 h-3 rounded-full bg-slate-800" aria-label={`${readiness.requirementsMet} of ${readiness.knownApplicableRequirements} known readiness requirements passed`}>
              <div className="h-3 rounded-full bg-emerald-400" style={{ width: `${readinessPercent(readiness)}%` }} />
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Current blocker context: {readiness.blockerSummary}
            </p>
            <ReadinessRows readiness={readiness} />
          </article>
        </aside>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <AiExplanationCard decision={decisionPresentation} />
        <DecisionStatusCards decision={decisionPresentation} />
      </div>

      <MobileDecisionDetails
        activeTab={activeDetailTab}
        onTabChange={setActiveDetailTab}
        whyCards={whyCards}
        riskCards={riskCards}
        readiness={readiness}
        actionability={decisionPresentation.actionability}
      />

      <div className="hidden space-y-6 md:block" data-b6-desktop-decision-details="true">
        <InsightGrid title="Why" items={whyCards} tone="green" />
        <InsightGrid title="Risks" items={riskCards} tone="yellow" />
        <ReadinessProgress readiness={readiness} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <ChangeMindPanel decision={decisionPresentation} />
        <AlternativesPreview cards={opportunityAlternatives.length ? opportunityAlternatives : alternatives.map(([label, value, href]) => ({
          label,
          title: labelize(value, 'Open full view'),
          market: 'Existing route',
          probability: null,
          badge: 'Open',
          href,
        }))} />
      </div>
      <PerformanceSnapshotCard snapshot={performance} />

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryMetric label="Market Updated" value={marketFreshness.label} detail={dateTime(opportunity?.updatedAt ?? marketTimestampFor(data), 'Market update time unavailable')} />
        <SummaryMetric label="Today API" value={labelize(data.status, 'Available')} detail={`Provider calls ${data.providerCallsMade ?? 0}; mutations ${data.remoteMutationsMade ?? 0}`} />
        <SummaryMetric label="Performance Context" value="Compact Link" detail="Open Performance for results, calibration and trust history." />
      </div>
    </section>
  )
}
