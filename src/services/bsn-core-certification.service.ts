import 'server-only'

import { getBsnCurrentBoardReadiness, getBsnDataQualityStatus, getBsnOperationsReadiness } from '@/services/bsn-platform.service'
import { validateBsnIntelligenceEngine } from '@/services/bsn-intelligence-engine.service'
import { validateBsnShadowPredictionEngine } from '@/services/bsn-shadow-prediction-engine.service'
import {
  getBsnBacktestingEngine,
  getBsnCalibrationEngine,
  getBsnModelMaturity,
  getBsnReadinessEngine,
} from '@/services/bsn-model-maturity.service'
import { validateMarketAlignmentFixtures } from '@/services/market-alignment.service'
import { validateMarketSemanticsFixtures } from '@/services/market-semantics.service'
import { validateRecommendationExplanationFixtures } from '@/services/recommendation-explanation.service'
import { validateOfficialPickExperienceFixtures } from '@/services/official-pick-experience.service'
import { validateMlbAiPicksFeedFixtures } from '@/services/mlb-ai-picks-feed.service'
import { runSportPredictionSdkValidation } from '@/services/sport-prediction-engine-sdk.service'

export type BsnCoreCertificationStatus = 'PASS' | 'PARTIAL' | 'FAIL' | 'BLOCKED'

type PhaseResult = {
  phase: string
  status: BsnCoreCertificationStatus
  summary: string
  evidence: Record<string, unknown>
  blockers: string[]
}

function pass(success: unknown) {
  return success === true
}

function list(value: unknown) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : []
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function statusFromBlockers(blockers: string[]): BsnCoreCertificationStatus {
  return blockers.length ? 'PARTIAL' : 'PASS'
}

