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

const UFC_WARNINGS = [
  'UFC Feature Store Integration V1 is architecture-only and does not claim predictive accuracy.',
  'Fighter form, camp context, injury context, method context and weigh-in context are not fully available in Feature Store Core V1.',
  'Unavailable UFC-specific context must degrade confidence or block later prediction engines instead of being fabricated.',
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

export function previewUfcFeatureStoreSnapshot() {
  const snapshot = createFeatureSnapshot({
    sportKey: 'mma_ufc',
    leagueKey: 'ufc',
    eventId: 'ufc_feature_preview',
    market: 'moneyline',
    generatedAt: '2026-08-01T12:00:00.000Z',
    cutoffAt: '2026-08-01T12:00:00.000Z',
    eventStartTime: '2026-08-02T02:00:00.000Z',
  })
  const featureSet = lookupFeatureSet({
    sportKey: 'mma_ufc',
    leagueKey: 'ufc',
    market: 'moneyline',
  })

  return {
    success: true,
    mode: 'ufc_feature_store_preview_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_ufc_feature_store_preview',
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
      ...UFC_WARNINGS,
    ],
  }
}

export async function getUfcFeatureStoreIntegrationStatus() {
  const definitions = getFeatureDefinitions({
    sportKey: 'mma_ufc',
    market: 'moneyline',
  })
  const featureSet = lookupFeatureSet({
    sportKey: 'mma_ufc',
    leagueKey: 'ufc',
    market: 'moneyline',
  })
  const preview = previewUfcFeatureStoreSnapshot()
  const [events, odds, predictions] = await Promise.all([
    safeCount('sport_events', 'sport_key', 'mma_ufc'),
    safeCount('sports_odds_snapshots', 'sport_key', 'mma_ufc'),
    safeCount('prediction_history', 'sport_key', 'mma_ufc'),
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
    mode: 'ufc_feature_store_integration_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'feature_contracts_and_existing_ufc_metadata',
    },
    status,
    summary: {
      ufcDefinitions: definitions.summary.definitions,
      featureSets: featureSet.summary.matches,
      readyFeatureSets: featureSet.summary.ready,
      partialFeatureSets: currentFeatureSet?.status === 'partial' ? 1 : 0,
      previewQuality: preview.snapshot.featureQualityScore,
      previewSufficiency: preview.snapshot.dataSufficiencyScore,
      previewNoLeakage: preview.snapshot.noLeakage,
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
      'fighter_form_context',
      'camp_context',
      'injury_context',
      'method_context',
      'weigh_in_context',
    ],
    definitions: definitions.definitions,
    featureSet: currentFeatureSet,
    preview: preview.snapshot,
    warnings: [
      ...(events.warning ? [events.warning] : []),
      ...(odds.warning ? [odds.warning] : []),
      ...(predictions.warning ? [predictions.warning] : []),
      ...(currentFeatureSet?.warnings ?? []),
      ...UFC_WARNINGS,
    ],
  }
}

export function runUfcFeatureStoreIntegrationValidation() {
  const preview = previewUfcFeatureStoreSnapshot()
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
    mode: 'ufc_feature_store_integration_validation_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_ufc_feature_contract_validation',
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
