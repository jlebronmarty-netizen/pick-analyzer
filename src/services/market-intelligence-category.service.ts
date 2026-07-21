import 'server-only'

import type { CurrentBoardCandidate } from '@/services/current-board.service'

export type MarketIntelligenceCategory = 'official' | 'ai_lean' | 'watchlist' | 'avoid'
export type MarketIntelligenceStatusLabel = 'Official' | 'AI Lean' | 'Watchlist' | 'Avoid'
export type CanonicalMarketState =
  | 'OFFICIAL'
  | 'AI_LEAN'
  | 'WATCHLIST'
  | 'AVOID'
  | 'NO_MARKET'
  | 'STALE'
  | 'INVALID'
  | 'QUARANTINED'
  | 'INSUFFICIENT_DATA'
  | 'SHADOW'

export type MarketIntelligenceClassification = {
  category: MarketIntelligenceCategory
  canonicalState: CanonicalMarketState
  label: MarketIntelligenceStatusLabel
  display: string
  color: 'green' | 'yellow' | 'blue' | 'red'
  warning: string | null
  reasonNotOfficial: string | null
  strengths: string[]
  weaknesses: string[]
  missingData: string[]
  primaryBlocker: string | null
  improvementPath: string | null
  valueQuality: 'POSITIVE' | 'THIN' | 'NEUTRAL' | 'NEGATIVE' | 'MATERIAL_NEGATIVE' | 'UNAVAILABLE'
  freshnessState: string
}

export const AI_LEAN_WARNING = "AI LEAN\nThe model slightly favors this outcome, but it did not satisfy Pick Analyzer's production recommendation policy.\nReview at your own discretion."
export const WATCHLIST_WARNING = 'WATCHLIST\nConditions may improve before game time.'
export const AVOID_WARNING = 'AVOID\nThe model recommends staying away.'
export const MATERIAL_NEGATIVE_EV_THRESHOLD = -20
export const MATERIAL_NEGATIVE_EDGE_THRESHOLD = -15

function firstReason(candidate: CurrentBoardCandidate) {
  return candidate.blockers[0] ??
    candidate.missingInformation[0] ??
    (candidate.expectedValue < 0 ? 'Negative EV at the current stored price.' : null) ??
    (candidate.edge < 0 ? 'Market price is weaker than model probability.' : null) ??
    (candidate.confidence < 60 ? 'Confidence below production threshold.' : null) ??
    'Did not satisfy Pick Analyzer production recommendation policy.'
}

function hasMarketOrContextPath(candidate: CurrentBoardCandidate) {
  const values = [...candidate.blockers, ...candidate.missingInformation].join(' ').toLowerCase()
  return /lineup|injur|bullpen|weather|market|odds|calibration|starter/.test(values)
}

function valueQuality(candidate: CurrentBoardCandidate): MarketIntelligenceClassification['valueQuality'] {
  const ev = candidate.marketAlignment?.snapshotExpectedValuePercent ?? candidate.expectedValue
  const edge = candidate.marketAlignment?.snapshotEdgePercentagePoints ?? candidate.edge
  if (!Number.isFinite(ev) || !Number.isFinite(edge)) return 'UNAVAILABLE'
  if (ev <= MATERIAL_NEGATIVE_EV_THRESHOLD || edge <= MATERIAL_NEGATIVE_EDGE_THRESHOLD) return 'MATERIAL_NEGATIVE'
  if (ev < 0 || edge < 0) return 'NEGATIVE'
  if (ev === 0 || edge === 0) return 'NEUTRAL'
  if (ev < 3 || edge < 2) return 'THIN'
  return 'POSITIVE'
}

function improvementPath(candidate: CurrentBoardCandidate) {
  const alignment = candidate.marketAlignment
  if (!alignment || alignment.alignmentStatus !== 'ALIGNED') return 'needs exact aligned market price'
  if (alignment.actionableUnavailableReason) return 'needs fresher market input'
  if ((alignment.snapshotExpectedValuePercent ?? candidate.expectedValue) <= 0 || (alignment.snapshotEdgePercentagePoints ?? candidate.edge) <= 0) return 'needs better price or stronger model probability'
  if (candidate.confidence < 60) return 'needs confidence closer to policy threshold'
  if (candidate.missingInformation[0]) return `needs ${candidate.missingInformation[0].replaceAll('_', ' ')}`
  return null
}

