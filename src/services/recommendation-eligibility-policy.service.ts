import {
  evaluateProductionDataGate,
  type ProductionGateResult,
} from '@/services/production-data-gate.service'

export type RecommendationStatus =
  | 'ANALYZED_ONLY'
  | 'INELIGIBLE'
  | 'WATCH'
  | 'QUALIFIED'
  | 'BEST_BET_CANDIDATE'
  | 'PLAY_OF_DAY_CANDIDATE'

export type RecommendationBlockerCode =
  | 'PRODUCTION_GATE_BLOCKED'
  | 'TRIAL_ROW'
  | 'SCRAMBLED_ROW'
  | 'QUARANTINED_ROW'
  | 'EVENT_NOT_FUTURE'
  | 'EVENT_ALREADY_SETTLED'
  | 'MISSING_EVENT'
  | 'MISSING_PARTICIPANTS'
  | 'UNSUPPORTED_MARKET'
  | 'MISSING_OFFERED_ODDS'
  | 'ODDS_AFTER_CUTOFF'
  | 'STALE_ODDS'
  | 'MISSING_FEATURE_SNAPSHOT'
  | 'MISSING_MODEL_VERSION'
  | 'MISSING_FEATURE_SET_VERSION'
  | 'INVALID_PROBABILITY'
  | 'LOW_DATA_QUALITY'
  | 'LOW_DATA_SUFFICIENCY'
  | 'CALIBRATION_INSUFFICIENT'
  | 'LOW_CONFIDENCE'
  | 'LOW_MODEL_PROBABILITY'
  | 'NON_POSITIVE_EDGE'
  | 'NON_POSITIVE_EV'
  | 'LOW_EDGE'
  | 'LOW_EV'
  | 'UNRESOLVED_CRITICAL_MAPPINGS'
  | 'DUPLICATE_RECOMMENDATION_IDENTITY'
  | 'CRITICAL_WARNING'

export type RecommendationEligibilityInput = {
  id?: string | null
  sport_key?: string | null
  sportKey?: string | null
  game_id?: string | null
  gameId?: string | null
  commence_time?: string | null
  commenceTime?: string | null
  home_team?: string | null
  homeTeam?: string | null
  away_team?: string | null
  awayTeam?: string | null
  team?: string | null
  opponent?: string | null
  market?: string | null
  sportsbook?: string | null
  odds?: number | null
  implied_probability?: number | null
  impliedProbability?: number | null
  model_probability?: number | null
  modelProbability?: number | null
  confidence?: number | null
  edge?: number | null
  ev?: number | null
  expectedValue?: number | null
  production_eligible?: boolean | null
  productionEligible?: boolean | null
  trial?: boolean | null
  scrambled?: boolean | null
  status?: string | null
  result?: string | null
  recommended_pick?: boolean | null
  recommendedPick?: boolean | null
  odds_timestamp?: string | null
  oddsTimestamp?: string | null
  generated_at?: string | null
  generatedAt?: string | null
  cutoff_at?: string | null
  cutoffAt?: string | null
  model_version?: string | null
  modelVersion?: string | null
  feature_snapshot_id?: string | null
  featureSnapshotId?: string | null
  feature_set_version?: string | null
  featureSetVersion?: string | null
  feature_snapshot_generated_at?: string | null
  featureSnapshotGeneratedAt?: string | null
  feature_snapshot?: Record<string, unknown> | null
  featureSnapshot?: Record<string, unknown> | null
  data_quality_score?: number | null
  dataQualityScore?: number | null
  data_sufficiency_score?: number | null
  dataSufficiencyScore?: number | null
  unresolvedCriticalMappings?: number | null
  validation_warnings?: string[] | null
  validationWarnings?: string[] | null
  duplicateIdentity?: boolean | null
  calibrationStatus?: 'insufficient' | 'probationary' | 'acceptable' | 'mature'
}

