import 'server-only'

import type { MarketAlignmentContract } from '@/services/market-alignment.service'
import { RECOMMENDATION_THRESHOLDS_V1 } from '@/services/recommendation-eligibility-policy.service'

export type RecommendationExplanationCategory = 'official' | 'ai_lean' | 'watchlist' | 'model_only' | 'pass' | 'avoid'
export type RecommendationEvidenceSeverity = 'positive' | 'neutral' | 'warning' | 'negative'

export type RecommendationEvidenceItem = {
  code: string
  label: string
  value: string | number | null
  severity: RecommendationEvidenceSeverity
  sourceField: string
  text: string
}

export type RecommendationExplanation = {
  explanationVersion: 'recommendation_explanation_v1'
  category: RecommendationExplanationCategory
  headline: string
  summary: string
  primaryReasons: RecommendationEvidenceItem[]
  secondaryReasons: RecommendationEvidenceItem[]
  blockers: RecommendationEvidenceItem[]
  promotionConditions: string[]
  riskWarnings: RecommendationEvidenceItem[]
  evidence: RecommendationEvidenceItem[]
  alignmentStatus: string
  freshnessStatus: string
  confidenceStatus: 'MEETS_OFFICIAL_THRESHOLD' | 'BELOW_OFFICIAL_THRESHOLD' | 'UNAVAILABLE'
  valueStatus: 'POSITIVE_VALUE' | 'NEGATIVE_VALUE' | 'ZERO_VALUE' | 'UNAVAILABLE'
  actionLabel: 'Official Pick' | 'AI Lean' | 'Watchlist' | 'Model Only' | 'Pass' | 'Avoid'
  fairOdds: number | null
  fairOddsLabel: string | null
  calculationVersion: 'recommendation_explanation_v1'
}

type ExplanationInput = {
  category: RecommendationExplanationCategory
  recommendationLabel?: string | null
  marketAlignment?: MarketAlignmentContract | null
  confidence?: number | null
  featureQuality?: number | null
  dataSufficiency?: number | null
  blockers?: string[]
  missingInformation?: string[]
  sportsbook?: string | null
  marketLabel?: string | null
  selection?: string | null
}

function finite(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function one(value: number | null | undefined, suffix = '%') {
  const parsed = finite(value)
  return parsed === null ? 'n/a' : `${parsed.toFixed(1)}${suffix}`
}

function signed(value: number | null | undefined, suffix = '') {
  const parsed = finite(value)
  return parsed === null ? 'n/a' : `${parsed > 0 ? '+' : ''}${parsed.toFixed(1)}${suffix}`
}

export function decimalToAmerican(decimalOdds: number | null | undefined) {
  const decimal = finite(decimalOdds)
  if (decimal === null || decimal <= 1) return null
  if (decimal >= 2) return Math.round((decimal - 1) * 100)
  return Math.round(-100 / (decimal - 1))
}

export function fairAmericanOddsFromProbability(modelProbability: number | null | undefined) {
  const probability = finite(modelProbability)
  if (probability === null || probability <= 0 || probability >= 100) return null
  return decimalToAmerican(1 / (probability / 100))
}

function evidence(
  code: string,
  label: string,
  value: string | number | null,
  severity: RecommendationEvidenceSeverity,
  sourceField: string,
  text: string
): RecommendationEvidenceItem {
  return { code, label, value, severity, sourceField, text }
}

function uniqueItems(items: RecommendationEvidenceItem[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.code)) return false
    seen.add(item.code)
    return true
  })
}

const BLOCKER_PRIORITY: Record<string, number> = {
  FRESHNESS_BLOCKER: 1,
  MISSING_ALIGNED_PRICE: 2,
  LINE_MISMATCH: 3,
  SELECTION_MISMATCH: 4,
  NON_POSITIVE_EV: 5,
  NON_POSITIVE_EDGE: 6,
  LOW_CONFIDENCE: 7,
  UNSUPPORTED_MARKET: 8,
  PRODUCTION_GATE_BLOCKED: 20,
}

function priorityItems(items: RecommendationEvidenceItem[]) {
  return [...items].sort((a, b) => (BLOCKER_PRIORITY[a.code] ?? 10) - (BLOCKER_PRIORITY[b.code] ?? 10))
}