function pack(input: Omit<MarketIntelligenceClassification, 'primaryBlocker' | 'improvementPath' | 'valueQuality' | 'freshnessState'>, candidate: CurrentBoardCandidate): MarketIntelligenceClassification {
  return {
    ...input,
    primaryBlocker: input.reasonNotOfficial,
    improvementPath: input.category === 'watchlist' || input.category === 'ai_lean' ? improvementPath(candidate) : null,
    valueQuality: valueQuality(candidate),
    freshnessState: candidate.marketAlignment?.freshnessStatus ?? 'UNKNOWN',
  }
}

export function classifyMarketIntelligence(candidate: CurrentBoardCandidate): MarketIntelligenceClassification {
  const official =
    candidate.officialEligibility === 'OFFICIAL_ELIGIBLE_CANDIDATE' &&
    ['QUALIFIED', 'BEST_BET_CANDIDATE', 'PLAY_OF_DAY_CANDIDATE'].includes(candidate.recommendationPolicyStatus)
  const strengths = candidate.positiveFactors.slice(0, 4)
  const weaknesses = [
    ...candidate.negativeFactors,
    ...candidate.blockers.map((item) => item.replaceAll('_', ' ').toLowerCase()),
  ].slice(0, 4)
  const missingData = candidate.missingInformation.slice(0, 4)

  const quality = valueQuality(candidate)
  const freshness = candidate.marketAlignment?.freshnessStatus ?? 'UNKNOWN'
  const invalid =
    candidate.probabilityOrigin === 'fallback' ||
    candidate.probabilityOrigin === 'unavailable' ||
    candidate.leakageStatus === 'blocked' ||
    candidate.blockers.some((item) => /IDENTITY_CONFLICT|INVALID|POST_START|POST_CUTOFF|LIVE_ODDS/.test(item))
  const noMarket =
    !candidate.marketAlignment ||
    ['MISSING_PRICE', 'MISSING_PROBABILITY', 'UNSUPPORTED_MARKET', 'LINE_MISMATCH', 'SELECTION_MISMATCH'].includes(candidate.marketAlignment.alignmentStatus)
  const shadow = candidate.trial || candidate.scrambled || candidate.boardLabel === 'HISTORICAL'
  const quarantined = candidate.quarantined && !shadow
  const insufficient = candidate.confidence < 40 || (candidate.featureQuality ?? 100) < 40 || (candidate.dataSufficiency ?? 100) < 40

  if (!invalid && !noMarket && !quarantined && !shadow && freshness !== 'STALE' && freshness !== 'EXPIRED' && quality !== 'MATERIAL_NEGATIVE' && official) {
    return pack({
      category: 'official',
      canonicalState: 'OFFICIAL',
      label: 'Official',
      display: 'Official',
      color: 'green',
      warning: null,
      reasonNotOfficial: null,
      strengths,
      weaknesses,
      missingData,
    }, candidate)
  }

  if (invalid) {
    return pack({
      category: 'avoid',
      canonicalState: 'INVALID',
      label: 'Avoid',
      display: 'INVALID',
      color: 'red',
      warning: AVOID_WARNING,
      reasonNotOfficial: firstReason(candidate),
      strengths,
      weaknesses,
      missingData,
    }, candidate)
  }

  if (noMarket) {
    return pack({
      category: 'avoid',
      canonicalState: 'NO_MARKET',
      label: 'Avoid',
      display: 'NO MARKET',
      color: 'red',
      warning: AVOID_WARNING,
      reasonNotOfficial: firstReason(candidate),
      strengths,
      weaknesses,
      missingData,
    }, candidate)
  }

  if (shadow) {
    return pack({
      category: 'avoid',
      canonicalState: 'SHADOW',
      label: 'Avoid',
      display: 'SHADOW',
      color: 'red',
      warning: AVOID_WARNING,
      reasonNotOfficial: firstReason(candidate),
      strengths,
      weaknesses,
      missingData,
    }, candidate)
  }

  if (quarantined) {
    return pack({
      category: 'avoid',
      canonicalState: 'QUARANTINED',
      label: 'Avoid',
      display: 'QUARANTINED',
      color: 'red',
      warning: AVOID_WARNING,
      reasonNotOfficial: firstReason(candidate),
      strengths,
      weaknesses,
      missingData,
    }, candidate)
  }

  if (freshness === 'STALE' || freshness === 'EXPIRED') {
    return pack({
      category: 'avoid',
      canonicalState: 'STALE',
      label: 'Avoid',
      display: freshness,
      color: 'red',
      warning: AVOID_WARNING,
      reasonNotOfficial: 'Market input is stale, so snapshot value is not actionable.',
      strengths,
      weaknesses,
      missingData,
    }, candidate)
  }

  if (quality === 'MATERIAL_NEGATIVE') {
    return pack({
      category: 'avoid',
      canonicalState: 'AVOID',
      label: 'Avoid',
      display: 'AVOID',
      color: 'red',
      warning: AVOID_WARNING,
      reasonNotOfficial: 'Materially negative EV or edge at the stored price.',
      strengths,
      weaknesses,
      missingData,
    }, candidate)
  }

  if (insufficient) {
    return pack({
      category: 'avoid',
      canonicalState: 'INSUFFICIENT_DATA',
      label: 'Avoid',
      display: 'INSUFFICIENT DATA',
      color: 'red',
      warning: AVOID_WARNING,
      reasonNotOfficial: firstReason(candidate),
      strengths,
      weaknesses,
      missingData,
    }, candidate)
  }

  const modelSignal =
    candidate.modeledValueStatus === 'MODELED_VALUE' ||
    candidate.edge > 0 ||
    candidate.expectedValue > 0 ||
    (candidate.rawProbability >= 45 && candidate.confidence >= 45)

  const clearAvoid = candidate.confidence < 40

  if (modelSignal && !clearAvoid) {
    return pack({
      category: 'ai_lean',
      canonicalState: 'AI_LEAN',
      label: 'AI Lean',
      display: 'AI LEAN',
      color: 'yellow',
      warning: AI_LEAN_WARNING,
      reasonNotOfficial: firstReason(candidate),
      strengths,
      weaknesses,
      missingData,
    }, candidate)
  }

  if (hasMarketOrContextPath(candidate) && candidate.confidence >= 40 && candidate.rawProbability >= 35 && quality !== 'NEGATIVE') {
    return pack({
      category: 'watchlist',
      canonicalState: 'WATCHLIST',
      label: 'Watchlist',
      display: 'WATCHLIST',
      color: 'blue',
      warning: WATCHLIST_WARNING,
      reasonNotOfficial: firstReason(candidate),
      strengths,
      weaknesses,
      missingData,
    }, candidate)
  }

  return pack({
    category: 'avoid',
    canonicalState: 'AVOID',
    label: 'Avoid',
    display: 'AVOID',
    color: 'red',
    warning: AVOID_WARNING,
    reasonNotOfficial: firstReason(candidate),
    strengths,
    weaknesses,
    missingData,
  }, candidate)
}

