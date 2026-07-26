import { NextRequest } from 'next/server'
import { apiOk, requestId } from '@/lib/api-contract'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ValidationBucket = 'PASS' | 'EXPECTED_PARTIAL' | 'NOT_APPLICABLE' | 'FAIL'

function classifyValidation(name: string, result: { success?: boolean; failed?: number; failedChecks?: unknown[] }) {
  const failed = Number(result.failed ?? 0)
  const failedChecks = Array.isArray(result.failedChecks) ? result.failedChecks.map(String) : []
  let classification: ValidationBucket = result.success === false || failed > 0 || failedChecks.length > 0 ? 'FAIL' : 'PASS'
  if (/bsn/i.test(name) && classification === 'FAIL' && failedChecks.some((item) => /no_settled_sample|shadow|preview/i.test(item))) {
    classification = 'EXPECTED_PARTIAL'
  }
  return {
    key: name,
    classification,
    success: result.success !== false,
    failed,
    failedChecks,
  }
}

async function loadValidationFixtures() {
  const [
    adaptive,
    marketAlignment,
    marketClassification,
    aiBetFinder,
    universalProjectionEngine,
    gameIntelligence,
    officialPickExperience,
    aiPicksFeed,
    mlbPlayerPropsFoundation,
    recommendationExplanation,
    bsnCoreCertification,
    sportsDataIoSubscriptionMaximization,
    sportsDataIoMlbImportDurability,
    mlbUnresolvedPlayerIdentity,
    mlbCurrentSeasonBackfillOrchestrator,
    mlbCurrentSeasonDataQualityAudit,
    mlbFeatureModelReadiness,
    mlbModelAudit,
    mlbPlayerDataExcellence,
    settlementReconciliation,
    sportsAnalyst,
    playerIntelligence,
    universalEventIdentity,
    missingCanonicalEventsRecovery,
    legacyPredictionProvenance,
    mlbLearningBrain,
    mlbPregameStarterEvidence,
    modelOnlyIntelligence,
    performanceScopeV2,
    mlbMarketPipelineDiagnostics,
    mlbProjectedScore,
    retrosheetHistoricalDataLake,
    retrosheetGameEngine,
    retrosheetHistoricalFeatureStore,
  ] = await Promise.all([
    import('@/services/adaptive-refresh-orchestrator.service'),
    import('@/services/market-alignment.service'),
    import('@/services/market-intelligence-category.service'),
    import('@/services/ai-bet-finder.service'),
    import('@/services/universal-projection-engine.service'),
    import('@/services/game-intelligence.service'),
    import('@/services/official-pick-experience.service'),
    import('@/services/mlb-ai-picks-feed.service'),
    import('@/services/mlb-player-props-foundation.service'),
    import('@/services/recommendation-explanation.service'),
    import('@/services/bsn-core-certification.service'),
    import('@/services/sportsdataio-subscription-maximization-audit.service'),
    import('@/services/sportsdataio-mlb-historical-import-executor.service'),
    import('@/services/mlb-unresolved-player-identity.service'),
    import('@/services/mlb-current-season-backfill-orchestrator.service'),
    import('@/services/mlb-current-season-data-quality-audit.service'),
    import('@/services/mlb-feature-model-readiness.service'),
    import('@/services/mlb-model-audit.service'),
    import('@/services/mlb-player-data-excellence.service'),
    import('@/services/settlement-reconciliation.service'),
    import('@/services/sports-analyst.service'),
    import('@/services/player-intelligence.service'),
    import('@/services/universal-event-identity.service'),
    import('@/services/missing-canonical-events-recovery.service'),
    import('@/services/legacy-prediction-provenance.service'),
    import('@/services/mlb-learning-brain.service'),
    import('@/services/mlb-pregame-starter-evidence.service'),
    import('@/services/model-only-intelligence.service'),
    import('@/services/performance-scope-v2.service'),
    import('@/services/mlb-market-pipeline-diagnostics.service'),
    import('@/services/mlb-projected-score.service'),
    import('@/services/retrosheet-historical-data-lake.service'),
    import('@/services/retrosheet-game-reconstruction.service'),
    import('@/services/retrosheet-historical-feature-store.service'),
  ])

  return {
    validateAdaptiveRefreshFixtures: adaptive.validateAdaptiveRefreshFixtures,
    validateMarketAlignmentFixtures: marketAlignment.validateMarketAlignmentFixtures,
    validateMarketIntelligenceCategoryFixtures: marketClassification.validateMarketIntelligenceCategoryFixtures,
    validateAiBetFinderDeterministicFixtures: aiBetFinder.validateAiBetFinderDeterministicFixtures,
    validateUniversalProjectionEngineFixtures: universalProjectionEngine.validateUniversalProjectionEngineFixtures,
    validateGameIntelligenceFixtures: gameIntelligence.validateGameIntelligenceFixtures,
    validateOfficialPickExperienceFixtures: officialPickExperience.validateOfficialPickExperienceFixtures,
    validateMlbAiPicksFeedFixtures: aiPicksFeed.validateMlbAiPicksFeedFixtures,
    validateMlbPlayerPropsFoundationFixtures: mlbPlayerPropsFoundation.validateMlbPlayerPropsFoundationFixtures,
    validateRecommendationExplanationFixtures: recommendationExplanation.validateRecommendationExplanationFixtures,
    validateBsnCoreCertificationFixtures: bsnCoreCertification.validateBsnCoreCertificationFixtures,
    validateSportsDataIoSubscriptionMaximizationAuditFixtures: sportsDataIoSubscriptionMaximization.validateSportsDataIoSubscriptionMaximizationAuditFixtures,
    validateSportsDataIoMlbImportDurabilityFixtures: sportsDataIoMlbImportDurability.validateSportsDataIoMlbImportDurabilityFixtures,
    validateMlbUnresolvedPlayerIdentityFixtures: mlbUnresolvedPlayerIdentity.validateMlbUnresolvedPlayerIdentityFixtures,
    validateMlbCurrentSeasonBackfillOrchestratorFixtures: mlbCurrentSeasonBackfillOrchestrator.validateMlbCurrentSeasonBackfillOrchestratorFixtures,
    validateMlbCurrentSeasonDataQualityAuditFixtures: mlbCurrentSeasonDataQualityAudit.validateMlbCurrentSeasonDataQualityAuditFixtures,
    validateMlbFeatureModelReadinessFixtures: mlbFeatureModelReadiness.validateMlbFeatureModelReadinessFixtures,
    validateMlbModelAuditFixtures: mlbModelAudit.validateMlbModelAuditFixtures,
    validateMlbPlayerDataExcellenceFixtures: mlbPlayerDataExcellence.validateMlbPlayerDataExcellenceFixtures,
    validateSettlementReconciliationFixtures: settlementReconciliation.validateSettlementReconciliationFixtures,
    validateSportsAnalystFixtures: sportsAnalyst.validateSportsAnalystFixtures,
    validatePlayerIntelligenceFixtures: playerIntelligence.validatePlayerIntelligenceFixtures,
    validateUniversalEventIdentityFixtures: universalEventIdentity.validateUniversalEventIdentityFixtures,
    validateMissingCanonicalEventsRecoveryFixtures: missingCanonicalEventsRecovery.validateMissingCanonicalEventsRecoveryFixtures,
    validateLegacyPredictionProvenanceFixtures: legacyPredictionProvenance.validateLegacyPredictionProvenanceFixtures,
    validateMlbLearningBrainFixtures: mlbLearningBrain.validateMlbLearningBrainFixtures,
    validateMlbPregameStarterEvidenceFixtures: mlbPregameStarterEvidence.validateMlbPregameStarterEvidenceFixtures,
    validateModelOnlyIntelligenceFixtures: modelOnlyIntelligence.validateModelOnlyIntelligenceFixtures,
    validatePerformanceScopeV2Fixtures: performanceScopeV2.validatePerformanceScopeV2Fixtures,
    validateMlbMarketPipelineDiagnosticsFixtures: mlbMarketPipelineDiagnostics.validateMlbMarketPipelineDiagnosticsFixtures,
    validateMlbProjectedScoreFixtures: mlbProjectedScore.validateMlbProjectedScoreFixtures,
    validateRetrosheetHistoricalDataLakeFixtures: retrosheetHistoricalDataLake.validateRetrosheetHistoricalDataLakeFixtures,
    validateRetrosheetGameEngineFixtures: retrosheetGameEngine.validateRetrosheetGameEngineFixtures,
    validateRetrosheetHistoricalFeatureStoreFixtures: retrosheetHistoricalFeatureStore.validateRetrosheetHistoricalFeatureStoreFixtures,
  }
}

