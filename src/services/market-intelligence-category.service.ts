import 'server-only'

import type { CurrentBoardCandidate } from '@/services/current-board.service'

export type MarketIntelligenceCategory = 'official' | 'ai_lean' | 'watchlist' | 'avoid'
export type MarketIntelligenceStatusLabel = 'Official' | 'AI Lean' | 'Watchlist' | 'Avoid'

export type MarketIntelligenceClassification = {
  category: MarketIntelligenceCategory
  label: MarketIntelligenceStatusLabel
  display: string
  color: 'green' | 'yellow' | 'blue' | 'red'
  warning: string | null
  reasonNotOfficial: string | null
  strengths: string[]
  weaknesses: string[]
  missingData: string[]
}

export const AI_LEAN_WARNING = "AI LEAN\nThe model slightly favors this outcome, but it did not satisfy Pick Analyzer's production recommendation policy.\nReview at your own discretion."
export const WATCHLIST_WARNING = 'WATCHLIST\nConditions may improve before game time.'
export const AVOID_WARNING = 'AVOID\nThe model recommends staying away.'

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

  if (official) {
    return {
      category: 'official',
      label: 'Official',
      display: 'Official',
      color: 'green',
      warning: null,
      reasonNotOfficial: null,
      strengths,
      weaknesses,
      missingData,
    }
  }

  const modelSignal =
    candidate.modeledValueStatus === 'MODELED_VALUE' ||
    candidate.edge > 0 ||
    candidate.expectedValue > 0 ||
    (candidate.rawProbability >= 45 && candidate.confidence >= 45)

  const clearAvoid =
    candidate.expectedValue < -20 ||
    candidate.edge < -15 ||
    candidate.confidence < 40 ||
    candidate.probabilityOrigin === 'fallback' ||
    candidate.probabilityOrigin === 'unavailable'

  if (modelSignal && !clearAvoid) {
    return {
      category: 'ai_lean',
      label: 'AI Lean',
      display: 'AI LEAN',
      color: 'yellow',
      warning: AI_LEAN_WARNING,
      reasonNotOfficial: firstReason(candidate),
      strengths,
      weaknesses,
      missingData,
    }
  }

  if (hasMarketOrContextPath(candidate) && candidate.confidence >= 40 && candidate.rawProbability >= 35) {
    return {
      category: 'watchlist',
      label: 'Watchlist',
      display: 'WATCHLIST',
      color: 'blue',
      warning: WATCHLIST_WARNING,
      reasonNotOfficial: firstReason(candidate),
      strengths,
      weaknesses,
      missingData,
    }
  }

  return {
    category: 'avoid',
    label: 'Avoid',
    display: 'AVOID',
    color: 'red',
    warning: AVOID_WARNING,
    reasonNotOfficial: firstReason(candidate),
    strengths,
    weaknesses,
    missingData,
  }
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
  } as unknown as CurrentBoardCandidate
  const checks = [
    ['official is green', classifyMarketIntelligence({ ...base, officialEligibility: 'OFFICIAL_ELIGIBLE_CANDIDATE', recommendationPolicyStatus: 'QUALIFIED' }).category === 'official'],
    ['official eligibility alone is not official', classifyMarketIntelligence({ ...base, officialEligibility: 'OFFICIAL_ELIGIBLE_CANDIDATE', recommendationPolicyStatus: 'ANALYZED_ONLY' }).category !== 'official'],
    ['ai lean has yellow category', classifyMarketIntelligence({ ...base, edge: 1, expectedValue: 1 }).category === 'ai_lean'],
    ['watchlist has blue category', classifyMarketIntelligence({ ...base, rawProbability: 41, confidence: 42, edge: -5, expectedValue: -8 }).category === 'watchlist'],
    ['avoid has red category', classifyMarketIntelligence({ ...base, rawProbability: 25, confidence: 35, edge: -20, expectedValue: -30 }).category === 'avoid'],
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
