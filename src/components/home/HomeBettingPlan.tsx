'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type Tone = 'green' | 'yellow' | 'blue' | 'red' | 'gray'

type Selector = {
  status?: 'AVAILABLE' | 'EMPTY' | 'BLOCKED'
  eventId?: string | null
  matchup?: string | null
  market?: string | null
  marketLabel?: string | null
  selection?: string | null
  metricName?: string | null
  metricValue?: number | null
  modelProbability?: number | null
  confidence?: number | null
  priceState?: string | null
  productFreshness?: {
    status?: string
    actionability?: string
    marketTimestamp?: string | null
    nextPlannedRefreshAt?: string | null
  } | null
  americanOdds?: number | null
  sportsbook?: string | null
  impliedProbability?: number | null
  edge?: number | null
  expectedValue?: number | null
  freshness?: 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN_TIMESTAMP'
  blocker?: string | null
  rankingReason?: string | null
}

type TodayResponse = {
  success: boolean
  status?: string
  generatedAt?: string
  latestOddsTimestamp?: string | null
  officialPicks?: number
  freshness?: string
  nextAction?: string
  summary?: {
    recommendation?: string
    aiBriefing?: string
    marketPrices?: string
  }
  warnings?: string[]
  viewModel?: {
    selectors?: {
      highestProjectedOutcome?: Selector
      highestRankedPricedMarket?: Selector
      mostLikelySummary?: { selector?: Selector }
      bestAvailableValue?: Selector
      marketFreshnessSummary?: {
        state?: 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN_TIMESTAMP'
        latestOddsTimestamp?: string | null
        freshStaleContradictions?: number
      }
      currentBoardSummary?: {
        candidates?: number
        displayableMarkets?: number
        directlyPricedCandidates?: number
      }
    }
  }
  sections?: {
    officialPicks?: { data?: unknown[]; reason?: string | null }
    groundedOpportunities?: { data?: Array<Record<string, unknown>>; reason?: string | null }
    mostLikely?: { data?: Array<Record<string, unknown>>; reason?: string | null }
    bestValue?: { data?: Array<Record<string, unknown>>; reason?: string | null }
  }
  providerCallsMade?: number
  remoteMutationsMade?: number
  totalScheduledToday?: number
  predictionCandidates?: number
  informationalCandidates?: number
}

type ApiEnvelope = Record<string, unknown>

type PlanPick = {
  id: string
  label: string
  source: string
  event: string
  selection: string
  market: string
  odds: number | null
  sportsbook: string
  probability: number | null
  confidence: number | null
  edge: number | null
  ev: number | null
  freshness: string
  modelVersion: string
  freshnessActionability?: string
  marketTimestamp?: string | null
  nextRefreshAt?: string | null
  evidence: string[]
  official: boolean
  qualified: boolean
  reason: string
}

const toneClasses: Record<Tone, string> = {
  green: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-50',
  yellow: 'border-amber-300/30 bg-amber-300/10 text-amber-50',
  blue: 'border-sky-300/30 bg-sky-300/10 text-sky-50',
  red: 'border-rose-300/30 bg-rose-300/10 text-rose-50',
  gray: 'border-slate-700 bg-slate-900/85 text-slate-100',
}

const actionTone: Record<string, Tone> = {
  ACT_NOW: 'green',
  ACTIONABLE: 'green',
  REVIEW_FIRST: 'yellow',
  WAIT_FOR_REFRESH: 'yellow',
  INFORMATIONAL_ONLY: 'blue',
  BLOCKED: 'red',
  UNAVAILABLE: 'gray',
}

const localeFoundation = {
  en: {
    morningBrief: 'Decision Core Morning Brief',
    question: 'What should I do today?',
  },
  es: {
    morningBrief: 'Resumen matutino de Decision Core',
    question: 'Que debo hacer hoy?',
  },
}