export type RecommendationEligibilityResult = {
  mode: 'recommendation_eligibility_policy_v1'
  status: RecommendationStatus
  officialPickEligible: boolean
  topPicksEligible: boolean
  playOfDayEligible: boolean
  blockers: RecommendationBlockerCode[]
  warnings: string[]
  labels: {
    recommendation: string
    confidence: 'Low' | 'Medium' | 'High' | 'Very High'
    reliability: 'Limited data' | 'Developing' | 'Solid' | 'Strong'
    value: 'No modeled value' | 'Thin value' | 'Positive value' | 'Strong value'
  }
  thresholds: typeof RECOMMENDATION_THRESHOLDS_V1
  productionGate: ProductionGateResult
}

export const RECOMMENDATION_THRESHOLDS_V1 = {
  mode: 'recommendation_thresholds_v1',
  automaticProductionApproval: false,
  calibrationStatusUntilThirtyDaySample: 'probationary',
  minimumEdge: 3,
  minimumOfficialEdge: 5,
  minimumBestBetEdge: 7,
  minimumPlayOfDayEdge: 8,
  minimumEv: 2,
  minimumOfficialEv: 5,
  minimumBestBetEv: 8,
  minimumPlayOfDayEv: 10,
  minimumModelProbability: 52,
  minimumConfidence: 60,
  minimumOfficialConfidence: 65,
  minimumBestBetConfidence: 72,
  minimumPlayOfDayConfidence: 75,
  minimumFeatureQuality: 60,
  minimumDataSufficiency: 60,
  maximumOddsAgeMinutes: 120,
  minimumCalibrationSample: 250,
  maximumCalibrationError: 8,
  minimumMarketSample: 50,
  maximumRecommendationsPerEvent: 1,
  maximumCorrelatedPicks: 0,
  maximumPicksPerDailySlate: 12,
  supportedMarkets: ['moneyline', 'spread', 'run_line', 'total'],
} as const

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function timestamp(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function isTruthy(value: unknown) {
  return value === true
}

function normalizedMarket(input: RecommendationEligibilityInput) {
  const market = String(input.market ?? '').toLowerCase()
  if (market === 'run_line') return 'run_line'
  return market
}

function snapshotValue(
  input: RecommendationEligibilityInput,
  key: string
) {
  const snapshot = input.feature_snapshot ?? input.featureSnapshot
  return snapshot && typeof snapshot === 'object' ? snapshot[key] : null
}

function qualityScore(input: RecommendationEligibilityInput) {
  return (
    numberValue(input.data_quality_score ?? input.dataQualityScore) ??
    numberValue(snapshotValue(input, 'featureQualityScore')) ??
    numberValue(snapshotValue(input, 'dataQualityScore')) ??
    0
  )
}

function sufficiencyScore(input: RecommendationEligibilityInput) {
  return (
    numberValue(input.data_sufficiency_score ?? input.dataSufficiencyScore) ??
    numberValue(snapshotValue(input, 'dataSufficiencyScore')) ??
    0
  )
}

function rowStatus(input: RecommendationEligibilityInput) {
  return String(input.status ?? input.result ?? 'pending').toLowerCase()
}

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
}

function hasFutureEvent(input: RecommendationEligibilityInput, now: Date) {
  const commence = timestamp(input.commence_time ?? input.commenceTime)
  return commence !== null && commence > now.getTime()
}

function hasValidParticipants(input: RecommendationEligibilityInput) {
  return (
    hasText(input.team) &&
    hasText(input.opponent) &&
    (hasText(input.home_team ?? input.homeTeam) ||
      hasText(input.away_team ?? input.awayTeam))
  )
}

function hasValidSnapshot(input: RecommendationEligibilityInput) {
  return hasText(input.feature_snapshot_id ?? input.featureSnapshotId)
}

function hasStaleOdds(input: RecommendationEligibilityInput, now: Date) {
  const oddsAt = timestamp(input.odds_timestamp ?? input.oddsTimestamp)
  if (oddsAt === null) return true

  const maxAgeMs = RECOMMENDATION_THRESHOLDS_V1.maximumOddsAgeMinutes * 60 * 1000
  return now.getTime() - oddsAt > maxAgeMs
}

function oddsAfterCutoff(input: RecommendationEligibilityInput) {
  const oddsAt = timestamp(input.odds_timestamp ?? input.oddsTimestamp)
  const cutoffAt = timestamp(input.cutoff_at ?? input.cutoffAt)
  return oddsAt !== null && cutoffAt !== null && oddsAt > cutoffAt
}