function confidenceStatus(confidence: number | null) {
  if (confidence === null) return 'UNAVAILABLE' as const
  return confidence >= RECOMMENDATION_THRESHOLDS_V1.minimumOfficialConfidence
    ? 'MEETS_OFFICIAL_THRESHOLD' as const
    : 'BELOW_OFFICIAL_THRESHOLD' as const
}

function valueStatus(ev: number | null) {
  if (ev === null) return 'UNAVAILABLE' as const
  if (ev > 0) return 'POSITIVE_VALUE' as const
  if (ev < 0) return 'NEGATIVE_VALUE' as const
  return 'ZERO_VALUE' as const
}

function headline(category: RecommendationExplanationCategory, ev: number | null, edge: number | null, freshness: string) {
  if (category === 'official') return 'Qualified by current recommendation policy.'
  if (category === 'model_only') return 'Model-only probability view; not a betting recommendation.'
  if (category === 'pass') return 'Pass under the current price, freshness, data and policy conditions.'
  if (freshness === 'STALE') return 'Market input is stale, so this is not actionable right now.'
  if ((ev ?? 0) > 0 && (edge ?? 0) > 0) return category === 'ai_lean' ? 'The model sees value, but official gates are not fully met.' : 'The model sees value, but this still needs monitoring.'
  if ((ev ?? 0) < 0 || (edge ?? 0) < 0) return 'The current market price is more expensive than the model supports.'
  return category === 'avoid' ? 'This market is not supported by enough aligned value.' : 'This candidate needs better confirmation.'
}

function summary(category: RecommendationExplanationCategory, input: ExplanationInput, fairOdds: number | null) {
  const alignment = input.marketAlignment
  const model = one(alignment?.modelProbability)
  const implied = one(alignment?.marketImpliedProbability)
  const edge = signed(alignment?.edgePercentagePoints, ' pts')
  const ev = signed(alignment?.expectedValuePercent, '%')
  const base = `Model ${model} vs market ${implied}; edge ${edge}; EV ${ev}.`
  if (category === 'official') return `${base} This is the current stored recommendation category and uses the existing eligibility policy.`
  if (category === 'ai_lean') return `${base} It remains below Official Pick requirements or has a blocker.`
  if (category === 'watchlist') return `${base} Monitor for fresher market input, better price, or stronger model/data support.${fairOdds !== null ? ` Model fair odds are ${fairOdds > 0 ? '+' : ''}${fairOdds}.` : ''}`
  if (category === 'model_only') return `${base} This is model intelligence only; it is not eligible as an Official Pick and should not be treated as a play.`
  if (category === 'pass') return `${base} The correct user action is pass unless the market price, freshness or data quality changes.`
  return `${base} The evidence points away from a play at the current stored price.`
}

function primaryReasonItems(input: ExplanationInput) {
  const alignment = input.marketAlignment
  const edge = finite(alignment?.edgePercentagePoints)
  const ev = finite(alignment?.expectedValuePercent)
  const items: RecommendationEvidenceItem[] = []
  if (!alignment || alignment.alignmentStatus !== 'ALIGNED') {
    items.push(evidence(
      'MISSING_ALIGNED_PRICE',
      'Alignment',
      alignment?.alignmentStatus ?? 'MISSING',
      'negative',
      'marketAlignment.alignmentStatus',
      `Market comparison is ${alignment?.alignmentStatus ?? 'missing'}, so Edge and EV are not actionable.`
    ))
  }
  if (edge !== null && edge <= -10) {
    items.push(evidence('MARKET_PRICE_OVERVALUED', 'Market Price', signed(edge, ' pts'), 'negative', 'marketAlignment.edgePercentagePoints', 'The market is materially overpriced versus the model probability.'))
  }
  if (ev !== null && ev < 0) {
    items.push(evidence('NEGATIVE_EXPECTED_VALUE', 'Expected Value', signed(ev, '%'), 'negative', 'marketAlignment.expectedValuePercent', 'Expected value is negative at the selected stored price.'))
  }
  if (edge !== null && edge < 0 && edge > -10) {
    items.push(evidence('NEGATIVE_MODEL_EDGE', 'Model Edge', signed(edge, ' pts'), 'warning', 'marketAlignment.edgePercentagePoints', 'The market implied probability is higher than the model probability.'))
  }
  if (ev !== null && ev > 0 && edge !== null && edge > 0) {
    items.push(evidence('POSITIVE_VALUE_BELOW_THRESHOLD', 'Modeled Value', `${signed(edge, ' pts')} / ${signed(ev, '%')}`, 'positive', 'marketAlignment.edgePercentagePoints,marketAlignment.expectedValuePercent', 'The aligned price shows positive modeled value, but recommendation policy still controls Official Pick status.'))
  }
  if (ev === 0 || edge === 0) {
    items.push(evidence('ZERO_VALUE_EDGE', 'Modeled Value', `${signed(edge, ' pts')} / ${signed(ev, '%')}`, 'neutral', 'marketAlignment.edgePercentagePoints,marketAlignment.expectedValuePercent', 'The selected price is approximately fair to the model and does not show positive value.'))
  }
  return items
}

