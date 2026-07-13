import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  createFeatureSnapshot,
  getFeatureDefinitions,
  runFeatureStoreValidation,
} from '@/services/feature-store-core.service'
import {
  lookupFeatureSet,
  runMultiSportFeatureRegistryValidation,
} from '@/services/multi-sport-feature-registry.service'

type CountResult = {
  count: number
  warning: string | null
}

const NFL_WARNINGS = [
  'NFL Feature Store Integration V1 is architecture-only and does not claim predictive accuracy.',
  'Quarterback impact, injury impact, weather and rest/travel context are not fully available in Feature Store Core V1.',
  'Unavailable NFL-specific context must degrade confidence or block later prediction engines instead of being fabricated.',
]

async function safeCount(table: string, sportColumn: string, sportKey: string): Promise<CountResult> {
  const result = await supabaseAdmin
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(sportColumn, sportKey)
    .then(
      (value) => ({ status: 'fulfilled' as const, value }),
      (reason) => ({ status: 'rejected' as const, reason })
    )

  if (result.status === 'rejected') {
    return {
      count: 0,
      warning: `${table} unavailable: ${result.reason instanceof Error ? result.reason.message : 'unknown error'}`,
    }
  }

  if (result.value.error) {
    return {
      count: 0,
      warning: `${table} unavailable: ${result.value.error.message}`,
    }
  }

  return {
    count: result.value.count ?? 0,
    warning: null,
  }
}

export function previewNflFeatureStoreSnapshot() {
  const snapshot = createFeatureSnapshot({
    sportKey: 'americanfootball_nfl',
    leagueKey: 'nfl',
    eventId: 'nfl_feature_preview',
    market: 'spread',
    generatedAt: '2026-10-01T16:00:00.000Z',
    cutoffAt: '2026-10-01T16:00:00.000Z',
    eventStartTime: '2026-10-02T00:20:00.000Z',
  })
  const featureSet = lookupFeatureSet({
    sportKey: 'americanfootball_nfl',
    leagueKey: 'nfl',
    market: 'spread',
  })

  return {
    success: true,
    mode: 'nfl_feature_store_preview_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_nfl_feature_store_preview',
    },
    completionLabels: [
      'ARCHITECTURE_COMPLETE',
      'DETERMINISTIC_VALIDATION_COMPLETE',
      'REAL_DATA_VALIDATION_PENDING',
      'HISTORICAL_CALIBRATION_PENDING',
    ],
    featureSet: featureSet.featureSets[0] ?? null,
    snapshot,
    warnings: [
      ...(featureSet.featureSets[0]?.warnings ?? []),
      ...NFL_WARNINGS,
    ],
  }
}

export async function getNflFeatureStoreIntegrationStatus() {
  const definitions = getFeatureDefinitions({
    sportKey: 'americanfootball_nfl',
    market: 'spread',
  })
  const featureSet = lookupFeatureSet({
    sportKey: 'americanfootball_nfl',
    leagueKey: 'nfl',
    market: 'spread',
  })
  const preview = previewNflFeatureStoreSnapshot()
  const [teams, events, odds, predictions] = await Promise.all([
    safeCount('sports_teams', 'sport_key', 'americanfootball_nfl'),
    safeCount('sport_events', 'sport_key', 'americanfootball_nfl'),
    safeCount('sports_odds_snapshots', 'sport_key', 'americanfootball_nfl'),
    safeCount('prediction_history', 'sport_key', 'americanfootball_nfl'),
  ])
  const currentFeatureSet = featureSet.featureSets[0] ?? null
  const requiredFeaturesPresent =
    currentFeatureSet?.missingRequiredFeatures.length === 0
  const status =
    currentFeatureSet && requiredFeaturesPresent && preview.snapshot.noLeakage
      ? currentFeatureSet.status
      : 'degraded'

  return {
    success: true,
    mode: 'nfl_feature_store_integration_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'feature_contracts_and_existing_nfl_metadata',
    },
    status,
    summary: {
      nflDefinitions: definitions.summary.definitions,
      featureSets: featureSet.summary.matches,
      readyFeatureSets: featureSet.summary.ready,
      partialFeatureSets: currentFeatureSet?.status === 'partial' ? 1 : 0,
      previewQuality: preview.snapshot.featureQualityScore,
      previewSufficiency: preview.snapshot.dataSufficiencyScore,
      previewNoLeakage: preview.snapshot.noLeakage,
      storedTeamsRows: teams.count,
      storedEventsRows: events.count,
      storedOddsRows: odds.count,
      storedPredictionRows: predictions.count,
    },
    compatibility: {
      usesFeatureStoreCore: true,
      usesMultiSportFeatureRegistry: true,
      usesSharedSportPredictionSdk: true,
      changesExistingPredictionGeneration: false,
      requiresMigration: false,
      durableFeatureStorePersistence: false,
      rawProviderPayloadsAllowed: false,
    },
    missingSportSpecificDomains: [
      'quarterback_impact_context',
      'injury_impact_context',
      'weather_context',
      'rest_and_travel_context',
    ],
    definitions: definitions.definitions,
    featureSet: currentFeatureSet,
    preview: preview.snapshot,
    warnings: [
      ...(teams.warning ? [teams.warning] : []),
      ...(events.warning ? [events.warning] : []),
      ...(odds.warning ? [odds.warning] : []),
      ...(predictions.warning ? [predictions.warning] : []),
      ...(currentFeatureSet?.warnings ?? []),
      ...NFL_WARNINGS,
    ],
  }
}

export function runNflFeatureStoreIntegrationValidation() {
  const preview = previewNflFeatureStoreSnapshot()
  const featureValidation = runFeatureStoreValidation()
  const registryValidation = runMultiSportFeatureRegistryValidation()
  const featureSet = preview.featureSet
  const featureSetAvailable = Boolean(featureSet)
  const requiredFeaturesPresent =
    featureSet?.missingRequiredFeatures.length === 0
  const supportedStatus = featureSet?.status === 'ready' || featureSet?.status === 'partial'

  return {
    success:
      featureValidation.success &&
      registryValidation.success &&
      featureSetAvailable &&
      requiredFeaturesPresent &&
      supportedStatus &&
      preview.snapshot.noLeakage,
    mode: 'nfl_feature_store_integration_validation_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_nfl_feature_contract_validation',
    },
    completionLabels: preview.completionLabels,
    summary: {
      featureSetAvailable,
      featureSetStatus: featureSet?.status ?? 'missing',
      requiredFeaturesPresent,
      previewNoLeakage: preview.snapshot.noLeakage,
      featureStoreValidation: featureValidation.success,
      registryValidation: registryValidation.success,
      previewQuality: preview.snapshot.featureQualityScore,
      previewSufficiency: preview.snapshot.dataSufficiencyScore,
      realDataValidationPending: true,
      historicalCalibrationPending: true,
    },
    warnings: preview.warnings,
  }
}