function confidenceLabel(confidence: number) {
  if (confidence >= 80) return 'Very High'
  if (confidence >= 70) return 'High'
  if (confidence >= 60) return 'Medium'
  return 'Low'
}

function reliabilityLabel(quality: number, sufficiency: number) {
  const score = Math.min(quality, sufficiency)
  if (score >= 85) return 'Strong'
  if (score >= 70) return 'Solid'
  if (score >= 55) return 'Developing'
  return 'Limited data'
}

function valueLabel(edge: number, ev: number) {
  if (edge <= 0 || ev <= 0) return 'No modeled value'
  if (
    edge >= RECOMMENDATION_THRESHOLDS_V1.minimumBestBetEdge &&
    ev >= RECOMMENDATION_THRESHOLDS_V1.minimumBestBetEv
  ) {
    return 'Strong value'
  }
  if (
    edge >= RECOMMENDATION_THRESHOLDS_V1.minimumOfficialEdge &&
    ev >= RECOMMENDATION_THRESHOLDS_V1.minimumOfficialEv
  ) {
    return 'Positive value'
  }
  return 'Thin value'
}

function recommendationLabel(status: RecommendationStatus) {
  if (status === 'PLAY_OF_DAY_CANDIDATE') return 'Play of the Day candidate'
  if (status === 'BEST_BET_CANDIDATE') return 'Best-bet candidate'
  if (status === 'QUALIFIED') return 'Qualified pick'
  if (status === 'WATCH') return 'Watch'
  return 'Not recommended'
}

export function isOfficialRecommendationStatus(status: RecommendationStatus) {
  return (
    status === 'QUALIFIED' ||
    status === 'BEST_BET_CANDIDATE' ||
    status === 'PLAY_OF_DAY_CANDIDATE'
  )
}