export function summarizeMarketIntelligenceCategories(candidates: CurrentBoardCandidate[]) {
  const counts = {
    official: 0,
    aiLeans: 0,
    watchlist: 0,
    avoid: 0,
  }
  for (const candidate of candidates) {
    const classification = classifyMarketIntelligence(candidate)
    if (classification.category === 'official') counts.official += 1
    if (classification.category === 'ai_lean') counts.aiLeans += 1
    if (classification.category === 'watchlist') counts.watchlist += 1
    if (classification.category === 'avoid') counts.avoid += 1
  }
  return counts
}

export function emptyCategoryTrackRecord() {
  return {
    official: { count: 0, wins: 0, losses: 0, pushes: 0, roi: null, yield: null, accuracy: null, clv: null, confidence: null },
    aiLeans: { count: 0, wins: 0, losses: 0, pushes: 0, roi: null, yield: null, accuracy: null, clv: null, confidence: null },
    watchlist: { count: 0, wins: 0, losses: 0, pushes: 0, roi: null, yield: null, accuracy: null, clv: null, confidence: null },
    avoid: { count: 0, wins: 0, losses: 0, pushes: 0, roi: null, yield: null, accuracy: null, clv: null, confidence: null },
  }
}

export function validateMarketIntelligenceCategoryFixtures() {
  const base = {
    positiveFactors: ['Good probability'],
    negativeFactors: [],
    blockers: ['MISSING_LINEUP'],
    missingInformation: ['confirmed_lineup'],
    officialEligibility: 'NOT_OFFICIALLY_ELIGIBLE',
    modeledValueStatus: 'NO_MODELED_VALUE',
    edge: 0,
    expectedValue: 0,
    rawProbability: 50,
    confidence: 50,
    probabilityOrigin: 'calculated',
    recommendationPolicyStatus: 'ANALYZED_ONLY',
    marketAlignment: {
      alignmentStatus: 'ALIGNED',
      freshnessStatus: 'FRESH',
      snapshotExpectedValuePercent: 0,
      snapshotEdgePercentagePoints: 0,
      actionableExpectedValuePercent: 0,
      actionableEdgePercentagePoints: 0,
    },
    leakageStatus: 'passed',
    quarantined: false,
    trial: false,
    scrambled: false,
    boardLabel: 'CURRENT',
    featureQuality: 65,
    dataSufficiency: 65,
  } as unknown as CurrentBoardCandidate
  const checks = [
    ['official is green', classifyMarketIntelligence({ ...base, officialEligibility: 'OFFICIAL_ELIGIBLE_CANDIDATE', recommendationPolicyStatus: 'QUALIFIED' }).category === 'official'],
    ['official eligibility alone is not official', classifyMarketIntelligence({ ...base, officialEligibility: 'OFFICIAL_ELIGIBLE_CANDIDATE', recommendationPolicyStatus: 'ANALYZED_ONLY' }).category !== 'official'],
    ['ai lean has yellow category', classifyMarketIntelligence({ ...base, edge: 1, expectedValue: 1 }).category === 'ai_lean'],
    ['watchlist has blue category', classifyMarketIntelligence({ ...base, rawProbability: 41, confidence: 42, edge: -5, expectedValue: -8 }).category === 'watchlist'],
    ['avoid has red category', classifyMarketIntelligence({ ...base, rawProbability: 25, confidence: 35, edge: -20, expectedValue: -30 }).category === 'avoid'],
    ['material negative EV cannot be watchlist', classifyMarketIntelligence({
      ...base,
      rawProbability: 55,
      confidence: 65,
      edge: -20,
      expectedValue: -30,
      marketAlignment: { ...base.marketAlignment, snapshotExpectedValuePercent: -30, snapshotEdgePercentagePoints: -20 } as CurrentBoardCandidate['marketAlignment'],
    }).canonicalState === 'AVOID'],
    ['production gate cannot hide negative value', classifyMarketIntelligence({
      ...base,
      blockers: ['PRODUCTION_GATE_BLOCKED'],
      edge: -20,
      expectedValue: -30,
      marketAlignment: { ...base.marketAlignment, snapshotExpectedValuePercent: -30, snapshotEdgePercentagePoints: -20 } as CurrentBoardCandidate['marketAlignment'],
    }).canonicalState === 'AVOID'],
    ['stale row is stale not watchlist', classifyMarketIntelligence({ ...base, marketAlignment: { freshnessStatus: 'STALE', alignmentStatus: 'ALIGNED', snapshotExpectedValuePercent: -2, snapshotEdgePercentagePoints: -1 } as CurrentBoardCandidate['marketAlignment'] }).canonicalState === 'STALE'],
    ['watchlist has improvement path', Boolean(classifyMarketIntelligence({ ...base, rawProbability: 41, confidence: 42, edge: 0, expectedValue: 0 }).improvementPath)],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'market_intelligence_category_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    officialThresholdsChanged: false,
    championRowsMutated: false,
    v7Promoted: false,
  }
}
