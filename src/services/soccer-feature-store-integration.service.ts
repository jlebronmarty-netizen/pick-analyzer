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

const SOCCER_WARNINGS = [
  'Soccer Feature Store Integration V1 is architecture-only and does not claim predictive accuracy.',
  'Draw-aware features, league strength, lineup context and injury context are not fully available in Feature Store Core V1.',
  'Unavailable soccer-specific context must degrade confidence or block later prediction engines instead of being fabricated.',
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

export function previewSoccerFeatureStoreSnapshot() {
  const snapshot = createFeatureSnapshot({
    sportKey: 'soccer',
    leagueKey: null,
    eventId: 'soccer_feature_preview',
    market: 'moneyline',
    generatedAt: '2026-04-01T12:00:00.000Z',
    cutoffAt: '2026-04-01T12:00:00.000Z',
    eventStartTime: '2026-04-01T19:45:00.000Z',
  })
  const featureSet = lookupFeatureSet({
    sportKey: 'soccer',
    leagueKey: null,
    market: 'moneyline',
  })

  return {
    success: true,
    mode: 'soccer_feature_store_preview_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_soccer_feature_store_preview',
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
      ...SOCCER_WARNINGS,
    ],
  }
}

export async function getSoccerFeatureStoreIntegrationStatus() {
  const definitions = getFeatureDefinitions({
    sportKey: 'soccer',
    market: 'moneyline',
  })
  const featureSet = lookupFeatureSet({
    sportKey: 'soccer',
    leagueKey: null,
    market: 'moneyline',
  })
  const preview = previewSoccerFeatureStoreSnapshot()
  const [teams, events, odds, predictions] = await Promise.all([
    safeCount('sports_teams', 'sport_key', 'soccer'),
    safeCount('sport_events', 'sport_key', 'soccer'),
    safeCount('sports_odds_snapshots', 'sport_key', 'soccer'),
    safeCount('prediction_history', 'sport_key', 'soccer'),
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
    mode: 'soccer_feature_store_integration_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'feature_contracts_and_existing_soccer_metadata',
    },
    status,
    summary: {
      soccerDefinitions: definitions.summary.definitions,
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
      'draw_aware_context',
      'league_strength_context',
      'confirmed_lineup_context',
      'injury_context',
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
      ...SOCCER_WARNINGS,
    ],
  }
}

export function runSoccerFeatureStoreIntegrationValidation() {
  const preview = previewSoccerFeatureStoreSnapshot()
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
    mode: 'soccer_feature_store_integration_validation_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_soccer_feature_contract_validation',
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