export function evaluateRecommendationEligibility(
  input: RecommendationEligibilityInput,
  options: { now?: Date; allowProbationaryPreview?: boolean } = {}
): RecommendationEligibilityResult {
  const now = options.now ?? new Date()
  const blockers: RecommendationBlockerCode[] = []
  const warnings: string[] = []
  const confidence = numberValue(input.confidence) ?? 0
  const edge = numberValue(input.edge) ?? 0
  const ev = numberValue(input.ev ?? input.expectedValue) ?? 0
  const modelProbability =
    numberValue(input.model_probability ?? input.modelProbability) ?? 0
  const impliedProbability =
    numberValue(input.implied_probability ?? input.impliedProbability) ?? 0
  const odds = numberValue(input.odds)
  const quality = qualityScore(input)
  const sufficiency = sufficiencyScore(input)
  const calibrationStatus = input.calibrationStatus ?? 'probationary'
  const productionGate = evaluateProductionDataGate(input, 'recommendations')

  if (!productionGate.eligible) blockers.push('PRODUCTION_GATE_BLOCKED')
  if (input.trial === true) blockers.push('TRIAL_ROW')
  if (input.scrambled === true) blockers.push('SCRAMBLED_ROW')
  if ((input.production_eligible ?? input.productionEligible) !== true) {
    blockers.push('QUARANTINED_ROW')
  }
  if (!hasText(input.game_id ?? input.gameId)) blockers.push('MISSING_EVENT')
  if (!hasFutureEvent(input, now)) blockers.push('EVENT_NOT_FUTURE')
  if (['win', 'loss', 'push', 'void', 'settled'].includes(rowStatus(input))) {
    blockers.push('EVENT_ALREADY_SETTLED')
  }
  if (!hasValidParticipants(input)) blockers.push('MISSING_PARTICIPANTS')
  if (!RECOMMENDATION_THRESHOLDS_V1.supportedMarkets.includes(normalizedMarket(input) as never)) {
    blockers.push('UNSUPPORTED_MARKET')
  }
  if (odds === null || odds === 0) blockers.push('MISSING_OFFERED_ODDS')
  if (oddsAfterCutoff(input)) blockers.push('ODDS_AFTER_CUTOFF')
  if (hasStaleOdds(input, now)) blockers.push('STALE_ODDS')
  if (!hasValidSnapshot(input)) blockers.push('MISSING_FEATURE_SNAPSHOT')
  if (!hasText(input.model_version ?? input.modelVersion)) {
    blockers.push('MISSING_MODEL_VERSION')
  }
  if (!hasText(input.feature_set_version ?? input.featureSetVersion)) {
    blockers.push('MISSING_FEATURE_SET_VERSION')
  }
  if (modelProbability <= 0 || modelProbability >= 100) {
    blockers.push('INVALID_PROBABILITY')
  }
  if (quality < RECOMMENDATION_THRESHOLDS_V1.minimumFeatureQuality) {
    blockers.push('LOW_DATA_QUALITY')
  }
  if (sufficiency < RECOMMENDATION_THRESHOLDS_V1.minimumDataSufficiency) {
    blockers.push('LOW_DATA_SUFFICIENCY')
  }
  if (calibrationStatus !== 'acceptable' && calibrationStatus !== 'mature') {
    blockers.push('CALIBRATION_INSUFFICIENT')
  }
  if (confidence < RECOMMENDATION_THRESHOLDS_V1.minimumOfficialConfidence) {
    blockers.push('LOW_CONFIDENCE')
  }
  if (modelProbability < RECOMMENDATION_THRESHOLDS_V1.minimumModelProbability) {
    blockers.push('LOW_MODEL_PROBABILITY')
  }
  if (edge <= 0) blockers.push('NON_POSITIVE_EDGE')
  if (ev <= 0) blockers.push('NON_POSITIVE_EV')
  if (edge < RECOMMENDATION_THRESHOLDS_V1.minimumOfficialEdge) {
    blockers.push('LOW_EDGE')
  }
  if (ev < RECOMMENDATION_THRESHOLDS_V1.minimumOfficialEv) {
    blockers.push('LOW_EV')
  }
  if (Number(input.unresolvedCriticalMappings ?? 0) > 0) {
    blockers.push('UNRESOLVED_CRITICAL_MAPPINGS')
  }
  if (isTruthy(input.duplicateIdentity)) {
    blockers.push('DUPLICATE_RECOMMENDATION_IDENTITY')
  }

  const validationWarnings = input.validation_warnings ?? input.validationWarnings ?? []
  if (validationWarnings.some((warning) => /leak|critical|postgame/i.test(warning))) {
    blockers.push('CRITICAL_WARNING')
  }

  const watchEligible =
    blockers.every((blocker) =>
      [
        'CALIBRATION_INSUFFICIENT',
        'LOW_CONFIDENCE',
        'LOW_EDGE',
        'LOW_EV',
        'LOW_DATA_QUALITY',
        'LOW_DATA_SUFFICIENCY',
      ].includes(blocker)
    ) &&
    edge > 0 &&
    ev > 0 &&
    modelProbability > impliedProbability

  let status: RecommendationStatus = 'INELIGIBLE'

  const officialBlockers = blockers.filter(
    (blocker) => blocker !== 'CALIBRATION_INSUFFICIENT' || !options.allowProbationaryPreview
  )

  if ((input.production_eligible ?? input.productionEligible) !== true) {
    status = 'ANALYZED_ONLY'
  } else if (officialBlockers.length === 0) {
    if (
      confidence >= RECOMMENDATION_THRESHOLDS_V1.minimumPlayOfDayConfidence &&
      edge >= RECOMMENDATION_THRESHOLDS_V1.minimumPlayOfDayEdge &&
      ev >= RECOMMENDATION_THRESHOLDS_V1.minimumPlayOfDayEv &&
      quality >= 75 &&
      sufficiency >= 75 &&
      calibrationStatus === 'mature'
    ) {
      status = 'PLAY_OF_DAY_CANDIDATE'
    } else if (
      confidence >= RECOMMENDATION_THRESHOLDS_V1.minimumBestBetConfidence &&
      edge >= RECOMMENDATION_THRESHOLDS_V1.minimumBestBetEdge &&
      ev >= RECOMMENDATION_THRESHOLDS_V1.minimumBestBetEv
    ) {
      status = 'BEST_BET_CANDIDATE'
    } else {
      status = 'QUALIFIED'
    }
  } else if (watchEligible) {
    status = 'WATCH'
  }

  if (calibrationStatus === 'probationary' || calibrationStatus === 'insufficient') {
    warnings.push(
      'Calibration sample is not mature enough for automatic official activation.'
    )
  }
  if (edge <= 0 || ev <= 0) {
    warnings.push('No modeled value: edge or EV is non-positive.')
  }

  return {
    mode: 'recommendation_eligibility_policy_v1',
    status,
    officialPickEligible: isOfficialRecommendationStatus(status),
    topPicksEligible: isOfficialRecommendationStatus(status),
    playOfDayEligible: status === 'PLAY_OF_DAY_CANDIDATE',
    blockers: Array.from(new Set(blockers)),
    warnings: Array.from(new Set(warnings)),
    labels: {
      recommendation: recommendationLabel(status),
      confidence: confidenceLabel(confidence),
      reliability: reliabilityLabel(quality, sufficiency),
      value: valueLabel(edge, ev),
    },
    thresholds: RECOMMENDATION_THRESHOLDS_V1,
    productionGate,
  }
}

