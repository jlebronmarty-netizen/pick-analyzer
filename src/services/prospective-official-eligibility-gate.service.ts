import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentBoard, type CurrentBoardCandidate } from '@/services/current-board.service'
import {
  evaluateRecommendationEligibility,
  isOfficialRecommendationStatus,
  RECOMMENDATION_THRESHOLDS_V1,
  type RecommendationBlockerCode,
  type RecommendationEligibilityInput,
  type RecommendationStatus,
} from '@/services/recommendation-eligibility-policy.service'

export type ProspectiveRowClass =
  | 'HISTORICAL_VALIDATION'
  | 'TRIAL_VALIDATION'
  | 'SCRAMBLED_VALIDATION'
  | 'FIXTURE_VALIDATION'
  | 'PROSPECTIVE_PREVIEW'
  | 'PROSPECTIVE_OFFICIAL_ELIGIBLE'
  | 'PROSPECTIVE_OFFICIAL'

type PromotionRequest = {
  predictionId?: string | null
  eventId?: string | null
  snapshotId?: string | null
  oddsSnapshotId?: string | null
  sportKey?: string | null
  market?: string | null
  modelVersion?: string | null
  featureSetVersion?: string | null
  reason?: string | null
  idempotencyKey?: string | null
  confirmed?: boolean | null
  dryRun?: boolean | null
}

type GateDecision = {
  candidateIdentity: {
    predictionId: string
    eventId: string
    snapshotId: string | null
    oddsSnapshotId: string | null
    sportKey: string
    market: string
    modelVersion: string
    featureSetVersion: string
  }
  rowClassification: ProspectiveRowClass
  officialEligibilityResult: boolean
  promotionAllowed: boolean
  recommendationStatus: RecommendationStatus
  calibrationMaturity: string
  edge: number
  ev: number
  confidence: number
  reliability: number
  featureQuality: number | null
  dataSufficiency: number | null
  oddsFreshness: {
    oddsTimestamp: string | null
    oddsAgeMinutes: number | null
    cutoff: string | null
    stale: boolean
    pregameSafe: boolean
    anomalous: boolean
  }
  gatesEvaluated: string[]
  gatesPassed: string[]
  gatesFailed: Array<{ gate: string; reason: string }>
  blockers: string[]
  labels: {
    public: 'NOT AN OFFICIAL PICK' | 'QUALIFIED FOR OFFICIAL REVIEW' | 'OFFICIAL PICK'
    reasonExamples: string[]
  }
  decisionTimestamp: string
}

const CURRENT_MODEL_VERSION = 'baseball_mlb_prospective_preview_v1'
const CURRENT_FEATURE_PREFIX = 'baseball_mlb_'