function secondaryReasonItems(input: ExplanationInput) {
  const alignment = input.marketAlignment
  const confidence = finite(input.confidence)
  const items: RecommendationEvidenceItem[] = []
  if (alignment?.freshnessStatus === 'STALE') {
    items.push(evidence('STALE_MARKET_INPUT', 'Market Freshness', alignment.marketAgeMinutes, 'warning', 'marketAlignment.marketAgeMinutes', `Selected market input is ${alignment.marketAgeMinutes ?? 'unknown'} minutes old.`))
  }
  if (confidence !== null && confidence < RECOMMENDATION_THRESHOLDS_V1.minimumOfficialConfidence) {
    items.push(evidence('LOW_CONFIDENCE', 'Confidence', one(confidence), 'warning', 'confidence', `Confidence is below the Official threshold of ${RECOMMENDATION_THRESHOLDS_V1.minimumOfficialConfidence}%.`))
  }
  if (finite(input.featureQuality) !== null && finite(input.featureQuality)! < RECOMMENDATION_THRESHOLDS_V1.minimumFeatureQuality) {
    items.push(evidence('INSUFFICIENT_DATA', 'Feature Quality', input.featureQuality ?? null, 'warning', 'featureQuality', 'Feature quality is below the policy threshold.'))
  }
  if (finite(input.dataSufficiency) !== null && finite(input.dataSufficiency)! < RECOMMENDATION_THRESHOLDS_V1.minimumDataSufficiency) {
    items.push(evidence('INSUFFICIENT_DATA_SUFFICIENCY', 'Data Sufficiency', input.dataSufficiency ?? null, 'warning', 'dataSufficiency', 'Data sufficiency is below the policy threshold.'))
  }
  return items
}

function blockerItems(input: ExplanationInput) {
  const blockers = [...(input.blockers ?? []), ...(input.marketAlignment?.reasonCodes ?? [])]
  return priorityItems(uniqueItems(blockers.filter(Boolean).map((code) => {
    if (code === 'STALE_INPUT' || code === 'STALE_ODDS') return evidence('FRESHNESS_BLOCKER', 'Freshness Blocker', code, 'warning', 'blockers,marketAlignment.reasonCodes', 'A fresher selected market input is required before this can be treated as actionable.')
    if (code === 'NON_POSITIVE_EV') return evidence('NON_POSITIVE_EV', 'Value Blocker', code, 'negative', 'blockers', 'Expected value is not positive.')
    if (code === 'NON_POSITIVE_EDGE') return evidence('NON_POSITIVE_EDGE', 'Edge Blocker', code, 'negative', 'blockers', 'Model edge is not positive.')
    if (code === 'LOW_CONFIDENCE') return evidence('LOW_CONFIDENCE', 'Confidence Blocker', code, 'warning', 'blockers', `Confidence must reach the existing Official threshold of ${RECOMMENDATION_THRESHOLDS_V1.minimumOfficialConfidence}%.`)
    if (code === 'UNSUPPORTED_MARKET') return evidence('UNSUPPORTED_MARKET', 'Market Blocker', code, 'negative', 'blockers', 'This market is not supported for current recommendations.')
    if (code === 'LINE_MISMATCH') return evidence('LINE_MISMATCH', 'Line Blocker', code, 'negative', 'marketAlignment.alignmentStatus', 'Prediction line and selected market line do not match.')
    if (code === 'SELECTION_MISMATCH') return evidence('SELECTION_MISMATCH', 'Selection Blocker', code, 'negative', 'marketAlignment.alignmentStatus', 'Prediction selection and selected market side do not match.')
    return evidence(code, 'Policy Blocker', code, 'warning', 'blockers', code.replaceAll('_', ' ').toLowerCase())
  })))
}

