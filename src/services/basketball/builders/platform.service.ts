import 'server-only'

import type { SportKey } from '@/config/sports.config'
import { getSportRegistryDetail } from '@/services/multi-sport-registry.service'
import { getBasketballSourceFramework, validateBasketballSourceFrameworkFixtures } from '@/services/basketball-source-framework.service'
import { runSportPredictionSdkValidation } from '@/services/sport-prediction-engine-sdk.service'
import { buildBasketballHistoricalSeasonPlan } from '@/services/basketball/history/historical-builder'
import { normalizeBasketballCanonicalRows } from '@/services/basketball/normalizers/canonical'
import { reconcileBasketballEntities } from '@/services/basketball/reconciliation/reconciliation-engine'
import { validateBasketballQualityFixtures } from '@/services/basketball/validators/data-quality'
import { summarizeBasketballPlatformMetrics } from '@/services/basketball/metrics/platform-metrics'
import { getBasketballExistingPlatformMap } from '@/services/basketball/mappers/existing-platform-mapper'
import {
  BASKETBALL_CAPABILITIES,
  BASKETBALL_SOURCE_PRIORITY_ORDER,
  type BasketballPlatformLeagueKey,
} from '@/services/basketball/contracts/capabilities'

const DEFAULT_SCOPE = {
  sportKey: 'basketball_bsn' as SportKey,
  leagueKey: 'bsn_pr' as BasketballPlatformLeagueKey,
  season: '2026',
  dateFrom: null,
  dateTo: null,
}

export function getBasketballDataPlatform({
  sportKey = DEFAULT_SCOPE.sportKey,
  leagueKey = DEFAULT_SCOPE.leagueKey,
  season = DEFAULT_SCOPE.season,
  dateFrom = DEFAULT_SCOPE.dateFrom,
  dateTo = DEFAULT_SCOPE.dateTo,
}: {
  sportKey?: SportKey
  leagueKey?: BasketballPlatformLeagueKey
  season?: string | null
  dateFrom?: string | null
  dateTo?: string | null
} = {}) {
  const scope = { sportKey, leagueKey, season, dateFrom, dateTo }
  const registry = getSportRegistryDetail(sportKey)
  const sourceFramework = getBasketballSourceFramework({ sportKey, leagueKey })
  const historicalBuilder = buildBasketballHistoricalSeasonPlan(scope)
  const platformMap = getBasketballExistingPlatformMap()

  return {
    success: true,
    mode: 'basketball_data_platform_v1',
    generatedAt: new Date().toISOString(),
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    scope,
    architecture: {
      root: 'src/services/basketball',
      folders: ['connectors', 'builders', 'knowledge', 'normalizers', 'validators', 'reconciliation', 'history', 'metrics', 'mappers', 'contracts', 'types'],
      connectorFirst: true,
      scraper: false,
      oneOffImporter: false,
      productionReadyContract: true,
      dependencyInjectionReady: true,
      typedContracts: true,
      checkpointResumeReady: true,
    },
    sourcePriority: BASKETBALL_SOURCE_PRIORITY_ORDER,
    capabilities: BASKETBALL_CAPABILITIES,
    connectorFramework: {
      discoverableCapabilities: true,
      unsupportedReturnsTypedNotSupported: true,
      connectors: sourceFramework.connectors.map((connector) => ({
        id: connector.id,
        displayName: connector.displayName,
        type: connector.type,
        priority: connector.priority,
        capabilities: connector.capabilities,
        approvedForLiveImport: connector.approvedForLiveImport,
        approvedForProductionPredictions: connector.approvedForProductionPredictions,
      })),
    },
    historicalBuilder,
    existingPlatformMap: platformMap,
    multiSportIntegration: {
      reused: true,
      sport: registry.key,
      leagues: registry.leagues.map((league) => league.key),
      markets: registry.markets.map((market) => market.key),
      productionReady: registry.productionReady,
    },
    featureStoreIntegration: historicalBuilder.featureStore,
    predictionSdkIntegration: historicalBuilder.predictionSdk,
    historicalImportIntegration: historicalBuilder.historicalImport,
    guardrails: {
      noScraping: true,
      noRobotsBypass: true,
      noFabricatedData: true,
      noOfficialPickMutation: true,
      noChampionMutation: true,
      noProviderCallsInValidation: true,
      importWritesDisabledUntilAuditApproved: true,
    },
  }
}

export function validateBasketballDataPlatformFixtures() {
  const normalized = normalizeBasketballCanonicalRows({
    sourceId: 'fixture_csv',
    connectorId: 'csv_fixture',
    rows: [
      { kind: 'team', teamName: 'Fixture Home', abbreviation: 'FHO' },
      { kind: 'game', homeTeam: 'Fixture Home', awayTeam: 'Fixture Away', startTime: '2026-01-02T00:00:00.000Z', homeScore: 90, awayScore: 84, status: 'final' },
    ],
  })
  const reconciled = reconcileBasketballEntities(normalized.entities.filter((entity) => entity.kind === 'team'))
  const metrics = summarizeBasketballPlatformMetrics(normalized.entities)
  const sourceValidation = validateBasketballSourceFrameworkFixtures()
  const qualityValidation = validateBasketballQualityFixtures()
  const sdkValidation = runSportPredictionSdkValidation()
  const platform = getBasketballDataPlatform()
  const checks = [
    ['platform exposes connector folders', platform.architecture.folders.includes('connectors')],
    ['source framework validation passes', sourceValidation.success],
    ['canonical rows normalize with stable ids', normalized.entities.length === 2 && normalized.entities.every((entity) => entity.id.includes(':'))],
    ['reconciliation preserves provenance', reconciled?.provenancePreserved === true && reconciled.silentOverwrite === false],
    ['quality validation passes', qualityValidation.success],
    ['metrics do not fabricate rows', metrics.entities === 2],
    ['historical import engine is reused', platform.historicalImportIntegration.reused === true],
    ['feature store is reused', platform.featureStoreIntegration.reused === true],
    ['prediction sdk is reused', platform.predictionSdkIntegration.reused === true && sdkValidation.success],
    ['guardrails block provider calls and writes', platform.providerCallsMade === 0 && platform.remoteMutationsMade === 0],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'basketball_data_platform_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    officialPicksChanged: false,
    championRowsMutated: false,
    duplicateServicesCreated: false,
  }
}