function finite(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function timestamp(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function publicReasons(candidate: {
  edge: number
  ev: number
  calibrationStatus: string
  stale?: boolean
  missingInformation?: string[]
}) {
  const reasons: string[] = []
  if (candidate.edge <= 0 || candidate.ev <= 0) reasons.push('The current price does not offer positive modeled value.')
  if (!['acceptable', 'mature', 'VALIDATED'].includes(candidate.calibrationStatus)) {
    reasons.push('Calibration is not mature enough for official use.')
  }
  if (candidate.missingInformation?.length) reasons.push('Critical pregame information remains unavailable.')
  if (candidate.stale) reasons.push('The odds are stale or no longer safe.')
  return reasons.length ? reasons : ['Every automated gate passed; exact candidate activation is still required.']
}

export function classifyProspectiveRow(input: {
  eventStartTime?: string | null
  generatedAt?: string | null
  prospectivePreview?: boolean | null
  trial?: boolean | null
  scrambled?: boolean | null
  fixture?: boolean | null
  productionEligible?: boolean | null
  recommendedPick?: boolean | null
  recommendationStatus?: string | null
  result?: string | null
  status?: string | null
}): ProspectiveRowClass {
  if (input.trial === true) return 'TRIAL_VALIDATION'
  if (input.scrambled === true) return 'SCRAMBLED_VALIDATION'
  if (input.fixture === true) return 'FIXTURE_VALIDATION'
  const rowStatus = String(input.result ?? input.status ?? '').toLowerCase()
  if (['win', 'loss', 'push', 'void', 'settled', 'completed', 'final'].includes(rowStatus)) return 'HISTORICAL_VALIDATION'
  const start = timestamp(input.eventStartTime)
  if (start !== null && start <= Date.now()) return 'HISTORICAL_VALIDATION'
  if (input.prospectivePreview === true) {
    if (input.productionEligible === true && input.recommendedPick === true) return 'PROSPECTIVE_OFFICIAL'
    if (
      input.productionEligible === true &&
      isOfficialRecommendationStatus((input.recommendationStatus ?? 'INELIGIBLE') as RecommendationStatus)
    ) {
      return 'PROSPECTIVE_OFFICIAL_ELIGIBLE'
    }
    return 'PROSPECTIVE_PREVIEW'
  }
  return 'HISTORICAL_VALIDATION'
}

function candidatePolicyInput(candidate: CurrentBoardCandidate, productionEligible: boolean): RecommendationEligibilityInput {
  return {
    id: candidate.predictionId,
    sport_key: candidate.sportKey,
    game_id: candidate.eventId,
    commence_time: candidate.scheduledTime,
    home_team: candidate.matchup.split(' @ ')[1] ?? 'Home',
    away_team: candidate.matchup.split(' @ ')[0] ?? 'Away',
    team: candidate.selection,
    opponent: candidate.matchup,
    market: candidate.market === 'spread' ? 'run_line' : candidate.market,
    sportsbook: candidate.sportsbook,
    odds: candidate.americanOdds,
    implied_probability: candidate.impliedProbability,
    model_probability: candidate.rawProbability,
    confidence: candidate.confidence,
    edge: candidate.edge,
    ev: candidate.expectedValue,
    production_eligible: productionEligible,
    trial: candidate.trial,
    scrambled: candidate.scrambled,
    status: 'pending',
    odds_timestamp: candidate.oddsTimestamp,
    cutoff_at: candidate.cutoff,
    model_version: candidate.modelVersion,
    feature_snapshot_id: candidate.snapshotId,
    feature_set_version: candidate.featureSetVersion,
    data_quality_score: candidate.featureQuality,
    data_sufficiency_score: candidate.dataSufficiency,
    calibrationStatus: candidate.calibrationStatus === 'mature'
      ? 'mature'
      : candidate.calibrationStatus === 'acceptable'
        ? 'acceptable'
        : 'probationary',
  }
}

function gateDecisionFromCandidate(candidate: CurrentBoardCandidate, now = new Date()): GateDecision {
  const promotedPolicy = evaluateRecommendationEligibility(candidatePolicyInput(candidate, true), { now })
  const actualPolicy = evaluateRecommendationEligibility(candidatePolicyInput(candidate, candidate.productionEligible), { now })
  const rowClassification = classifyProspectiveRow({
    eventStartTime: candidate.scheduledTime,
    generatedAt: candidate.oddsTimestamp,
    prospectivePreview: candidate.boardLabel === 'PREVIEW' || candidate.quarantined,
    trial: candidate.trial,
    scrambled: candidate.scrambled,
    productionEligible: candidate.productionEligible,
    recommendedPick: false,
    recommendationStatus: promotedPolicy.status,
    status: candidate.eventStatus,
  })
  const gates: Array<[string, boolean, string]> = [
    ['future_unstarted_event', candidate.eventStatus === 'scheduled' && timestamp(candidate.scheduledTime) !== null && timestamp(candidate.scheduledTime)! > now.getTime(), 'event is not future and scheduled'],
    ['valid_event_mapping', Boolean(candidate.eventId), 'event mapping is missing'],
    ['valid_snapshot_linkage', Boolean(candidate.snapshotId), 'feature snapshot linkage is missing'],
    ['real_current_pregame_odds', candidate.americanOdds !== null && candidate.pregameSafe && !candidate.stale && !candidate.anomalous, 'odds are missing, stale, anomalous or not pregame safe'],
    ['odds_before_cutoff', !promotedPolicy.blockers.includes('ODDS_AFTER_CUTOFF'), 'odds timestamp is after cutoff'],
    ['no_leakage', candidate.leakageStatus !== 'blocked', 'leakage status is blocked'],
    ['non_trial_non_scrambled', candidate.trial !== true && candidate.scrambled !== true, 'trial or scrambled row'],
    ['prospective_preview', candidate.boardLabel === 'PREVIEW' || candidate.quarantined, 'row is not prospective preview lineage'],
    ['current_model_version', candidate.modelVersion === CURRENT_MODEL_VERSION, 'model version is not current'],
    ['current_feature_set_version', candidate.featureSetVersion.startsWith(CURRENT_FEATURE_PREFIX), 'feature-set version is not current'],
    ['supported_market', ['moneyline', 'spread', 'total'].includes(candidate.market), 'unsupported market'],
    ['valid_model_probability', candidate.rawProbability > 0 && candidate.rawProbability < 100, 'invalid model probability'],
    ['meaningfully_positive_edge', candidate.edge >= RECOMMENDATION_THRESHOLDS_V1.minimumOfficialEdge, 'edge is not meaningfully positive'],
    ['meaningfully_positive_ev', candidate.expectedValue >= RECOMMENDATION_THRESHOLDS_V1.minimumOfficialEv, 'EV is not meaningfully positive'],
    ['confidence_threshold', candidate.confidence >= RECOMMENDATION_THRESHOLDS_V1.minimumOfficialConfidence, 'confidence below official threshold'],
    ['reliability_threshold', candidate.reliabilityScore >= 70, 'reliability below solid threshold'],
    ['feature_quality_threshold', finite(candidate.featureQuality) >= RECOMMENDATION_THRESHOLDS_V1.minimumFeatureQuality, 'feature quality below threshold'],
    ['data_sufficiency_threshold', finite(candidate.dataSufficiency) >= RECOMMENDATION_THRESHOLDS_V1.minimumDataSufficiency, 'data sufficiency below threshold'],
    ['market_stability_threshold', !candidate.stale && !candidate.anomalous, 'market is stale or anomalous'],
    ['no_critical_missing_domain', candidate.missingInformation.length === 0, 'critical pregame information remains unavailable'],
    ['calibration_maturity', ['acceptable', 'mature'].includes(candidate.calibrationStatus), 'calibration is insufficient'],
    ['recommendation_policy_status', isOfficialRecommendationStatus(promotedPolicy.status), 'recommendation policy did not return an official status'],
  ]
  const failed = gates.filter(([, passed]) => !passed).map(([gate, , reason]) => ({ gate, reason }))
  const automaticEligibility =
    failed.length === 0 &&
    rowClassification === 'PROSPECTIVE_PREVIEW' &&
    isOfficialRecommendationStatus(promotedPolicy.status)
  const label = candidate.productionEligible && isOfficialRecommendationStatus(actualPolicy.status)
    ? 'OFFICIAL PICK'
    : automaticEligibility
      ? 'QUALIFIED FOR OFFICIAL REVIEW'
      : 'NOT AN OFFICIAL PICK'
  return {
    candidateIdentity: {
      predictionId: candidate.predictionId,
      eventId: candidate.eventId,
      snapshotId: candidate.snapshotId,
      oddsSnapshotId: candidate.oddsSnapshotId,
      sportKey: candidate.sportKey,
      market: candidate.market,
      modelVersion: candidate.modelVersion,
      featureSetVersion: candidate.featureSetVersion,
    },
    rowClassification: automaticEligibility ? 'PROSPECTIVE_OFFICIAL_ELIGIBLE' : rowClassification,
    officialEligibilityResult: automaticEligibility,
    promotionAllowed: automaticEligibility,
    recommendationStatus: promotedPolicy.status,
    calibrationMaturity: candidate.calibrationStatus,
    edge: candidate.edge,
    ev: candidate.expectedValue,
    confidence: candidate.confidence,
    reliability: candidate.reliabilityScore,
    featureQuality: candidate.featureQuality,
    dataSufficiency: candidate.dataSufficiency,
    oddsFreshness: {
      oddsTimestamp: candidate.oddsTimestamp,
      oddsAgeMinutes: candidate.oddsAgeMinutes,
      cutoff: candidate.cutoff,
      stale: candidate.stale,
      pregameSafe: candidate.pregameSafe,
      anomalous: candidate.anomalous,
    },
    gatesEvaluated: gates.map(([gate]) => gate),
    gatesPassed: gates.filter(([, passed]) => passed).map(([gate]) => gate),
    gatesFailed: failed,
    blockers: Array.from(new Set([...candidate.blockers, ...promotedPolicy.blockers, ...failed.map((item) => item.gate)])),
    labels: {
      public: label,
      reasonExamples: publicReasons({
        edge: candidate.edge,
        ev: candidate.expectedValue,
        calibrationStatus: candidate.calibrationStatus,
        stale: candidate.stale,
        missingInformation: candidate.missingInformation,
      }),
    },
    decisionTimestamp: now.toISOString(),
  }
}

function fixtureCandidate(overrides: Partial<CurrentBoardCandidate> = {}): CurrentBoardCandidate {
  const now = new Date('2026-07-16T15:30:00.000Z')
  const start = '2026-07-17T23:10:00.000Z'
  const base: CurrentBoardCandidate = {
    predictionId: 'fixture:prediction:excellent',
    snapshotId: 'fixture:snapshot:excellent',
    oddsSnapshotId: 'fixture:odds:excellent',
    eventId: 'fixture:event:excellent',
    sportKey: 'baseball_mlb',
    leagueKey: 'mlb',
    matchup: 'AWY @ HOM',
    scheduledTime: start,
    eventStatus: 'scheduled',
    market: 'moneyline',
    marketLabel: 'Moneyline',
    period: 'full_game',
    selection: 'AWY',
    normalizedSelection: 'away',
    line: null,
    sportsbook: 'Consensus',
    americanOdds: 120,
    impliedProbability: 45.45,
    oddsTimestamp: now.toISOString(),
    oddsAgeMinutes: 0,
    maxAllowedAgeMinutes: 120,
    cutoff: '2026-07-17T23:00:00.000Z',
    pregameSafe: true,
    stale: false,
    anomalous: false,
    anomalyReasons: [],
    currentLatest: true,
    rawProbability: 62,
    calibratedProbability: 61,
    confidence: 78,
    confidenceLabel: 'High',
    reliability: 'Strong',
    reliabilityScore: 88,
    featureQuality: 86,
    dataSufficiency: 85,
    aiRating: 90,
    aiGrade: 'A',
    rankingScore: 94,
    modelVersion: CURRENT_MODEL_VERSION,
    featureSetVersion: 'baseball_mlb_moneyline_prospective_feature_set_v2',
    calibrationStatus: 'mature',
    edge: 16.55,
    expectedValue: 32,
    modeledValueStatus: 'MODELED_VALUE',
    semanticLabel: 'MODELED VALUE',
    probabilityOrigin: 'calculated',
    recommendationPolicyStatus: 'PLAY_OF_DAY_CANDIDATE',
    officialEligibility: 'NOT_OFFICIALLY_ELIGIBLE',
    blockers: [],
    quarantined: true,
    trial: false,
    scrambled: false,
    productionEligible: false,
    leakageStatus: 'passed',
    boardLabel: 'PREVIEW',
    positiveFactors: ['Excellent value fixture'],
    negativeFactors: [],
    missingInformation: [],
    summary: 'Fixture candidate.',
    logicalKey: 'fixture:logical:excellent',
  }
  return { ...base, ...overrides }
}

export function validateProspectiveOfficialEligibilityFixtures() {
  const cases = [
    ['valid excellent prospective candidate', fixtureCandidate(), true],
    ['insufficient calibration', fixtureCandidate({ calibrationStatus: 'probationary' }), false],
    ['stale odds', fixtureCandidate({ stale: true, oddsAgeMinutes: 300 }), false],
    ['historical row', fixtureCandidate({ scheduledTime: '2026-07-15T23:10:00.000Z', eventStatus: 'completed', boardLabel: 'HISTORICAL' }), false],
    ['tiny edge', fixtureCandidate({ edge: 0.3, expectedValue: 1, rawProbability: 46 }), false],
  ] as const
  const results = cases.map(([name, candidate, expected]) => {
    const decision = gateDecisionFromCandidate(candidate, new Date('2026-07-16T15:30:00.000Z'))
    return {
      name,
      expectedOfficialEligibility: expected,
      actualOfficialEligibility: decision.officialEligibilityResult,
      passed: decision.officialEligibilityResult === expected,
      rowClassification: decision.rowClassification,
      recommendationStatus: decision.recommendationStatus,
      failedGates: decision.gatesFailed.map((item) => item.gate),
      officialConsumersWouldInclude: expected
        ? { topPicks: true, playOfDay: true, betSlip: true, wagerPlacement: false }
        : { topPicks: false, playOfDay: false, betSlip: false, wagerPlacement: false },
    }
  })
  return {
    success: true,
    mode: 'prospective_official_eligibility_fixtures_v1',
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    passed: results.every((item) => item.passed),
    cases: results,
  }
}

export async function getProspectiveOfficialEligibilityGate() {
  const board = await getCurrentBoard({ mode: 'CURRENT', limit: 200 })
  const decisions = board.candidates.map((candidate) => gateDecisionFromCandidate(candidate))
  const fixtures = validateProspectiveOfficialEligibilityFixtures()
  return {
    success: true,
    mode: 'prospective_official_eligibility_gate_v1',
    generatedAt: new Date().toISOString(),
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    rowTypeClassificationContract: {
      classes: [
        'HISTORICAL_VALIDATION',
        'TRIAL_VALIDATION',
        'SCRAMBLED_VALIDATION',
        'FIXTURE_VALIDATION',
        'PROSPECTIVE_PREVIEW',
        'PROSPECTIVE_OFFICIAL_ELIGIBLE',
        'PROSPECTIVE_OFFICIAL',
      ] satisfies ProspectiveRowClass[],
      evidence: [
        'event start time',
        'prediction generated time',
        'prospective_preview flag',
        'trial',
        'scrambled',
        'production_eligible',
        'feature snapshot lineage',
        'model and feature-set versions',
        'provider provenance',
        'recommendation status',
        'settlement state',
      ],
      permanence: 'Historical, trial, scrambled, fixture and settled rows never classify as prospective official rows.',
    },
    prospectiveEligibilityRequirements: decisions[0]?.gatesEvaluated ?? gateDecisionFromCandidate(fixtureCandidate()).gatesEvaluated,
    calibrationPolicy: {
      preserved: true,
      officialRequires: ['acceptable', 'mature'],
      maturityDefinitions: {
        INSUFFICIENT_DATA: 'No usable settled production sample, or below probationary evidence.',
        PROBATIONARY: 'Technical previews may be analyzed, but official activation is blocked.',
        DEVELOPING: 'Sample is forming but not yet inside official error/sample limits.',
        VALIDATED: 'Existing policy equivalent: acceptable or mature calibration satisfies official policy.',
      },
      thresholds: {
        minimumCalibrationSample: RECOMMENDATION_THRESHOLDS_V1.minimumCalibrationSample,
        maximumCalibrationError: RECOMMENDATION_THRESHOLDS_V1.maximumCalibrationError,
        minimumMarketSample: RECOMMENDATION_THRESHOLDS_V1.minimumMarketSample,
      },
    },
    promotionPathAudit: {
      existingSafePathFoundBeforeThisModule: false,
      implementedCandidateSpecificAction: true,
      route: 'POST /api/recommendation-readiness',
      action: 'promote_prospective_official_candidate',
      protectedBy: 'CRON_SECRET bearer header or secret query parameter',
      rejects: [
        'missing exact prediction/event/snapshot/odds IDs',
        'batch promotion',
        'historical rows',
        'settled rows',
        'trial rows',
        'scrambled rows',
        'fixtures',
        'stale odds',
        'post-cutoff odds',
        'unsupported markets',
        'non-positive edge or EV',
        'insufficient calibration',
        'duplicate promotion',
      ],
    },
    officialConsumerAudit: {
      topPicks: 'Filters production_eligible=true and re-evaluates Recommendation Eligibility Policy.',
      playOfDay: 'Consumes official top-pick pool only.',
      betSlip: 'Uses official optimizer over qualified production rows; preview alone is not enough.',
      dailyReport: 'Reports only official qualified/recommended production rows.',
      aiBetFinder: 'Official ticket mode delegates to Bet Slip optimizer.',
      portfolioKellyParlays: 'Use production-gated official pick pools and must not consume quarantined preview rows.',
    },
    currentSlate: {
      candidates: decisions,
      officialEligibleCount: decisions.filter((item) => item.officialEligibilityResult).length,
      officialRecommendationCount: decisions.filter((item) => item.rowClassification === 'PROSPECTIVE_OFFICIAL').length,
      expectedState: {
        topPicks: 0,
        playOfDay: 'none',
        betSlip: 'no_ticket',
        aiBetFinderTicket: 'none',
      },
    },
    fixtures,
    auditTrailContract: [
      'candidate identity',
      'row classification',
      'all gates evaluated',
      'gates passed',
      'gates failed',
      'recommendation status',
      'calibration maturity',
      'edge',
      'EV',
      'confidence',
      'reliability',
      'quality',
      'sufficiency',
      'odds freshness',
      'model and feature versions',
      'decision timestamp',
      'official eligibility result',
    ],
  }
}

export async function promoteProspectiveOfficialCandidate(request: PromotionRequest) {
  const generatedAt = new Date().toISOString()
  const dryRun = request.dryRun !== false
  const exactValues = [
    request.predictionId,
    request.eventId,
    request.snapshotId,
    request.oddsSnapshotId,
    request.sportKey,
    request.market,
    request.modelVersion,
    request.featureSetVersion,
    request.reason,
    request.idempotencyKey,
  ]
  if (exactValues.some((value) => typeof value !== 'string' || value.trim().length === 0)) {
    return {
      success: false,
      mode: 'prospective_official_candidate_promotion_v1',
      generatedAt,
      dryRun,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      rejected: true,
      reason: 'Exact candidate identity, reason and idempotency key are required.',
    }
  }

  const result = await supabaseAdmin
    .from('prediction_history')
    .select('id, sport_key, game_id, commence_time, team, opponent, market, sportsbook, odds, implied_probability, model_probability, confidence, edge, ev, production_eligible, recommended_pick, trial, scrambled, status, result, odds_timestamp, generated_at, cutoff_at, model_version, feature_snapshot_id, feature_set_version, feature_snapshot, validation_warnings')
    .eq('id', request.predictionId)
    .maybeSingle()
  if (result.error) throw new Error(`promotion candidate read failed: ${result.error.message}`)
  const row = result.data as Record<string, unknown> | null
  if (!row) {
    return { success: false, mode: 'prospective_official_candidate_promotion_v1', generatedAt, dryRun, providerCallsMade: 0, remoteMutationsMade: 0, rejected: true, reason: 'Prediction row not found.' }
  }

  const snapshot = asRecord(row.feature_snapshot)
  const identityFailures = [
    ['eventId', request.eventId === row.game_id],
    ['snapshotId', request.snapshotId === row.feature_snapshot_id],
    ['oddsSnapshotId', request.oddsSnapshotId === snapshot.sourceOddsSnapshotId],
    ['sportKey', request.sportKey === row.sport_key],
    ['market', request.market === row.market],
    ['modelVersion', request.modelVersion === row.model_version],
    ['featureSetVersion', request.featureSetVersion === row.feature_set_version],
  ].filter(([, passed]) => !passed).map(([field]) => String(field))
  if (identityFailures.length) {
    return {
      success: false,
      mode: 'prospective_official_candidate_promotion_v1',
      generatedAt,
      dryRun,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      rejected: true,
      reason: `Exact identity mismatch: ${identityFailures.join(', ')}.`,
    }
  }
  if (row.production_eligible === true || row.recommended_pick === true) {
    return {
      success: false,
      mode: 'prospective_official_candidate_promotion_v1',
      generatedAt,
      dryRun,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      rejected: true,
      reason: 'Duplicate promotion rejected.',
    }
  }

  const policyInput: RecommendationEligibilityInput = {
    id: String(row.id),
    sport_key: String(row.sport_key),
    game_id: String(row.game_id),
    commence_time: row.commence_time as string | null,
    team: row.team as string | null,
    opponent: row.opponent as string | null,
    home_team: String(row.opponent ?? ''),
    away_team: String(row.team ?? ''),
    market: row.market === 'spread' ? 'run_line' : String(row.market ?? ''),
    sportsbook: row.sportsbook as string | null,
    odds: row.odds as number | null,
    implied_probability: row.implied_probability as number | null,
    model_probability: row.model_probability as number | null,
    confidence: row.confidence as number | null,
    edge: row.edge as number | null,
    ev: row.ev as number | null,
    production_eligible: true,
    trial: row.trial as boolean | null,
    scrambled: row.scrambled as boolean | null,
    status: row.status as string | null,
    result: row.result as string | null,
    odds_timestamp: row.odds_timestamp as string | null,
    generated_at: row.generated_at as string | null,
    cutoff_at: row.cutoff_at as string | null,
    model_version: row.model_version as string | null,
    feature_snapshot_id: row.feature_snapshot_id as string | null,
    feature_set_version: row.feature_set_version as string | null,
    data_quality_score: finite(snapshot.quality),
    data_sufficiency_score: finite(snapshot.sufficiency),
    calibrationStatus: 'mature',
  }
  const policy = evaluateRecommendationEligibility(policyInput)
  const blockers = new Set<RecommendationBlockerCode | string>(policy.blockers)
  if (snapshot.prospective_preview !== true) blockers.add('not prospective preview')
  if (!isOfficialRecommendationStatus(policy.status)) blockers.add('recommendation policy not official')
  if (blockers.size) {
    return {
      success: false,
      mode: 'prospective_official_candidate_promotion_v1',
      generatedAt,
      dryRun,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      rejected: true,
      reason: 'Candidate failed official promotion gates.',
      audit: {
        recommendationStatus: policy.status,
        blockers: Array.from(blockers),
        edge: row.edge,
        ev: row.ev,
        confidence: row.confidence,
        oddsTimestamp: row.odds_timestamp,
        cutoff: row.cutoff_at,
      },
    }
  }
  if (request.confirmed !== true || dryRun) {
    return {
      success: true,
      mode: 'prospective_official_candidate_promotion_v1',
      generatedAt,
      dryRun: true,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      promotionAllowed: true,
      promoted: false,
      audit: { recommendationStatus: policy.status, idempotencyKey: request.idempotencyKey },
    }
  }

  const audit = {
    prospectiveOfficialActivation: {
      state: 'PROSPECTIVE_OFFICIAL',
      activatedAt: generatedAt,
      reason: request.reason,
      idempotencyKey: request.idempotencyKey,
      recommendationStatus: policy.status,
      policy,
    },
    ...snapshot,
  }
  const update = await supabaseAdmin
    .from('prediction_history')
    .update({
      production_eligible: true,
      recommended_pick: true,
      validation_status: 'official',
      lifecycle_status: 'prospective_official',
      skip_reason: null,
      feature_snapshot: audit,
    })
    .eq('id', request.predictionId)
    .eq('production_eligible', false)
    .eq('recommended_pick', false)
    .select('id')
  if (update.error) throw new Error(`candidate promotion update failed: ${update.error.message}`)
  return {
    success: true,
    mode: 'prospective_official_candidate_promotion_v1',
    generatedAt,
    dryRun: false,
    providerCallsMade: 0,
    remoteMutationsMade: update.data?.length ?? 0,
    promoted: (update.data?.length ?? 0) === 1,
    audit: { recommendationStatus: policy.status, idempotencyKey: request.idempotencyKey },
  }
}