function promotionConditions(input: ExplanationInput, fairOdds: number | null) {
  const alignment = input.marketAlignment
  const conditions: string[] = []
  if (alignment?.freshnessStatus === 'STALE' && ((alignment?.expectedValuePercent ?? 0) <= 0 || (alignment?.edgePercentagePoints ?? 0) <= 0)) {
    conditions.push('Could improve if a fresh aligned price becomes available at a better market price.')
  }
  if (!alignment || alignment.alignmentStatus !== 'ALIGNED') conditions.push('Could become easier to evaluate if an exact aligned price is available.')
  if (alignment?.freshnessStatus === 'STALE') conditions.push('Could become eligible if market input refreshes before game start.')
  if ((alignment?.expectedValuePercent ?? 0) <= 0 || (alignment?.edgePercentagePoints ?? 0) <= 0) {
    conditions.push('Could improve if the market price becomes less expensive or model probability strengthens.')
  }
  const confidence = finite(input.confidence)
  if (confidence !== null && confidence < RECOMMENDATION_THRESHOLDS_V1.minimumOfficialConfidence) {
    conditions.push(`Could improve if confidence reaches the existing ${RECOMMENDATION_THRESHOLDS_V1.minimumOfficialConfidence}% Official threshold.`)
  }
  if (fairOdds !== null) conditions.push(`Model fair odds are ${fairOdds > 0 ? '+' : ''}${fairOdds}; this is not an Official threshold.`)
  return Array.from(new Set(conditions)).slice(0, 4)
}

export function buildRecommendationExplanation(input: ExplanationInput): RecommendationExplanation {
  const alignment = input.marketAlignment
  const confidence = finite(input.confidence)
  const fairOdds = fairAmericanOddsFromProbability(alignment?.modelProbability)
  const primaryReasons = uniqueItems(primaryReasonItems(input))
  const secondaryReasons = uniqueItems(secondaryReasonItems(input))
  const blockers = blockerItems(input)
  const riskWarnings = uniqueItems([
    ...(alignment?.risk === 'STALE_MARKET_INPUT' ? [evidence('STALE_MARKET_INPUT', 'Risk', alignment.risk, 'warning', 'marketAlignment.risk', 'Risk is elevated by stale market input.')] : []),
    ...(alignment?.risk === 'ELEVATED' ? [evidence('ELEVATED_RISK', 'Risk', alignment.risk, 'warning', 'marketAlignment.risk', 'Market alignment risk is elevated.')] : []),
  ])
  const evidenceItems = uniqueItems([
    ...primaryReasons,
    ...secondaryReasons,
    ...blockers,
    ...riskWarnings,
    evidence('MODEL_PROBABILITY', 'Model Probability', one(alignment?.modelProbability), 'neutral', 'marketAlignment.modelProbability', 'Stored model probability for the exact selected market.'),
    evidence('MARKET_IMPLIED_PROBABILITY', 'Market Implied', one(alignment?.marketImpliedProbability), 'neutral', 'marketAlignment.marketImpliedProbability', 'Raw implied probability from the selected American odds.'),
  ])
  const actionLabel =
    input.category === 'official' ? 'Official Pick' :
    input.category === 'ai_lean' ? 'AI Lean' :
    input.category === 'watchlist' ? 'Watchlist' :
    input.category === 'model_only' ? 'Model Only' :
    input.category === 'pass' ? 'Pass' :
    'Avoid'

  return {
    explanationVersion: 'recommendation_explanation_v1',
    category: input.category,
    headline: headline(input.category, finite(alignment?.expectedValuePercent), finite(alignment?.edgePercentagePoints), alignment?.freshnessStatus ?? 'UNKNOWN'),
    summary: summary(input.category, input, fairOdds),
    primaryReasons,
    secondaryReasons,
    blockers,
    promotionConditions: input.category === 'official' || input.category === 'avoid' || input.category === 'pass' ? [] : promotionConditions(input, fairOdds),
    riskWarnings,
    evidence: evidenceItems,
    alignmentStatus: alignment?.alignmentStatus ?? 'MISSING_PRICE',
    freshnessStatus: alignment?.freshnessStatus ?? 'UNKNOWN',
    confidenceStatus: confidenceStatus(confidence),
    valueStatus: valueStatus(finite(alignment?.expectedValuePercent)),
    actionLabel,
    fairOdds,
    fairOddsLabel: fairOdds === null ? null : `Model fair odds ${fairOdds > 0 ? '+' : ''}${fairOdds}`,
    calculationVersion: 'recommendation_explanation_v1',
  }
}

