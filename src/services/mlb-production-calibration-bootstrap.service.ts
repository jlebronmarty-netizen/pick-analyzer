import type { PredictionEvaluationPolicyResult } from '@/services/prediction-evaluation-policy.service'

export const MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_V1 = {
  mode: 'mlb_production_calibration_bootstrap_v1',
  state: 'PRODUCTION_CALIBRATION_PROBATION',
  activationBoundary:
    'future_rows_written_by_deployed_mlb_production_calibration_bootstrap_v1_runtime',
  eligibleSport: 'baseball_mlb',
  eligibleMarkets: ['moneyline', 'run_line', 'spread', 'total'],
  recommendedPickSemantics: 'USER_RECOMMENDATION_OR_OFFICIAL_PICK_LEGACY_FLAG',
  probationaryRowsSetRecommendedPick: false,
  probationaryRowsSetProductionEligible: false,
  historicalReplayEligible: false,
} as const

type BootstrapInput = {
  sportKey: string
  market: string | null | undefined
  generatedAt: string | null | undefined
  cutoffAt: string | null | undefined
  commenceTime: string | null | undefined
  featureSnapshotId: string | null | undefined
  oddsSnapshotId: string | null | undefined
  oddsTimestamp: string | null | undefined
  modelVersion: string | null | undefined
  featureSetVersion: string | null | undefined
  trial?: boolean | null
  scrambled?: boolean | null
  modelRole?: string | null
  productionEvaluationPolicy: PredictionEvaluationPolicyResult | null | undefined
}

export type ProductionCalibrationBootstrapMetadata = {
  mode: typeof MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_V1.mode
  state: typeof MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_V1.state
  eligible: boolean
  calibrationCohortEligible: boolean
  calibrationStatus: 'insufficient_accumulating'
  activationBoundary: typeof MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_V1.activationBoundary
  futureOnly: true
  officialPickEligible: false
  officialPickPromoted: false
  userRecommendation: false
  recommendedPick: false
  productionEligibleLegacyFlag: false
  eligibleSport: typeof MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_V1.eligibleSport
  eligibleMarkets: readonly string[]
  blockedReasons: string[]
}