function numberOrNull(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function label(value: unknown, fallback = 'Unavailable') {
  const text = String(value ?? '').trim()
  if (!text || text === 'null' || text === 'undefined') return fallback
  return text.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function pct(value: unknown) {
  const parsed = numberOrNull(value)
  if (parsed === null) return 'N/A'
  return `${parsed.toFixed(1)}%`
}

function signedPct(value: unknown) {
  const parsed = numberOrNull(value)
  if (parsed === null) return 'N/A'
  return `${parsed > 0 ? '+' : ''}${parsed.toFixed(2)}%`
}

function countValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function odds(value: unknown) {
  const parsed = numberOrNull(value)
  if (parsed === null) return 'Odds N/A'
  return parsed > 0 ? `+${parsed}` : `${parsed}`
}

function width(value: number | null, fallback = 8) {
  if (value === null) return `${fallback}%`
  return `${Math.max(4, Math.min(100, value))}%`
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

function fromSelector(id: string, source: string, selector: Selector | undefined, official = false): PlanPick | null {
  if (!selector || selector.status !== 'AVAILABLE' || !selector.selection) return null
  const ev = selectorExpectedValue(selector)
  const edge = numberOrNull(selector.edge)
  const probability = numberOrNull(selector.modelProbability)
  const confidence = numberOrNull(selector.confidence)
  const freshness = label(selector.productFreshness?.status ?? selector.freshness ?? selector.priceState, 'Freshness unavailable')
  const freshnessActionability = label(selector.productFreshness?.actionability, 'INFORMATIONAL_ONLY')
  const qualified = !['STALE', 'INVALID_FUTURE', 'POST_START', 'MARKET_CLOSED'].includes(freshness) &&
    !['BLOCKED', 'WAIT_FOR_REFRESH', 'UNAVAILABLE'].includes(freshnessActionability) &&
    selector.priceState !== 'STALE_PREGAME_PRICE' &&
    (official || probability !== null || confidence !== null)
  return {
    id,
    label: source,
    source,
    event: label(selector.matchup, 'Event pending'),
    selection: label(selector.selection, 'Selection pending'),
    market: label(selector.marketLabel ?? selector.market, 'Market pending'),
    odds: numberOrNull(selector.americanOdds),
    sportsbook: label(selector.sportsbook, 'Sportsbook pending'),
    probability,
    confidence,
    edge,
    ev,
    freshness,
    modelVersion: 'Model version unavailable',
    freshnessActionability,
    marketTimestamp: selector.productFreshness?.marketTimestamp ?? null,
    nextRefreshAt: selector.productFreshness?.nextPlannedRefreshAt ?? null,
    evidence: [
      `Source: ${source}`,
      `Freshness: ${freshness}`,
      edge !== null ? `Edge ${signedPct(edge)}` : 'Edge unavailable',
      ev !== null ? `EV ${signedPct(ev)}` : 'EV unavailable',
    ],
    official,
    qualified,
    reason: label(selector.blocker ?? selector.rankingReason, qualified ? 'Qualified from existing Today evidence.' : 'Evidence is incomplete or stale.'),
  }
}

function fromRow(id: string, source: string, row: Record<string, unknown>, official = false): PlanPick {
  const probability = numberOrNull(row.modelProbability ?? row.model_probability ?? row.probability)
  const confidence = numberOrNull(row.confidence)
  const edge = numberOrNull(row.edgePercentagePoints ?? row.edge)
  const ev = numberOrNull(row.expectedValuePercent ?? row.expectedValue ?? row.ev)
  const productFreshness = row.productFreshness && typeof row.productFreshness === 'object' ? row.productFreshness as Record<string, unknown> : null
  const freshness = label(productFreshness?.status ?? row.freshnessStatus ?? row.freshness, 'Freshness unavailable')
  const freshnessActionability = label(productFreshness?.actionability, 'INFORMATIONAL_ONLY')
  const qualified = !/stale|avoid|do not act/i.test(`${freshness} ${row.blocker ?? ''} ${row.reasonNotOfficial ?? ''}`) &&
    !['BLOCKED', 'WAIT_FOR_REFRESH', 'UNAVAILABLE'].includes(freshnessActionability)
  const modelVersion = label(row.modelVersion ?? row.model_version, 'Model version unavailable')
  const evidence = arrayValue(row.supportingEvidence ?? row.evidence ?? row.positiveFactors)
    .map((item) => label(item, ''))
    .filter(Boolean)
  return {
    id,
    label: source,
    source,
    event: label(row.matchup ?? row.eventLabel, 'Event pending'),
    selection: label(row.selection ?? row.team, 'Selection pending'),
    market: label(row.marketLabel ?? row.market, 'Market pending'),
    odds: numberOrNull(row.americanOdds ?? row.odds),
    sportsbook: label(row.sportsbook, 'Sportsbook pending'),
    probability,
    confidence,
    edge,
    ev,
    freshness,
    modelVersion,
    freshnessActionability,
    marketTimestamp: typeof productFreshness?.marketTimestamp === 'string' ? productFreshness.marketTimestamp : null,
    nextRefreshAt: typeof productFreshness?.nextPlannedRefreshAt === 'string' ? productFreshness.nextPlannedRefreshAt : null,
    evidence: [
      ...evidence.slice(0, 3),
      `Source: ${source}`,
      confidence !== null ? `Confidence ${pct(confidence)}` : 'Confidence unavailable',
      edge !== null ? `Edge ${signedPct(edge)}` : 'Edge unavailable',
    ],
    official,
    qualified,
    reason: official ? 'Passed the existing Official Pick policy.' : label(row.reasonNotOfficial ?? row.blocker ?? row.why, 'Informational candidate from stored evidence.'),
  }
}

function allCandidates(data: TodayResponse | null) {
  if (!data) return []
  const selectors = data.viewModel?.selectors
  const rows: PlanPick[] = []
  const officialRows = data.sections?.officialPicks?.data ?? []
  officialRows.forEach((row, index) => rows.push(fromRow(`official-${index}`, 'Official Pick', row as Record<string, unknown>, true)))
  const selectorRows = [
    fromSelector('best-value', 'Best Value', selectors?.bestAvailableValue),
    fromSelector('priced', 'Priced Market', selectors?.highestRankedPricedMarket),
    fromSelector('most-likely', 'Most Likely', selectors?.mostLikelySummary?.selector),
    fromSelector('projected', 'Highest Probability', selectors?.highestProjectedOutcome),
  ].filter((item): item is PlanPick => Boolean(item))
  rows.push(...selectorRows)
  ;(data.sections?.groundedOpportunities?.data ?? []).slice(0, 8).forEach((row, index) => {
    rows.push(fromRow(`grounded-${index}`, 'Grounded Opportunity', row))
  })
  const unique = new Map<string, PlanPick>()
  for (const item of rows) {
    const key = `${item.event}|${item.market}|${item.selection}|${item.sportsbook}`
    if (!unique.has(key)) unique.set(key, item)
  }
  return Array.from(unique.values())
}

function bestBy(candidates: PlanPick[], predicate: (item: PlanPick) => boolean, score: (item: PlanPick) => number) {
  return candidates.filter(predicate).sort((left, right) => score(right) - score(left))[0] ?? null
}

function pickPlan(data: TodayResponse | null) {
  const candidates = allCandidates(data)
  const official = candidates.filter((item) => item.official && item.qualified)
  const rentPlay = bestBy(official, () => true, (item) => Number(item.confidence ?? 0) + Number(item.probability ?? 0))
  const moneyline = bestBy(
    candidates,
    (item) => item.qualified && item.market.toLowerCase().includes('moneyline'),
    (item) => (item.official ? 1000 : 0) + Number(item.confidence ?? 0) + Number(item.probability ?? 0) + Number(item.ev ?? 0),
  )
  const bestOpportunity = bestBy(
    candidates,
    (item) => item.qualified && !/avoid|do not act/i.test(item.reason),
    (item) => (item.official ? 1000 : 0) + Number(item.ev ?? 0) + Number(item.edge ?? 0) + Number(item.confidence ?? 0),
  )
  const closest = bestBy(candidates, () => true, (item) => Number(item.confidence ?? 0) + Number(item.probability ?? 0))
  const parlayLegs = candidates
    .filter((item) => item.qualified && item.probability !== null)
    .sort((left, right) => Number(right.probability ?? 0) - Number(left.probability ?? 0))
    .slice(0, 5)
  const watchlist = candidates
    .filter((item) => item.qualified && item.id !== rentPlay?.id && item.id !== moneyline?.id && item.id !== bestOpportunity?.id)
    .sort((left, right) => Number(right.confidence ?? 0) + Number(right.probability ?? 0) - Number(left.confidence ?? 0) - Number(left.probability ?? 0))
    .slice(0, 4)
  return { candidates, rentPlay, moneyline, bestOpportunity, closest, parlayLegs, watchlist }
}

function MetricBar({ label: metricLabel, value, tone = 'green' }: { label: string; value: number | null; tone?: Tone }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
        <span>{metricLabel}</span>
        <span className="text-slate-100">{pct(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-800">
        <div className={`h-2 rounded-full ${tone === 'green' ? 'bg-emerald-400' : tone === 'blue' ? 'bg-sky-400' : tone === 'yellow' ? 'bg-amber-300' : 'bg-slate-500'}`} style={{ width: width(value) }} />
      </div>
    </div>
  )
}

function StatusChip({ children, tone = 'gray' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${toneClasses[tone]}`}>{children}</span>
}

function compactDate(value: string | null | undefined) {
  if (!value) return 'Unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return label(value)
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

function dailyRecommendation(plan: ReturnType<typeof pickPlan>, data: TodayResponse | null) {
  const official = countValue(data?.officialPicks) || plan.candidates.filter((item) => item.official).length
  const valueCandidates = plan.candidates.filter((item) => item.qualified && Number(item.ev ?? 0) > 0 && Number(item.edge ?? 0) > 0).length
  if (official > 0) return { label: 'BET TODAY', tone: 'green' as Tone, reason: 'At least one stored candidate passed the existing Official Pick policy.' }
  if (valueCandidates > 0 || plan.bestOpportunity) return { label: 'LIMITED OPPORTUNITIES', tone: 'yellow' as Tone, reason: 'Stored evidence found candidates worth review, but Official Pick policy did not certify a broad betting day.' }
  return { label: 'NO STRONG EDGE TODAY', tone: 'gray' as Tone, reason: 'Current stored evidence does not show a qualified edge under existing policy.' }
}

function DailyBrief({
  data,
  plan,
  currentBoard,
  intelligence,
  performance,
}: {
  data: TodayResponse
  plan: ReturnType<typeof pickPlan>
  currentBoard: ApiEnvelope | null
  intelligence: ApiEnvelope | null
  performance: ApiEnvelope | null
}) {
  const recommendation = dailyRecommendation(plan, data)
  const boardCandidates = countValue(currentBoard?.candidates ? arrayValue(currentBoard.candidates).length : currentBoard?.candidateCount)
  const intelligenceSample = countValue(recordValue(intelligence?.currentProductionSample).sampleSize)
  const perfMetrics = recordValue(recordValue(performance?.aiBrain).reportCard)
  const perfCore = recordValue(perfMetrics.metrics)
  const perfCalibration = recordValue(perfMetrics.calibration)
  const gamesToday = countValue(data.totalScheduledToday ?? data.viewModel?.selectors?.currentBoardSummary?.candidates ?? boardCandidates)
  const predictions = countValue(data.predictionCandidates ?? boardCandidates ?? plan.candidates.length)
  const official = countValue(data.officialPicks) || plan.candidates.filter((item) => item.official).length
  const value = plan.candidates.filter((item) => item.qualified && Number(item.ev ?? 0) > 0).length
  const skipped = Math.max(0, plan.candidates.length - plan.candidates.filter((item) => item.qualified).length)

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-5 md:p-6" data-r9-daily-brief="true" data-mc08a-morning-brief="true" data-language-foundation="en-es">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-200">{localeFoundation.en.morningBrief}</p>
          <h2 className="mt-3 text-3xl font-black text-white md:text-5xl">Good Morning. {localeFoundation.en.question}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Today&apos;s Betting Weather: {recommendation.label}. {recommendation.reason}</p>
        </div>
        <StatusChip tone={recommendation.tone}>{label(data.status, 'Today ready')}</StatusChip>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <MiniMetric label="Games Today" value={gamesToday} />
        <MiniMetric label="Sports Active" value={gamesToday > 0 ? 1 : 0} />
        <MiniMetric label="Predictions" value={predictions} />
        <MiniMetric label="Official Picks" value={official} />
        <MiniMetric label="Value Candidates" value={value} />
        <MiniMetric label="Games Skipped" value={skipped} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <MiniMetric label="Decision Summary" value={recommendation.label} />
        <MiniMetric label="Market Quality" value={data.summary?.marketPrices ?? label(data.freshness, 'Unknown')} />
        <MiniMetric label="Risk" value={skipped ? 'Review first' : 'Low'} />
        <MiniMetric label="Confidence" value={perfCore.accuracy ?? perfCalibration.calibrationError ?? intelligenceSample ? 'Measured' : 'Limited'} />
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        Latest odds: {compactDate(data.latestOddsTimestamp ?? data.viewModel?.selectors?.marketFreshnessSummary?.latestOddsTimestamp ?? null)}
      </p>
    </section>
  )
}

function MiniMetric({ label: metricLabel, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
      <p className="text-xs font-black uppercase text-slate-500">{metricLabel}</p>
      <p className="mt-2 break-words text-2xl font-black text-white">{String(value ?? 'N/A')}</p>
    </div>
  )
}

function PickCard({
  title,
  icon,
  pick,
  emptyTitle,
  emptyDetail,
  closest,
}: {
  title: string
  icon: string
  pick: PlanPick | null
  emptyTitle: string
  emptyDetail: string
  closest?: PlanPick | null
}) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-950/80 p-5 shadow-2xl shadow-slate-950/20 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{icon} {title}</p>
          <h2 className="mt-3 text-2xl font-black text-white md:text-3xl">{pick ? pick.selection : emptyTitle}</h2>
        </div>
        <StatusChip tone={pick?.official ? 'green' : pick ? 'yellow' : 'gray'}>{pick?.official ? 'Official' : pick ? 'Qualified' : 'No Bet'}</StatusChip>
      </div>
      {pick ? (
        <>
          <p className="mt-3 text-sm font-bold text-slate-300">{pick.event}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
              <p className="text-xs font-bold uppercase text-slate-500">Market</p>
              <p className="mt-1 text-sm font-black text-white">{pick.market}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
              <p className="text-xs font-bold uppercase text-slate-500">Price</p>
              <p className="mt-1 text-sm font-black text-white">{odds(pick.odds)}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
              <p className="text-xs font-bold uppercase text-slate-500">Freshness</p>
              <p className="mt-1 text-sm font-black text-white">{pick.freshness}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
              <p className="text-xs font-bold uppercase text-slate-500">Actionability</p>
              <p className="mt-1 text-sm font-black text-white">{pick.freshnessActionability ?? 'INFORMATIONAL_ONLY'}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4">
            <MetricBar label="Probability" value={pick.probability} tone="green" />
            <MetricBar label="Confidence" value={pick.confidence} tone="blue" />
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                <p className="text-xs font-bold uppercase text-slate-500">Edge</p>
                <p className="mt-1 text-xl font-black text-emerald-200">{signedPct(pick.edge)}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                <p className="text-xs font-bold uppercase text-slate-500">EV</p>
                <p className="mt-1 text-xl font-black text-emerald-200">{signedPct(pick.ev)}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/70 p-4" data-r9-ai-explanation="true">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">AI Explanation</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{pick.reason}</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <MiniText label="Model" value={pick.modelVersion} />
              <MiniText label="Evidence" value={pick.evidence.slice(0, 3).join(' / ') || 'No supporting evidence exposed by current APIs.'} />
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm leading-6 text-slate-400">{emptyDetail}</p>
          {closest ? (
            <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">Closest Candidate</p>
              <p className="mt-2 text-lg font-black text-white">{closest.selection}</p>
              <p className="mt-1 text-sm text-amber-50">{closest.event} / {closest.market}</p>
              <p className="mt-2 text-sm text-slate-300">{closest.reason}</p>
            </div>
          ) : null}
        </>
      )}
    </article>
  )
}

function MiniText({ label: metricLabel, value }: { label: string; value: string }) {
  return (
    <p className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
      <span className="block font-black uppercase text-slate-500">{metricLabel}</span>
      <span className="mt-1 block break-words">{value}</span>
    </p>
  )
}

function ParlayBuilder({ legs }: { legs: PlanPick[] }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({})
  const defaultEnabled = useMemo(() => Object.fromEntries(legs.map((leg, index) => [leg.id, index < 3])), [legs])

  const selected = legs.filter((leg) => enabled[leg.id] ?? defaultEnabled[leg.id])
  const probability = selected.reduce((product, leg) => product * Math.max(0, Math.min(1, Number(leg.probability ?? 0) / 100)), selected.length ? 1 : 0) * 100
  const confidence = selected.length ? selected.reduce((sum, leg) => sum + Number(leg.confidence ?? 0), 0) / selected.length : null
  const ev = selected.length ? selected.reduce((sum, leg) => sum + Number(leg.ev ?? 0), 0) : null

  return (
    <article className="rounded-lg border border-slate-800 bg-slate-950/80 p-5 md:p-6" data-mc08a-smart-parlay="true">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Smart Parlay</p>
          <h2 className="mt-3 text-2xl font-black text-white md:text-3xl">Suggested Legs</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Toggle legs. The math updates instantly in the browser from existing prediction evidence.</p>
        </div>
        <StatusChip tone={selected.length >= 2 ? 'blue' : 'gray'}>{selected.length} Legs</StatusChip>
      </div>

      <div className="mt-5 grid gap-3">
        {legs.length ? legs.map((leg) => (
          <label key={leg.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
            <input
              type="checkbox"
              checked={Boolean(enabled[leg.id] ?? defaultEnabled[leg.id])}
              onChange={() => setEnabled((current) => ({ ...current, [leg.id]: !(current[leg.id] ?? defaultEnabled[leg.id]) }))}
              className="mt-1 h-5 w-5 accent-emerald-400"
            />
            <span className="min-w-0 flex-1">
              <span className="block break-words text-sm font-black text-white">{leg.selection}</span>
              <span className="mt-1 block text-xs font-semibold text-slate-400">{leg.market} / {pct(leg.probability)} / {odds(leg.odds)}</span>
            </span>
            <span className="text-xs font-black text-emerald-200">{pct(leg.confidence)}</span>
          </label>
        )) : (
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">No qualified parlay legs are available today.</div>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs font-black uppercase text-slate-500">Probability</p>
          <p className="mt-2 text-2xl font-black text-white">{pct(probability)}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs font-black uppercase text-slate-500">Confidence</p>
          <p className="mt-2 text-2xl font-black text-white">{pct(confidence)}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs font-black uppercase text-slate-500">EV</p>
          <p className="mt-2 text-2xl font-black text-white">{signedPct(ev)}</p>
        </div>
      </div>
      <details className="mt-5 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
        <summary className="cursor-pointer text-sm font-black text-white">Risk</summary>
        <p className="mt-3 text-sm leading-6 text-slate-300">Parlay Builder math is informational. Leg independence and correlation are not promoted into Official Pick policy here.</p>
      </details>
    </article>
  )
}

function Watchlist({ picks }: { picks: PlanPick[] }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-5 md:p-6" data-mc08a-watchlist="true">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Today&apos;s Watchlist</p>
      <h2 className="mt-3 text-2xl font-black text-white">Remaining strong opportunities</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {picks.length ? picks.map((pick) => (
          <div key={pick.id} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="break-words text-sm font-black text-white">{pick.selection}</p>
                <p className="mt-1 text-xs font-bold uppercase text-slate-500">{pick.market} / {pick.event}</p>
              </div>
              <StatusChip tone={actionTone[(pick.freshnessActionability ?? 'INFORMATIONAL_ONLY').toUpperCase()] ?? 'blue'}>{pick.freshness}</StatusChip>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-black text-slate-400">
              <span>{pct(pick.probability)}</span>
              <span>{pct(pick.confidence)}</span>
              <span>{signedPct(pick.ev)}</span>
            </div>
          </div>
        )) : (
          <p className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">No Qualified Opportunity Today. No additional strong opportunities are available.</p>
        )}
      </div>
    </section>
  )
}

function DecisionSummary({ data, plan }: { data: TodayResponse; plan: ReturnType<typeof pickPlan> }) {
  const recommendation = dailyRecommendation(plan, data)
  const freshness = label(data.viewModel?.selectors?.marketFreshnessSummary?.state ?? data.freshness, 'Unknown')
  const riskCount = plan.candidates.filter((item) => !item.qualified).length
  const confidenceValues = plan.candidates.map((item) => item.confidence).filter((item): item is number => item !== null)
  const confidence = confidenceValues.length ? confidenceValues.reduce((sum, item) => sum + item, 0) / confidenceValues.length : null
  const marketQuality = freshness.toUpperCase() === 'FRESH' ? 86 : freshness.toUpperCase() === 'AGING' ? 62 : 38

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-5 md:p-6" data-mc08a-decision-summary="true">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Decision Summary</p>
      <h2 className="mt-3 text-2xl font-black text-white">Why today is {recommendation.label.toLowerCase()}</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <MetricBar label="Market Quality" value={marketQuality} tone={marketQuality >= 80 ? 'green' : 'yellow'} />
        <MetricBar label="Risk" value={riskCount ? Math.min(90, 35 + riskCount * 8) : 20} tone={riskCount ? 'yellow' : 'green'} />
        <MetricBar label="Confidence" value={confidence} tone="blue" />
      </div>
      <p className="mt-5 text-sm leading-6 text-slate-300">{data.summary?.aiBriefing ?? recommendation.reason}</p>
    </section>
  )
}

function TechnicalEvidence({
  data,
  currentBoard,
  intelligence,
  performance,
}: {
  data: TodayResponse
  currentBoard: ApiEnvelope | null
  intelligence: ApiEnvelope | null
  performance: ApiEnvelope | null
}) {
  const boardCandidates = arrayValue(currentBoard?.candidates).length || countValue(currentBoard?.candidateCount)
  const sample = countValue(recordValue(intelligence?.currentProductionSample).sampleSize)
  const metrics = recordValue(recordValue(recordValue(performance?.aiBrain).reportCard).metrics)

  return (
    <details className="rounded-lg border border-slate-800 bg-slate-950/80 p-5 md:p-6" data-mc08a-technical-evidence="true">
      <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.18em] text-slate-400">Expandable Technical Evidence</summary>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniMetric label="Health" value={label(data.status, 'Today ready')} />
        <MiniMetric label="Planner" value={data.nextAction ?? 'Observational'} />
        <MiniMetric label="Lifecycle" value={`${countValue(data.totalScheduledToday)} games`} />
        <MiniMetric label="Providers" value={`${countValue(data.providerCallsMade)} calls`} />
        <MiniMetric label="Budget" value="Stored evidence" />
        <MiniMetric label="Operations" value={`${countValue(data.remoteMutationsMade)} mutations`} />
        <MiniMetric label="Model" value={sample || 'Read-only'} />
        <MiniMetric label="Diagnostics" value={`${boardCandidates} board rows`} />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <MiniText label="Latest market" value={compactDate(data.latestOddsTimestamp ?? data.viewModel?.selectors?.marketFreshnessSummary?.latestOddsTimestamp ?? null)} />
        <MiniText label="Performance" value={JSON.stringify(metrics).slice(0, 180) || 'Performance summary unavailable.'} />
      </div>
    </details>
  )
}

export default function HomeBettingPlan() {
  const [data, setData] = useState<TodayResponse | null>(null)
  const [currentBoard, setCurrentBoard] = useState<ApiEnvelope | null>(null)
  const [intelligence, setIntelligence] = useState<ApiEnvelope | null>(null)
  const [performance, setPerformance] = useState<ApiEnvelope | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.allSettled([
      fetch('/api/dashboard/today', { cache: 'no-store' }).then((response) => {
        if (!response.ok) throw new Error(`Today API returned HTTP ${response.status}`)
        return response.json() as Promise<TodayResponse>
      }),
      fetch('/api/current-board?mode=current&limit=100', { cache: 'no-store' }).then((response) => response.ok ? response.json() as Promise<ApiEnvelope> : null),
      fetch('/api/model/intelligence', { cache: 'no-store' }).then((response) => response.ok ? response.json() as Promise<ApiEnvelope> : null),
      fetch('/api/performance', { cache: 'no-store' }).then((response) => response.ok ? response.json() as Promise<ApiEnvelope> : null),
    ])
      .then(([todayResult, boardResult, intelligenceResult, performanceResult]) => {
        if (!active) return
        if (todayResult.status === 'rejected') throw todayResult.reason
        setData(todayResult.value)
        setCurrentBoard(boardResult.status === 'fulfilled' ? boardResult.value : null)
        setIntelligence(intelligenceResult.status === 'fulfilled' ? intelligenceResult.value : null)
        setPerformance(performanceResult.status === 'fulfilled' ? performanceResult.value : null)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Today API unavailable')
      })
    return () => {
      active = false
    }
  }, [])

  const plan = useMemo(() => pickPlan(data), [data])

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
        <section className="mx-auto max-w-5xl rounded-lg border border-amber-300/30 bg-amber-300/10 p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-100">Today&apos;s Betting Plan</p>
          <h1 className="mt-3 text-3xl font-black">Plan unavailable</h1>
          <p className="mt-2 text-sm text-amber-50">{error}</p>
        </section>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
        <section className="mx-auto max-w-5xl animate-pulse rounded-lg border border-slate-800 bg-slate-900 p-6">
          <div className="h-4 w-44 rounded bg-slate-800" />
          <div className="mt-4 h-10 w-72 rounded bg-slate-800" />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="h-64 rounded-lg bg-slate-800" />
            <div className="h-64 rounded-lg bg-slate-800" />
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_30rem),linear-gradient(180deg,#020617_0%,#0f172a_52%,#020617_100%)] px-4 py-5 text-white md:px-6 md:py-8" data-c1-home-betting-plan="true" data-mc08a-homepage="true">
      <section className="mx-auto grid max-w-6xl gap-5">
        <DailyBrief data={data} plan={plan} currentBoard={currentBoard} intelligence={intelligence} performance={performance} />

        <div className="grid gap-4">
          <PickCard
            title="Rent Play"
            icon="Primary"
            pick={plan.rentPlay}
            emptyTitle="No Rent Play Today"
            emptyDetail={data.summary?.recommendation ?? 'No available pick satisfies the existing Official Pick policy with the safest confidence/probability profile.'}
            closest={plan.closest}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <PickCard
            title="Moneyline Bet"
            icon="Moneyline"
            pick={plan.moneyline}
            emptyTitle="No Qualified Moneyline Today"
            emptyDetail="No stored moneyline candidate currently qualifies from existing Today evidence."
            closest={plan.closest}
          />
          <ParlayBuilder legs={plan.parlayLegs} />
        </div>

        <Watchlist picks={plan.watchlist} />
        <DecisionSummary data={data} plan={plan} />
        <TechnicalEvidence data={data} currentBoard={currentBoard} intelligence={intelligence} performance={performance} />

        <nav className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7" aria-label="Dedicated product tabs" data-mc08a-secondary-tabs="true">
          {[
            ['Most Likely', '/most-likely'],
            ['Best Value', '/best-value'],
            ['Performance', '/performance'],
            ['Sports', '/sports-center'],
            ['Operations', '/ai-operations'],
            ['Data Coverage', '/data-coverage'],
            ['Diagnostics', '/mission-control'],
          ].map(([name, href]) => (
            <a key={href} href={href} className="rounded-lg border border-slate-800 bg-slate-900/80 px-4 py-3 text-center text-sm font-black text-slate-100 hover:border-sky-300/40 hover:bg-sky-300/10">
              {name}
            </a>
          ))}
        </nav>
      </section>
    </main>
  )
}