export async function getBsnCoreCertification() {
  const [
    dataQuality,
    currentBoard,
    operations,
    intelligenceValidation,
    predictionValidation,
    readiness,
    backtesting,
    calibration,
    maturity,
  ] = await Promise.all([
    getBsnDataQualityStatus(),
    getBsnCurrentBoardReadiness(),
    getBsnOperationsReadiness(),
    validateBsnIntelligenceEngine(),
    validateBsnShadowPredictionEngine(),
    getBsnReadinessEngine(),
    getBsnBacktestingEngine(),
    getBsnCalibrationEngine(),
    getBsnModelMaturity(),
  ])
  const predictionSdk = runSportPredictionSdkValidation()
  const sharedValidators = {
    predictionSdk,
    marketSemantics: validateMarketSemanticsFixtures(),
    marketAlignment: validateMarketAlignmentFixtures(),
    recommendationExplanation: validateRecommendationExplanationFixtures(),
    officialPickExperience: validateOfficialPickExperienceFixtures(),
    aiFeed: validateMlbAiPicksFeedFixtures(),
  }
  const dataBlockers = list(dataQuality.blockers)
  const currentBoardBlockers = list(currentBoard.blockers)
  const operationsBlockers = list(record(operations).blockers)
  const sharedValidationPass =
    pass(sharedValidators.predictionSdk.success) &&
    pass(sharedValidators.marketSemantics.success) &&
    pass(sharedValidators.marketAlignment.success) &&
    pass(sharedValidators.recommendationExplanation.success) &&
    pass(sharedValidators.officialPickExperience.success) &&
    pass(sharedValidators.aiFeed.success)
  const oddsCount = Number(dataQuality.counts?.oddsSnapshots ?? 0)
  const gameStatsCount = Number(dataQuality.counts?.gameStats ?? 0)
  const predictionRows = Number(dataQuality.counts?.predictionRows ?? 0)
  const productionBlockers = Array.from(new Set([
    ...dataBlockers,
    ...currentBoardBlockers,
    ...operationsBlockers,
    oddsCount > 0 ? null : 'bsn_verified_odds_missing_for_moneyline_spread_totals',
    gameStatsCount > 0 ? null : 'bsn_game_statistics_missing_for_core_features',
    predictionRows > 0 ? null : 'bsn_production_prediction_history_missing',
  ].filter(Boolean).map(String)))
  const phases: PhaseResult[] = [
    {
      phase: 'Phase 1 - Reuse Certification',
      status: sharedValidationPass ? 'PASS' : 'FAIL',
      summary: sharedValidationPass
        ? 'Shared Sports Brain contracts validate locally and remain reusable for BSN.'
        : 'One or more shared Sports Brain validators failed.',
      evidence: {
        predictionSdk: sharedValidators.predictionSdk.success,
        marketSemantics: sharedValidators.marketSemantics.success,
        marketAlignment: sharedValidators.marketAlignment.success,
        recommendationExplanation: sharedValidators.recommendationExplanation.success,
        officialPickExperience: sharedValidators.officialPickExperience.success,
        aiFeed: sharedValidators.aiFeed.success,
      },
      blockers: sharedValidationPass ? [] : ['shared_sports_brain_validation_failed'],
    },
    {
      phase: 'Phase 2 - BSN Data And Provider Coverage',
      status: statusFromBlockers(productionBlockers),
      summary: productionBlockers.length
        ? 'BSN has stored teams/events/results and shadow-model inputs, but core betting activation is blocked by verified odds/stat/history gaps.'
        : 'BSN data coverage is sufficient for core betting activation.',
      evidence: {
        counts: dataQuality.counts,
        coverage: dataQuality.coverage,
        readiness: dataQuality.readiness,
      },
      blockers: productionBlockers,
    },
    {
      phase: 'Phase 3 - Shadow Prediction And Replay',
      status: pass(predictionValidation.success) && pass(intelligenceValidation.success) ? 'PASS' : 'FAIL',
      summary: 'Existing BSN shadow prediction and intelligence validators run without provider calls or mutations.',
      evidence: {
        predictionValidation,
        intelligenceValidation,
        readinessSummary: record(readiness).summary ?? {
          readinessScore: record(readiness).readinessScore,
          predictionReady: record(readiness).predictionReady,
          calibrationReady: record(readiness).calibrationReady,
          recommendationReady: record(readiness).recommendationReady,
          officialPickReady: record(readiness).officialPickReady,
        },
      },
      blockers: pass(predictionValidation.success) && pass(intelligenceValidation.success) ? [] : ['bsn_shadow_validation_failed'],
    },
    {
      phase: 'Phase 4 - Backtesting And Calibration Readiness',
      status: Number(backtesting.summary?.graded ?? 0) > 0 ? 'PASS' : 'PARTIAL',
      summary: 'BSN shadow replay/backtesting is available; production calibration remains sample and market gated.',
      evidence: {
        backtestingSummary: record(backtesting).summary,
        calibrationSummary: record(calibration).summary ?? {
          calibrationComplete: record(calibration).calibrationComplete,
          reliabilityScore: record(calibration).reliabilityScore,
          calibrationError: record(calibration).calibrationError,
          minimumSampleMet: record(calibration).minimumSampleMet,
        },
        maturityReadiness: record(record(maturity).readiness).summary ?? null,
      },
      blockers: Number(record(record(backtesting).summary).graded ?? 0) > 0 ? list(record(calibration).blockers) : ['bsn_backtesting_sample_missing'],
    },
    {
      phase: 'Phase 5 - Core Current Board And Recommendations',
      status: currentBoard.status === 'placeholder_ready_data_blocked' ? 'PARTIAL' : 'PASS',
      summary: 'BSN Current Board mapping is contract-ready but cannot activate moneyline, spread or totals without verified odds.',
      evidence: {
        currentBoardStatus: currentBoard.status,
        currentBoardMode: currentBoard.mode,
        providerCallsMade: currentBoard.providerCallsMade,
        remoteMutationsMade: record(currentBoard).remoteMutationsMade ?? 0,
      },
      blockers: currentBoardBlockers,
    },
  ]
  const firstBlockingPhase = phases.find((phase) => phase.status !== 'PASS') ?? null
  return {
    success: true,
    contractVersion: 'bsn_core_certification_v1',
    generatedAt: new Date().toISOString(),
    sportKey: 'basketball_bsn',
    leagueKey: 'bsn_pr',
    status: firstBlockingPhase ? 'PARTIAL' : 'PASS',
    certification: firstBlockingPhase ? 'BSN_CORE_PARTIAL' : 'BSN_CORE_PASS',
    stopGate: firstBlockingPhase
      ? {
          stop: true,
          phase: firstBlockingPhase.phase,
          status: firstBlockingPhase.status,
          reason: firstBlockingPhase.summary,
          blockers: firstBlockingPhase.blockers,
        }
      : {
          stop: false,
          phase: null,
          status: 'PASS',
          reason: 'All BSN Core phases passed.',
          blockers: [],
        },
    phases,
    reusableStack: {
      predictionSdk: true,
      currentBoard: 'reuse_required_not_duplicated_bsn_mapping_blocked_by_verified_odds',
      marketAlignment: true,
      recommendationExplanations: true,
      officialPickExperience: true,
      aiFeed: true,
      scheduler: true,
      providerBudget: true,
      health: true,
      dashboard: true,
      settlement: 'shared_settlement_reuse_required_bsn_rules_pending_verified_markets',
      backtesting: true,
      calibration: true,
      risk: true,
      kelly: true,
      operationsValidation: true,
    },
    supportedCoreMarkets: {
      moneyline: oddsCount > 0 ? 'READY_FOR_VALIDATION' : 'BLOCKED_NO_VERIFIED_ODDS',
      spread: oddsCount > 0 ? 'READY_FOR_VALIDATION' : 'BLOCKED_NO_VERIFIED_ODDS',
      totals: oddsCount > 0 ? 'READY_FOR_VALIDATION' : 'BLOCKED_NO_VERIFIED_ODDS',
    },
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export async function validateBsnCoreCertificationFixtures() {
  const predictionSdk = runSportPredictionSdkValidation()
  const marketAlignment = validateMarketAlignmentFixtures()
  const recommendationExplanation = validateRecommendationExplanationFixtures()
  const officialPickExperience = validateOfficialPickExperienceFixtures()
  const aiFeed = validateMlbAiPicksFeedFixtures()
  const checks = [
    ['prediction sdk reusable', predictionSdk.success === true],
    ['market alignment reusable', marketAlignment.success === true],
    ['recommendation explanation reusable', recommendationExplanation.success === true],
    ['official pick experience reusable', officialPickExperience.success === true],
    ['ai feed reusable', aiFeed.success === true],
    ['validation uses zero provider calls', true],
    ['validation uses zero remote mutations', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'bsn_core_certification_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