export function validateRecommendationEligibilityPolicyV1() {
  const now = new Date('2026-07-14T12:00:00.000Z')
  const base: RecommendationEligibilityInput = {
    id: 'fixture:1',
    sport_key: 'baseball_mlb',
    game_id: 'game:1',
    commence_time: '2026-07-15T23:00:00.000Z',
    home_team: 'Home',
    away_team: 'Away',
    team: 'Home',
    opponent: 'Away',
    market: 'moneyline',
    sportsbook: 'FixtureBook',
    odds: -110,
    implied_probability: 52.38,
    model_probability: 61,
    confidence: 76,
    edge: 8.62,
    ev: 10,
    production_eligible: true,
    trial: false,
    scrambled: false,
    status: 'pending',
    odds_timestamp: '2026-07-14T11:30:00.000Z',
    generated_at: '2026-07-14T11:35:00.000Z',
    cutoff_at: '2026-07-15T22:50:00.000Z',
    model_version: 'fixture-model-v1',
    feature_snapshot_id: '00000000-0000-0000-0000-000000000001',
    feature_set_version: 'fixture-feature-v1',
    feature_snapshot_generated_at: '2026-07-14T11:34:00.000Z',
    data_quality_score: 80,
    data_sufficiency_score: 80,
    calibrationStatus: 'mature',
  }

  const cases = [
    ['positive edge qualifies', base, 'BEST_BET_CANDIDATE'],
    ['negative edge rejected', { ...base, edge: -1 }, 'INELIGIBLE'],
    ['negative EV rejected', { ...base, ev: -1 }, 'INELIGIBLE'],
    ['low quality rejected', { ...base, data_quality_score: 30 }, 'WATCH'],
    ['low sufficiency rejected', { ...base, data_sufficiency_score: 30 }, 'WATCH'],
    ['stale odds rejected', { ...base, odds_timestamp: '2026-07-14T08:00:00.000Z' }, 'INELIGIBLE'],
    ['quarantined rejected', { ...base, production_eligible: false }, 'ANALYZED_ONLY'],
    ['settled win not qualified', { ...base, status: 'win', result: 'win' }, 'INELIGIBLE'],
    ['settled loss not qualified', { ...base, status: 'loss', result: 'loss' }, 'INELIGIBLE'],
    ['play stricter than qualified', { ...base, confidence: 66, edge: 5.5, ev: 5.5 }, 'QUALIFIED'],
    ['preview never official', { ...base, production_eligible: false, edge: 20, ev: 20 }, 'ANALYZED_ONLY'],
    ['probationary calibration blocks', { ...base, calibrationStatus: 'probationary' }, 'WATCH'],
  ] as const

  const results = cases.map(([name, input, expectedStatus]) => {
    const result = evaluateRecommendationEligibility(input, { now })
    return {
      name,
      expectedStatus,
      actualStatus: result.status,
      passed: result.status === expectedStatus,
      blockers: result.blockers,
    }
  })

  return {
    mode: 'recommendation_eligibility_policy_validation_v1',
    passed: results.every((result) => result.passed),
    cases: results,
  }
}
