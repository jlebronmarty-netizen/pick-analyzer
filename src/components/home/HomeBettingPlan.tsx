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
      gameCoverageSummary?: {
        gamesToday?: number
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
  currentGames?: number
  lifecycleCounts?: {
    totalScheduledToday?: number
    upcoming?: number
    live?: number
    final?: number
  }
  schedulerCoverage?: {
    skippedToday?: number
    pendingToday?: number
    gamesPendingPregameExecution?: number
  }
  predictionCandidates?: number
  informationalCandidates?: number
}

type ApiEnvelope = Record<string, unknown>

type PlanPick = {
  id: string
  label: string
  source: string
  sourceRank: number
  eventId: string | null
  event: string
  selection: string
  market: string
  marketKey: string
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

type RentPlayStatus =
  | 'ACTIONABLE'
  | 'REVIEW_ONLY'
  | 'WAITING_FOR_FRESH_PRICE'
  | 'NO_ELIGIBLE_PLAY'
  | 'MARKET_UNAVAILABLE'
  | 'POLICY_BLOCKED'
  | 'NO_GAMES'
  | 'UNKNOWN'

type RentPlayGateStatus = 'PASS' | 'FAIL' | 'PENDING' | 'NOT_AVAILABLE'

type MoneylineBetStatus =
  | 'ACTIONABLE'
  | 'REVIEW_ONLY'
  | 'WAITING_FOR_FRESH_PRICE'
  | 'NO_ELIGIBLE_MONEYLINE'
  | 'MARKET_UNAVAILABLE'
  | 'POLICY_BLOCKED'
  | 'NO_GAMES'
  | 'UNKNOWN'

type SmartParlayStatus =
  | 'ACTIONABLE'
  | 'REVIEW_ONLY'
  | 'WAITING_FOR_FRESH_PRICES'
  | 'NO_ELIGIBLE_LEGS'
  | 'NO_SAFE_COMBINATION'
  | 'POLICY_BLOCKED'
  | 'NO_GAMES'
  | 'UNKNOWN'

type SmartParlayLegActionability =
  | 'ACTIONABLE'
  | 'REVIEW_ONLY'
  | 'WAITING_FOR_FRESH_PRICE'
  | 'POLICY_BLOCKED'
  | 'MARKET_UNAVAILABLE'
  | 'POST_START_BLOCKED'
  | 'UNSUPPORTED'
  | 'UNKNOWN'

type SmartParlayCorrelationStatus = 'CLEAR' | 'POTENTIAL' | 'BLOCKED' | 'UNKNOWN'

type RentPlayGate = {
  id: string
  label: string
  status: RentPlayGateStatus
  detail: string
}

type RentPlayContract = {
  contractVersion: 'rent_play_v1'
  status: RentPlayStatus
  eventId: string | null
  sportKey: string
  eventLabel: string | null
  startTime: string | null
  marketKey: string | null
  marketLabel: string | null
  selectionKey: string | null
  selectionLabel: string | null
  americanOdds: number | null
  decimalOdds: number | null
  bookmaker: string | null
  provider: string | null
  modelProbability: number | null
  impliedProbability: number | null
  probabilityAdvantage: number | null
  confidence: number | null
  edge: number | null
  expectedValue: number | null
  marketTimestamp: string | null
  marketAgeMinutes: number | null
  freshnessStatus: string
  freshnessTargetMinutes: number | null
  nextPlannedRefreshAt: string | null
  officialPick: boolean
  officialPickStatus: 'OFFICIAL_PICK' | 'NOT_OFFICIAL' | 'NO_CANDIDATE'
  actionability: string
  eligibilityGates: RentPlayGate[]
  passedGateCount: number
  failedGateCount: number
  pendingGateCount: number
  unavailableGateCount: number
  supportingReasons: string[]
  riskReasons: string[]
  blockers: string[]
  warnings: string[]
  whatWouldChangeTheDecision: string[]
  sourceSurface: string
  sourceRowId: string | null
  canonicalAcquisitionId: string | null
  evidence: string[]
  observedAt: string
  candidate: PlanPick | null
  closestCandidate: PlanPick | null
}

type SmartParlayLeg = {
  legId: string
  eventId: string | null
  sportKey: string
  eventLabel: string
  startTime: string | null
  marketKey: string
  marketLabel: string
  selectionKey: string
  selectionLabel: string
  americanOdds: number | null
  decimalOdds: number | null
  bookmaker: string | null
  provider: string | null
  modelProbability: number | null
  impliedProbability: number | null
  confidence: number | null
  edge: number | null
  expectedValue: number | null
  marketTimestamp: string | null
  marketAgeMinutes: number | null
  freshnessStatus: string
  freshnessTargetMinutes: number | null
  nextPlannedRefreshAt: string | null
  actionability: SmartParlayLegActionability
  officialPick: boolean
  rentPlay: boolean
  moneylineBet: boolean
  mostLikely: boolean
  bestValue: boolean
  eligibilityGates: RentPlayGate[]
  blockers: string[]
  warnings: string[]
  evidence: string[]
  reason: string
  sourceSurface: string
  sourceRowId: string | null
}

type SmartParlaySummary = {
  selectedLegCount: number
  minimumLegCount: number
  maximumLegCount: number
  combinedAmericanOdds: number | null
  combinedDecimalOdds: number | null
  combinedOddsAvailable: boolean
  jointProbability: number | null
  jointProbabilityMethod: 'NOT_CERTIFIED' | 'UNKNOWN'
  jointProbabilityEvidence: string[]
  allLegsFresh: boolean
  freshestLegId: string | null
  stalestLegId: string | null
  stalestLegAgeMinutes: number | null
  allLegsActionable: boolean
  blockingLegIds: string[]
  correlationStatus: SmartParlayCorrelationStatus
  correlationReasons: string[]
  parlayActionability: SmartParlayStatus
  recommendationSummary: string
  supportingReasons: string[]
  riskReasons: string[]
  whatWouldChangeTheDecision: string[]
}

type SmartParlayContract = SmartParlaySummary & {
  contractVersion: 'smart_parlay_v1'
  status: SmartParlayStatus
  mode: 'USER_SELECTED' | 'SUGGESTED' | 'EMPTY'
  availableLegs: SmartParlayLeg[]
  selectedLegs: SmartParlayLeg[]
  rejectedLegs: SmartParlayLeg[]
  providerCallsMade: 0
  remoteMutationsMade: 0
  observedAt: string
}

type MoneylineBetContract = {
  contractVersion: 'moneyline_bet_v1'
  status: MoneylineBetStatus
  eventId: string | null
  sportKey: string
  eventLabel: string | null
  startTime: string | null
  teamOrParticipantId: string | null
  teamOrParticipantLabel: string | null
  opponentLabel: string | null
  homeAway: string | null
  marketKey: string | null
  selectionKey: string | null
  selectionLabel: string | null
  americanOdds: number | null
  decimalOdds: number | null
  bookmaker: string | null
  provider: string | null
  modelProbability: number | null
  impliedProbability: number | null
  probabilityAdvantage: number | null
  confidence: number | null
  edge: number | null
  expectedValue: number | null
  marketTimestamp: string | null
  marketAgeMinutes: number | null
  freshnessStatus: string
  freshnessTargetMinutes: number | null
  nextPlannedRefreshAt: string | null
  officialPick: boolean
  rentPlay: boolean
  mostLikely: boolean
  bestValue: boolean
  actionability: string
  eligibilityGates: RentPlayGate[]
  passedGateCount: number
  failedGateCount: number
  pendingGateCount: number
  unavailableGateCount: number
  selectionReasons: string[]
  comparisonReasons: string[]
  riskReasons: string[]
  blockers: string[]
  warnings: string[]
  whatWouldChangeTheDecision: string[]
  candidateCount: number
  eligibleCandidateCount: number
  rankWithinMoneylineUniverse: number | null
  sourceSurface: string
  sourceRowId: string | null
  canonicalAcquisitionId: string | null
  evidence: string[]
  observedAt: string
  candidate: PlanPick | null
  closestCandidate: PlanPick | null
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

const rentPlayCopy = {
  en: {
    label: 'Rent Play',
    noEligible: 'No Rent Play Today',
    waiting: 'Waiting for fresh price',
    candidate: 'Best Available Candidate - Not Rent Play',
    empty: 'No available wager currently satisfies probability, value, freshness and policy requirements.',
  },
  es: {
    label: 'Jugada Rent',
    noEligible: 'No hay Rent Play hoy',
    waiting: 'Esperando precio actualizado',
    candidate: 'Mejor candidato disponible - no Rent Play',
    empty: 'No hay una jugada que cumpla los requisitos.',
  },
}

const moneylineCopy = {
  en: {
    label: 'Moneyline Bet',
    noEligible: 'No Eligible Moneyline Bet',
    waiting: 'Best Moneyline Candidate - Waiting for Fresh Price',
    unavailable: 'Moneyline Market Unavailable',
    reviewOnly: 'Review-Only Moneyline Candidate',
    empty: 'No current Moneyline satisfies the complete probability, price, freshness, value and policy requirements.',
  },
  es: {
    label: 'Apuesta Moneyline',
    noEligible: 'No hay moneyline elegible',
    waiting: 'Mejor candidato moneyline - esperando precio actualizado',
    unavailable: 'Mercado moneyline no disponible',
    reviewOnly: 'Candidato moneyline solo para revisar',
    empty: 'No hay una moneyline actual que cumpla todos los requisitos.',
  },
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && value.trim() === '') return null
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

function firstPositiveCount(...values: unknown[]) {
  for (const value of values) {
    const parsed = countValue(value)
    if (parsed > 0) return parsed
  }
  return 0
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
    sourceRank: ['Official Pick', 'Best Value', 'Priced Market', 'Most Likely', 'Highest Probability', 'Grounded Opportunity'].indexOf(source),
    eventId: selector.eventId ?? null,
    event: label(selector.matchup, 'Event pending'),
    selection: label(selector.selection, 'Selection pending'),
    market: label(selector.marketLabel ?? selector.market, 'Market pending'),
    marketKey: String(selector.market ?? selector.marketLabel ?? '').toLowerCase(),
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
    sourceRank: ['Official Pick', 'Best Value', 'Priced Market', 'Most Likely', 'Highest Probability', 'Grounded Opportunity'].indexOf(source),
    eventId: typeof row.eventId === 'string' ? row.eventId : typeof row.event_id === 'string' ? row.event_id : null,
    event: label(row.matchup ?? row.eventLabel, 'Event pending'),
    selection: label(row.selection ?? row.team, 'Selection pending'),
    market: label(row.marketLabel ?? row.market, 'Market pending'),
    marketKey: String(row.market ?? row.marketLabel ?? '').toLowerCase(),
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

function isMoneylineMarket(item: PlanPick) {
  const market = `${item.marketKey} ${item.market}`.toLowerCase()
  return /\bmoneyline\b|^h2h$|^ml$/.test(market) && !/run line|spread|total|prop|first five|first half|team total/.test(market)
}

function isSupportedParlayMarket(item: PlanPick) {
  const market = `${item.marketKey} ${item.market}`.toLowerCase()
  if (/prop|pitcher|batter|first five|first half|team total|alternate|nrfi|yrfi/.test(market)) return false
  return /\bmoneyline\b|^h2h$|^ml$|run line|spread|total/.test(market)
}

function compareMoneylineEvidence(left: PlanPick, right: PlanPick) {
  const sourceLeft = left.sourceRank < 0 ? 99 : left.sourceRank
  const sourceRight = right.sourceRank < 0 ? 99 : right.sourceRank
  const officialDelta = Number(right.official) - Number(left.official)
  if (officialDelta) return officialDelta
  const qualifiedDelta = Number(right.qualified) - Number(left.qualified)
  if (qualifiedDelta) return qualifiedDelta
  if (sourceLeft !== sourceRight) return sourceLeft - sourceRight
  const probabilityDelta = Number(right.probability ?? -1) - Number(left.probability ?? -1)
  if (probabilityDelta) return probabilityDelta
  const confidenceDelta = Number(right.confidence ?? -1) - Number(left.confidence ?? -1)
  if (confidenceDelta) return confidenceDelta
  const edgeDelta = Number(right.edge ?? -999) - Number(left.edge ?? -999)
  if (edgeDelta) return edgeDelta
  const evDelta = Number(right.ev ?? -999) - Number(left.ev ?? -999)
  if (evDelta) return evDelta
  return left.id.localeCompare(right.id)
}

function compareParlayEvidence(left: PlanPick, right: PlanPick) {
  const sourceLeft = left.sourceRank < 0 ? 99 : left.sourceRank
  const sourceRight = right.sourceRank < 0 ? 99 : right.sourceRank
  const actionableDelta = Number(isFreshnessActionable(right) && right.qualified) - Number(isFreshnessActionable(left) && left.qualified)
  if (actionableDelta) return actionableDelta
  if (sourceLeft !== sourceRight) return sourceLeft - sourceRight
  const probabilityDelta = Number(right.probability ?? -1) - Number(left.probability ?? -1)
  if (probabilityDelta) return probabilityDelta
  const confidenceDelta = Number(right.confidence ?? -1) - Number(left.confidence ?? -1)
  if (confidenceDelta) return confidenceDelta
  const edgeDelta = Number(right.edge ?? -999) - Number(left.edge ?? -999)
  if (edgeDelta) return edgeDelta
  const evDelta = Number(right.ev ?? -999) - Number(left.ev ?? -999)
  if (evDelta) return evDelta
  return left.id.localeCompare(right.id)
}

function isDirectOpposite(left: SmartParlayLeg, right: SmartParlayLeg) {
  if (!left.eventId || left.eventId !== right.eventId) return false
  if (left.marketKey !== right.marketKey) return false
  if (left.selectionKey === right.selectionKey) return false
  const market = `${left.marketKey} ${left.marketLabel}`.toLowerCase()
  return /moneyline|h2h|ml|spread|run line|total/.test(market)
}

function isSameLeg(left: SmartParlayLeg, right: SmartParlayLeg) {
  return left.eventId === right.eventId &&
    left.marketKey === right.marketKey &&
    left.selectionKey === right.selectionKey &&
    left.bookmaker === right.bookmaker
}

function isSmartParlayLegFresh(leg: SmartParlayLeg) {
  const freshness = leg.freshnessStatus.toUpperCase()
  return !['STALE', 'INVALID_FUTURE', 'POST_START', 'MARKET_CLOSED', 'UNKNOWN_TIMESTAMP'].includes(freshness) &&
    leg.actionability !== 'WAITING_FOR_FRESH_PRICE' &&
    !isFutureTimestamp(leg.marketTimestamp)
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

function buildMoneylineGates(pick: PlanPick | null): RentPlayGate[] {
  if (!pick) {
    return [
      gate('candidate', 'Moneyline candidate evidence', 'FAIL', 'No current supported Moneyline candidate satisfies the contract.'),
      gate('sport_certification', 'Sport certification', 'NOT_AVAILABLE', 'No candidate sport evidence is available.'),
      gate('moneyline_market_support', 'Moneyline market support', 'NOT_AVAILABLE', 'No candidate market evidence is available.'),
      gate('canonical_current_event', 'Canonical current event', 'NOT_AVAILABLE', 'No candidate event link is available.'),
      gate('pregame', 'Pregame eligibility', 'NOT_AVAILABLE', 'No candidate start-time evidence is available.'),
      gate('probability_available', 'Win probability available', 'NOT_AVAILABLE', 'No model probability is available.'),
      gate('odds_available', 'Current moneyline available', 'NOT_AVAILABLE', 'No current Moneyline price is available.'),
      gate('canonical_timestamp', 'Canonical market timestamp', 'NOT_AVAILABLE', 'No market timestamp is available.'),
      gate('market_freshness', 'Market freshness', 'NOT_AVAILABLE', 'No market timestamp is available.'),
      gate('confidence_available', 'Confidence available', 'NOT_AVAILABLE', 'No confidence evidence is available.'),
      gate('edge_available', 'Edge available', 'NOT_AVAILABLE', 'No edge evidence is available.'),
      gate('positive_edge', 'Positive edge policy', 'NOT_AVAILABLE', 'No edge evidence is available.'),
      gate('ev_available', 'EV available', 'NOT_AVAILABLE', 'No EV evidence is available.'),
      gate('ev_policy', 'EV policy', 'NOT_AVAILABLE', 'No EV evidence is available.'),
      gate('official_status', 'Official Pick status', 'NOT_AVAILABLE', 'No Official Pick candidate is available.'),
    ]
  }

  const freshness = pick.freshness.toUpperCase()
  const actionability = String(pick.freshnessActionability ?? '').toUpperCase()
  const timestampFuture = isFutureTimestamp(pick.marketTimestamp ?? null)
  const postStart = /post_start|post start|market_closed|started|live/i.test(`${freshness} ${actionability} ${pick.reason}`)
  const unsupported = !isMoneylineMarket(pick) || /unsupported/i.test(pick.reason)

  return [
    gate('candidate', 'Moneyline candidate evidence', 'PASS', `Candidate comes from ${pick.source}.`),
    gate('sport_certification', 'Sport certification', 'PASS', 'Moneyline Bet uses certified stored Today evidence only.'),
    gate('moneyline_market_support', 'Moneyline market support', unsupported ? 'FAIL' : 'PASS', unsupported ? 'Candidate is not a supported Moneyline market.' : 'Candidate is recognized as a supported Moneyline market.'),
    gate('canonical_current_event', 'Canonical current event', pick.eventId || pick.event !== 'Event pending' ? 'PASS' : 'PENDING', pick.eventId ? `Event ID ${pick.eventId}.` : 'Event label is available, event ID is not exposed to the homepage contract.'),
    gate('pregame', 'Pregame eligibility', postStart ? 'FAIL' : 'PASS', 'Pregame eligibility is derived from existing freshness/actionability evidence.'),
    gate('probability_available', 'Win probability available', pick.probability === null ? 'NOT_AVAILABLE' : 'PASS', pick.probability === null ? 'Model win probability is unavailable.' : `Model win probability is ${pct(pick.probability)}.`),
    gate('odds_available', 'Current moneyline available', pick.odds === null ? 'NOT_AVAILABLE' : 'PASS', pick.odds === null ? 'Current Moneyline price is unavailable.' : `Current Moneyline is ${odds(pick.odds)}.`),
    gate('canonical_timestamp', 'Canonical market timestamp', pick.marketTimestamp ? 'PASS' : 'NOT_AVAILABLE', pick.marketTimestamp ? `Market timestamp ${compactDate(pick.marketTimestamp)}.` : 'Market timestamp is unavailable.'),
    gate('market_freshness', 'Market freshness', timestampFuture ? 'FAIL' : isFreshnessActionable(pick) ? 'PASS' : freshness.includes('STALE') || actionability === 'WAIT_FOR_REFRESH' ? 'PENDING' : 'FAIL', timestampFuture ? 'Market timestamp is in the future and cannot be used.' : `Freshness is ${pick.freshness}.`),
    gate('confidence_available', 'Confidence available', pick.confidence === null ? 'NOT_AVAILABLE' : 'PASS', pick.confidence === null ? 'Confidence is unavailable.' : `Confidence is ${pct(pick.confidence)}.`),
    gate('confidence_policy', 'Confidence policy', pick.confidence === null ? 'NOT_AVAILABLE' : pick.confidence > 0 ? 'PASS' : 'FAIL', 'Existing confidence evidence must be present and positive.'),
    gate('edge_available', 'Edge available', pick.edge === null ? 'NOT_AVAILABLE' : 'PASS', pick.edge === null ? 'Edge is unavailable.' : `Edge is ${signedPct(pick.edge)}.`),
    gate('positive_edge', 'Positive edge policy', pick.edge === null ? 'NOT_AVAILABLE' : pick.edge > 0 ? 'PASS' : 'FAIL', 'Moneyline Bet cannot present negative edge as positive value.'),
    gate('ev_available', 'EV available', pick.ev === null ? 'NOT_AVAILABLE' : 'PASS', pick.ev === null ? 'EV is unavailable.' : `EV is ${signedPct(pick.ev)}.`),
    gate('ev_policy', 'EV policy', pick.ev === null ? 'NOT_AVAILABLE' : pick.ev >= 0 ? 'PASS' : 'FAIL', 'EV must be non-negative when EV evidence is available.'),
    gate('data_quality', 'Data quality', /quarantined|calibration insufficient|low confidence/i.test(pick.reason) ? 'FAIL' : 'PASS', pick.reason),
    gate('policy_blockers', 'Policy blockers', /blocked|do not act|avoid/i.test(pick.reason) ? 'FAIL' : 'PASS', pick.reason),
    gate('official_status', 'Official Pick status', pick.official ? 'PASS' : 'PENDING', pick.official ? 'Candidate is an existing Official Pick.' : 'Candidate is not promoted to Official Pick.'),
  ]
}

function buildMoneylineBetContract(plan: ReturnType<typeof pickPlan>, rentPlay: RentPlayContract): MoneylineBetContract {
  const observedAt = new Date().toISOString()
  const moneylineUniverse = plan.candidates.filter(isMoneylineMarket).sort(compareMoneylineEvidence)
  const eligibleUniverse = moneylineUniverse.filter((item) => item.qualified)
  const actionableOfficial = eligibleUniverse.find((item) => item.official && isFreshnessActionable(item) && Number(item.edge ?? 0) > 0 && item.ev !== null && Number(item.ev) >= 0) ?? null
  const actionableCandidate = eligibleUniverse.find((item) => isFreshnessActionable(item) && Number(item.edge ?? 0) > 0 && item.ev !== null && Number(item.ev) >= 0) ?? null
  const waitingCandidate = moneylineUniverse.find((item) =>
    Number(item.probability ?? 0) > 0 &&
    item.odds !== null &&
    (item.freshness.toUpperCase().includes('STALE') || String(item.freshnessActionability ?? '').toUpperCase() === 'WAIT_FOR_REFRESH')
  ) ?? null
  const reviewCandidate = moneylineUniverse[0] ?? null
  const candidate = actionableOfficial ?? actionableCandidate ?? waitingCandidate ?? reviewCandidate
  const gates = buildMoneylineGates(candidate)
  const counts = applicableGateCounts(gates)
  const failed = gates.filter((item) => item.status === 'FAIL')
  const pending = gates.filter((item) => item.status === 'PENDING')
  const actionable = Boolean(candidate) && counts.failedGateCount === 0 && counts.pendingGateCount === 0 && Number(candidate?.edge ?? 0) > 0 && candidate?.ev !== null && Number(candidate?.ev) >= 0 && isFreshnessActionable(candidate)
  const status: MoneylineBetStatus = !plan.candidates.length
    ? 'NO_GAMES'
    : !moneylineUniverse.length
      ? 'MARKET_UNAVAILABLE'
      : actionable
        ? 'ACTIONABLE'
        : candidate === waitingCandidate
          ? 'WAITING_FOR_FRESH_PRICE'
          : failed.some((item) => item.id === 'policy_blockers' || item.id === 'data_quality' || item.id === 'moneyline_market_support')
            ? 'POLICY_BLOCKED'
            : candidate
              ? 'REVIEW_ONLY'
              : 'NO_ELIGIBLE_MONEYLINE'

  const impliedProbability = candidate ? impliedFromAmerican(candidate.odds) : null
  const modelProbability = candidate?.probability ?? null
  const probabilityAdvantage = modelProbability !== null && impliedProbability !== null ? Number((modelProbability - impliedProbability).toFixed(2)) : null
  const rank = candidate ? moneylineUniverse.findIndex((item) => item.id === candidate.id) + 1 : null
  const rentPlayOverlap = Boolean(candidate && rentPlay.candidate && candidate.event === rentPlay.eventLabel && candidate.selection === rentPlay.selectionLabel && candidate.market === rentPlay.marketLabel)
  const mostLikelyOverlap = candidate?.source === 'Most Likely' || candidate?.id === 'most-likely'
  const bestValueOverlap = candidate?.source === 'Best Value' || candidate?.id === 'best-value'

  const selectionReasons = candidate
    ? [
      candidate.official ? 'Existing actionable Official Pick evidence has first preference inside Moneyline.' : 'Selected from the existing certified Moneyline universe without creating a new ranking formula.',
      rank ? `Rank ${rank} of ${moneylineUniverse.length} current Moneyline candidates by existing surface priority and exposed evidence.` : 'Rank unavailable.',
      modelProbability !== null ? `Estimated win probability is ${pct(modelProbability)}.` : 'Estimated win probability is unavailable.',
      probabilityAdvantage !== null ? `Probability advantage vs price is ${signedPct(probabilityAdvantage)}.` : 'Probability advantage is unavailable because probability or odds evidence is missing.',
    ]
    : ['No supported current Moneyline candidate satisfies the contract.']

  const comparisonReasons = candidate
    ? [
      `Universe: ${moneylineUniverse.length} supported Moneyline candidates, ${eligibleUniverse.length} qualified by existing Today evidence.`,
      'Largest favorite is not automatically selected; freshness, price, value, confidence and policy evidence must also be usable.',
      rentPlayOverlap ? 'This Moneyline also overlaps with Rent Play.' : 'Moneyline Bet is evaluated separately from Rent Play.',
      mostLikelyOverlap ? 'This Moneyline overlaps with Most Likely.' : 'Most Likely remains probability-first and may differ from Moneyline Bet.',
      bestValueOverlap ? 'This Moneyline overlaps with Best Value.' : 'Best Value can choose another market when value evidence is stronger elsewhere.',
    ]
    : ['No comparison is available because no supported current Moneyline candidate is available.']

  const riskReasons = [
    ...failed.slice(0, 4).map((item) => item.detail),
    ...pending.slice(0, 3).map((item) => item.detail),
    probabilityAdvantage !== null && probabilityAdvantage <= 1 ? 'Probability advantage is small.' : '',
    candidate?.ev === null ? 'EV is unavailable.' : '',
  ].filter(Boolean)

  return {
    contractVersion: 'moneyline_bet_v1',
    status,
    eventId: candidate?.eventId ?? null,
    sportKey: 'baseball_mlb',
    eventLabel: candidate?.event ?? null,
    startTime: null,
    teamOrParticipantId: candidate?.selection ?? null,
    teamOrParticipantLabel: candidate?.selection ?? null,
    opponentLabel: null,
    homeAway: null,
    marketKey: candidate?.marketKey ?? null,
    selectionKey: candidate?.selection ?? null,
    selectionLabel: candidate?.selection ?? null,
    americanOdds: candidate?.odds ?? null,
    decimalOdds: candidate ? decimalFromAmerican(candidate.odds) : null,
    bookmaker: candidate?.sportsbook ?? null,
    provider: candidate?.sportsbook ?? null,
    modelProbability,
    impliedProbability,
    probabilityAdvantage,
    confidence: candidate?.confidence ?? null,
    edge: candidate?.edge ?? null,
    expectedValue: candidate?.ev ?? null,
    marketTimestamp: candidate?.marketTimestamp ?? null,
    marketAgeMinutes: minutesSince(candidate?.marketTimestamp ?? null),
    freshnessStatus: candidate?.freshness ?? 'UNKNOWN',
    freshnessTargetMinutes: 10,
    nextPlannedRefreshAt: candidate?.nextRefreshAt ?? null,
    officialPick: Boolean(candidate?.official),
    rentPlay: rentPlayOverlap,
    mostLikely: mostLikelyOverlap,
    bestValue: bestValueOverlap,
    actionability: actionable ? 'ACTIONABLE_NOW' : status,
    eligibilityGates: gates,
    ...counts,
    selectionReasons,
    comparisonReasons,
    riskReasons: riskReasons.length ? riskReasons : ['No additional risks were exposed by current stored evidence.'],
    blockers: failed.map((item) => item.label),
    warnings: pending.map((item) => item.label),
    whatWouldChangeTheDecision: [
      'Current moneyline price changes enough to remove the existing advantage.',
      'Market price becomes stale, future-dated, unavailable or closed.',
      'Another Moneyline candidate becomes stronger under existing certified ranking evidence.',
      'New injury or lineup evidence changes eligibility before game start.',
      'Confidence, edge, EV or policy evidence no longer passes.',
      'The event begins.',
    ],
    candidateCount: moneylineUniverse.length,
    eligibleCandidateCount: eligibleUniverse.length,
    rankWithinMoneylineUniverse: rank,
    sourceSurface: candidate?.source ?? 'No eligible source',
    sourceRowId: candidate?.id ?? null,
    canonicalAcquisitionId: null,
    evidence: candidate?.evidence ?? [],
    observedAt,
    candidate,
    closestCandidate: moneylineUniverse[0] ?? plan.closest,
  }
}

function buildSmartParlayLegGates(pick: PlanPick | null): RentPlayGate[] {
  if (!pick) {
    return [
      gate('candidate', 'Leg evidence', 'FAIL', 'No current leg evidence is available.'),
      gate('supported_market', 'Supported market', 'NOT_AVAILABLE', 'No market evidence is available.'),
      gate('canonical_current_event', 'Canonical current event', 'NOT_AVAILABLE', 'No event identity is available.'),
      gate('pregame', 'Pregame eligibility', 'NOT_AVAILABLE', 'No lifecycle evidence is available.'),
      gate('probability_available', 'Probability available', 'NOT_AVAILABLE', 'No model probability is available.'),
      gate('odds_available', 'Odds available', 'NOT_AVAILABLE', 'No selected canonical price is available.'),
      gate('market_timestamp', 'Market timestamp', 'NOT_AVAILABLE', 'No market timestamp is available.'),
      gate('market_freshness', 'Market freshness', 'NOT_AVAILABLE', 'No market freshness evidence is available.'),
    ]
  }

  const freshness = pick.freshness.toUpperCase()
  const actionability = String(pick.freshnessActionability ?? '').toUpperCase()
  const unsupported = !isSupportedParlayMarket(pick)
  const postStart = /post_start|post start|started|live|market_closed/i.test(`${freshness} ${actionability} ${pick.reason}`)
  const timestampFuture = isFutureTimestamp(pick.marketTimestamp ?? null)

  return [
    gate('candidate', 'Leg evidence', 'PASS', `Leg comes from ${pick.source}.`),
    gate('supported_market', 'Supported market', unsupported ? 'FAIL' : 'PASS', unsupported ? 'Unsupported market evidence cannot enter Smart Parlay.' : 'Market is supported by the current stored product evidence.'),
    gate('canonical_current_event', 'Canonical current event', pick.eventId || pick.event !== 'Event pending' ? 'PASS' : 'PENDING', pick.eventId ? `Event ID ${pick.eventId}.` : 'Event label is available, event ID is not exposed.'),
    gate('pregame', 'Pregame eligibility', postStart ? 'FAIL' : 'PASS', postStart ? 'Leg appears post-start, live or closed.' : 'Leg is not marked post-start by current evidence.'),
    gate('probability_available', 'Probability available', pick.probability === null ? 'NOT_AVAILABLE' : 'PASS', pick.probability === null ? 'Model probability is unavailable.' : `Model probability is ${pct(pick.probability)}.`),
    gate('odds_available', 'Odds available', pick.odds === null ? 'NOT_AVAILABLE' : 'PASS', pick.odds === null ? 'Canonical selected price is unavailable.' : `Selected price is ${odds(pick.odds)}.`),
    gate('market_timestamp', 'Market timestamp', pick.marketTimestamp ? 'PASS' : 'NOT_AVAILABLE', pick.marketTimestamp ? `Market timestamp ${compactDate(pick.marketTimestamp)}.` : 'Market timestamp is unavailable.'),
    gate('market_freshness', 'Market freshness', timestampFuture ? 'FAIL' : isFreshnessActionable(pick) ? 'PASS' : freshness.includes('STALE') || actionability === 'WAIT_FOR_REFRESH' ? 'PENDING' : 'FAIL', timestampFuture ? 'Market timestamp is in the future.' : `Freshness is ${pick.freshness}.`),
    gate('policy_blockers', 'Policy blockers', /blocked|avoid|do not act|quarantined/i.test(pick.reason) ? 'FAIL' : 'PASS', pick.reason),
  ]
}

function legActionability(pick: PlanPick, gates: RentPlayGate[]): SmartParlayLegActionability {
  if (!isSupportedParlayMarket(pick)) return 'UNSUPPORTED'
  if (/post_start|post start|started|live|market_closed/i.test(`${pick.freshness} ${pick.freshnessActionability ?? ''} ${pick.reason}`)) return 'POST_START_BLOCKED'
  if (pick.odds === null) return 'MARKET_UNAVAILABLE'
  if (gates.some((item) => item.id === 'policy_blockers' && item.status === 'FAIL')) return 'POLICY_BLOCKED'
  if (pick.freshness.toUpperCase().includes('STALE') || String(pick.freshnessActionability ?? '').toUpperCase() === 'WAIT_FOR_REFRESH') return 'WAITING_FOR_FRESH_PRICE'
  if (pick.qualified && isFreshnessActionable(pick) && pick.probability !== null) return 'ACTIONABLE'
  return 'REVIEW_ONLY'
}

function planPickToParlayLeg(
  pick: PlanPick,
  rentPlay: RentPlayContract,
  moneyline: MoneylineBetContract,
): SmartParlayLeg {
  const gates = buildSmartParlayLegGates(pick)
  const rentPlayOverlap = Boolean(rentPlay.candidate && pick.event === rentPlay.eventLabel && pick.selection === rentPlay.selectionLabel && pick.market === rentPlay.marketLabel)
  const moneylineOverlap = Boolean(moneyline.candidate && pick.event === moneyline.eventLabel && pick.selection === moneyline.selectionLabel && pick.marketKey === moneyline.marketKey)
  return {
    legId: pick.id,
    eventId: pick.eventId,
    sportKey: 'baseball_mlb',
    eventLabel: pick.event,
    startTime: null,
    marketKey: pick.marketKey,
    marketLabel: pick.market,
    selectionKey: pick.selection,
    selectionLabel: pick.selection,
    americanOdds: pick.odds,
    decimalOdds: decimalFromAmerican(pick.odds),
    bookmaker: pick.sportsbook,
    provider: pick.sportsbook,
    modelProbability: pick.probability,
    impliedProbability: impliedFromAmerican(pick.odds),
    confidence: pick.confidence,
    edge: pick.edge,
    expectedValue: pick.ev,
    marketTimestamp: pick.marketTimestamp ?? null,
    marketAgeMinutes: minutesSince(pick.marketTimestamp ?? null),
    freshnessStatus: pick.freshness,
    freshnessTargetMinutes: 10,
    nextPlannedRefreshAt: pick.nextRefreshAt ?? null,
    actionability: legActionability(pick, gates),
    officialPick: pick.official,
    rentPlay: rentPlayOverlap,
    moneylineBet: moneylineOverlap,
    mostLikely: pick.source === 'Most Likely' || pick.id === 'most-likely',
    bestValue: pick.source === 'Best Value' || pick.id === 'best-value',
    eligibilityGates: gates,
    blockers: gates.filter((item) => item.status === 'FAIL').map((item) => item.label),
    warnings: gates.filter((item) => item.status === 'PENDING').map((item) => item.label),
    evidence: pick.evidence,
    reason: pick.reason,
    sourceSurface: pick.source,
    sourceRowId: pick.id,
  }
}

function evaluateSmartParlaySelection(
  availableLegs: SmartParlayLeg[],
  selectedLegIds: string[],
  minimumLegCount: number,
  maximumLegCount: number,
): SmartParlaySummary {
  const selectedLegs = selectedLegIds
    .map((id) => availableLegs.find((leg) => leg.legId === id))
    .filter((leg): leg is SmartParlayLeg => Boolean(leg))
    .slice(0, maximumLegCount)
  const blockingLegs = selectedLegs.filter((leg) => leg.actionability !== 'ACTIONABLE')
  const waitingLegs = selectedLegs.filter((leg) => leg.actionability === 'WAITING_FOR_FRESH_PRICE')
  const hardBlockedLegs = selectedLegs.filter((leg) => ['POLICY_BLOCKED', 'MARKET_UNAVAILABLE', 'POST_START_BLOCKED', 'UNSUPPORTED', 'UNKNOWN'].includes(leg.actionability))
  const selectedDecimals = selectedLegs.map((leg) => leg.decimalOdds)
  const combinedOddsAvailable = selectedLegs.length >= minimumLegCount && selectedDecimals.every((value): value is number => value !== null && value > 1)
  const combinedDecimalOdds = combinedOddsAvailable ? Number(selectedDecimals.reduce((product, value) => product * value, 1).toFixed(3)) : null
  const combinedAmericanOdds = americanFromDecimal(combinedDecimalOdds)
  const ages = selectedLegs
    .filter((leg) => leg.marketAgeMinutes !== null)
    .sort((left, right) => Number(left.marketAgeMinutes ?? 0) - Number(right.marketAgeMinutes ?? 0))
  const freshestLegId = ages[0]?.legId ?? null
  const stalest = ages[ages.length - 1] ?? null
  const freshnessBlocking = selectedLegs.filter((leg) => leg.actionability === 'WAITING_FOR_FRESH_PRICE' || !isSmartParlayLegFresh(leg))
  const duplicateBlocked = selectedLegs.some((leg, index) => selectedLegs.some((other, otherIndex) => otherIndex > index && isSameLeg(leg, other)))
  const oppositeBlocked = selectedLegs.some((leg, index) => selectedLegs.some((other, otherIndex) => otherIndex > index && isDirectOpposite(leg, other)))
  const sameEventPairs = selectedLegs.flatMap((leg, index) => selectedLegs.slice(index + 1).filter((other) => leg.eventId && leg.eventId === other.eventId).map((other) => `${leg.selectionLabel} with ${other.selectionLabel}`))
  const correlationStatus: SmartParlayCorrelationStatus = duplicateBlocked || oppositeBlocked
    ? 'BLOCKED'
    : sameEventPairs.length
      ? 'POTENTIAL'
      : selectedLegs.length >= minimumLegCount
        ? 'CLEAR'
        : 'UNKNOWN'
  const correlationReasons = duplicateBlocked
    ? ['Duplicate selected leg is blocked.']
    : oppositeBlocked
      ? ['Direct opposite sides of the same market are blocked.']
      : sameEventPairs.length
        ? ['Same-event legs have potential correlation and are not treated as independent.', ...sameEventPairs.slice(0, 3)]
        : selectedLegs.length >= minimumLegCount
          ? ['No direct duplicate, opposite-side or same-event conflict detected in selected legs.']
          : ['Select at least two legs before correlation can be evaluated.']

  const allLegsFresh = selectedLegs.length >= minimumLegCount && freshnessBlocking.length === 0
  const allLegsActionable = selectedLegs.length >= minimumLegCount && blockingLegs.length === 0
  const blockingLegIds = [...new Set([...blockingLegs, ...freshnessBlocking].map((leg) => leg.legId))]
  const parlayActionability: SmartParlayStatus = !availableLegs.length
    ? 'NO_ELIGIBLE_LEGS'
    : selectedLegs.length < minimumLegCount
      ? 'NO_SAFE_COMBINATION'
      : hardBlockedLegs.length || correlationStatus === 'BLOCKED'
        ? 'POLICY_BLOCKED'
        : waitingLegs.length || freshnessBlocking.length
          ? 'WAITING_FOR_FRESH_PRICES'
          : allLegsActionable && correlationStatus === 'CLEAR' && combinedOddsAvailable
            ? 'ACTIONABLE'
            : 'REVIEW_ONLY'

  const recommendationSummary = parlayActionability === 'ACTIONABLE'
    ? 'Actionable selected parlay. All selected legs pass current leg, freshness and direct-correlation checks.'
    : parlayActionability === 'WAITING_FOR_FRESH_PRICES'
      ? 'Parlay not actionable - one or more selected legs need fresh prices.'
      : parlayActionability === 'POLICY_BLOCKED'
        ? 'Blocked combination. One or more selected legs conflict, are unsupported, post-start, unavailable or policy-blocked.'
        : parlayActionability === 'NO_ELIGIBLE_LEGS'
          ? 'No eligible legs. No current opportunities can enter the builder.'
          : parlayActionability === 'NO_SAFE_COMBINATION'
            ? 'No safe combination. Select at least two supportable legs before evaluating a parlay.'
            : 'Review selected parlay. The combination is useful for analysis but not fully actionable.'

  return {
    selectedLegCount: selectedLegs.length,
    minimumLegCount,
    maximumLegCount,
    combinedAmericanOdds,
    combinedDecimalOdds,
    combinedOddsAvailable,
    jointProbability: null,
    jointProbabilityMethod: 'NOT_CERTIFIED',
    jointProbabilityEvidence: ['No certified homepage joint-probability method is available. Leg probabilities are not multiplied because dependence and correlation are not certified.'],
    allLegsFresh,
    freshestLegId,
    stalestLegId: stalest?.legId ?? null,
    stalestLegAgeMinutes: stalest?.marketAgeMinutes ?? null,
    allLegsActionable,
    blockingLegIds,
    correlationStatus,
    correlationReasons,
    parlayActionability,
    recommendationSummary,
    supportingReasons: selectedLegs.length
      ? selectedLegs.map((leg) => leg.officialPick ? `${leg.selectionLabel} is an existing Official Pick.` : leg.rentPlay ? `${leg.selectionLabel} overlaps with Rent Play.` : leg.moneylineBet ? `${leg.selectionLabel} overlaps with Moneyline Bet.` : `${leg.selectionLabel} comes from ${leg.sourceSurface}.`).slice(0, 5)
      : ['No legs are selected.'],
    riskReasons: [
      'Every selected leg must win.',
      'Risk compounds with each added leg.',
      combinedOddsAvailable ? 'Combined odds are mechanical price math, not model confidence.' : 'Combined odds are unavailable until every selected leg has a valid selected price.',
      'Joint probability is unavailable because no certified dependence model is exposed for this homepage builder.',
      correlationStatus === 'POTENTIAL' ? 'Same-event or related legs may be correlated.' : '',
    ].filter(Boolean),
    whatWouldChangeTheDecision: [
      'A selected leg becomes stale, unavailable, post-start or unsupported.',
      'A selected price changes or disappears.',
      'The user removes the limiting leg.',
      'A fresher or stronger eligible leg replaces a weaker selected leg.',
      'Correlation becomes blocked by duplicate or direct-opposite evidence.',
      'A certified joint-probability method becomes available.',
    ],
  }
}

function buildSmartParlayContract(
  plan: ReturnType<typeof pickPlan>,
  rentPlay: RentPlayContract,
  moneyline: MoneylineBetContract,
): SmartParlayContract {
  const observedAt = new Date().toISOString()
  const seen = new Set<string>()
  const rejectedLegs: SmartParlayLeg[] = []
  const availableLegs: SmartParlayLeg[] = []
  const rawLegs = plan.candidates.sort(compareParlayEvidence).slice(0, 16)
  for (const pick of rawLegs) {
    const leg = planPickToParlayLeg(pick, rentPlay, moneyline)
    const key = `${leg.eventId ?? leg.eventLabel}|${leg.marketKey}|${leg.selectionKey}|${leg.bookmaker ?? ''}`
    if (seen.has(key) || !isSupportedParlayMarket(pick) || leg.actionability === 'UNSUPPORTED' || leg.actionability === 'POST_START_BLOCKED') {
      rejectedLegs.push({
        ...leg,
        actionability: seen.has(key) ? 'POLICY_BLOCKED' : leg.actionability,
        blockers: [...leg.blockers, seen.has(key) ? 'Duplicate leg identity' : 'Not eligible for Smart Parlay'],
      })
      continue
    }
    seen.add(key)
    availableLegs.push(leg)
    if (availableLegs.length >= 8) break
  }
  const suggested: SmartParlayLeg[] = []
  for (const leg of availableLegs) {
    if (leg.actionability !== 'ACTIONABLE') continue
    if (suggested.some((item) => item.eventId && item.eventId === leg.eventId)) continue
    suggested.push(leg)
    if (suggested.length >= 3) break
  }
  const defaultSelected = suggested.length >= 2 ? suggested : []
  const summary = evaluateSmartParlaySelection(availableLegs, defaultSelected.map((leg) => leg.legId), 2, 5)
  const status: SmartParlayStatus = !plan.candidates.length ? 'NO_GAMES' : summary.parlayActionability
  return {
    contractVersion: 'smart_parlay_v1',
    status,
    mode: defaultSelected.length ? 'SUGGESTED' : 'EMPTY',
    availableLegs,
    selectedLegs: defaultSelected,
    rejectedLegs,
    ...summary,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    observedAt,
  }
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

function decimalFromAmerican(value: number | null) {
  if (value === null) return null
  return value > 0 ? Number((1 + value / 100).toFixed(3)) : Number((1 + 100 / Math.abs(value)).toFixed(3))
}

function impliedFromAmerican(value: number | null) {
  if (value === null) return null
  const implied = value > 0 ? 100 / (value + 100) : Math.abs(value) / (Math.abs(value) + 100)
  return Number((implied * 100).toFixed(2))
}

function americanFromDecimal(value: number | null) {
  if (value === null || value <= 1) return null
  return value >= 2 ? Math.round((value - 1) * 100) : Math.round(-100 / (value - 1))
}

function minutesSince(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000))
}

function isFutureTimestamp(value: string | null) {
  if (!value) return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now() + 60_000
}

function gate(id: string, labelText: string, status: RentPlayGateStatus, detail: string): RentPlayGate {
  return { id, label: labelText, status, detail }
}

function applicableGateCounts(gates: RentPlayGate[]) {
  const applicable = gates.filter((item) => item.status !== 'NOT_AVAILABLE')
  return {
    passedGateCount: applicable.filter((item) => item.status === 'PASS').length,
    failedGateCount: applicable.filter((item) => item.status === 'FAIL').length,
    pendingGateCount: applicable.filter((item) => item.status === 'PENDING').length,
    unavailableGateCount: gates.filter((item) => item.status === 'NOT_AVAILABLE').length,
  }
}

function isFreshnessActionable(pick: PlanPick | null) {
  if (!pick) return false
  const freshness = pick.freshness.toUpperCase()
  const actionability = String(pick.freshnessActionability ?? '').toUpperCase()
  return !['STALE', 'INVALID_FUTURE', 'POST_START', 'MARKET_CLOSED', 'UNKNOWN_TIMESTAMP'].includes(freshness) &&
    !['BLOCKED', 'WAIT_FOR_REFRESH', 'UNAVAILABLE'].includes(actionability) &&
    !isFutureTimestamp(pick.marketTimestamp ?? null)
}

function buildRentPlayGates(pick: PlanPick | null): RentPlayGate[] {
  if (!pick) {
    return [
      gate('candidate', 'Candidate evidence', 'FAIL', 'No current candidate satisfies Rent Play requirements.'),
      gate('sport_certification', 'Sport certification', 'NOT_AVAILABLE', 'No candidate sport evidence is available.'),
      gate('market_certification', 'Market certification', 'NOT_AVAILABLE', 'No candidate market evidence is available.'),
      gate('pregame', 'Pregame eligibility', 'NOT_AVAILABLE', 'No candidate start-time evidence is available.'),
      gate('probability_available', 'Probability available', 'NOT_AVAILABLE', 'No model probability is available.'),
      gate('probability_floor', 'Probability above 50%', 'NOT_AVAILABLE', 'No model probability is available.'),
      gate('odds_available', 'Odds available', 'NOT_AVAILABLE', 'No market price is available.'),
      gate('market_freshness', 'Market freshness', 'NOT_AVAILABLE', 'No market timestamp is available.'),
      gate('confidence_available', 'Confidence available', 'NOT_AVAILABLE', 'No confidence evidence is available.'),
      gate('edge_available', 'Edge available', 'NOT_AVAILABLE', 'No edge evidence is available.'),
      gate('positive_edge', 'Positive edge', 'NOT_AVAILABLE', 'No edge evidence is available.'),
      gate('ev_available', 'EV available', 'NOT_AVAILABLE', 'No EV evidence is available.'),
      gate('ev_policy', 'EV policy', 'NOT_AVAILABLE', 'No EV evidence is available.'),
      gate('official_status', 'Official Pick status', 'NOT_AVAILABLE', 'No Official Pick candidate is available.'),
    ]
  }

  const probability = pick.probability
  const edge = pick.edge
  const ev = pick.ev
  const freshness = pick.freshness.toUpperCase()
  const actionability = String(pick.freshnessActionability ?? '').toUpperCase()
  const timestampFuture = isFutureTimestamp(pick.marketTimestamp ?? null)

  return [
    gate('candidate', 'Candidate evidence', 'PASS', `Candidate comes from ${pick.source}.`),
    gate('sport_certification', 'Sport certification', 'PASS', 'Current Rent Play scope is restricted to certified stored Today evidence.'),
    gate('market_certification', 'Market certification', /unsupported/i.test(pick.reason) ? 'FAIL' : 'PASS', /unsupported/i.test(pick.reason) ? 'Candidate includes unsupported-market evidence.' : 'Market is not marked unsupported by current evidence.'),
    gate('pregame', 'Pregame eligibility', /post_start|POST START|started/i.test(`${freshness} ${pick.reason}`) ? 'FAIL' : 'PASS', 'Pregame status is derived from existing Today freshness/actionability evidence.'),
    gate('probability_available', 'Probability available', probability === null ? 'NOT_AVAILABLE' : 'PASS', probability === null ? 'Model probability is unavailable.' : `Model probability is ${pct(probability)}.`),
    gate('probability_floor', 'Probability above 50%', probability === null ? 'NOT_AVAILABLE' : probability > 50 ? 'PASS' : 'FAIL', probability === null ? 'Model probability is unavailable.' : 'Standard binary Rent Play requires probability above 50%.'),
    gate('odds_available', 'Odds available', pick.odds === null ? 'NOT_AVAILABLE' : 'PASS', pick.odds === null ? 'Current odds are unavailable.' : `Current odds are ${odds(pick.odds)}.`),
    gate('market_freshness', 'Market freshness', timestampFuture ? 'FAIL' : isFreshnessActionable(pick) ? 'PASS' : freshness.includes('STALE') || actionability === 'WAIT_FOR_REFRESH' ? 'PENDING' : 'FAIL', timestampFuture ? 'Market timestamp is in the future and cannot be used.' : `Freshness is ${pick.freshness}.`),
    gate('confidence_available', 'Confidence available', pick.confidence === null ? 'NOT_AVAILABLE' : 'PASS', pick.confidence === null ? 'Confidence is unavailable.' : `Confidence is ${pct(pick.confidence)}.`),
    gate('confidence_policy', 'Confidence policy', pick.confidence === null ? 'NOT_AVAILABLE' : pick.confidence > 0 ? 'PASS' : 'FAIL', 'Existing confidence evidence must be present and positive.'),
    gate('edge_available', 'Edge available', edge === null ? 'NOT_AVAILABLE' : 'PASS', edge === null ? 'Edge is unavailable.' : `Edge is ${signedPct(edge)}.`),
    gate('positive_edge', 'Positive edge requirement', edge === null ? 'NOT_AVAILABLE' : edge > 0 ? 'PASS' : 'FAIL', 'Rent Play cannot call a negative-edge candidate safest actionable.'),
    gate('ev_available', 'EV available', ev === null ? 'NOT_AVAILABLE' : 'PASS', ev === null ? 'EV is unavailable.' : `EV is ${signedPct(ev)}.`),
    gate('ev_policy', 'EV policy', ev === null ? 'NOT_AVAILABLE' : ev >= 0 ? 'PASS' : 'FAIL', 'EV must be non-negative or policy-compliant.'),
    gate('data_quality', 'Data quality', /quarantined|calibration insufficient|low confidence/i.test(pick.reason) ? 'FAIL' : 'PASS', pick.reason),
    gate('policy_blockers', 'Policy blockers', /blocked|do not act|avoid/i.test(pick.reason) ? 'FAIL' : 'PASS', pick.reason),
    gate('official_status', 'Official Pick status', pick.official ? 'PASS' : 'PENDING', pick.official ? 'Candidate is an existing Official Pick.' : 'Candidate is not promoted to Official Pick.'),
  ]
}

function buildRentPlayContract(plan: ReturnType<typeof pickPlan>): RentPlayContract {
  const observedAt = new Date().toISOString()
  const officialCandidate = plan.candidates.find((item) => item.official && item.qualified) ?? null
  const highProbabilityCandidate = plan.candidates.find((item) => item.qualified && Number(item.probability ?? 0) > 50) ?? null
  const waitingCandidate = plan.candidates.find((item) =>
    Number(item.probability ?? 0) > 50 &&
    Number(item.edge ?? 0) > 0 &&
    item.ev !== null &&
    (item.freshness.toUpperCase().includes('STALE') || String(item.freshnessActionability ?? '').toUpperCase() === 'WAIT_FOR_REFRESH')
  ) ?? null
  const candidate = officialCandidate ?? highProbabilityCandidate ?? waitingCandidate
  const gates = buildRentPlayGates(candidate)
  const counts = applicableGateCounts(gates)
  const failed = gates.filter((item) => item.status === 'FAIL')
  const pending = gates.filter((item) => item.status === 'PENDING')
  const actionable = Boolean(candidate) && counts.failedGateCount === 0 && counts.pendingGateCount === 0 && Number(candidate?.probability ?? 0) > 50 && isFreshnessActionable(candidate)
  const status: RentPlayStatus = !plan.candidates.length
    ? 'NO_GAMES'
    : actionable
      ? 'ACTIONABLE'
      : waitingCandidate
        ? 'WAITING_FOR_FRESH_PRICE'
        : failed.some((item) => item.id === 'policy_blockers' || item.id === 'official_status')
          ? 'POLICY_BLOCKED'
          : candidate
            ? 'REVIEW_ONLY'
            : 'NO_ELIGIBLE_PLAY'

  const impliedProbability = candidate ? impliedFromAmerican(candidate.odds) : null
  const modelProbability = candidate?.probability ?? null
  const probabilityAdvantage = modelProbability !== null && impliedProbability !== null ? Number((modelProbability - impliedProbability).toFixed(2)) : null
  const marketAgeMinutes = minutesSince(candidate?.marketTimestamp ?? null)
  const marketAgeMinutesFromCanonicalTimestamp = marketAgeMinutes

  const supportingReasons = candidate
    ? [
      candidate.official ? 'Existing Official Pick evidence is present.' : 'Candidate is not official and remains review-only unless all gates pass.',
      modelProbability !== null ? `Model probability is ${pct(modelProbability)}.` : 'Model probability is unavailable.',
      probabilityAdvantage !== null ? `Probability advantage is ${signedPct(probabilityAdvantage)}.` : 'Probability advantage is unavailable.',
      `Source surface: ${candidate.source}.`,
    ]
    : ['No current candidate satisfies the Rent Play contract.']

  const riskReasons = [
    ...failed.slice(0, 4).map((item) => item.detail),
    ...pending.slice(0, 3).map((item) => item.detail),
  ].filter(Boolean)

  return {
    contractVersion: 'rent_play_v1',
    status,
    eventId: null,
    sportKey: 'baseball_mlb',
    eventLabel: candidate?.event ?? null,
    startTime: null,
    marketKey: candidate?.market ?? null,
    marketLabel: candidate?.market ?? null,
    selectionKey: candidate?.selection ?? null,
    selectionLabel: candidate?.selection ?? null,
    americanOdds: candidate?.odds ?? null,
    decimalOdds: candidate ? decimalFromAmerican(candidate.odds) : null,
    bookmaker: candidate?.sportsbook ?? null,
    provider: candidate?.sportsbook ?? null,
    modelProbability,
    impliedProbability,
    probabilityAdvantage,
    confidence: candidate?.confidence ?? null,
    edge: candidate?.edge ?? null,
    expectedValue: candidate?.ev ?? null,
    marketTimestamp: candidate?.marketTimestamp ?? null,
    marketAgeMinutes: marketAgeMinutesFromCanonicalTimestamp,
    freshnessStatus: candidate?.freshness ?? 'UNKNOWN',
    freshnessTargetMinutes: 10,
    nextPlannedRefreshAt: candidate?.nextRefreshAt ?? null,
    officialPick: Boolean(candidate?.official),
    officialPickStatus: candidate ? candidate.official ? 'OFFICIAL_PICK' : 'NOT_OFFICIAL' : 'NO_CANDIDATE',
    actionability: actionable ? 'ACTIONABLE_NOW' : status,
    eligibilityGates: gates,
    ...counts,
    supportingReasons,
    riskReasons: riskReasons.length ? riskReasons : ['No additional risks were exposed by current stored evidence.'],
    blockers: failed.map((item) => item.label),
    warnings: pending.map((item) => item.label),
    whatWouldChangeTheDecision: [
      'Market price becomes stale or future-dated.',
      'Model probability falls to 50% or below for a standard binary market.',
      'Edge or EV becomes unavailable or non-positive.',
      'Current policy blockers appear before game start.',
      'New lineup, injury or data-quality evidence changes the stored recommendation evidence.',
    ],
    sourceSurface: candidate?.source ?? 'No eligible source',
    sourceRowId: candidate?.id ?? null,
    canonicalAcquisitionId: null,
    evidence: candidate?.evidence ?? [],
    observedAt,
    candidate,
    closestCandidate: plan.closest,
  }
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
  const gamesToday = firstPositiveCount(
    data.totalScheduledToday,
    data.currentGames,
    data.lifecycleCounts?.totalScheduledToday,
    data.viewModel?.selectors?.gameCoverageSummary?.gamesToday,
    data.viewModel?.selectors?.currentBoardSummary?.candidates,
    boardCandidates,
  )
  const predictions = countValue(data.predictionCandidates ?? boardCandidates ?? plan.candidates.length)
  const official = countValue(data.officialPicks) || plan.candidates.filter((item) => item.official).length
  const value = plan.candidates.filter((item) => item.qualified && Number(item.ev ?? 0) > 0).length
  const skipped = firstPositiveCount(
    data.schedulerCoverage?.skippedToday,
    data.schedulerCoverage?.pendingToday,
    data.schedulerCoverage?.gamesPendingPregameExecution,
    Math.max(0, gamesToday - predictions),
    plan.candidates.length - plan.candidates.filter((item) => item.qualified).length,
  )

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

function moneylineStatusTone(status: MoneylineBetStatus): Tone {
  if (status === 'ACTIONABLE') return 'green'
  if (status === 'WAITING_FOR_FRESH_PRICE' || status === 'REVIEW_ONLY') return 'yellow'
  if (status === 'NO_ELIGIBLE_MONEYLINE' || status === 'NO_GAMES' || status === 'MARKET_UNAVAILABLE') return 'gray'
  return 'red'
}

function MoneylineBetCard({ moneyline }: { moneyline: MoneylineBetContract }) {
  const pick = moneyline.candidate
  const closest = moneyline.closestCandidate
  const readinessDenominator = moneyline.passedGateCount + moneyline.failedGateCount + moneyline.pendingGateCount
  const readiness = readinessDenominator ? (moneyline.passedGateCount / readinessDenominator) * 100 : null
  const priceFreshness = moneyline.marketAgeMinutes === null ? moneyline.freshnessStatus : `${moneyline.marketAgeMinutes} min`
  const title = pick
    ? moneyline.selectionLabel
    : moneyline.status === 'WAITING_FOR_FRESH_PRICE'
      ? moneylineCopy.en.waiting
      : moneyline.status === 'MARKET_UNAVAILABLE'
        ? moneylineCopy.en.unavailable
        : moneylineCopy.en.noEligible

  return (
    <article className="rounded-lg border border-sky-300/20 bg-slate-950/85 p-5 shadow-2xl shadow-slate-950/20 md:p-6" data-mc08c-moneyline-card="true" data-moneyline-status={moneyline.status}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-200">{moneylineCopy.en.label}</p>
          <h2 className="mt-3 break-words text-2xl font-black text-white md:text-4xl">{title}</h2>
          <p className="mt-3 text-sm font-bold text-slate-300">
            {pick ? `${moneyline.eventLabel} / Strongest eligible Moneyline` : moneylineCopy.en.empty}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <StatusChip tone={moneylineStatusTone(moneyline.status)}>{moneyline.status.replaceAll('_', ' ')}</StatusChip>
          <StatusChip tone={moneyline.officialPick ? 'green' : 'blue'}>{moneyline.officialPick ? 'Official Pick' : 'Not Official'}</StatusChip>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniMetric label="Current Moneyline" value={odds(moneyline.americanOdds)} />
        <MiniMetric label="Win Probability" value={pct(moneyline.modelProbability)} />
        <MiniMetric label="Implied Probability" value={pct(moneyline.impliedProbability)} />
        <MiniMetric label="Freshness" value={priceFreshness} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <MetricBar label="Win Probability" value={moneyline.modelProbability} tone={moneyline.modelProbability !== null && moneyline.modelProbability > 50 ? 'green' : 'yellow'} />
        <MetricBar label="Price Implied" value={moneyline.impliedProbability} tone="blue" />
        <MetricBar label="Advantage" value={moneyline.probabilityAdvantage} tone={moneyline.probabilityAdvantage !== null && moneyline.probabilityAdvantage > 0 ? 'green' : 'yellow'} />
        <MetricBar label="Readiness Gates" value={readiness} tone={moneyline.failedGateCount ? 'yellow' : 'green'} />
      </div>

      <p className="mt-5 text-sm leading-6 text-slate-300">{moneyline.selectionReasons[0] ?? moneylineCopy.en.empty}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MiniText label="Candidate Rank" value={moneyline.rankWithinMoneylineUniverse ? `${moneyline.rankWithinMoneylineUniverse} of ${moneyline.candidateCount}` : 'Unavailable'} />
        <MiniText label="Actionability" value={moneyline.actionability.replaceAll('_', ' ')} />
        <MiniText label="Value" value={`Edge ${signedPct(moneyline.edge)} / EV ${signedPct(moneyline.expectedValue)}`} />
      </div>

      {pick ? null : closest ? (
        <div className="mt-5 rounded-lg border border-amber-300/20 bg-amber-300/10 p-4" data-mc08c-review-only-candidate="true">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">{moneylineCopy.en.reviewOnly}</p>
          <p className="mt-2 text-lg font-black text-white">{closest.selection}</p>
          <p className="mt-1 text-sm text-amber-50">{closest.event} / {closest.market} / {pct(closest.probability)}</p>
          <p className="mt-2 text-sm text-slate-300">{closest.reason}</p>
        </div>
      ) : null}

      <details className="mt-5 rounded-lg border border-slate-800 bg-slate-900/70 p-4" data-mc08c-moneyline-expanded="true">
        <summary className="cursor-pointer text-sm font-black text-white">Why this Moneyline</summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.95fr]">
          <div className="grid gap-3">
            <MiniText label="Moneyline vs Rent Play" value={moneyline.rentPlay ? 'This Moneyline also overlaps with Rent Play. The product concepts remain separate.' : 'Moneyline Bet is restricted to the Moneyline universe and is not forced to match Rent Play.'} />
            <MiniText label="Moneyline vs Most Likely" value={moneyline.mostLikely ? 'This selection overlaps with Most Likely, but Moneyline Bet still requires price, freshness and value evidence.' : 'Most Likely remains probability-first; Moneyline Bet is actionability, value and freshness-aware inside Moneyline.'} />
            <MiniText label="Official Pick Status" value={moneyline.officialPick ? 'This selection is already an Official Pick.' : 'This selection is not promoted into Official Picks by MC-08C.'} />
            <MiniText label="Provider / Bookmaker" value={`${moneyline.provider ?? 'Unavailable'} / ${moneyline.bookmaker ?? 'Unavailable'}`} />
            <MiniText label="Market Timestamp" value={compactDate(moneyline.marketTimestamp)} />
            <MiniText label="Next Scheduled Refresh" value={compactDate(moneyline.nextPlannedRefreshAt)} />
            <MiniText label="Observed At" value={`${compactDate(moneyline.observedAt)}. This is not used as market freshness.`} />
          </div>
          <div className="grid gap-3">
            <MiniText label="Comparison With Other Moneylines" value={moneyline.comparisonReasons.join(' / ')} />
            <MiniText label="Main Risks" value={moneyline.riskReasons.join(' / ')} />
            <MiniText label="What Would Change The Decision" value={moneyline.whatWouldChangeTheDecision.join(' / ')} />
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <p className="text-xs font-black uppercase text-slate-500">Eligibility Gates</p>
              <div className="mt-3 grid gap-2">
                {moneyline.eligibilityGates.map((item) => (
                  <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900 p-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-white">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
                    </div>
                    <StatusChip tone={gateTone(item.status)}>{item.status}</StatusChip>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </details>
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

function gateTone(status: RentPlayGateStatus): Tone {
  if (status === 'PASS') return 'green'
  if (status === 'FAIL') return 'red'
  if (status === 'PENDING') return 'yellow'
  return 'gray'
}

function RentPlayCard({ rentPlay }: { rentPlay: RentPlayContract }) {
  const pick = rentPlay.candidate
  const closest = rentPlay.closestCandidate
  const readinessDenominator = rentPlay.passedGateCount + rentPlay.failedGateCount + rentPlay.pendingGateCount
  const readiness = readinessDenominator ? (rentPlay.passedGateCount / readinessDenominator) * 100 : null
  const statusTone: Tone = rentPlay.status === 'ACTIONABLE'
    ? 'green'
    : rentPlay.status === 'WAITING_FOR_FRESH_PRICE'
      ? 'yellow'
      : rentPlay.status === 'NO_ELIGIBLE_PLAY' || rentPlay.status === 'NO_GAMES'
        ? 'gray'
        : 'red'

  return (
    <article className="rounded-lg border border-emerald-400/20 bg-slate-950/90 p-5 shadow-2xl shadow-slate-950/20 md:p-7" data-mc08b-rent-play-card="true" data-rent-play-status={rentPlay.status}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">{rentPlayCopy.en.label}</p>
          <h2 className="mt-3 break-words text-3xl font-black text-white md:text-5xl">
            {pick ? rentPlay.selectionLabel : rentPlay.status === 'WAITING_FOR_FRESH_PRICE' ? rentPlayCopy.en.waiting : rentPlayCopy.en.noEligible}
          </h2>
          <p className="mt-3 text-sm font-bold text-slate-300">
            {pick ? `${rentPlay.eventLabel} / ${rentPlay.marketLabel}` : rentPlayCopy.en.empty}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <StatusChip tone={statusTone}>{rentPlay.status.replaceAll('_', ' ')}</StatusChip>
          <StatusChip tone={rentPlay.officialPick ? 'green' : 'blue'}>{rentPlay.officialPickStatus.replaceAll('_', ' ')}</StatusChip>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniMetric label="Current Odds" value={odds(rentPlay.americanOdds)} />
        <MiniMetric label="Win Probability" value={pct(rentPlay.modelProbability)} />
        <MiniMetric label="Freshness" value={rentPlay.marketAgeMinutes === null ? rentPlay.freshnessStatus : `${rentPlay.marketAgeMinutes} min`} />
        <MiniMetric label="Actionability" value={rentPlay.actionability.replaceAll('_', ' ')} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <MetricBar label="Model Probability" value={rentPlay.modelProbability} tone={rentPlay.modelProbability !== null && rentPlay.modelProbability > 50 ? 'green' : 'yellow'} />
        <MetricBar label="Implied Probability" value={rentPlay.impliedProbability} tone="blue" />
        <MetricBar label="Readiness Gates" value={readiness} tone={rentPlay.failedGateCount ? 'yellow' : 'green'} />
      </div>

      <p className="mt-5 text-sm leading-6 text-slate-300">{rentPlay.supportingReasons[0] ?? rentPlayCopy.en.empty}</p>

      {pick ? null : closest ? (
        <div className="mt-5 rounded-lg border border-amber-300/20 bg-amber-300/10 p-4" data-mc08b-best-available-not-rent-play="true">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">{rentPlayCopy.en.candidate}</p>
          <p className="mt-2 text-lg font-black text-white">{closest.selection}</p>
          <p className="mt-1 text-sm text-amber-50">{closest.event} / {closest.market} / {pct(closest.probability)}</p>
          <p className="mt-2 text-sm text-slate-300">{closest.reason}</p>
        </div>
      ) : null}

      <details className="mt-5 rounded-lg border border-slate-800 bg-slate-900/70 p-4" data-mc08b-rent-play-expanded="true">
        <summary className="cursor-pointer text-sm font-black text-white">Why this is or is not Rent Play</summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="grid gap-3">
            <MiniText label="Most Likely Distinction" value="Most Likely is the highest modeled probability in its universe. Rent Play is the safest currently actionable wager only after probability, value, freshness and policy gates pass." />
            <MiniText label="Official Pick Distinction" value={rentPlay.officialPick ? 'This Rent Play overlaps with an existing Official Pick.' : 'This candidate is not promoted into Official Picks by MC-08B.'} />
            <MiniText label="Provider / Source" value={`${rentPlay.provider ?? 'Unavailable'} / ${rentPlay.sourceSurface}`} />
            <MiniText label="Last Market Update" value={compactDate(rentPlay.marketTimestamp)} />
            <MiniText label="Next Planned Refresh" value={compactDate(rentPlay.nextPlannedRefreshAt)} />
            <MiniText label="Edge and EV" value={`Edge ${signedPct(rentPlay.edge)} / EV ${signedPct(rentPlay.expectedValue)}`} />
            <MiniText label="Observed At" value={`${compactDate(rentPlay.observedAt)}. This is not used as market freshness.`} />
          </div>
          <div className="grid gap-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <p className="text-xs font-black uppercase text-slate-500">Readiness Gates</p>
              <div className="mt-3 grid gap-2">
                {rentPlay.eligibilityGates.map((item) => (
                  <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900 p-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-white">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
                    </div>
                    <StatusChip tone={gateTone(item.status)}>{item.status}</StatusChip>
                  </div>
                ))}
              </div>
            </div>
            <MiniText label="Main Risks" value={rentPlay.riskReasons.join(' / ')} />
            <MiniText label="What Would Change The Decision" value={rentPlay.whatWouldChangeTheDecision.join(' / ')} />
          </div>
        </div>
      </details>
    </article>
  )
}

function smartParlayTone(status: SmartParlayStatus): Tone {
  if (status === 'ACTIONABLE') return 'green'
  if (status === 'WAITING_FOR_FRESH_PRICES' || status === 'REVIEW_ONLY') return 'yellow'
  if (status === 'NO_ELIGIBLE_LEGS' || status === 'NO_SAFE_COMBINATION' || status === 'NO_GAMES') return 'gray'
  return 'red'
}

function legActionTone(status: SmartParlayLegActionability): Tone {
  if (status === 'ACTIONABLE') return 'green'
  if (status === 'REVIEW_ONLY' || status === 'WAITING_FOR_FRESH_PRICE') return 'yellow'
  if (status === 'UNKNOWN' || status === 'MARKET_UNAVAILABLE') return 'gray'
  return 'red'
}

function SmartParlayBuilder({ parlay }: { parlay: SmartParlayContract }) {
  const defaultSelectedIds = useMemo(() => parlay.selectedLegs.map((leg) => leg.legId), [parlay.selectedLegs])
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultSelectedIds)

  const selectedSummary = useMemo(
    () => evaluateSmartParlaySelection(parlay.availableLegs, selectedIds, parlay.minimumLegCount, parlay.maximumLegCount),
    [parlay.availableLegs, parlay.maximumLegCount, parlay.minimumLegCount, selectedIds],
  )
  const selectedLegs = selectedSummary.selectedLegCount
    ? selectedIds.map((id) => parlay.availableLegs.find((leg) => leg.legId === id)).filter((leg): leg is SmartParlayLeg => Boolean(leg))
    : []
  const displayedStatus = parlay.status === 'NO_GAMES' ? 'NO_GAMES' : selectedSummary.parlayActionability
  const canAdd = selectedIds.length < parlay.maximumLegCount

  function toggleLeg(leg: SmartParlayLeg) {
    setSelectedIds((current) => {
      if (current.includes(leg.legId)) return current.filter((id) => id !== leg.legId)
      if (current.length >= parlay.maximumLegCount) return current
      return [...current, leg.legId]
    })
  }

  return (
    <article className="rounded-lg border border-violet-300/20 bg-slate-950/85 p-5 shadow-2xl shadow-slate-950/20 md:p-6" data-mc08a-smart-parlay="true" data-mc08d-smart-parlay-card="true" data-smart-parlay-status={displayedStatus}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-200">Smart Parlay</p>
          <h2 className="mt-3 break-words text-2xl font-black text-white md:text-3xl">
            {displayedStatus === 'NO_ELIGIBLE_LEGS' || displayedStatus === 'NO_SAFE_COMBINATION' || displayedStatus === 'NO_GAMES' ? 'No Safe Parlay Available' : 'Build A Selected Parlay'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Select legs to evaluate the combination. Combined odds are price math only; joint probability is unavailable until a certified method exists.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <StatusChip tone={smartParlayTone(displayedStatus)}>{displayedStatus.replaceAll('_', ' ')}</StatusChip>
          <StatusChip tone="blue">{selectedSummary.selectedLegCount} of {parlay.maximumLegCount} selected</StatusChip>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniMetric label="Available Legs" value={parlay.availableLegs.length} />
        <MiniMetric label="Combined Odds" value={selectedSummary.combinedOddsAvailable ? odds(selectedSummary.combinedAmericanOdds) : 'Unavailable' } />
        <MiniMetric label="Joint Probability" value="Unavailable" />
        <MiniMetric label="Stalest Leg" value={selectedSummary.stalestLegAgeMinutes === null ? 'Unavailable' : `${selectedSummary.stalestLegAgeMinutes} min`} />
      </div>

      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-slate-500">Selected Legs</p>
            <p className="mt-1 text-sm font-bold text-slate-200">
              {selectedLegs.length ? selectedLegs.map((leg) => leg.selectionLabel).join(' / ') : 'No legs selected.'}
            </p>
          </div>
          <button type="button" onClick={() => setSelectedIds([])} className="min-h-11 rounded-lg border border-slate-700 px-4 py-2 text-sm font-black text-slate-100 outline-none hover:border-violet-200/50 hover:bg-violet-200/10 focus-visible:ring-2 focus-visible:ring-violet-200">
            Reset
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-300">{selectedSummary.recommendationSummary}</p>
      </div>

      <details className="mt-5 rounded-lg border border-slate-800 bg-slate-900/70 p-4" data-mc08d-smart-parlay-builder="true">
        <summary className="cursor-pointer text-sm font-black text-white">Open builder</summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Available Legs</p>
            {parlay.availableLegs.length ? parlay.availableLegs.map((leg) => {
              const selected = selectedIds.includes(leg.legId)
              const disabled = !selected && !canAdd
              return (
                <label key={leg.legId} className={`flex min-w-0 cursor-pointer flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start ${selected ? 'border-violet-300/50 bg-violet-300/10' : 'border-slate-800 bg-slate-950/70'} ${disabled ? 'opacity-60' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={disabled}
                    onChange={() => toggleLeg(leg)}
                    className="mt-1 h-5 w-5 accent-violet-300"
                    aria-label={`${selected ? 'Remove' : 'Add'} ${leg.selectionLabel}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-black text-white">{leg.selectionLabel}</span>
                    <span className="mt-1 block text-xs font-semibold text-slate-400">{leg.eventLabel} / {leg.marketLabel}</span>
                    <span className="mt-2 flex flex-wrap gap-2">
                      <StatusChip tone={legActionTone(leg.actionability)}>{leg.actionability.replaceAll('_', ' ')}</StatusChip>
                      {leg.rentPlay ? <StatusChip tone="green">Rent Play</StatusChip> : null}
                      {leg.moneylineBet ? <StatusChip tone="blue">Moneyline</StatusChip> : null}
                    </span>
                  </span>
                  <span className="grid gap-1 text-left text-xs font-black text-slate-300 sm:text-right">
                    <span>{pct(leg.modelProbability)}</span>
                    <span>{odds(leg.americanOdds)}</span>
                    <span>{leg.marketAgeMinutes === null ? leg.freshnessStatus : `${leg.marketAgeMinutes} min`}</span>
                  </span>
                </label>
              )
            }) : (
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">No safe suggested combination is available. The user may still review eligible legs when they appear.</div>
            )}
          </div>

          <div className="grid gap-3">
            <MiniText label="Actionability" value={selectedSummary.parlayActionability.replaceAll('_', ' ')} />
            <MiniText label="Combined Odds" value={selectedSummary.combinedOddsAvailable ? `${odds(selectedSummary.combinedAmericanOdds)} / decimal ${selectedSummary.combinedDecimalOdds}` : 'Unavailable until every selected leg has canonical odds.'} />
            <MiniText label="Joint Probability" value={`${selectedSummary.jointProbabilityMethod}. ${selectedSummary.jointProbabilityEvidence.join(' ')}`} />
            <MiniText label="Freshness" value={selectedSummary.allLegsFresh ? 'All selected legs are fresh.' : `Limited by ${selectedSummary.stalestLegId ?? 'an unavailable or stale leg'}.`} />
            <MiniText label="Correlation" value={`${selectedSummary.correlationStatus}. ${selectedSummary.correlationReasons.join(' / ')}`} />
            <MiniText label="Blocking Legs" value={selectedSummary.blockingLegIds.length ? selectedSummary.blockingLegIds.join(' / ') : 'None'} />
            <MiniText label="Why These Legs" value={selectedSummary.supportingReasons.join(' / ')} />
            <MiniText label="Main Risks" value={selectedSummary.riskReasons.join(' / ')} />
            <MiniText label="What Would Change The Decision" value={selectedSummary.whatWouldChangeTheDecision.join(' / ')} />
          </div>
        </div>
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
        <MiniMetric label="Lifecycle" value={`${firstPositiveCount(data.totalScheduledToday, data.currentGames, data.lifecycleCounts?.totalScheduledToday)} games`} />
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
  const rentPlayContract = useMemo(() => buildRentPlayContract(plan), [plan])
  const moneylineBetContract = useMemo(() => buildMoneylineBetContract(plan, rentPlayContract), [plan, rentPlayContract])
  const smartParlayContract = useMemo(() => buildSmartParlayContract(plan, rentPlayContract, moneylineBetContract), [plan, rentPlayContract, moneylineBetContract])

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
          <RentPlayCard rentPlay={rentPlayContract} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <MoneylineBetCard moneyline={moneylineBetContract} />
          <SmartParlayBuilder parlay={smartParlayContract} />
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
