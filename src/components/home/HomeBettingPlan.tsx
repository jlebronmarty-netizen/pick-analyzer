'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CANONICAL_OPERATING_TIMEZONE, formatDateTimeValue, formatOddsValue, usePersonalization } from '@/context/PersonalizationContext'
import { getTimeOfDayGreeting } from '@/lib/time-of-day-greeting'

type Tone = 'green' | 'yellow' | 'blue' | 'red' | 'gray'

type Selector = {
  status?: 'AVAILABLE' | 'EMPTY' | 'BLOCKED'
  predictionId?: string | null
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
  priceBindingMode?: 'DIRECT' | 'COMPLEMENT' | 'UNAVAILABLE'
  priceSourceMarket?: string | null
  priceSourceSelection?: string | null
  priceSourceLine?: number | null
  priceSourceSnapshotId?: string | null
  providerSourceTimestamp?: string | null
  snapshotCapturedAt?: string | null
  marketEvidenceFreshness?: string | null
  snapshotRecencyTimestamp?: string | null
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
      bestValueSemantics?: {
        candidatesWithPositiveEv?: number
        candidatesPassingPolicy?: number
        primaryRejectionReason?: string | null
      }
      gameCoverageSummary?: {
        gamesToday?: number
        gamesWithValidPregamePredictions?: number
        gamesWithDisplayableCurrentBoardMarket?: number
        marketsPredicted?: number
        currentBoardCandidates?: number
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
  predictionId: string | null
  label: string
  source: string
  sourceRank: number
  eventId: string | null
  event: string
  selection: string
  market: string
  marketKey: string
  odds: number | null
  priceBindingMode?: 'DIRECT' | 'COMPLEMENT' | 'UNAVAILABLE'
  priceSourceMarket?: string | null
  priceSourceSelection?: string | null
  priceSourceLine?: number | null
  priceSourceSnapshotId?: string | null
  sportsbook: string
  probability: number | null
  confidence: number | null
  edge: number | null
  ev: number | null
  freshness: string
  modelVersion: string
  freshnessActionability?: string
  marketTimestamp?: string | null
  providerSourceTimestamp?: string | null
  snapshotCapturedAt?: string | null
  nextRefreshAt?: string | null
  evidence: string[]
  official: boolean
  qualified: boolean
  reason: string
}

type BestAvailableReviewOption = {
  contractVersion: 'best_available_review_option_v1'
  label: 'BEST AVAILABLE REVIEW OPTION'
  notRecommendation: true
  candidate: PlanPick | null
  evidenceCompleteness: number
  sufficientEvidence: boolean
  rankingSource: string
  blockers: string[]
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

type RentPlayGateStatus = 'PASS' | 'FAIL' | 'PENDING' | 'NOT_AVAILABLE' | 'OPTIONAL'

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
  priceBindingMode?: 'DIRECT' | 'COMPLEMENT' | 'UNAVAILABLE'
  priceSourceMarket?: string | null
  priceSourceSelection?: string | null
  priceSourceLine?: number | null
  priceSourceSnapshotId?: string | null
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
  providerSourceTimestamp?: string | null
  snapshotCapturedAt?: string | null
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
  bestAvailableReviewOption: BestAvailableReviewOption
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
  priceBindingMode?: 'DIRECT' | 'COMPLEMENT' | 'UNAVAILABLE'
  decimalOdds: number | null
  bookmaker: string | null
  provider: string | null
  modelProbability: number | null
  impliedProbability: number | null
  confidence: number | null
  edge: number | null
  expectedValue: number | null
  marketTimestamp: string | null
  providerSourceTimestamp?: string | null
  snapshotCapturedAt?: string | null
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

type WatchlistStatus =
  | 'AVAILABLE'
  | 'LIMITED'
  | 'EMPTY'
  | 'NO_GAMES'
  | 'MARKET_UNAVAILABLE'
  | 'STALE'
  | 'UNKNOWN'

type WatchlistPriority = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'

type WatchlistActionability =
  | 'ACTIONABLE'
  | 'BEST_AVAILABLE_RESEARCH'
  | 'WATCH'
  | 'BLOCKED'
  | 'UNAVAILABLE'
  | 'NO_CURRENT_EVIDENCE'

type WatchlistReason =
  | 'NEAR_RENT_PLAY'
  | 'NEAR_MONEYLINE'
  | 'NEAR_OFFICIAL_PICK'
  | 'MOST_LIKELY_MONITOR'
  | 'BEST_VALUE_MONITOR'
  | 'PRICE_MONITORING'
  | 'FRESHNESS_PENDING'
  | 'VALUE_PENDING'
  | 'CONFIDENCE_PENDING'
  | 'EVIDENCE_PENDING'
  | 'POLICY_BLOCKED'
  | 'INFORMATIONAL'

type WatchlistItem = {
  itemId: string
  eventId: string | null
  eventLabel: string
  marketKey: string
  marketLabel: string
  selectionLabel: string
  americanOdds: number | null
  priceBindingMode?: 'DIRECT' | 'COMPLEMENT' | 'UNAVAILABLE'
  modelProbability: number | null
  confidence: number | null
  edge: number | null
  expectedValue: number | null
  freshnessStatus: string
  freshnessActionability: string
  marketTimestamp: string | null
  providerSourceTimestamp?: string | null
  snapshotCapturedAt?: string | null
  marketAgeMinutes: number | null
  nextPlannedRefreshAt: string | null
  reason: WatchlistReason
  priority: WatchlistPriority
  actionability: WatchlistActionability
  evidenceFirstStatus: WatchlistActionability
  researchOnly: boolean
  watchReason: string
  currentEpoch: 'CURRENT_V2_PRODUCTION'
  sourceSurface: string
  sourceRowId: string | null
  officialPick: boolean
  rentPlay: boolean
  moneylineBet: boolean
  smartParlayEligible: boolean
  mostLikely: boolean
  bestValue: boolean
  supportingEvidence: string[]
  limitingEvidence: string[]
  promotionConditions: string[]
  removalConditions: string[]
  eligibilityGates: RentPlayGate[]
  candidate: PlanPick
}

type WatchlistContract = {
  contractVersion: 'watchlist_v1'
  status: WatchlistStatus
  evidenceFirstStatus: WatchlistActionability
  researchOnly: boolean
  currentEpoch: 'CURRENT_V2_PRODUCTION'
  maximumItemCount: 5
  itemCount: number
  totalCandidateCount: number
  eligibleCandidateCount: number
  excludedCandidateCount: number
  staleCandidateCount: number
  blockedCandidateCount: number
  unavailableMarketCount: number
  items: WatchlistItem[]
  emptyReason: string | null
  summary: string
  observedAt: string
  providerCallsMade: 0
  remoteMutationsMade: 0
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
  priceBindingMode?: 'DIRECT' | 'COMPLEMENT' | 'UNAVAILABLE'
  priceSourceMarket?: string | null
  priceSourceSelection?: string | null
  priceSourceLine?: number | null
  priceSourceSnapshotId?: string | null
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
  providerSourceTimestamp?: string | null
  snapshotCapturedAt?: string | null
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
  bestAvailableReviewOption: BestAvailableReviewOption
}

const toneClasses: Record<Tone, string> = {
  green: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-50',
  yellow: 'border-amber-300/30 bg-amber-300/10 text-amber-50',
  blue: 'border-sky-300/30 bg-sky-300/10 text-sky-50',
  red: 'border-rose-300/30 bg-rose-300/10 text-rose-50',
  gray: 'border-slate-700 bg-slate-900/85 text-slate-100',
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
    noEligible: 'No Current Rent Play Evidence',
    waiting: 'Waiting for fresh price',
    candidate: 'Best Rent Play Candidate',
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
    reviewOnly: 'Best Moneyline Candidate',
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

function textOrNull(value: unknown) {
  const text = String(value ?? '').trim()
  return text && text !== 'null' && text !== 'undefined' ? text : null
}

function sourceRank(source: string) {
  return ['Official Pick', 'Best Value', 'Priced Market', 'Current Board', 'Most Likely', 'Highest Probability', 'Grounded Opportunity'].indexOf(source)
}

function odds(value: unknown) {
  if (value === null || value === undefined) return 'Odds N/A'
  return formatOddsValue(numberOrNull(value))
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
    id: selector.predictionId ?? id,
    predictionId: selector.predictionId ?? null,
    label: source,
    source,
    sourceRank: sourceRank(source),
    eventId: selector.eventId ?? null,
    event: label(selector.matchup, 'Event pending'),
    selection: label(selector.selection, 'Selection pending'),
    market: label(selector.marketLabel ?? selector.market, 'Market pending'),
    marketKey: String(selector.market ?? selector.marketLabel ?? '').toLowerCase(),
    odds: numberOrNull(selector.americanOdds),
    priceBindingMode: selector.priceBindingMode,
    priceSourceMarket: selector.priceSourceMarket ?? null,
    priceSourceSelection: selector.priceSourceSelection ?? null,
    priceSourceLine: numberOrNull(selector.priceSourceLine),
    priceSourceSnapshotId: selector.priceSourceSnapshotId ?? null,
    sportsbook: label(selector.sportsbook, 'Sportsbook pending'),
    probability,
    confidence,
    edge,
    ev,
    freshness,
    modelVersion: 'Model version unavailable',
    freshnessActionability,
    marketTimestamp: selector.productFreshness?.marketTimestamp ?? null,
    providerSourceTimestamp: selector.providerSourceTimestamp ?? null,
    snapshotCapturedAt: selector.snapshotCapturedAt ?? selector.snapshotRecencyTimestamp ?? null,
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
  const canonicalEv = recordValue(row.canonicalEv)
  const canonicalPrice = recordValue(row.canonicalPrice)
  const probability = numberOrNull(row.modelProbability ?? row.model_probability ?? row.probability)
  const confidence = numberOrNull(row.confidence)
  const edge = numberOrNull(row.edgePercentagePoints ?? row.edge ?? canonicalEv.edge)
  const ev = numberOrNull(row.expectedValuePercent ?? row.expectedValue ?? row.ev ?? canonicalEv.expectedValue)
  const productFreshness = row.productFreshness && typeof row.productFreshness === 'object' ? row.productFreshness as Record<string, unknown> : null
  const freshness = label(productFreshness?.status ?? row.freshnessStatus ?? row.freshness, 'Freshness unavailable')
  const freshnessActionability = label(productFreshness?.actionability, 'INFORMATIONAL_ONLY')
  const officialEligibility = textOrNull(row.officialEligibility ?? row.official_pick_status ?? row.recommendationPolicyStatus)
  const blockerText = [
    ...arrayValue(row.blockers).map((item) => label(item, '')),
    label(row.reasonNotOfficial ?? row.blocker ?? row.why ?? officialEligibility, ''),
  ].filter(Boolean)
  const policyEligible = official || ['ELIGIBLE', 'OFFICIAL_ELIGIBLE', 'OFFICIAL_ELIGIBLE_CANDIDATE', 'OFFICIAL_PICK'].includes(String(officialEligibility ?? '').toUpperCase())
  const policyBlockedReason = !policyEligible && source === 'Current Board'
    ? `Policy blocked: ${label(row.reasonNotOfficial ?? row.blocker ?? officialEligibility, 'Not officially eligible under existing policy.')}`
    : null
  const freshEnough = !/stale|avoid|do not act|post start|post_start|market closed/i.test(`${freshness} ${blockerText.join(' ')}`) &&
    !['BLOCKED', 'WAIT_FOR_REFRESH', 'UNAVAILABLE'].includes(freshnessActionability)
  const hasCurrentEvidence = probability !== null || confidence !== null || edge !== null || ev !== null || numberOrNull(row.americanOdds ?? row.odds) !== null
  const qualified = official || (freshEnough && hasCurrentEvidence)
  const modelVersion = label(row.modelVersion ?? row.model_version, 'Model version unavailable')
  const evidence = arrayValue(row.supportingEvidence ?? row.evidence ?? row.positiveFactors)
    .map((item) => label(item, ''))
    .filter(Boolean)
  const marketTimestamp = textOrNull(productFreshness?.marketTimestamp ?? row.providerSourceTimestamp ?? row.marketTimestamp ?? row.sourceTimestamp)
  const providerSourceTimestamp = textOrNull(row.providerSourceTimestamp ?? productFreshness?.marketTimestamp ?? row.sourceTimestamp ?? row.marketTimestamp)
  const snapshotCapturedAt = textOrNull(row.snapshotCapturedAt ?? row.snapshotRecencyTimestamp ?? row.capturedAt ?? row.updatedAt)
  return {
    id,
    predictionId: typeof row.predictionId === 'string' ? row.predictionId : typeof row.id === 'string' ? row.id : null,
    label: source,
    source,
    sourceRank: sourceRank(source),
    eventId: typeof row.eventId === 'string' ? row.eventId : typeof row.event_id === 'string' ? row.event_id : null,
    event: label(row.matchup ?? row.eventLabel, 'Event pending'),
    selection: label(row.selection ?? row.team, 'Selection pending'),
    market: label(row.marketLabel ?? row.market, 'Market pending'),
    marketKey: String(row.market ?? row.marketLabel ?? '').toLowerCase(),
    odds: numberOrNull(row.americanOdds ?? row.odds ?? canonicalPrice.americanOdds),
    priceBindingMode: (canonicalPrice.bindingMode ?? row.priceBindingMode) as PlanPick['priceBindingMode'],
    priceSourceMarket: textOrNull(canonicalPrice.sourceMarket ?? row.priceSourceMarket),
    priceSourceSelection: textOrNull(canonicalPrice.sourceSelection ?? row.priceSourceSelection),
    priceSourceLine: numberOrNull(canonicalPrice.sourceLine ?? row.priceSourceLine),
    priceSourceSnapshotId: textOrNull(row.oddsSnapshotId ?? canonicalPrice.snapshotId),
    sportsbook: label(row.sportsbook ?? canonicalPrice.bookmaker ?? canonicalPrice.provider, 'Sportsbook pending'),
    probability,
    confidence,
    edge,
    ev,
    freshness,
    modelVersion,
    freshnessActionability,
    marketTimestamp,
    providerSourceTimestamp,
    snapshotCapturedAt,
    nextRefreshAt: typeof productFreshness?.nextPlannedRefreshAt === 'string' ? productFreshness.nextPlannedRefreshAt : null,
    evidence: [
      ...evidence.slice(0, 3),
      `Source: ${source}`,
      confidence !== null ? `Confidence ${pct(confidence)}` : 'Confidence unavailable',
      edge !== null ? `Edge ${signedPct(edge)}` : 'Edge unavailable',
    ],
    official,
    qualified,
    reason: official ? 'Passed the existing Official Pick policy.' : policyBlockedReason ?? label(row.reasonNotOfficial ?? row.blocker ?? row.why, 'Informational candidate from stored evidence.'),
  }
}

function allCandidates(data: TodayResponse | null, currentBoard?: ApiEnvelope | null) {
  if (!data && !currentBoard) return []
  const selectors = data?.viewModel?.selectors
  const rows: PlanPick[] = []
  const officialRows = data?.sections?.officialPicks?.data ?? []
  officialRows.forEach((row, index) => rows.push(fromRow(`official-${index}`, 'Official Pick', row as Record<string, unknown>, true)))
  const selectorRows = [
    fromSelector('best-value', 'Best Value', selectors?.bestAvailableValue),
    fromSelector('priced', 'Priced Market', selectors?.highestRankedPricedMarket),
    fromSelector('most-likely', 'Most Likely', selectors?.mostLikelySummary?.selector),
    fromSelector('projected', 'Highest Probability', selectors?.highestProjectedOutcome),
  ].filter((item): item is PlanPick => Boolean(item))
  rows.push(...selectorRows)
  ;(data?.sections?.groundedOpportunities?.data ?? []).slice(0, 8).forEach((row, index) => {
    rows.push(fromRow(`grounded-${index}`, 'Grounded Opportunity', row))
  })
  arrayValue(currentBoard?.candidates).forEach((row, index) => {
    if (row && typeof row === 'object') rows.push(fromRow(`current-board-${index}`, 'Current Board', row as Record<string, unknown>))
  })
  const unique = new Map<string, PlanPick>()
  for (const item of rows) {
    const key = `${item.eventId ?? item.event}|${item.marketKey}|${item.selection}|${item.priceSourceLine ?? ''}|${item.sportsbook}`
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

function reviewEvidenceCompleteness(item: PlanPick) {
  const fields = [
    item.eventId,
    item.market,
    item.selection,
    item.probability,
    item.confidence,
    item.odds,
    item.edge,
    item.ev,
    item.marketTimestamp,
    item.snapshotCapturedAt ?? item.providerSourceTimestamp,
  ]
  const present = fields.filter((value) => value !== null && value !== undefined && value !== '').length
  return Math.round((present / fields.length) * 100)
}

function isSupportedReviewMarket(item: PlanPick) {
  return isMoneylineMarket(item) || isSupportedParlayMarket(item)
}

function bestAvailableReviewOption(
  candidates: PlanPick[],
  predicate: (item: PlanPick) => boolean = isSupportedReviewMarket,
): BestAvailableReviewOption {
  const ranked = candidates
    .filter((item) => predicate(item))
    .filter((item) => !isLowInformationCandidate(item))
    .sort((left, right) => {
      const rightCompleteness = reviewEvidenceCompleteness(right)
      const leftCompleteness = reviewEvidenceCompleteness(left)
      const sourceLeft = left.sourceRank < 0 ? 99 : left.sourceRank
      const sourceRight = right.sourceRank < 0 ? 99 : right.sourceRank
      return (
        Number(right.qualified) - Number(left.qualified) ||
        Number(right.probability !== null && right.odds !== null) - Number(left.probability !== null && left.odds !== null) ||
        rightCompleteness - leftCompleteness ||
        sourceLeft - sourceRight ||
        Number(right.ev ?? Number.NEGATIVE_INFINITY) - Number(left.ev ?? Number.NEGATIVE_INFINITY) ||
        Number(right.edge ?? Number.NEGATIVE_INFINITY) - Number(left.edge ?? Number.NEGATIVE_INFINITY) ||
        Number(right.confidence ?? Number.NEGATIVE_INFINITY) - Number(left.confidence ?? Number.NEGATIVE_INFINITY) ||
        Number(right.probability ?? Number.NEGATIVE_INFINITY) - Number(left.probability ?? Number.NEGATIVE_INFINITY)
      )
    })
  const candidate = ranked[0] ?? null
  const evidenceCompleteness = candidate ? reviewEvidenceCompleteness(candidate) : 0
  const blockers = candidate
    ? uniqueList([
      'NOT A RECOMMENDATION',
      candidate.reason,
      candidate.probability === null ? 'Model probability unavailable.' : '',
      candidate.odds === null ? 'Exact-line odds unavailable.' : '',
      candidate.edge === null ? 'Edge unavailable.' : Number(candidate.edge) <= 0 ? 'Edge is not positive.' : '',
      candidate.ev === null ? 'EV unavailable.' : Number(candidate.ev) < 0 ? 'EV is negative.' : '',
      isPostStartOrClosed(candidate) ? 'Pregame betting window closed.' : '',
      isFreshnessActionable(candidate) ? '' : 'Fresh actionable market evidence is not certified for recommendation.',
    ])
    : ['No sufficiently evidenced review candidate is available.']
  return {
    contractVersion: 'best_available_review_option_v1',
    label: 'BEST AVAILABLE REVIEW OPTION',
    notRecommendation: true,
    candidate,
    evidenceCompleteness,
    sufficientEvidence: Boolean(candidate && evidenceCompleteness >= 50 && (candidate.probability !== null || candidate.odds !== null || candidate.edge !== null || candidate.ev !== null)),
    rankingSource: candidate?.source ?? 'No eligible source',
    blockers,
  }
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

function pickPlan(data: TodayResponse | null, currentBoard?: ApiEnvelope | null) {
  const candidates = allCandidates(data, currentBoard)
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
  const bestReview = bestAvailableReviewOption(moneylineUniverse, isMoneylineMarket)
  const reviewCandidate = bestReview.sufficientEvidence ? bestReview.candidate : moneylineUniverse[0] ?? null
  const candidate = actionableOfficial ?? actionableCandidate ?? waitingCandidate ?? reviewCandidate
  const gates = buildMoneylineGates(candidate)
  const counts = applicableGateCounts(gates)
  const failed = gates.filter((item) => item.status === 'FAIL')
  const pending = gates.filter((item) => item.status === 'PENDING')
  const blockingGates = blockingRecommendationGates(gates)
  const actionable = Boolean(candidate) && blockingGates.length === 0 && Number(candidate?.edge ?? 0) > 0 && candidate?.ev !== null && Number(candidate?.ev) >= 0 && isFreshnessActionable(candidate)
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
              ? 'NO_ELIGIBLE_MONEYLINE'
              : 'NO_ELIGIBLE_MONEYLINE'

  const impliedProbability = candidate ? impliedFromAmerican(candidate.odds) : null
  const modelProbability = candidate?.probability ?? null
  const probabilityAdvantage = modelProbability !== null && impliedProbability !== null ? Number((modelProbability - impliedProbability).toFixed(2)) : null
  const rank = candidate ? moneylineUniverse.findIndex((item) => item.id === candidate.id) + 1 : null
  const rentPlayOverlap = rentPlay.status === 'ACTIONABLE' && Boolean(candidate && rentPlay.candidate && candidate.event === rentPlay.eventLabel && candidate.selection === rentPlay.selectionLabel && candidate.market === rentPlay.marketLabel)
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

  const riskReasons = uniqueList([
    ...failed.slice(0, 4).map((item) => item.detail),
    ...pending.slice(0, 3).map((item) => item.detail),
    ...gates.filter((item) => item.status === 'NOT_AVAILABLE').slice(0, 4).map((item) => item.detail),
    probabilityAdvantage !== null && probabilityAdvantage <= 1 ? 'Probability advantage is small.' : '',
    candidate?.ev === null ? 'EV is unavailable.' : '',
  ])

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
    priceBindingMode: candidate?.priceBindingMode,
    priceSourceMarket: candidate?.priceSourceMarket ?? null,
    priceSourceSelection: candidate?.priceSourceSelection ?? null,
    priceSourceLine: candidate?.priceSourceLine ?? null,
    priceSourceSnapshotId: candidate?.priceSourceSnapshotId ?? null,
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
    providerSourceTimestamp: candidate?.providerSourceTimestamp ?? null,
    snapshotCapturedAt: candidate?.snapshotCapturedAt ?? null,
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
    whatWouldChangeTheDecision: buildStateAwareDecisionCopy('moneyline', actionable, gates),
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
    bestAvailableReviewOption: bestReview,
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
  const rentPlayOverlap = rentPlay.status === 'ACTIONABLE' && Boolean(rentPlay.candidate && pick.event === rentPlay.eventLabel && pick.selection === rentPlay.selectionLabel && pick.market === rentPlay.marketLabel)
  const moneylineOverlap = moneyline.status === 'ACTIONABLE' && Boolean(moneyline.candidate && pick.event === moneyline.eventLabel && pick.selection === moneyline.selectionLabel && pick.marketKey === moneyline.marketKey)
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
    priceBindingMode: pick.priceBindingMode,
    decimalOdds: decimalFromAmerican(pick.odds),
    bookmaker: pick.sportsbook,
    provider: pick.sportsbook,
    modelProbability: pick.probability,
    impliedProbability: impliedFromAmerican(pick.odds),
    confidence: pick.confidence,
    edge: pick.edge,
    expectedValue: pick.ev,
    marketTimestamp: pick.marketTimestamp ?? null,
    providerSourceTimestamp: pick.providerSourceTimestamp ?? null,
    snapshotCapturedAt: pick.snapshotCapturedAt ?? null,
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

function isUnsupportedWatchlistMarket(item: PlanPick) {
  const market = `${item.marketKey} ${item.market}`.toLowerCase()
  return /prop|pitcher|batter|first five|first half|team total|alternate|nrfi|yrfi/.test(market)
}

function isPostStartOrClosed(item: PlanPick) {
  return /post_start|post start|started|live|market_closed|closed|cancelled|canceled|final|settled/i.test(`${item.freshness} ${item.freshnessActionability ?? ''} ${item.reason}`)
}

function isLowInformationCandidate(item: PlanPick) {
  return item.probability === null &&
    item.confidence === null &&
    item.edge === null &&
    item.ev === null &&
    item.odds === null &&
    item.evidence.length <= 2
}

function watchlistGateStatus(item: PlanPick, id: string): RentPlayGateStatus {
  if (id === 'supported_market') return isUnsupportedWatchlistMarket(item) ? 'FAIL' : 'PASS'
  if (id === 'pregame') return isPostStartOrClosed(item) ? 'FAIL' : 'PASS'
  if (id === 'current_price') return item.odds === null ? 'NOT_AVAILABLE' : 'PASS'
  if (id === 'freshness') {
    if (isFutureTimestamp(item.marketTimestamp ?? null)) return 'FAIL'
    if (isFreshnessActionable(item)) return 'PASS'
    if (item.freshness.toUpperCase().includes('STALE') || String(item.freshnessActionability ?? '').toUpperCase() === 'WAIT_FOR_REFRESH') return 'PENDING'
    return 'NOT_AVAILABLE'
  }
  if (id === 'model_probability') return item.probability === null ? 'NOT_AVAILABLE' : 'PASS'
  if (id === 'confidence') return item.confidence === null ? 'NOT_AVAILABLE' : 'PASS'
  if (id === 'value') return item.edge === null && item.ev === null ? 'NOT_AVAILABLE' : Number(item.edge ?? 0) > 0 || Number(item.ev ?? -1) >= 0 ? 'PASS' : 'PENDING'
  if (id === 'policy') return /blocked|avoid|do not act|quarantined/i.test(item.reason) ? 'FAIL' : 'PASS'
  return 'PENDING'
}

function buildWatchlistGates(item: PlanPick): RentPlayGate[] {
  return [
    gate('supported_market', 'Supported market', watchlistGateStatus(item, 'supported_market'), isUnsupportedWatchlistMarket(item) ? 'Unsupported markets are not shown in the homepage Watchlist.' : 'Market is supported by existing product evidence.'),
    gate('pregame', 'Pregame event', watchlistGateStatus(item, 'pregame'), isPostStartOrClosed(item) ? 'Post-start, closed, cancelled or terminal events are excluded.' : 'Candidate is not marked post-start or terminal.'),
    gate('current_price', 'Current price', watchlistGateStatus(item, 'current_price'), item.odds === null ? 'Current odds are unavailable and remain unavailable.' : `Current odds are ${odds(item.odds)}.`),
    gate('freshness', 'Freshness', watchlistGateStatus(item, 'freshness'), `Freshness is ${item.freshness}; observedAt is not used as market freshness.`),
    gate('model_probability', 'Model probability', watchlistGateStatus(item, 'model_probability'), item.probability === null ? 'Model probability is unavailable.' : `Model probability is ${pct(item.probability)}.`),
    gate('confidence', 'Confidence', watchlistGateStatus(item, 'confidence'), item.confidence === null ? 'Confidence is unavailable.' : `Confidence is ${pct(item.confidence)}.`),
    gate('value', 'Value evidence', watchlistGateStatus(item, 'value'), `Edge ${signedPct(item.edge)} / EV ${signedPct(item.ev)}.`),
    gate('policy', 'Policy blockers', watchlistGateStatus(item, 'policy'), item.reason),
  ]
}

function watchlistActionability(item: PlanPick, gates: RentPlayGate[]): WatchlistActionability {
  if (item.odds === null) return 'UNAVAILABLE'
  if (gates.some((gateItem) => gateItem.id === 'policy' && gateItem.status === 'FAIL')) return 'BLOCKED'
  if (item.freshness.toUpperCase().includes('STALE') || String(item.freshnessActionability ?? '').toUpperCase() === 'WAIT_FOR_REFRESH') return 'WATCH'
  if (item.qualified && isFreshnessActionable(item) && Number(item.edge ?? 0) > 0 && item.ev !== null && Number(item.ev) >= 0) return 'ACTIONABLE'
  if (item.probability !== null || item.confidence !== null || item.edge !== null || item.ev !== null) return 'BEST_AVAILABLE_RESEARCH'
  return 'NO_CURRENT_EVIDENCE'
}

function watchlistReason(
  item: PlanPick,
  rentPlay: RentPlayContract,
  moneyline: MoneylineBetContract,
  parlay: SmartParlayContract,
  actionability: WatchlistActionability,
): WatchlistReason {
  const rentOverlap = rentPlay.status === 'ACTIONABLE' && Boolean(rentPlay.candidate && item.event === rentPlay.eventLabel && item.selection === rentPlay.selectionLabel && item.market === rentPlay.marketLabel)
  const moneylineOverlap = moneyline.status === 'ACTIONABLE' && Boolean(moneyline.candidate && item.event === moneyline.eventLabel && item.selection === moneyline.selectionLabel && item.marketKey === moneyline.marketKey)
  const parlayOverlap = parlay.availableLegs.some((leg) => leg.eventLabel === item.event && leg.selectionLabel === item.selection && leg.marketKey === item.marketKey)
  if (rentOverlap && actionability !== 'ACTIONABLE') return 'NEAR_RENT_PLAY'
  if (moneylineOverlap && actionability !== 'ACTIONABLE') return 'NEAR_MONEYLINE'
  if (item.official && actionability !== 'ACTIONABLE') return 'NEAR_OFFICIAL_PICK'
  if (actionability === 'WATCH') return 'FRESHNESS_PENDING'
  if (actionability === 'UNAVAILABLE') return 'PRICE_MONITORING'
  if (actionability === 'BLOCKED') return 'POLICY_BLOCKED'
  if (item.source === 'Best Value' || item.id === 'best-value') return 'BEST_VALUE_MONITOR'
  if (item.source === 'Most Likely' || item.id === 'most-likely') return 'MOST_LIKELY_MONITOR'
  if (item.confidence === null || Number(item.confidence) <= 0) return 'CONFIDENCE_PENDING'
  if ((item.edge === null && item.ev === null) || Number(item.edge ?? 0) <= 0 || Number(item.ev ?? -1) < 0) return 'VALUE_PENDING'
  if (!parlayOverlap && item.probability === null) return 'EVIDENCE_PENDING'
  return 'INFORMATIONAL'
}

function watchlistPriority(reason: WatchlistReason, actionability: WatchlistActionability): WatchlistPriority {
  if (['NEAR_RENT_PLAY', 'NEAR_MONEYLINE', 'NEAR_OFFICIAL_PICK', 'FRESHNESS_PENDING'].includes(reason)) return 'HIGH'
  if (actionability === 'ACTIONABLE' || ['BEST_VALUE_MONITOR', 'MOST_LIKELY_MONITOR', 'PRICE_MONITORING'].includes(reason)) return 'MEDIUM'
  if (reason === 'INFORMATIONAL' || actionability === 'NO_CURRENT_EVIDENCE') return 'LOW'
  return 'MEDIUM'
}

function planPickToWatchlistItem(
  item: PlanPick,
  rentPlay: RentPlayContract,
  moneyline: MoneylineBetContract,
  parlay: SmartParlayContract,
): WatchlistItem {
  const gates = buildWatchlistGates(item)
  const actionability = watchlistActionability(item, gates)
  const reason = watchlistReason(item, rentPlay, moneyline, parlay, actionability)
  const priority = watchlistPriority(reason, actionability)
  const rentOverlap = rentPlay.status === 'ACTIONABLE' && Boolean(rentPlay.candidate && item.event === rentPlay.eventLabel && item.selection === rentPlay.selectionLabel && item.market === rentPlay.marketLabel)
  const moneylineOverlap = moneyline.status === 'ACTIONABLE' && Boolean(moneyline.candidate && item.event === moneyline.eventLabel && item.selection === moneyline.selectionLabel && item.marketKey === moneyline.marketKey)
  const parlayOverlap = parlay.availableLegs.some((leg) => leg.eventLabel === item.event && leg.selectionLabel === item.selection && leg.marketKey === item.marketKey)
  const supportingEvidence = [
    `Source: ${item.source}`,
    item.probability !== null ? `Model probability ${pct(item.probability)}` : '',
    item.confidence !== null ? `Confidence ${pct(item.confidence)}` : '',
    item.odds !== null ? `Current price ${odds(item.odds)}` : '',
    item.edge !== null ? `Edge ${signedPct(item.edge)}` : '',
    item.ev !== null ? `EV ${signedPct(item.ev)}` : '',
    item.official ? 'Existing Official Pick evidence is present.' : '',
    ...item.evidence.slice(0, 2),
  ].filter(Boolean)
  const limitingEvidence = [
    item.odds === null ? 'Current odds are unavailable.' : '',
    item.marketTimestamp ? '' : 'Canonical market timestamp is unavailable.',
    item.freshness.toUpperCase().includes('STALE') || String(item.freshnessActionability ?? '').toUpperCase() === 'WAIT_FOR_REFRESH' ? 'Fresh price is required before action.' : '',
    item.confidence === null ? 'Confidence is unavailable.' : '',
    item.edge === null ? 'Edge is unavailable.' : Number(item.edge) <= 0 ? 'Edge is not positive.' : '',
    item.ev === null ? 'EV is unavailable.' : Number(item.ev) < 0 ? 'EV is negative.' : '',
    /blocked|avoid|do not act|quarantined/i.test(item.reason) ? item.reason : '',
  ].filter(Boolean)
  return {
    itemId: item.id,
    eventId: item.eventId,
    eventLabel: item.event,
    marketKey: item.marketKey,
    marketLabel: item.market,
    selectionLabel: item.selection,
    americanOdds: item.odds,
    priceBindingMode: item.priceBindingMode,
    modelProbability: item.probability,
    confidence: item.confidence,
    edge: item.edge,
    expectedValue: item.ev,
    freshnessStatus: item.freshness,
    freshnessActionability: item.freshnessActionability ?? 'INFORMATIONAL_ONLY',
    marketTimestamp: item.marketTimestamp ?? null,
    providerSourceTimestamp: item.providerSourceTimestamp ?? null,
    snapshotCapturedAt: item.snapshotCapturedAt ?? null,
    marketAgeMinutes: minutesSince(item.marketTimestamp ?? null),
    nextPlannedRefreshAt: item.nextRefreshAt ?? null,
    reason,
    priority,
    actionability,
    evidenceFirstStatus: actionability,
    researchOnly: actionability !== 'ACTIONABLE',
    watchReason: reason,
    currentEpoch: 'CURRENT_V2_PRODUCTION',
    sourceSurface: item.source,
    sourceRowId: item.id,
    officialPick: item.official,
    rentPlay: rentOverlap,
    moneylineBet: moneylineOverlap,
    smartParlayEligible: parlayOverlap,
    mostLikely: item.source === 'Most Likely' || item.id === 'most-likely',
    bestValue: item.source === 'Best Value' || item.id === 'best-value',
    supportingEvidence: supportingEvidence.length ? supportingEvidence : ['Stored Today evidence exists, but detailed support is limited.'],
    limitingEvidence: limitingEvidence.length ? limitingEvidence : ['No limiting evidence was exposed by the current stored candidate.'],
    promotionConditions: [
      'Fresh canonical market price is available before start.',
      'No policy, data quality or supported-market blocker is present.',
      'Probability, confidence, edge and EV evidence satisfy the existing recommendation policy.',
      'The existing Official Pick, Rent Play, Moneyline or Smart Parlay surface independently promotes it.',
    ],
    removalConditions: [
      'The event starts, closes, cancels or becomes terminal.',
      'The market becomes unsupported or unavailable.',
      'Freshness, odds, confidence, edge or EV evidence deteriorates.',
      'A stronger current candidate replaces it inside existing stored Today evidence.',
    ],
    eligibilityGates: gates,
    candidate: item,
  }
}

function buildWatchlistContract(
  plan: ReturnType<typeof pickPlan>,
  rentPlay: RentPlayContract,
  moneyline: MoneylineBetContract,
  parlay: SmartParlayContract,
): WatchlistContract {
  const observedAt = new Date().toISOString()
  const seen = new Set<string>()
  const excluded = plan.candidates.filter((item) => isUnsupportedWatchlistMarket(item) || isPostStartOrClosed(item) || isLowInformationCandidate(item))
  const rawItems = plan.candidates
    .filter((item) => !isUnsupportedWatchlistMarket(item) && !isPostStartOrClosed(item) && !isLowInformationCandidate(item))
    .sort((left, right) => {
      const leftPriority = left.official ? 100 : 0
      const rightPriority = right.official ? 100 : 0
      const sourceLeft = left.sourceRank < 0 ? 50 : 50 - left.sourceRank
      const sourceRight = right.sourceRank < 0 ? 50 : 50 - right.sourceRank
      return (rightPriority + sourceRight + Number(right.confidence ?? 0) + Number(right.probability ?? 0)) -
        (leftPriority + sourceLeft + Number(left.confidence ?? 0) + Number(left.probability ?? 0))
    })

  const items: WatchlistItem[] = []
  for (const candidate of rawItems) {
    const key = `${candidate.eventId ?? candidate.event}|${candidate.marketKey}|${candidate.selection}`
    if (seen.has(key)) continue
    seen.add(key)
    const item = planPickToWatchlistItem(candidate, rentPlay, moneyline, parlay)
    items.push(item)
    if (items.length >= 5) break
  }

  const staleCandidateCount = plan.candidates.filter((item) => item.freshness.toUpperCase().includes('STALE') || String(item.freshnessActionability ?? '').toUpperCase() === 'WAIT_FOR_REFRESH').length
  const blockedCandidateCount = plan.candidates.filter((item) => /blocked|avoid|do not act|quarantined/i.test(item.reason)).length
  const unavailableMarketCount = plan.candidates.filter((item) => item.odds === null).length
  const status: WatchlistStatus = !plan.candidates.length
    ? 'NO_GAMES'
    : items.length
      ? staleCandidateCount >= items.length && items.every((item) => item.actionability === 'WATCH')
        ? 'STALE'
        : items.length < 3
          ? 'LIMITED'
          : 'AVAILABLE'
      : unavailableMarketCount >= plan.candidates.length
        ? 'MARKET_UNAVAILABLE'
        : excluded.length
          ? 'EMPTY'
          : 'UNKNOWN'
  const evidenceFirstStatus: WatchlistActionability = items.some((item) => item.actionability === 'ACTIONABLE')
    ? 'ACTIONABLE'
    : items.some((item) => item.actionability === 'WATCH')
      ? 'WATCH'
      : items.some((item) => item.actionability === 'BEST_AVAILABLE_RESEARCH')
        ? 'BEST_AVAILABLE_RESEARCH'
        : items.some((item) => item.actionability === 'BLOCKED')
          ? 'BLOCKED'
          : items.some((item) => item.actionability === 'UNAVAILABLE')
            ? 'UNAVAILABLE'
            : 'NO_CURRENT_EVIDENCE'

  const emptyReason = items.length
    ? null
    : status === 'NO_GAMES'
      ? 'No current games are available in stored Today evidence.'
      : status === 'MARKET_UNAVAILABLE'
        ? 'Markets are unavailable or missing canonical prices.'
        : 'No remaining current candidate is useful enough for the homepage Watchlist.'
  return {
    contractVersion: 'watchlist_v1',
    status,
    evidenceFirstStatus,
    researchOnly: evidenceFirstStatus !== 'ACTIONABLE',
    currentEpoch: 'CURRENT_V2_PRODUCTION',
    maximumItemCount: 5,
    itemCount: items.length,
    totalCandidateCount: plan.candidates.length,
    eligibleCandidateCount: rawItems.length,
    excludedCandidateCount: Math.max(0, plan.candidates.length - rawItems.length),
    staleCandidateCount,
    blockedCandidateCount,
    unavailableMarketCount,
    items,
    emptyReason,
    summary: items.length
      ? `${items.length} current opportunities need monitoring before they can become primary decisions.`
      : emptyReason ?? 'No Watchlist summary is available.',
    observedAt,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
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
  return formatDateTimeValue(value)
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
  const applicable = gates.filter((item) => item.status !== 'OPTIONAL')
  return {
    passedGateCount: applicable.filter((item) => item.status === 'PASS').length,
    failedGateCount: applicable.filter((item) => item.status === 'FAIL').length,
    pendingGateCount: applicable.filter((item) => item.status === 'PENDING').length,
    unavailableGateCount: gates.filter((item) => item.status === 'NOT_AVAILABLE').length,
  }
}

function blockingRecommendationGates(gates: RentPlayGate[]) {
  return gates.filter((item) => item.status === 'FAIL' || item.status === 'PENDING' || item.status === 'NOT_AVAILABLE')
}

function uniqueList(values: Array<string | null | undefined>) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const normalized = String(value ?? '').trim()
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }
  return result
}

function isFreshnessActionable(pick: PlanPick | null) {
  if (!pick) return false
  const freshness = pick.freshness.toUpperCase()
  const actionability = String(pick.freshnessActionability ?? '').toUpperCase()
  if (!pick.marketTimestamp) return false
  if (/UNAVAILABLE|UNKNOWN|PENDING/.test(freshness)) return false
  return !['STALE', 'INVALID_FUTURE', 'POST_START', 'MARKET_CLOSED', 'UNKNOWN_TIMESTAMP'].includes(freshness) &&
    !['BLOCKED', 'WAIT_FOR_REFRESH', 'UNAVAILABLE'].includes(actionability) &&
    !isFutureTimestamp(pick.marketTimestamp ?? null)
}

function buildStateAwareDecisionCopy(surface: 'rent' | 'moneyline' | 'parlay', actionable: boolean, gates: RentPlayGate[]) {
  if (actionable) {
    if (surface === 'parlay') {
      return [
        'A selected leg becomes stale, unavailable, post-start or unsupported.',
        'A selected price changes or disappears.',
        'Correlation becomes blocked by duplicate or direct-opposite evidence.',
        'A certified joint-probability method becomes available and changes the risk view.',
      ]
    }
    return [
      'Current price changes enough to remove the existing advantage.',
      'Market evidence becomes stale, future-dated, unavailable or closed.',
      'Confidence, edge, EV or policy evidence no longer passes.',
      'The event begins.',
    ]
  }

  const blocking = blockingRecommendationGates(gates)
  const improvements = blocking.map((item) => {
    if (/fresh/i.test(item.label)) return 'Fresh exact-line market evidence becomes available before start.'
    if (/odds|price|moneyline/i.test(item.label)) return 'Current exact-line sportsbook odds become available.'
    if (/probability/i.test(item.label)) return 'Model probability evidence is available for the same market identity.'
    if (/confidence/i.test(item.label)) return 'Confidence evidence clears the existing policy requirement.'
    if (/edge/i.test(item.label)) return 'Positive edge is established from the existing formula.'
    if (/\bEV\b|ev policy|value/i.test(item.label)) return 'EV becomes available and policy-compliant.'
    if (/official|policy|data quality|calibration/i.test(item.label)) return 'Production policy, calibration or data-quality blockers clear.'
    if (/pregame|event/i.test(item.label)) return 'The event remains pregame and cutoff-safe.'
    return item.detail
  })
  return uniqueList(improvements).slice(0, 6)
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
  const bestReview = bestAvailableReviewOption(plan.candidates)
  const reviewCandidate = bestReview.sufficientEvidence ? bestReview.candidate : null
  const candidate = officialCandidate ?? highProbabilityCandidate ?? waitingCandidate ?? reviewCandidate
  const gates = buildRentPlayGates(candidate)
  const counts = applicableGateCounts(gates)
  const failed = gates.filter((item) => item.status === 'FAIL')
  const pending = gates.filter((item) => item.status === 'PENDING')
  const blockingGates = blockingRecommendationGates(gates)
  const actionable = Boolean(candidate) && blockingGates.length === 0 && Number(candidate?.probability ?? 0) > 50 && Number(candidate?.edge ?? 0) > 0 && candidate?.ev !== null && Number(candidate?.ev) >= 0 && isFreshnessActionable(candidate)
  const status: RentPlayStatus = !plan.candidates.length
    ? 'NO_GAMES'
    : actionable
      ? 'ACTIONABLE'
      : waitingCandidate
        ? 'WAITING_FOR_FRESH_PRICE'
        : failed.some((item) => item.id === 'policy_blockers' || item.id === 'official_status')
          ? 'POLICY_BLOCKED'
          : candidate
            ? 'NO_ELIGIBLE_PLAY'
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

  const riskReasons = uniqueList([
    ...failed.slice(0, 4).map((item) => item.detail),
    ...pending.slice(0, 3).map((item) => item.detail),
    ...gates.filter((item) => item.status === 'NOT_AVAILABLE').slice(0, 4).map((item) => item.detail),
  ])

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
    whatWouldChangeTheDecision: buildStateAwareDecisionCopy('rent', actionable, gates),
    sourceSurface: candidate?.source ?? 'No eligible source',
    sourceRowId: candidate?.id ?? null,
    canonicalAcquisitionId: null,
    evidence: candidate?.evidence ?? [],
    observedAt,
    candidate,
    closestCandidate: plan.closest,
    bestAvailableReviewOption: bestReview,
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
  greeting,
}: {
  data: TodayResponse
  plan: ReturnType<typeof pickPlan>
  currentBoard: ApiEnvelope | null
  intelligence: ApiEnvelope | null
  performance: ApiEnvelope | null
  greeting: string
}) {
  const recommendation = dailyRecommendation(plan, data)
  const boardCandidates = countValue(currentBoard?.candidates ? arrayValue(currentBoard.candidates).length : currentBoard?.candidateCount)
  const boardPositiveEvCandidates = arrayValue(currentBoard?.candidates).filter((row) => {
    if (!row || typeof row !== 'object') return false
    const record = row as Record<string, unknown>
    const canonicalEv = recordValue(record.canonicalEv)
    return Number(numberOrNull(record.ev ?? record.expectedValue ?? canonicalEv.expectedValue) ?? 0) > 0 &&
      Number(numberOrNull(record.edge ?? record.edgePercentagePoints ?? canonicalEv.edge) ?? 0) > 0
  }).length
  const intelligenceSample = countValue(recordValue(intelligence?.currentProductionSample).sampleSize)
  const perfMetrics = recordValue(recordValue(performance?.aiBrain).reportCard)
  const perfCore = recordValue(perfMetrics.metrics)
  const perfCalibration = recordValue(perfMetrics.calibration)
  const boardFreshness = recordValue(currentBoard?.dataFreshness)
  const gamesToday = firstPositiveCount(
    data.totalScheduledToday,
    data.currentGames,
    data.lifecycleCounts?.totalScheduledToday,
    data.viewModel?.selectors?.gameCoverageSummary?.gamesToday,
    data.viewModel?.selectors?.currentBoardSummary?.candidates,
    boardCandidates,
  )
  const predictions = firstPositiveCount(
    data.predictionCandidates,
    data.viewModel?.selectors?.gameCoverageSummary?.marketsPredicted,
    data.viewModel?.selectors?.gameCoverageSummary?.currentBoardCandidates,
    boardCandidates,
    plan.candidates.length,
  )
  const official = countValue(data.officialPicks) || plan.candidates.filter((item) => item.official).length
  const value = firstPositiveCount(
    data.viewModel?.selectors?.bestValueSemantics?.candidatesWithPositiveEv,
    boardPositiveEvCandidates,
    currentBoard?.modeledValueCount,
    plan.candidates.filter((item) => Number(item.ev ?? 0) > 0 && Number(item.edge ?? 0) > 0).length,
  )
  const analyzedGames = firstPositiveCount(
    data.viewModel?.selectors?.gameCoverageSummary?.gamesWithDisplayableCurrentBoardMarket,
    data.viewModel?.selectors?.gameCoverageSummary?.gamesWithValidPregamePredictions,
    gamesToday > 0 && predictions > 0 ? gamesToday : 0,
  )
  const skipped = firstPositiveCount(
    data.schedulerCoverage?.skippedToday,
    data.schedulerCoverage?.pendingToday,
    data.schedulerCoverage?.gamesPendingPregameExecution,
    Math.max(0, gamesToday - analyzedGames),
  )
  const marketQuality = data.summary?.marketPrices === 'Waiting for sportsbook refresh.' &&
    firstPositiveCount(data.viewModel?.selectors?.currentBoardSummary?.displayableMarkets, boardCandidates) > 0
      ? 'Current market evidence available'
      : data.summary?.marketPrices ?? label(data.freshness, 'Unknown')
  const snapshotCapturedAt = data.latestOddsTimestamp ??
    data.viewModel?.selectors?.marketFreshnessSummary?.latestOddsTimestamp ??
    textOrNull(boardFreshness.latestSnapshotTimestamp ?? boardFreshness.latestOddsTimestamp ?? boardFreshness.latestSourceTimestamp) ??
    null

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-5 md:p-6" data-r9-daily-brief="true" data-mc08a-morning-brief="true" data-language-foundation="en-es">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-200">{localeFoundation.en.morningBrief}</p>
          <h2 className="mt-3 text-3xl font-black text-white md:text-5xl" suppressHydrationWarning>{greeting} {localeFoundation.en.question}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Today&apos;s Betting Weather: {recommendation.label}. {recommendation.reason}</p>
        </div>
        <StatusChip tone={recommendation.tone}>{label(data.status, 'Today ready')}</StatusChip>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <MiniMetric label="Games Today" value={gamesToday} />
        <MiniMetric label="Sports Active" value={gamesToday > 0 ? 1 : 0} />
        <MiniMetric label="Predictions" value={predictions} />
        <MiniMetric label="Official Picks" value={official} />
        <MiniMetric label="Value Signals" value={value} />
        <MiniMetric label="Games Skipped" value={skipped} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <MiniMetric label="Decision Summary" value={recommendation.label} />
        <MiniMetric label="Market Quality" value={marketQuality} />
        <MiniMetric label="Risk" value={skipped ? 'Review first' : 'Low'} />
        <MiniMetric label="Confidence" value={perfCore.accuracy ?? perfCalibration.calibrationError ?? intelligenceSample ? 'Measured' : 'Limited'} />
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        Market evidence: {compactDate(snapshotCapturedAt)}
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
  const primaryPick = moneyline.status === 'ACTIONABLE' ? pick : null
  const reviewPick = moneyline.status === 'ACTIONABLE' ? null : pick ?? moneyline.closestCandidate
  const bestReview = moneyline.bestAvailableReviewOption
  const closest = moneyline.closestCandidate
  const readinessDenominator = moneyline.passedGateCount + moneyline.failedGateCount + moneyline.pendingGateCount + moneyline.unavailableGateCount
  const readiness = readinessDenominator ? (moneyline.passedGateCount / readinessDenominator) * 100 : null
  const priceFreshness = moneyline.marketAgeMinutes === null ? moneyline.freshnessStatus : `${moneyline.marketAgeMinutes} min`
  const title = primaryPick
    ? moneyline.selectionLabel
    : moneyline.status === 'WAITING_FOR_FRESH_PRICE'
      ? moneylineCopy.en.waiting
      : moneyline.status === 'MARKET_UNAVAILABLE'
        ? moneylineCopy.en.unavailable
        : 'No Qualified Moneyline Bet'

  return (
    <article className="rounded-lg border border-sky-300/20 bg-slate-950/85 p-5 shadow-2xl shadow-slate-950/20 md:p-6" data-mc08c-moneyline-card="true" data-moneyline-status={moneyline.status}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-200">{moneylineCopy.en.label}</p>
          <h2 className="mt-3 break-words text-2xl font-black text-white md:text-4xl">{title}</h2>
          <p className="mt-3 text-sm font-bold text-slate-300">
            {primaryPick ? `${moneyline.eventLabel} / Qualified Moneyline recommendation` : 'No current Moneyline passes the full probability, price, freshness, value and policy contract.'}
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
        <MiniMetric label="Market Evidence" value={priceFreshness} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <MetricBar label="Win Probability" value={moneyline.modelProbability} tone={moneyline.modelProbability !== null && moneyline.modelProbability > 50 ? 'green' : 'yellow'} />
        <MetricBar label="Price Implied" value={moneyline.impliedProbability} tone="blue" />
        <MetricBar label="Advantage" value={moneyline.probabilityAdvantage} tone={moneyline.probabilityAdvantage !== null && moneyline.probabilityAdvantage > 0 ? 'green' : 'yellow'} />
        <MetricBar label="Required Gates Passed" value={readiness} tone={moneyline.failedGateCount || moneyline.pendingGateCount || moneyline.unavailableGateCount ? 'yellow' : 'green'} />
      </div>

      <p className="mt-5 text-sm leading-6 text-slate-300">{primaryPick ? moneyline.selectionReasons[0] ?? moneylineCopy.en.empty : 'The strongest Moneyline evidence remains review-only until every required gate passes.'}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MiniText label="Candidate Rank" value={moneyline.rankWithinMoneylineUniverse ? `${moneyline.rankWithinMoneylineUniverse} of ${moneyline.candidateCount}` : 'Unavailable'} />
        <MiniText label="Price Binding" value={moneyline.priceBindingMode ?? 'UNAVAILABLE'} />
        <MiniText label="Analysis Snapshot" value={compactDate(moneyline.snapshotCapturedAt ?? null)} />
        <MiniText label="Actionability" value={moneyline.actionability.replaceAll('_', ' ')} />
        <MiniText label="Value" value={`Edge ${signedPct(moneyline.edge)} / EV ${signedPct(moneyline.expectedValue)}`} />
      </div>

      {reviewPick ? (
        <div className="mt-5 rounded-lg border border-amber-300/20 bg-amber-300/10 p-4" data-mc08c-review-only-candidate="true" data-best-available-review-option="true" data-not-recommendation="true">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">Best Review-Only Moneyline Candidate / Best Available Review Option - Not A Recommendation</p>
          <p className="mt-2 text-lg font-black text-white">{reviewPick.selection}</p>
          <p className="mt-1 text-sm text-amber-50">{reviewPick.event} / {reviewPick.market} / {pct(reviewPick.probability)}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <MiniText label="Odds" value={odds(reviewPick.odds)} />
            <MiniText label="Implied" value={pct(impliedFromAmerican(reviewPick.odds))} />
            <MiniText label="Edge / EV" value={`${signedPct(reviewPick.edge)} / ${signedPct(reviewPick.ev)}`} />
            <MiniText label="Evidence Time" value={compactDate(reviewPick.providerSourceTimestamp ?? reviewPick.marketTimestamp)} />
          </div>
          <p className="mt-2 text-sm text-slate-300">{reviewPick.reason}</p>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-100">Blocked Because: {bestReview.blockers.slice(0, 3).join(' / ')}</p>
        </div>
      ) : !primaryPick && closest ? (
        <div className="mt-5 rounded-lg border border-amber-300/20 bg-amber-300/10 p-4" data-mc08c-review-only-candidate="true" data-best-available-review-option="false" data-not-recommendation="true">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">No Sufficiently Evidenced Review Candidate</p>
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
            <MiniText label={moneyline.status === 'ACTIONABLE' ? 'What Would Change The Decision' : 'What Would Make This Eligible'} value={moneyline.whatWouldChangeTheDecision.join(' / ')} />
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
  if (status === 'OPTIONAL') return 'blue'
  return 'gray'
}

function RentPlayCard({ rentPlay }: { rentPlay: RentPlayContract }) {
  const pick = rentPlay.candidate
  const primaryPick = rentPlay.status === 'ACTIONABLE' ? pick : null
  const reviewPick = rentPlay.status === 'ACTIONABLE' ? null : pick ?? rentPlay.closestCandidate
  const bestReview = rentPlay.bestAvailableReviewOption
  const closest = rentPlay.closestCandidate
  const readinessDenominator = rentPlay.passedGateCount + rentPlay.failedGateCount + rentPlay.pendingGateCount + rentPlay.unavailableGateCount
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
            {primaryPick ? rentPlay.selectionLabel : rentPlay.status === 'WAITING_FOR_FRESH_PRICE' ? rentPlayCopy.en.waiting : 'No Qualified Rent Play'}
          </h2>
          <p className="mt-3 text-sm font-bold text-slate-300">
            {primaryPick ? `${rentPlay.eventLabel} / ${rentPlay.marketLabel}` : 'No candidate currently passes every Rent Play hard gate. Review candidates stay below.'}
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
        <MiniMetric label="Market Evidence" value={rentPlay.marketAgeMinutes === null ? rentPlay.freshnessStatus : `${rentPlay.marketAgeMinutes} min`} />
        <MiniMetric label="Actionability" value={rentPlay.actionability.replaceAll('_', ' ')} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <MetricBar label="Model Probability" value={rentPlay.modelProbability} tone={rentPlay.modelProbability !== null && rentPlay.modelProbability > 50 ? 'green' : 'yellow'} />
        <MetricBar label="Implied Probability" value={rentPlay.impliedProbability} tone="blue" />
        <MetricBar label="Required Gates Passed" value={readiness} tone={rentPlay.failedGateCount || rentPlay.pendingGateCount || rentPlay.unavailableGateCount ? 'yellow' : 'green'} />
      </div>

      <p className="mt-5 text-sm leading-6 text-slate-300">{primaryPick ? rentPlay.supportingReasons[0] ?? rentPlayCopy.en.empty : 'The strongest Rent Play evidence remains review-only until probability, odds, freshness, value and policy gates all pass.'}</p>

      {reviewPick ? (
        <div className="mt-5 rounded-lg border border-amber-300/20 bg-amber-300/10 p-4" data-mc08b-best-available-not-rent-play="true" data-best-available-review-option="true" data-not-recommendation="true">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">Best Review-Only Candidate - Not Rent Play / Best Available Review Option - Not A Recommendation</p>
          <p className="mt-2 text-lg font-black text-white">{reviewPick.selection}</p>
          <p className="mt-1 text-sm text-amber-50">{reviewPick.event} / {reviewPick.market} / {pct(reviewPick.probability)}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <MiniText label="Odds" value={odds(reviewPick.odds)} />
            <MiniText label="Implied" value={pct(impliedFromAmerican(reviewPick.odds))} />
            <MiniText label="Edge / EV" value={`${signedPct(reviewPick.edge)} / ${signedPct(reviewPick.ev)}`} />
            <MiniText label="Evidence Time" value={compactDate(reviewPick.providerSourceTimestamp ?? reviewPick.marketTimestamp)} />
          </div>
          <p className="mt-2 text-sm text-slate-300">{reviewPick.reason}</p>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-100">Blocked Because: {bestReview.blockers.slice(0, 3).join(' / ')}</p>
        </div>
      ) : !primaryPick && closest ? (
        <div className="mt-5 rounded-lg border border-amber-300/20 bg-amber-300/10 p-4" data-mc08b-best-available-not-rent-play="true" data-best-available-review-option="false" data-not-recommendation="true">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">No Sufficiently Evidenced Review Candidate</p>
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
            <MiniText label="Price Binding" value={rentPlay.priceBindingMode ?? 'UNAVAILABLE'} />
            <MiniText label="Market Evidence Time" value={compactDate(rentPlay.providerSourceTimestamp ?? rentPlay.marketTimestamp)} />
            <MiniText label="Analysis Snapshot" value={compactDate(rentPlay.snapshotCapturedAt ?? null)} />
            <MiniText label="Next Planned Refresh" value={compactDate(rentPlay.nextPlannedRefreshAt)} />
            <MiniText label="Edge and EV" value={`Edge ${signedPct(rentPlay.edge)} / EV ${signedPct(rentPlay.expectedValue)}`} />
            <MiniText label="Observed At" value={`${compactDate(rentPlay.observedAt)}. This is not used as market evidence freshness.`} />
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
            <MiniText label={rentPlay.status === 'ACTIONABLE' ? 'What Would Change The Decision' : 'What Would Make This Eligible'} value={rentPlay.whatWouldChangeTheDecision.join(' / ')} />
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
  const builderStatus = parlay.availableLegs.length ? 'BUILDER_AVAILABLE' : 'NO_ELIGIBLE_LEGS'
  const certifiedLegCount = parlay.availableLegs.filter((leg) => leg.actionability === 'ACTIONABLE').length
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
          <StatusChip tone={builderStatus === 'BUILDER_AVAILABLE' ? 'blue' : 'gray'}>{builderStatus.replaceAll('_', ' ')}</StatusChip>
          <StatusChip tone={smartParlayTone(displayedStatus)}>{displayedStatus === 'ACTIONABLE' ? 'PARLAY ACTIONABLE' : displayedStatus.replaceAll('_', ' ')}</StatusChip>
          <StatusChip tone="blue">{selectedSummary.selectedLegCount} of {parlay.maximumLegCount} selected</StatusChip>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniMetric label="Browsable Legs" value={parlay.availableLegs.length} />
        <MiniMetric label="Certified Legs" value={certifiedLegCount} />
        <MiniMetric label="Combined Odds" value={selectedSummary.combinedOddsAvailable ? odds(selectedSummary.combinedAmericanOdds) : 'Unavailable' } />
        <MiniMetric label="Joint Probability" value="Unavailable" />
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
                    <span>{leg.priceBindingMode ?? 'UNAVAILABLE'}</span>
                  </span>
                </label>
              )
            }) : (
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">No safe suggested combination is available. The user may still review eligible legs when they appear.</div>
            )}
          </div>

          <div className="grid gap-3">
            <MiniText label="Builder Status" value={builderStatus.replaceAll('_', ' ')} />
            <MiniText label="Recommendation Status" value={selectedSummary.parlayActionability === 'ACTIONABLE' ? 'PARLAY ACTIONABLE' : selectedSummary.parlayActionability.replaceAll('_', ' ')} />
            <MiniText label="Combined Odds" value={selectedSummary.combinedOddsAvailable ? `${odds(selectedSummary.combinedAmericanOdds)} / decimal ${selectedSummary.combinedDecimalOdds}` : 'Unavailable until every selected leg has canonical odds.'} />
            <MiniText label="Joint Probability" value={`${selectedSummary.jointProbabilityMethod}. ${selectedSummary.jointProbabilityEvidence.join(' ')}`} />
            <MiniText label="Market Evidence" value={selectedSummary.allLegsFresh ? 'All selected legs have actionable market evidence.' : `Limited by ${selectedSummary.stalestLegId ?? 'an unavailable or stale leg'}.`} />
            <MiniText label="Correlation" value={`${selectedSummary.correlationStatus}. ${selectedSummary.correlationReasons.join(' / ')}`} />
            <MiniText label="Blocking Legs" value={selectedSummary.blockingLegIds.length ? selectedSummary.blockingLegIds.join(' / ') : 'None'} />
            <MiniText label="Why These Legs" value={selectedSummary.supportingReasons.join(' / ')} />
            <MiniText label="Main Risks" value={selectedSummary.riskReasons.join(' / ')} />
            <MiniText label={selectedSummary.parlayActionability === 'ACTIONABLE' ? 'What Would Change The Decision' : 'What Would Make This Eligible'} value={(selectedSummary.parlayActionability === 'ACTIONABLE' ? selectedSummary.whatWouldChangeTheDecision : uniqueList([
              selectedSummary.selectedLegCount < parlay.minimumLegCount ? 'Select at least two supportable legs.' : '',
              selectedSummary.blockingLegIds.length ? 'Remove or replace blocked, stale, unavailable or unsupported legs.' : '',
              selectedSummary.combinedOddsAvailable ? '' : 'Every selected leg needs a valid canonical price.',
              selectedSummary.correlationStatus === 'BLOCKED' ? 'Remove duplicate or direct-opposite legs.' : '',
              'A certified joint-probability method is required before probability-certified parlay guidance exists.',
            ])).join(' / ')} />
          </div>
        </div>
      </details>
    </article>
  )
}

function watchlistStatusTone(status: WatchlistStatus): Tone {
  if (status === 'AVAILABLE') return 'green'
  if (status === 'LIMITED' || status === 'STALE') return 'yellow'
  if (status === 'EMPTY' || status === 'NO_GAMES' || status === 'MARKET_UNAVAILABLE') return 'gray'
  return 'blue'
}

function watchlistPriorityTone(priority: WatchlistPriority): Tone {
  if (priority === 'HIGH') return 'green'
  if (priority === 'MEDIUM') return 'yellow'
  if (priority === 'LOW') return 'blue'
  return 'gray'
}

function watchlistActionTone(status: WatchlistActionability): Tone {
  if (status === 'ACTIONABLE') return 'green'
  if (status === 'BEST_AVAILABLE_RESEARCH' || status === 'WATCH') return 'yellow'
  if (status === 'UNAVAILABLE' || status === 'NO_CURRENT_EVIDENCE') return 'gray'
  if (status === 'BLOCKED') return 'red'
  return 'blue'
}

function Watchlist({ watchlist, isPreferredTeamLabel }: { watchlist: WatchlistContract; isPreferredTeamLabel: ReturnType<typeof usePersonalization>['isPreferredTeamLabel'] }) {
  return (
    <section
      className="rounded-lg border border-slate-800 bg-slate-950/80 p-5 md:p-6"
      data-mc08a-watchlist="true"
      data-mc08e-watchlist="true"
      data-watchlist-status={watchlist.status}
      data-watchlist-contract={watchlist.contractVersion}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Today&apos;s Watchlist</p>
          <h2 className="mt-3 text-2xl font-black text-white">Monitor what could matter next</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{watchlist.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <StatusChip tone={watchlistStatusTone(watchlist.status)}>{watchlist.status.replaceAll('_', ' ')}</StatusChip>
          <StatusChip tone={watchlistActionTone(watchlist.evidenceFirstStatus)}>{watchlist.evidenceFirstStatus.replaceAll('_', ' ')}</StatusChip>
          <StatusChip tone="blue">{watchlist.itemCount} of {watchlist.maximumItemCount}</StatusChip>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniMetric label="Watch Items" value={watchlist.itemCount} />
        <MiniMetric label="Candidates Reviewed" value={watchlist.totalCandidateCount} />
        <MiniMetric label="Stale Or Waiting" value={watchlist.staleCandidateCount} />
        <MiniMetric label="Markets Missing" value={watchlist.unavailableMarketCount} />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {watchlist.items.length ? watchlist.items.map((item, index) => (
          <article key={item.itemId} className="rounded-lg border border-slate-800 bg-slate-900 p-4" data-mc08e-watchlist-item="true" data-watchlist-priority={item.priority} data-watchlist-reason={item.reason} data-watchlist-evidence-first-status={item.evidenceFirstStatus} data-watchlist-research-only={item.researchOnly}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">#{index + 1} / {item.sourceSurface}</p>
                <h3 className="mt-2 break-words text-lg font-black text-white">{item.selectionLabel}</h3>
                <p className="mt-1 text-xs font-bold uppercase text-slate-500">{item.marketLabel} / {item.eventLabel}</p>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <StatusChip tone={watchlistPriorityTone(item.priority)}>{item.priority}</StatusChip>
                <StatusChip tone={watchlistActionTone(item.evidenceFirstStatus)}>{item.evidenceFirstStatus.replaceAll('_', ' ')}</StatusChip>
                {item.researchOnly ? <StatusChip tone="yellow">Research Only</StatusChip> : null}
                {isPreferredTeamLabel(`${item.selectionLabel} ${item.eventLabel}`) ? <StatusChip tone="blue">Favorite</StatusChip> : null}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black text-slate-300 sm:grid-cols-4">
              <MiniText label="Probability" value={pct(item.modelProbability)} />
              <MiniText label="Confidence" value={pct(item.confidence)} />
              <MiniText label="Odds" value={odds(item.americanOdds)} />
              <MiniText label="Market Evidence" value={item.marketAgeMinutes === null ? item.freshnessStatus : `${item.marketAgeMinutes} min`} />
            </div>

            <details className="mt-4 rounded-lg border border-slate-800 bg-slate-950/70 p-3" data-mc08e-watchlist-item-expanded="true">
              <summary className="cursor-pointer text-sm font-black text-white">Why it is on the Watchlist</summary>
              <div className="mt-4 grid gap-3">
                <MiniText label="Watch Reason" value={item.watchReason.replaceAll('_', ' ')} />
                <MiniText label="Current Epoch" value={item.currentEpoch.replaceAll('_', ' ')} />
                <MiniText label="Positive Evidence" value={item.supportingEvidence.join(' / ')} />
                <MiniText label="Limiting Evidence" value={item.limitingEvidence.join(' / ')} />
                <MiniText label="Promotion Conditions" value={item.promotionConditions.join(' / ')} />
                <MiniText label="Removal Conditions" value={item.removalConditions.join(' / ')} />
                <MiniText label="Relationships" value={[
                  item.officialPick ? 'Official Pick' : '',
                  item.rentPlay ? 'Rent Play' : '',
                  item.moneylineBet ? 'Moneyline Bet' : '',
                  item.smartParlayEligible ? 'Smart Parlay eligible' : '',
                  item.mostLikely ? 'Most Likely' : '',
                  item.bestValue ? 'Best Value' : '',
                ].filter(Boolean).join(' / ') || 'No primary-surface overlap.'} />
                <MiniText label="Price Binding" value={item.priceBindingMode ?? 'UNAVAILABLE'} />
                <MiniText label="Market Evidence Time" value={compactDate(item.providerSourceTimestamp ?? item.marketTimestamp)} />
                <MiniText label="Snapshot Captured" value={compactDate(item.snapshotCapturedAt ?? null)} />
                <MiniText label="Next Planned Refresh" value={compactDate(item.nextPlannedRefreshAt)} />
                <div className="grid gap-2">
                  {item.eligibilityGates.map((gateItem) => (
                    <div key={gateItem.id} className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900 p-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-black text-white">{gateItem.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{gateItem.detail}</p>
                      </div>
                      <StatusChip tone={gateTone(gateItem.status)}>{gateItem.status}</StatusChip>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          </article>
        )) : (
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300" data-mc08e-watchlist-empty="true">
            <p className="text-lg font-black text-white">No Current Watchlist Evidence</p>
            <p className="mt-2 leading-6">{watchlist.emptyReason ?? 'No additional current opportunity is strong enough to monitor.'}</p>
            <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Nothing is promoted by filler. Watchlist only uses current stored evidence.</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a href="/most-likely" className="rounded-lg border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm font-black text-slate-100 hover:border-sky-300/40 hover:bg-sky-300/10">Most Likely</a>
        <a href="/best-value" className="rounded-lg border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm font-black text-slate-100 hover:border-sky-300/40 hover:bg-sky-300/10">Best Value</a>
        <a href="/betting-workbench" className="rounded-lg border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm font-black text-slate-100 hover:border-sky-300/40 hover:bg-sky-300/10">Betting Workbench</a>
      </div>
    </section>
  )
}

function DecisionSummary({ data, plan, watchlist }: { data: TodayResponse; plan: ReturnType<typeof pickPlan>; watchlist: WatchlistContract }) {
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
      <p className="mt-3 text-sm leading-6 text-slate-400" data-mc08e-watchlist-summary-reference="true">
        Watchlist: {watchlist.itemCount ? `${watchlist.itemCount} current monitor ${watchlist.itemCount === 1 ? 'item' : 'items'} with ${watchlist.status.toLowerCase().replaceAll('_', ' ')} status.` : watchlist.emptyReason ?? 'No current watch items.'}
      </p>
    </section>
  )
}

function TechnicalEvidence({
  data,
  currentBoard,
  intelligence,
  performance,
  advancedOpen,
}: {
  data: TodayResponse
  currentBoard: ApiEnvelope | null
  intelligence: ApiEnvelope | null
  performance: ApiEnvelope | null
  advancedOpen: boolean
}) {
  const boardCandidates = arrayValue(currentBoard?.candidates).length || countValue(currentBoard?.candidateCount)
  const sample = countValue(recordValue(intelligence?.currentProductionSample).sampleSize)
  const metrics = recordValue(recordValue(recordValue(performance?.aiBrain).reportCard).metrics)
  const marketEvidenceValue = recordValue(currentBoard?.dataFreshness).latestSourceTimestamp
  const marketEvidenceTimestamp = typeof marketEvidenceValue === 'string' && marketEvidenceValue.trim() ? marketEvidenceValue : null

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
        <MiniMetric label="Evidence Preference" value={advancedOpen ? 'Expanded' : 'Collapsed'} />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <MiniText label="Snapshot captured" value={compactDate(data.latestOddsTimestamp ?? data.viewModel?.selectors?.marketFreshnessSummary?.latestOddsTimestamp ?? null)} />
        <MiniText label="Market evidence" value={compactDate(marketEvidenceTimestamp)} />
        <MiniText label="Performance" value={JSON.stringify(metrics).slice(0, 180) || 'Performance summary unavailable.'} />
      </div>
    </details>
  )
}

export default function HomeBettingPlan() {
  const { preferences, t, isPreferredSport, isPreferredTeamLabel } = usePersonalization()
  const [greetingNow, setGreetingNow] = useState(() => new Date())
  const [data, setData] = useState<TodayResponse | null>(null)
  const [currentBoard, setCurrentBoard] = useState<ApiEnvelope | null>(null)
  const [intelligence, setIntelligence] = useState<ApiEnvelope | null>(null)
  const [performance, setPerformance] = useState<ApiEnvelope | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const updateGreetingClock = () => setGreetingNow(new Date())
    updateGreetingClock()
    const timer = window.setInterval(updateGreetingClock, 60_000)
    return () => window.clearInterval(timer)
  }, [])

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

  const plan = useMemo(() => pickPlan(data, currentBoard), [data, currentBoard])
  const rentPlayContract = useMemo(() => buildRentPlayContract(plan), [plan])
  const moneylineBetContract = useMemo(() => buildMoneylineBetContract(plan, rentPlayContract), [plan, rentPlayContract])
  const smartParlayContract = useMemo(() => buildSmartParlayContract(plan, rentPlayContract, moneylineBetContract), [plan, rentPlayContract, moneylineBetContract])
  const watchlistContract = useMemo(() => buildWatchlistContract(plan, rentPlayContract, moneylineBetContract, smartParlayContract), [plan, rentPlayContract, moneylineBetContract, smartParlayContract])
  const greeting = useMemo(() => getTimeOfDayGreeting({
    date: greetingNow,
    timeZone: preferences.timezone,
    locale: preferences.language,
  }).greeting, [greetingNow, preferences.language, preferences.timezone])

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
    <main className={`min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_30rem),linear-gradient(180deg,#020617_0%,#0f172a_52%,#020617_100%)] px-4 text-white md:px-6 ${preferences.homepageDensity === 'COMPACT' ? 'py-3 md:py-5' : 'py-5 md:py-8'}`} data-c1-home-betting-plan="true" data-mc08a-homepage="true" data-mc08f-homepage-personalized="true" data-language={preferences.language} data-odds-format={preferences.oddsFormat} data-display-timezone={preferences.timezone} data-canonical-timezone={CANONICAL_OPERATING_TIMEZONE}>
      <section className="mx-auto grid max-w-6xl gap-5">
        <DailyBrief data={data} plan={plan} currentBoard={currentBoard} intelligence={intelligence} performance={performance} greeting={greeting} />

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs font-black uppercase tracking-[0.14em] text-slate-300" data-mc08f-homepage-preferences="true">
          <span>Language {preferences.language}</span>
          <span>Odds {preferences.oddsFormat}</span>
          <span>Display timezone {preferences.timezone}</span>
          <span>Operating timezone {CANONICAL_OPERATING_TIMEZONE}</span>
          {isPreferredSport('baseball_mlb') ? <span>MLB preferred</span> : null}
          <a className="rounded-md border border-slate-700 px-3 py-2 text-slate-100 outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-emerald-300" href="/settings">{t('settings')}</a>
        </div>

        <div className="grid gap-4">
          <RentPlayCard rentPlay={rentPlayContract} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <MoneylineBetCard moneyline={moneylineBetContract} />
          <SmartParlayBuilder parlay={smartParlayContract} />
        </div>

        <Watchlist watchlist={watchlistContract} isPreferredTeamLabel={isPreferredTeamLabel} />
        <DecisionSummary data={data} plan={plan} watchlist={watchlistContract} />
        <TechnicalEvidence data={data} currentBoard={currentBoard} intelligence={intelligence} performance={performance} advancedOpen={preferences.showAdvancedEvidence} />

        <nav className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7" aria-label="Dedicated product tabs" data-mc08a-secondary-tabs="true">
          {[
            ['Most Likely', '/most-likely'],
            ['Best Value', '/best-value'],
            ['Performance', '/performance'],
            [t('settings'), '/settings'],
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