export function validateRecommendationExplanationFixtures() {
  const baseAlignment: MarketAlignmentContract = {
    alignmentStatus: 'ALIGNED',
    aligned: true,
    eventId: 'event-1',
    predictionId: 'prediction-1',
    oddsSnapshotId: 'odds-1',
    marketType: 'run_line',
    period: 'full_game',
    selection: 'SF',
    normalizedSelection: 'away',
    line: 1.5,
    americanOdds: -185,
    decimalOdds: 1.5405,
    sportsbook: 'Consensus',
    modelProbability: 44.01,
    calibratedProbability: null,
    marketImpliedProbability: 64.91,
    noVigProbability: null,
    edgePercentagePoints: -20.9,
    expectedValuePercent: -32.2,
    snapshotEdgePercentagePoints: -20.9,
    snapshotExpectedValuePercent: -32.2,
    actionableEdgePercentagePoints: null,
    actionableExpectedValuePercent: null,
    actionableUnavailableReason: 'STALE_MARKET_INPUT',
    marketInputTimestamp: new Date(Date.now() - 90 * 60000).toISOString(),
    providerSourceTimestamp: null,
    oddsIngestedAt: null,
    marketAgeMinutes: 90,
    providerSourceAgeMinutes: null,
    snapshotIngestionAgeMinutes: null,
    freshnessStatus: 'STALE',
    confidence: 45.15,
    risk: 'STALE_MARKET_INPUT',
    recommendationCategory: 'AVOID',
    reasonCodes: ['STALE_INPUT'],
    calculationVersion: 'market_alignment_v1',
  }
  const cases = [
    ['aligned positive EV', buildRecommendationExplanation({ category: 'ai_lean', marketAlignment: { ...baseAlignment, edgePercentagePoints: 3.2, expectedValuePercent: 4.8, freshnessStatus: 'FRESH', reasonCodes: [] }, confidence: 64 }).primaryReasons.some((item) => item.code === 'POSITIVE_VALUE_BELOW_THRESHOLD')],
    ['aligned negative EV primary reason', buildRecommendationExplanation({ category: 'avoid', marketAlignment: baseAlignment, confidence: 45 }).primaryReasons[0]?.code === 'MARKET_PRICE_OVERVALUED'],
    ['zero EV', buildRecommendationExplanation({ category: 'watchlist', marketAlignment: { ...baseAlignment, edgePercentagePoints: 0, expectedValuePercent: 0, freshnessStatus: 'FRESH', reasonCodes: [] }, confidence: 66 }).primaryReasons.some((item) => item.code === 'ZERO_VALUE_EDGE')],
    ['stale input warning', buildRecommendationExplanation({ category: 'watchlist', marketAlignment: baseAlignment, confidence: 55 }).secondaryReasons.some((item) => item.code === 'STALE_MARKET_INPUT')],
    ['fresh input no stale warning', !buildRecommendationExplanation({ category: 'ai_lean', marketAlignment: { ...baseAlignment, freshnessStatus: 'FRESH', marketAgeMinutes: 5, reasonCodes: [] }, confidence: 66 }).secondaryReasons.some((item) => item.code === 'STALE_MARKET_INPUT')],
    ['low confidence blocker', buildRecommendationExplanation({ category: 'ai_lean', marketAlignment: baseAlignment, confidence: 58 }).secondaryReasons.some((item) => item.code === 'LOW_CONFIDENCE')],
    ['missing probability', buildRecommendationExplanation({ category: 'avoid', marketAlignment: { ...baseAlignment, alignmentStatus: 'MISSING_PROBABILITY', modelProbability: null }, confidence: 60 }).alignmentStatus === 'MISSING_PROBABILITY'],
    ['missing price', buildRecommendationExplanation({ category: 'avoid', marketAlignment: { ...baseAlignment, alignmentStatus: 'MISSING_PRICE', americanOdds: null }, confidence: 60 }).alignmentStatus === 'MISSING_PRICE'],
    ['line mismatch', buildRecommendationExplanation({ category: 'avoid', marketAlignment: { ...baseAlignment, alignmentStatus: 'LINE_MISMATCH' }, confidence: 60 }).alignmentStatus === 'LINE_MISMATCH'],
    ['selection mismatch', buildRecommendationExplanation({ category: 'avoid', marketAlignment: { ...baseAlignment, alignmentStatus: 'SELECTION_MISMATCH' }, confidence: 60 }).alignmentStatus === 'SELECTION_MISMATCH'],
    ['unaligned market', buildRecommendationExplanation({ category: 'avoid', marketAlignment: { ...baseAlignment, alignmentStatus: 'UNSUPPORTED_MARKET' }, confidence: 60 }).alignmentStatus === 'UNSUPPORTED_MARKET'],
    ['official threshold blocker', buildRecommendationExplanation({ category: 'ai_lean', marketAlignment: baseAlignment, confidence: 58 }).promotionConditions.some((item) => item.includes('65%'))],
    ['multiple blockers', buildRecommendationExplanation({ category: 'watchlist', marketAlignment: baseAlignment, confidence: 40, blockers: ['LOW_CONFIDENCE', 'NON_POSITIVE_EV'] }).blockers.length >= 2],
    ['no duplicated reasons', new Set(buildRecommendationExplanation({ category: 'watchlist', marketAlignment: baseAlignment, blockers: ['STALE_INPUT', 'STALE_INPUT'] }).blockers.map((item) => item.code)).size === buildRecommendationExplanation({ category: 'watchlist', marketAlignment: baseAlignment, blockers: ['STALE_INPUT', 'STALE_INPUT'] }).blockers.length],
    ['reason priority', buildRecommendationExplanation({ category: 'avoid', marketAlignment: baseAlignment }).primaryReasons[0]?.code === 'MARKET_PRICE_OVERVALUED'],
    ['stale blocker priority', buildRecommendationExplanation({ category: 'watchlist', marketAlignment: baseAlignment, blockers: ['PRODUCTION_GATE_BLOCKED'] }).blockers[0]?.code === 'FRESHNESS_BLOCKER'],
    ['fresh aligned better price promotion', buildRecommendationExplanation({ category: 'watchlist', marketAlignment: baseAlignment }).promotionConditions[0]?.includes('fresh aligned price')],
    ['model fair odds label', buildRecommendationExplanation({ category: 'watchlist', marketAlignment: baseAlignment }).fairOddsLabel?.startsWith('Model fair odds') === true],
    ['fair odds above 50', fairAmericanOddsFromProbability(60) === -150],
    ['fair odds below 50', fairAmericanOddsFromProbability(40) === 150],
    ['fair odds exact 50', fairAmericanOddsFromProbability(50) === 100],
    ['invalid zero probability', fairAmericanOddsFromProbability(0) === null],
    ['rounding around even money', fairAmericanOddsFromProbability(49.9) === 100],
    ['no unsupported claims', !/bullpen|pitcher form|weather edge|injury advantage|sharp|line movement|lineup confirmation/i.test(buildRecommendationExplanation({ category: 'avoid', marketAlignment: baseAlignment }).summary)],
  ] as const
  const failedChecks = cases.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'recommendation_explanation_validation_v1',
    checks: cases.length,
    passed: cases.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
