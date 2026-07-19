import { getBasketballSourceFramework } from '@/services/basketball-source-framework.service'
import { getFeatureDefinitions, getFeatureStoreStatus } from '@/services/feature-store-core.service'
import { planHistoricalImport } from '@/services/historical-import-engine.service'
import { getSharedSportPredictionEngineSdk } from '@/services/sport-prediction-engine-sdk.service'
import type { BasketballPlatformScope } from '@/services/basketball/contracts/capabilities'
import { planBasketballKnowledgeGeneration } from '@/services/basketball/knowledge/knowledge-layer'

export type BasketballHistoricalBuilderPhase =
  | 'acquire'
  | 'normalize'
  | 'validate'
  | 'merge'
  | 'reconcile'
  | 'store'
  | 'generate_knowledge'
  | 'generate_features'
  | 'expose_prediction_sdk'

export const BASKETBALL_HISTORICAL_BUILDER_PHASES: BasketballHistoricalBuilderPhase[] = [
  'acquire',
  'normalize',
  'validate',
  'merge',
  'reconcile',
  'store',
  'generate_knowledge',
  'generate_features',
  'expose_prediction_sdk',
]

export function buildBasketballHistoricalSeasonPlan(scope: BasketballPlatformScope) {
  const sourceFramework = getBasketballSourceFramework({
    sportKey: scope.sportKey,
    leagueKey: scope.leagueKey,
  })
  const importPlan = planHistoricalImport({
    sportKey: scope.sportKey,
    leagueKey: scope.leagueKey,
    season: scope.season,
    dateFrom: scope.dateFrom,
    dateTo: scope.dateTo,
    dataTypes: ['teams', 'games', 'results', 'standings', 'players', 'stats'],
    dryRun: true,
  })
  const featureDefinitions = getFeatureDefinitions({ sportKey: scope.sportKey })
  const basketballFeatureDefinitions = featureDefinitions.definitions.filter((definition) =>
    definition.key.startsWith('basketball_') || definition.key === 'team_form'
  )
  const featureStore = getFeatureStoreStatus()
  const predictionSdk = getSharedSportPredictionEngineSdk()
  const knowledge = planBasketballKnowledgeGeneration()

  return {
    success: true,
    mode: 'basketball_historical_builder_v1',
    generatedAt: new Date().toISOString(),
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    scope,
    workflow: BASKETBALL_HISTORICAL_BUILDER_PHASES.map((phase, index) => ({
      sequence: index + 1,
      phase,
      status: phase === 'store' ? 'write_blocked_until_audit_approved' : 'contract_ready',
      checkpointKey: `${scope.sportKey}:${scope.leagueKey}:${scope.season ?? 'season'}:${phase}`,
      resumeStrategy: 'resume_from_last_successful_checkpoint',
    })),
    connectors: sourceFramework.connectors,
    historicalImport: {
      reused: true,
      mode: importPlan.mode,
      status: importPlan.status,
      checkpoints: importPlan.job.totalCheckpoints,
      executableCheckpoints: importPlan.job.executableCheckpoints,
      blockedCheckpoints: importPlan.job.blockedCheckpoints,
      providerCallsEstimated: importPlan.quotaEstimate.estimatedProviderCalls,
    },
    normalization: {
      canonicalEntities: ['teams', 'players', 'games', 'venues', 'officials', 'standings', 'game_stats', 'player_game_stats', 'quarter_scores', 'possessions', 'advanced_metrics'],
      stableIdsRequired: true,
      namesNeverPrimaryIdentifiers: true,
    },
    reconciliation: {
      confidenceScoredMerge: true,
      provenancePreserved: true,
      silentOverwrite: false,
      conflictTracking: true,
    },
    dataQuality: {
      completenessScore: true,
      confidenceScore: true,
      consistencyScore: true,
      missingFieldsRemainNull: true,
    },
    knowledge,
    featureStore: {
      reused: true,
      status: featureStore.status,
      basketballDefinitions: basketballFeatureDefinitions.map((definition) => definition.key),
    },
    predictionSdk: {
      reused: true,
      mode: predictionSdk.mode,
      supportedMarkets: predictionSdk.markets.filter((market) => market.supported).map((market) => market.market),
      duplicatePredictionEngineCreated: false,
    },
    guardrails: {
      noScrapingRequired: true,
      noProviderCallsInPlanner: true,
      noWritesInPlanner: true,
      noFakeData: true,
      noOfficialPickMutation: true,
      noChampionMutation: true,
    },
  }
}
