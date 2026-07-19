export function getBasketballExistingPlatformMap() {
  return {
    success: true,
    mode: 'basketball_existing_platform_mapper_v1',
    providerCallsMade: 0,
    reusedServices: {
      multiSportRegistry: 'src/services/multi-sport-registry.service.ts',
      providerRegistry: 'src/services/multi-sport-providers.service.ts',
      providerHealth: 'src/services/provider-intelligence.service.ts',
      providerBudget: 'src/services/provider-budget.service.ts',
      historicalImport: 'src/services/historical-import-engine.service.ts',
      featureStore: 'src/services/feature-store-core.service.ts',
      predictionSdk: 'src/services/sport-prediction-engine-sdk.service.ts',
      bsnSourceFramework: 'src/services/basketball-source-framework.service.ts',
      bsnPlatform: 'src/services/bsn-platform.service.ts',
    },
    normalizedTables: [
      'sports_teams',
      'sport_events',
      'sport_players',
      'sport_standings',
      'sport_game_stats',
      'sport_player_stats',
      'sport_lineups',
      'sport_injuries',
      'sports_odds_snapshots',
      'provider_entity_mappings',
      'sports_sync_jobs',
    ],
    noDuplicationPolicy: {
      duplicateFeatureStoreCreated: false,
      duplicatePredictionEngineCreated: false,
      duplicateHistoricalImportEngineCreated: false,
      duplicateProviderRegistryCreated: false,
    },
  }
}