function timestamp(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function normalizedMarket(value: string | null | undefined) {
  const market = String(value ?? '').toLowerCase()
  if (market === 'h2h') return 'moneyline'
  return market
}

function hasText(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0
}

export function buildProductionCalibrationBootstrapMetadata(
  input: BootstrapInput
): ProductionCalibrationBootstrapMetadata {
  const blockedReasons: string[] = []
  const market = normalizedMarket(input.market)
  const generatedAt = timestamp(input.generatedAt)
  const cutoffAt = timestamp(input.cutoffAt)
  const commenceAt = timestamp(input.commenceTime)
  const oddsAt = timestamp(input.oddsTimestamp)
  const role = String(input.modelRole ?? '').toLowerCase()

  if (input.sportKey !== MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_V1.eligibleSport) {
    blockedReasons.push('UNSUPPORTED_SPORT')
  }
  if (!MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_V1.eligibleMarkets.includes(market as never)) {
    blockedReasons.push('UNSUPPORTED_MARKET')
  }
  if (input.trial === true) blockedReasons.push('TRIAL_ROW')
  if (input.scrambled === true) blockedReasons.push('SCRAMBLED_ROW')
  if (role === 'shadow' || role === 'challenger' || role === 'archived') {
    blockedReasons.push('NON_CHAMPION_MODEL_ROLE')
  }
  if (!hasText(input.featureSnapshotId)) blockedReasons.push('MISSING_FEATURE_SNAPSHOT')
  if (!hasText(input.oddsSnapshotId)) blockedReasons.push('MISSING_ODDS_SNAPSHOT')
  if (!hasText(input.modelVersion)) blockedReasons.push('MISSING_MODEL_VERSION')
  if (!hasText(input.featureSetVersion)) blockedReasons.push('MISSING_FEATURE_SET_VERSION')
  if (generatedAt === null) blockedReasons.push('MISSING_GENERATED_AT')
  if (cutoffAt === null) blockedReasons.push('MISSING_CUTOFF_AT')
  if (commenceAt === null) blockedReasons.push('MISSING_COMMENCE_TIME')
  if (oddsAt === null) blockedReasons.push('MISSING_ODDS_TIMESTAMP')
  if (generatedAt !== null && cutoffAt !== null && generatedAt > cutoffAt) {
    blockedReasons.push('PREDICTION_AFTER_CUTOFF')
  }
  if (generatedAt !== null && commenceAt !== null && generatedAt >= commenceAt) {
    blockedReasons.push('PREDICTION_AFTER_START')
  }
  if (oddsAt !== null && cutoffAt !== null && oddsAt > cutoffAt) {
    blockedReasons.push('ODDS_AFTER_CUTOFF')
  }
  if (input.productionEvaluationPolicy?.production_evaluable !== true) {
    blockedReasons.push('NOT_PRODUCTION_EVALUABLE_POLICY')
  }

  const eligible = blockedReasons.length === 0

  return {
    mode: MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_V1.mode,
    state: MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_V1.state,
    eligible,
    calibrationCohortEligible: eligible,
    calibrationStatus: 'insufficient_accumulating',
    activationBoundary: MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_V1.activationBoundary,
    futureOnly: true,
    officialPickEligible: false,
    officialPickPromoted: false,
    userRecommendation: false,
    recommendedPick: false,
    productionEligibleLegacyFlag: false,
    eligibleSport: MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_V1.eligibleSport,
    eligibleMarkets: MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_V1.eligibleMarkets,
    blockedReasons,
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export function hasProductionCalibrationBootstrapEligibility(
  featureSnapshot: unknown
) {
  const bootstrap = record(record(featureSnapshot).productionCalibrationBootstrap)
  return (
    bootstrap.mode === MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_V1.mode &&
    bootstrap.state === MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_V1.state &&
    bootstrap.eligible === true &&
    bootstrap.calibrationCohortEligible === true &&
    bootstrap.recommendedPick === false &&
    bootstrap.officialPickPromoted === false &&
    bootstrap.userRecommendation === false
  )
}

export function validateMlbProductionCalibrationBootstrapV1() {
  const policy: PredictionEvaluationPolicyResult = {
    mode: 'production_evaluation_policy_v1_3',
    prediction_valid: true,
    production_evaluable: true,
    recommendation_eligible: false,
    actionable: false,
    official_pick_eligible: false,
    production_evaluation_reasons: ['OK'],
    production_evaluation_warnings: ['CALIBRATION_IS_RECOMMENDATION_ONLY'],
    recommendation_gate_reasons: ['CALIBRATION_INSUFFICIENT'],
    production_scope: 'PROSPECTIVE_PRODUCTION_EVALUATION',
    notes: [],
  }
  const valid = buildProductionCalibrationBootstrapMetadata({
    sportKey: 'baseball_mlb',
    market: 'total',
    generatedAt: '2026-08-14T18:00:00.000Z',
    cutoffAt: '2026-08-14T22:50:00.000Z',
    commenceTime: '2026-08-14T23:00:00.000Z',
    featureSnapshotId: '11111111-1111-4111-8111-111111111111',
    oddsSnapshotId: 'odds-1',
    oddsTimestamp: '2026-08-14T17:59:00.000Z',
    modelVersion: 'fixture',
    featureSetVersion: 'fixture',
    trial: false,
    scrambled: false,
    modelRole: 'champion',
    productionEvaluationPolicy: policy,
  })
  const postStart = buildProductionCalibrationBootstrapMetadata({
    sportKey: 'baseball_mlb',
    market: 'total',
    generatedAt: '2026-08-15T00:00:00.000Z',
    cutoffAt: '2026-08-14T22:50:00.000Z',
    commenceTime: '2026-08-14T23:00:00.000Z',
    featureSnapshotId: '11111111-1111-4111-8111-111111111111',
    oddsSnapshotId: 'odds-1',
    oddsTimestamp: '2026-08-14T17:59:00.000Z',
    modelVersion: 'fixture',
    featureSetVersion: 'fixture',
    trial: false,
    scrambled: false,
    modelRole: 'champion',
    productionEvaluationPolicy: policy,
  })

  return {
    mode: 'mlb_production_calibration_bootstrap_v1_validation',
    passed:
      valid.eligible === true &&
      valid.recommendedPick === false &&
      valid.productionEligibleLegacyFlag === false &&
      valid.officialPickEligible === false &&
      hasProductionCalibrationBootstrapEligibility({
        productionCalibrationBootstrap: valid,
      }) &&
      postStart.eligible === false &&
      postStart.blockedReasons.includes('PREDICTION_AFTER_CUTOFF') &&
      postStart.blockedReasons.includes('PREDICTION_AFTER_START'),
    cases: { valid, postStart },
  }
}
