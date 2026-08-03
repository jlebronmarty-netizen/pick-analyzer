import {
  type RecommendationEligibilityInput,
  type RecommendationEligibilityResult,
} from '@/services/recommendation-eligibility-policy.service'

export type ProductionEvaluationReason =
  | 'OK'
  | 'MISSING_EVENT'
  | 'MISSING_PARTICIPANTS'
  | 'UNSUPPORTED_MARKET'
  | 'MISSING_SELECTION'
  | 'INVALID_PROBABILITY'
  | 'MISSING_MODEL_VERSION'
  | 'MISSING_FEATURE_SET_VERSION'
  | 'MISSING_FEATURE_SNAPSHOT'
  | 'TRIAL_ROW'
  | 'SCRAMBLED_ROW'
  | 'REPLAY_SCOPE'
  | 'BACKTEST_SCOPE'
  | 'SHADOW_SCOPE'
  | 'HISTORICAL_SCOPE'
  | 'LEGACY_SCOPE'
  | 'DUPLICATE_IDENTITY'
  | 'UNRESOLVED_CRITICAL_MAPPINGS'
  | 'PREDICTION_AFTER_CUTOFF'
  | 'ODDS_AFTER_CUTOFF'
  | 'FEATURE_SNAPSHOT_AFTER_PREDICTION'
  | 'CRITICAL_WARNING'

export type ProductionEvaluationWarning =
  | 'STALE_PRICE_EVIDENCE'
  | 'MISSING_PRICE_EVIDENCE'
  | 'LOW_CONFIDENCE_IS_RECOMMENDATION_ONLY'
  | 'LOW_EDGE_IS_RECOMMENDATION_ONLY'
  | 'LOW_EV_IS_RECOMMENDATION_ONLY'
  | 'CALIBRATION_IS_RECOMMENDATION_ONLY'
  | 'PRODUCTION_ELIGIBLE_LEGACY_FLAG_NOT_REQUIRED_FOR_EVALUATION'

export type PredictionEvaluationPolicyInput = RecommendationEligibilityInput & {
  productionScope?: string | null
  production_scope?: string | null
  modelRole?: string | null
  model_role?: string | null
}

export type PredictionEvaluationPolicyResult = {
  mode: 'production_evaluation_policy_v1_3'
  prediction_valid: boolean
  production_evaluable: boolean
  recommendation_eligible: boolean
  actionable: boolean
  official_pick_eligible: boolean
  production_evaluation_reasons: ProductionEvaluationReason[]
  production_evaluation_warnings: ProductionEvaluationWarning[]
  recommendation_gate_reasons: string[]
  production_scope: 'PROSPECTIVE_PRODUCTION_EVALUATION' | 'EXCLUDED_FROM_PRODUCTION_EVALUATION'
  notes: string[]
}

const SUPPORTED_MARKETS = new Set(['moneyline', 'spread', 'run_line', 'total'])

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
}

function finiteNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function timestamp(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function normalizedMarket(value: unknown) {
  const market = String(value ?? '').toLowerCase()
  if (market === 'h2h') return 'moneyline'
  return market
}

function normalizedScope(input: PredictionEvaluationPolicyInput) {
  return String(input.production_scope ?? input.productionScope ?? '').toLowerCase()
}

function normalizedModelRole(input: PredictionEvaluationPolicyInput) {
  return String(input.model_role ?? input.modelRole ?? '').toLowerCase()
}

function hasCriticalWarning(input: PredictionEvaluationPolicyInput) {
  const warnings = input.validation_warnings ?? input.validationWarnings ?? []
  return warnings.some((warning) => /leak|postgame|corrupt|critical/i.test(warning))
}

function hasValidParticipants(input: PredictionEvaluationPolicyInput) {
  return (
    hasText(input.team) &&
    hasText(input.opponent) &&
    (hasText(input.home_team ?? input.homeTeam) ||
      hasText(input.away_team ?? input.awayTeam))
  )
}

function hasStaleOdds(input: PredictionEvaluationPolicyInput, now: Date) {
  const oddsAt = timestamp(input.odds_timestamp ?? input.oddsTimestamp)
  if (oddsAt === null) return false
  return now.getTime() - oddsAt > 120 * 60 * 1000
}

export function evaluatePredictionEvaluationPolicy(
  input: PredictionEvaluationPolicyInput,
  recommendation: RecommendationEligibilityResult,
  options: { now?: Date } = {}
): PredictionEvaluationPolicyResult {
  const now = options.now ?? new Date()
  const reasons: ProductionEvaluationReason[] = []
  const warnings: ProductionEvaluationWarning[] = []
  const notes: string[] = [
    'Production evaluation measures valid pregame model output.',
    'Recommendation, actionability and Official Pick gates remain separate.',
  ]

  const modelProbability = finiteNumber(input.model_probability ?? input.modelProbability)
  const confidence = finiteNumber(input.confidence) ?? 0
  const edge = finiteNumber(input.edge) ?? 0
  const ev = finiteNumber(input.ev ?? input.expectedValue) ?? 0
  const odds = finiteNumber(input.odds)
  const cutoffAt = timestamp(input.cutoff_at ?? input.cutoffAt)
  const generatedAt = timestamp(input.generated_at ?? input.generatedAt)
  const oddsAt = timestamp(input.odds_timestamp ?? input.oddsTimestamp)
  const snapshotAt = timestamp(
    input.feature_snapshot_generated_at ?? input.featureSnapshotGeneratedAt
  )
  const scope = normalizedScope(input)
  const role = normalizedModelRole(input)

  if (!hasText(input.game_id ?? input.gameId)) reasons.push('MISSING_EVENT')
  if (!hasValidParticipants(input)) reasons.push('MISSING_PARTICIPANTS')
  if (!SUPPORTED_MARKETS.has(normalizedMarket(input.market))) reasons.push('UNSUPPORTED_MARKET')
  if (!hasText(input.team)) reasons.push('MISSING_SELECTION')
  if (modelProbability === null || modelProbability <= 0 || modelProbability >= 100) {
    reasons.push('INVALID_PROBABILITY')
  }
  if (!hasText(input.model_version ?? input.modelVersion)) reasons.push('MISSING_MODEL_VERSION')
  if (!hasText(input.feature_set_version ?? input.featureSetVersion)) {
    reasons.push('MISSING_FEATURE_SET_VERSION')
  }
  if (!hasText(input.feature_snapshot_id ?? input.featureSnapshotId)) {
    reasons.push('MISSING_FEATURE_SNAPSHOT')
  }
  if (input.trial === true) reasons.push('TRIAL_ROW')
  if (input.scrambled === true) reasons.push('SCRAMBLED_ROW')
  if (/replay/.test(scope)) reasons.push('REPLAY_SCOPE')
  if (/backtest/.test(scope)) reasons.push('BACKTEST_SCOPE')
  if (/historical/.test(scope)) reasons.push('HISTORICAL_SCOPE')
  if (/legacy/.test(scope)) reasons.push('LEGACY_SCOPE')
  if (/shadow/.test(scope) || role === 'shadow') reasons.push('SHADOW_SCOPE')
  if (input.duplicateIdentity === true) reasons.push('DUPLICATE_IDENTITY')
  if (Number(input.unresolvedCriticalMappings ?? 0) > 0) {
    reasons.push('UNRESOLVED_CRITICAL_MAPPINGS')
  }
  if (generatedAt !== null && cutoffAt !== null && generatedAt > cutoffAt) {
    reasons.push('PREDICTION_AFTER_CUTOFF')
  }
  if (oddsAt !== null && cutoffAt !== null && oddsAt > cutoffAt) {
    reasons.push('ODDS_AFTER_CUTOFF')
  }
  if (snapshotAt !== null && generatedAt !== null && snapshotAt > generatedAt) {
    reasons.push('FEATURE_SNAPSHOT_AFTER_PREDICTION')
  }
  if (hasCriticalWarning(input)) reasons.push('CRITICAL_WARNING')

  if (hasStaleOdds(input, now)) warnings.push('STALE_PRICE_EVIDENCE')
  if (odds === null || odds === 0) warnings.push('MISSING_PRICE_EVIDENCE')
  if (confidence < 65) warnings.push('LOW_CONFIDENCE_IS_RECOMMENDATION_ONLY')
  if (edge <= 0 || edge < 5) warnings.push('LOW_EDGE_IS_RECOMMENDATION_ONLY')
  if (ev <= 0 || ev < 5) warnings.push('LOW_EV_IS_RECOMMENDATION_ONLY')
  if (recommendation.blockers.includes('CALIBRATION_INSUFFICIENT')) {
    warnings.push('CALIBRATION_IS_RECOMMENDATION_ONLY')
  }
  if ((input.production_eligible ?? input.productionEligible) !== true) {
    warnings.push('PRODUCTION_ELIGIBLE_LEGACY_FLAG_NOT_REQUIRED_FOR_EVALUATION')
  }

  const uniqueReasons = Array.from(new Set(reasons))
  const uniqueWarnings = Array.from(new Set(warnings))
  const predictionValid = !uniqueReasons.some((reason) =>
    [
      'MISSING_EVENT',
      'MISSING_PARTICIPANTS',
      'UNSUPPORTED_MARKET',
      'MISSING_SELECTION',
      'INVALID_PROBABILITY',
      'MISSING_MODEL_VERSION',
      'MISSING_FEATURE_SET_VERSION',
      'MISSING_FEATURE_SNAPSHOT',
      'CRITICAL_WARNING',
    ].includes(reason)
  )
  const productionEvaluable = uniqueReasons.length === 0

  return {
    mode: 'production_evaluation_policy_v1_3',
    prediction_valid: predictionValid,
    production_evaluable: productionEvaluable,
    recommendation_eligible: recommendation.topPicksEligible,
    actionable: recommendation.topPicksEligible,
    official_pick_eligible: recommendation.officialPickEligible,
    production_evaluation_reasons: productionEvaluable ? ['OK'] : uniqueReasons,
    production_evaluation_warnings: uniqueWarnings,
    recommendation_gate_reasons: recommendation.blockers,
    production_scope: productionEvaluable
      ? 'PROSPECTIVE_PRODUCTION_EVALUATION'
      : 'EXCLUDED_FROM_PRODUCTION_EVALUATION',
    notes,
  }
}

export function validatePredictionEvaluationPolicyV1_3() {
  const now = new Date('2026-08-03T12:00:00.000Z')
  const base: PredictionEvaluationPolicyInput = {
    id: 'fixture:policy:1',
    sport_key: 'baseball_mlb',
    game_id: 'event:1',
    commence_time: '2026-08-03T23:00:00.000Z',
    home_team: 'Home',
    away_team: 'Away',
    team: 'Home',
    opponent: 'Away',
    market: 'moneyline',
    sportsbook: 'FixtureBook',
    odds: -110,
    implied_probability: 52.38,
    model_probability: 54,
    confidence: 45,
    edge: 1,
    ev: -1,
    production_eligible: false,
    trial: false,
    scrambled: false,
    status: 'pending',
    odds_timestamp: '2026-08-03T09:00:00.000Z',
    generated_at: '2026-08-03T10:00:00.000Z',
    cutoff_at: '2026-08-03T22:50:00.000Z',
    model_version: 'fixture-model-v1',
    feature_snapshot_id: 'fixture-snapshot-1',
    feature_set_version: 'fixture-feature-v1',
    feature_snapshot_generated_at: '2026-08-03T09:59:00.000Z',
    data_quality_score: 80,
    data_sufficiency_score: 80,
    calibrationStatus: 'probationary',
  }
  const recommendation: RecommendationEligibilityResult = {
    mode: 'recommendation_eligibility_policy_v1',
    status: 'ANALYZED_ONLY',
    officialPickEligible: false,
    topPicksEligible: false,
    playOfDayEligible: false,
    blockers: [
      'PRODUCTION_GATE_BLOCKED',
      'QUARANTINED_ROW',
      'CALIBRATION_INSUFFICIENT',
      'LOW_CONFIDENCE',
      'NON_POSITIVE_EV',
      'LOW_EDGE',
      'LOW_EV',
    ],
    warnings: [],
    labels: {
      recommendation: 'Not recommended',
      confidence: 'Low',
      reliability: 'Solid',
      value: 'No modeled value',
    },
    thresholds: {} as RecommendationEligibilityResult['thresholds'],
    productionGate: {
      mode: 'production_data_gate_v1',
      consumer: 'recommendations',
      eligible: false,
      blockedReasons: ['production_eligible is not true'],
      warnings: [],
      requiredConditions: [],
    },
  }

  const validButNotRecommended = evaluatePredictionEvaluationPolicy(base, recommendation, { now })
  const afterCutoff = evaluatePredictionEvaluationPolicy(
    { ...base, generated_at: '2026-08-03T23:05:00.000Z' },
    recommendation,
    { now }
  )
  const shadow = evaluatePredictionEvaluationPolicy(
    { ...base, model_role: 'shadow' },
    recommendation,
    { now }
  )

  return {
    mode: 'production_evaluation_policy_v1_3_validation',
    passed:
      validButNotRecommended.prediction_valid === true &&
      validButNotRecommended.production_evaluable === true &&
      validButNotRecommended.recommendation_eligible === false &&
      validButNotRecommended.production_evaluation_warnings.includes(
        'LOW_CONFIDENCE_IS_RECOMMENDATION_ONLY'
      ) &&
      validButNotRecommended.production_evaluation_warnings.includes(
        'LOW_EV_IS_RECOMMENDATION_ONLY'
      ) &&
      afterCutoff.production_evaluable === false &&
      afterCutoff.production_evaluation_reasons.includes('PREDICTION_AFTER_CUTOFF') &&
      shadow.production_evaluable === false &&
      shadow.production_evaluation_reasons.includes('SHADOW_SCOPE'),
    cases: {
      validButNotRecommended,
      afterCutoff,
      shadow,
    },
  }
}
