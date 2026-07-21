import { NextRequest } from 'next/server'
import { apiOk, requestId } from '@/lib/api-contract'
import { validateAdaptiveRefreshFixtures } from '@/services/adaptive-refresh-orchestrator.service'
import { validateMarketAlignmentFixtures } from '@/services/market-alignment.service'
import { validateMarketIntelligenceCategoryFixtures } from '@/services/market-intelligence-category.service'
import { validateAiBetFinderDeterministicFixtures } from '@/services/ai-bet-finder.service'
import { validateUniversalProjectionEngineFixtures } from '@/services/universal-projection-engine.service'
import { validateGameIntelligenceFixtures } from '@/services/game-intelligence.service'
import { validateOfficialPickExperienceFixtures } from '@/services/official-pick-experience.service'
import { validateMlbAiPicksFeedFixtures } from '@/services/mlb-ai-picks-feed.service'
import { validateMlbPlayerPropsFoundationFixtures } from '@/services/mlb-player-props-foundation.service'
import { validateRecommendationExplanationFixtures } from '@/services/recommendation-explanation.service'
import { validateBsnCoreCertificationFixtures } from '@/services/bsn-core-certification.service'
import { validateSportsDataIoSubscriptionMaximizationAuditFixtures } from '@/services/sportsdataio-subscription-maximization-audit.service'
import { validateSportsDataIoMlbImportDurabilityFixtures } from '@/services/sportsdataio-mlb-historical-import-executor.service'
import { validateMlbUnresolvedPlayerIdentityFixtures } from '@/services/mlb-unresolved-player-identity.service'
import { validateMlbCurrentSeasonBackfillOrchestratorFixtures } from '@/services/mlb-current-season-backfill-orchestrator.service'
import { validateMlbCurrentSeasonDataQualityAuditFixtures } from '@/services/mlb-current-season-data-quality-audit.service'
import { validateMlbFeatureModelReadinessFixtures } from '@/services/mlb-feature-model-readiness.service'
import { validateMlbModelAuditFixtures } from '@/services/mlb-model-audit.service'
import { validateMlbPlayerDataExcellenceFixtures } from '@/services/mlb-player-data-excellence.service'

export async function GET(request: NextRequest) {
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
  return apiOk({
    ...adaptive,
    success:
      adaptive.success &&
      marketAlignment.success &&
      marketClassification.success &&
      aiBetFinder.success &&
      universalProjectionEngine.success &&
      gameIntelligence.success &&
      recommendationExplanation.success &&
      officialPickExperience.success &&
      aiPicksFeed.success &&
      mlbPlayerPropsFoundation.success &&
      bsnCoreCertification.success &&
      sportsDataIoSubscriptionMaximization.success &&
      sportsDataIoMlbImportDurability.success &&
      mlbUnresolvedPlayerIdentity.success &&
      mlbCurrentSeasonBackfillOrchestrator.success &&
      mlbCurrentSeasonDataQualityAudit.success &&
      mlbFeatureModelReadiness.success &&
      mlbModelAudit.success &&
      mlbPlayerDataExcellence.success,
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
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }, requestId(request))
}