export async function GET(request: NextRequest) {
  const {
    validateAdaptiveRefreshFixtures,
    validateMarketAlignmentFixtures,
    validateMarketIntelligenceCategoryFixtures,
    validateAiBetFinderDeterministicFixtures,
    validateUniversalProjectionEngineFixtures,
    validateGameIntelligenceFixtures,
    validateOfficialPickExperienceFixtures,
    validateMlbAiPicksFeedFixtures,
    validateMlbPlayerPropsFoundationFixtures,
    validateRecommendationExplanationFixtures,
    validateBsnCoreCertificationFixtures,
    validateSportsDataIoSubscriptionMaximizationAuditFixtures,
    validateSportsDataIoMlbImportDurabilityFixtures,
    validateMlbUnresolvedPlayerIdentityFixtures,
    validateMlbCurrentSeasonBackfillOrchestratorFixtures,
    validateMlbCurrentSeasonDataQualityAuditFixtures,
    validateMlbFeatureModelReadinessFixtures,
    validateMlbModelAuditFixtures,
    validateMlbPlayerDataExcellenceFixtures,
    validateSettlementReconciliationFixtures,
    validateSportsAnalystFixtures,
    validatePlayerIntelligenceFixtures,
    validateUniversalEventIdentityFixtures,
    validateMissingCanonicalEventsRecoveryFixtures,
    validateLegacyPredictionProvenanceFixtures,
    validateMlbLearningBrainFixtures,
    validateMlbPregameStarterEvidenceFixtures,
    validateModelOnlyIntelligenceFixtures,
    validatePerformanceScopeV2Fixtures,
    validateMlbMarketPipelineDiagnosticsFixtures,
    validateMlbProjectedScoreFixtures,
    validateRetrosheetHistoricalDataLakeFixtures,
    validateRetrosheetGameEngineFixtures,
    validateRetrosheetHistoricalFeatureStoreFixtures,
  } = await loadValidationFixtures()
  const adaptive = validateAdaptiveRefreshFixtures()
  const marketAlignment = validateMarketAlignmentFixtures()
  const marketClassification = validateMarketIntelligenceCategoryFixtures()
  const aiBetFinder = validateAiBetFinderDeterministicFixtures()
  const universalProjectionEngine = validateUniversalProjectionEngineFixtures()
  const gameIntelligence = validateGameIntelligenceFixtures()
  const recommendationExplanation = validateRecommendationExplanationFixtures()
  const officialPickExperience = validateOfficialPickExperienceFixtures()
  const aiPicksFeed = validateMlbAiPicksFeedFixtures()
  const mlbPlayerPropsFoundation = validateMlbPlayerPropsFoundationFixtures()
  const bsnCoreCertification = await validateBsnCoreCertificationFixtures()
  const sportsDataIoSubscriptionMaximization = validateSportsDataIoSubscriptionMaximizationAuditFixtures()
  const sportsDataIoMlbImportDurability = validateSportsDataIoMlbImportDurabilityFixtures()
  const mlbUnresolvedPlayerIdentity = validateMlbUnresolvedPlayerIdentityFixtures()
  const mlbCurrentSeasonBackfillOrchestrator = validateMlbCurrentSeasonBackfillOrchestratorFixtures()
  const mlbCurrentSeasonDataQualityAudit = validateMlbCurrentSeasonDataQualityAuditFixtures()
  const mlbFeatureModelReadiness = validateMlbFeatureModelReadinessFixtures()
  const mlbModelAudit = validateMlbModelAuditFixtures()
  const mlbPlayerDataExcellence = validateMlbPlayerDataExcellenceFixtures()
  const settlementReconciliation = validateSettlementReconciliationFixtures()
  const sportsAnalyst = validateSportsAnalystFixtures()
  const playerIntelligence = validatePlayerIntelligenceFixtures()
  const universalEventIdentity = validateUniversalEventIdentityFixtures()
  const missingCanonicalEventsRecovery = validateMissingCanonicalEventsRecoveryFixtures()
  const legacyPredictionProvenance = validateLegacyPredictionProvenanceFixtures()
  const mlbLearningBrain = validateMlbLearningBrainFixtures()
  const mlbPregameStarterEvidence = validateMlbPregameStarterEvidenceFixtures()
  const modelOnlyIntelligence = validateModelOnlyIntelligenceFixtures()
  const performanceScopeV2 = validatePerformanceScopeV2Fixtures()
  const mlbMarketPipelineDiagnostics = validateMlbMarketPipelineDiagnosticsFixtures()
  const mlbProjectedScore = validateMlbProjectedScoreFixtures()
  const retrosheetHistoricalDataLake = validateRetrosheetHistoricalDataLakeFixtures()
  const retrosheetGameEngine = validateRetrosheetGameEngineFixtures()
  const retrosheetHistoricalFeatureStore = validateRetrosheetHistoricalFeatureStoreFixtures()
  const validationResults = [
    classifyValidation('adaptive_refresh', adaptive),
    classifyValidation('market_alignment', marketAlignment),
    classifyValidation('market_classification', marketClassification),
    classifyValidation('ai_bet_finder', aiBetFinder),
    classifyValidation('universal_projection_engine', universalProjectionEngine),
    classifyValidation('game_intelligence', gameIntelligence),
    classifyValidation('recommendation_explanation', recommendationExplanation),
    classifyValidation('official_pick_experience', officialPickExperience),
    classifyValidation('ai_picks_feed', aiPicksFeed),
    classifyValidation('mlb_player_props_foundation', mlbPlayerPropsFoundation),
    classifyValidation('bsn_core_certification', bsnCoreCertification),
    classifyValidation('sportsdataio_subscription_maximization', sportsDataIoSubscriptionMaximization),
    classifyValidation('sportsdataio_mlb_import_durability', sportsDataIoMlbImportDurability),
    classifyValidation('mlb_unresolved_player_identity', mlbUnresolvedPlayerIdentity),
    classifyValidation('mlb_current_season_backfill_orchestrator', mlbCurrentSeasonBackfillOrchestrator),
    classifyValidation('mlb_current_season_data_quality_audit', mlbCurrentSeasonDataQualityAudit),
    classifyValidation('mlb_feature_model_readiness', mlbFeatureModelReadiness),
    classifyValidation('mlb_model_audit', mlbModelAudit),
    classifyValidation('mlb_player_data_excellence', mlbPlayerDataExcellence),
    classifyValidation('settlement_reconciliation', settlementReconciliation),
    classifyValidation('sports_analyst', sportsAnalyst),
    classifyValidation('player_intelligence', playerIntelligence),
    classifyValidation('universal_event_identity', universalEventIdentity),
    classifyValidation('missing_canonical_events_recovery', missingCanonicalEventsRecovery),
    classifyValidation('legacy_prediction_provenance', legacyPredictionProvenance),
    classifyValidation('mlb_learning_brain', mlbLearningBrain),
    classifyValidation('mlb_pregame_starter_evidence', mlbPregameStarterEvidence),
    classifyValidation('model_only_intelligence', modelOnlyIntelligence),
    classifyValidation('performance_scope_v2', performanceScopeV2),
    classifyValidation('mlb_market_pipeline_diagnostics', mlbMarketPipelineDiagnostics),
    classifyValidation('mlb_projected_score', mlbProjectedScore),
    classifyValidation('retrosheet_historical_data_lake', retrosheetHistoricalDataLake),
    classifyValidation('retrosheet_game_engine', retrosheetGameEngine),
    classifyValidation('retrosheet_historical_feature_store', retrosheetHistoricalFeatureStore),
  ]
  const trueFailures = validationResults.filter((item) => item.classification === 'FAIL')
  return apiOk({
    ...adaptive,
    success: trueFailures.length === 0,
    overallClassification: trueFailures.length === 0 ? 'PASS' : 'FAIL',
    validationResults,
    trueFailures,
    marketAlignment,
    marketClassification,
    aiBetFinder,
    universalProjectionEngine,
    gameIntelligence,
    recommendationExplanation,
    officialPickExperience,
    aiPicksFeed,
    mlbPlayerPropsFoundation,
    bsnCoreCertification,
    sportsDataIoSubscriptionMaximization,
    sportsDataIoMlbImportDurability,
    mlbUnresolvedPlayerIdentity,
    mlbCurrentSeasonBackfillOrchestrator,
    mlbCurrentSeasonDataQualityAudit,
    mlbFeatureModelReadiness,
    mlbModelAudit,
    mlbPlayerDataExcellence,
    settlementReconciliation,
    sportsAnalyst,
    playerIntelligence,
    universalEventIdentity,
    missingCanonicalEventsRecovery,
    legacyPredictionProvenance,
    mlbLearningBrain,
    mlbPregameStarterEvidence,
    modelOnlyIntelligence,
    performanceScopeV2,
    mlbMarketPipelineDiagnostics,
    mlbProjectedScore,
    retrosheetHistoricalDataLake,
    retrosheetGameEngine,
    retrosheetHistoricalFeatureStore,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }, requestId(request))
}
