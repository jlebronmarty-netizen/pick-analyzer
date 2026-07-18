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
import {
  getMlbStarterWeatherStadiumIntelligence,
  validateMlbStarterWeatherStadiumIntelligenceFixtures,
} from '@/services/mlb-starter-weather-stadium-intelligence.service'

type PredictionFeatureRow = {
  id: string
  sport_key: string
  game_id: string | null
  market: string | null
  model_version: string | null
  feature_snapshot: Record<string, unknown> | null
  cutoff_at: string | null
  commence_time: string | null
}

type CountResult = {
  count: number
  warning: string | null
}

const MLB_WARNINGS = [
  'MLB Feature Store Integration V1 consumes verified GamesByDate starter, weather and StadiumID evidence.',
  'Player detail, player stat and stadium metadata caches are designed but not populated by this read-only module run.',
  'Lineup, injury, bullpen and props remain outside Starter + Weather + Stadium Intelligence V1.',
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

async function loadRecentMlbFeatureRows() {
  const result = await supabaseAdmin
    .from('prediction_history')
    .select('id, sport_key, game_id, market, model_version, feature_snapshot, cutoff_at, commence_time')
    .eq('sport_key', 'baseball_mlb')
    .order('generated_at', { ascending: false })
    .limit(50)
    .then(
      (value) => ({ status: 'fulfilled' as const, value }),
      (reason) => ({ status: 'rejected' as const, reason })
    )

  if (result.status === 'rejected') {
    return {
      rows: [] as PredictionFeatureRow[],
      warning: `prediction_history unavailable: ${result.reason instanceof Error ? result.reason.message : 'unknown error'}`,
    }
  }

  if (result.value.error) {
    return {
      rows: [] as PredictionFeatureRow[],
      warning: `prediction_history unavailable: ${result.value.error.message}`,
    }
  }

  return {
    rows: (result.value.data ?? []) as PredictionFeatureRow[],
    warning: null,
  }
}

function isFeatureStoreCompatible(snapshot: Record<string, unknown> | null) {
  if (!snapshot || Object.keys(snapshot).length === 0) return false

  return (
    'featureQualityScore' in snapshot ||
    'dataSufficiencyScore' in snapshot ||
    'values' in snapshot ||
    'storeVersion' in snapshot
  )
}

export function previewMlbFeatureStoreSnapshot() {
  const snapshot = createFeatureSnapshot({
    sportKey: 'baseball_mlb',
    leagueKey: 'mlb',
    eventId: 'mlb_feature_preview',
    market: 'moneyline',
    generatedAt: '2026-06-01T16:00:00.000Z',
    cutoffAt: '2026-06-01T16:00:00.000Z',
    eventStartTime: '2026-06-01T23:00:00.000Z',
  })
  const featureSet = lookupFeatureSet({
    sportKey: 'baseball_mlb',
    leagueKey: 'mlb',
    market: 'moneyline',
  })

  return {
    success: true,
    mode: 'mlb_feature_store_preview_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_mlb_feature_store_preview',
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
      ...MLB_WARNINGS,
    ],
  }
}

export async function getMlbFeatureStoreIntegrationStatus() {
  const definitions = getFeatureDefinitions({
    sportKey: 'baseball_mlb',
    market: 'moneyline',
  })
  const featureSet = lookupFeatureSet({
    sportKey: 'baseball_mlb',
    leagueKey: 'mlb',
    market: 'moneyline',
  })
  const preview = previewMlbFeatureStoreSnapshot()
  const intelligence = await getMlbStarterWeatherStadiumIntelligence('2026-07-17')
  const rows = await loadRecentMlbFeatureRows()
  const predictionCompatible = rows.rows.filter((row) =>
    isFeatureStoreCompatible(row.feature_snapshot)
  )
  const [teamStats, gameResults, predictions] = await Promise.all([
    safeCount('team_stats', 'sport_key', 'baseball_mlb'),
    safeCount('game_results', 'sport_key', 'baseball_mlb'),
    safeCount('prediction_history', 'sport_key', 'baseball_mlb'),
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
    mode: 'mlb_feature_store_integration_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'feature_contracts_and_existing_mlb_metadata',
    },
    status,
    summary: {
      mlbDefinitions: definitions.summary.definitions,
      featureSets: featureSet.summary.matches,
      readyFeatureSets: featureSet.summary.ready,
      partialFeatureSets: currentFeatureSet?.status === 'partial' ? 1 : 0,
      previewQuality: preview.snapshot.featureQualityScore,
      previewSufficiency: preview.snapshot.dataSufficiencyScore,
      verifiedFeatureQuality: intelligence.summary.featureQualityAfter,
      verifiedDataSufficiency: intelligence.summary.dataSufficiencyAfter,
      verifiedCriticalCompleteness: intelligence.summary.criticalCompletenessAfter,
      previewNoLeakage: preview.snapshot.noLeakage,
      recentPredictionRows: rows.rows.length,
      compatiblePredictionSnapshots: predictionCompatible.length,
      storedTeamStatsRows: teamStats.count,
      storedGameResultsRows: gameResults.count,
      storedPredictionRows: predictions.count,
    },
    compatibility: {
      usesFeatureStoreCore: true,
      usesMultiSportFeatureRegistry: true,
      usesSharedSportPredictionSdk: true,
      changesLegacyMlbPredictionGeneration: true,
      requiresMigration: false,
      durableFeatureStorePersistence: false,
      rawProviderPayloadsAllowed: false,
    },
    missingSportSpecificDomains: ['confirmed_lineup_context', 'injury_diagnosis', 'bullpen_context', 'player_detail_cache', 'player_stats_cache', 'stadium_metadata_cache'],
    definitions: definitions.definitions,
    featureSet: currentFeatureSet,
    preview: preview.snapshot,
    verifiedIntelligence: {
      sourceLedger: intelligence.sourceLedger,
      summary: intelligence.summary,
      readiness: intelligence.readiness,
      caches: intelligence.caches,
    },
    warnings: [
      ...(rows.warning ? [rows.warning] : []),
      ...(teamStats.warning ? [teamStats.warning] : []),
      ...(gameResults.warning ? [gameResults.warning] : []),
      ...(predictions.warning ? [predictions.warning] : []),
      ...(currentFeatureSet?.warnings ?? []),
      ...MLB_WARNINGS,
    ],
  }
}

export function runMlbFeatureStoreIntegrationValidation() {
  const preview = previewMlbFeatureStoreSnapshot()
  const featureValidation = runFeatureStoreValidation()
  const registryValidation = runMultiSportFeatureRegistryValidation()
  const intelligenceValidation = validateMlbStarterWeatherStadiumIntelligenceFixtures()
  const featureSet = preview.featureSet
  const featureSetAvailable = Boolean(featureSet)
  const requiredFeaturesPresent =
    featureSet?.missingRequiredFeatures.length === 0
  const supportedStatus = featureSet?.status === 'ready' || featureSet?.status === 'partial'

  return {
    success:
      featureValidation.success &&
      registryValidation.success &&
      intelligenceValidation.success &&
      featureSetAvailable &&
      requiredFeaturesPresent &&
      supportedStatus &&
      preview.snapshot.noLeakage,
    mode: 'mlb_feature_store_integration_validation_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_mlb_feature_contract_validation',
    },
    completionLabels: preview.completionLabels,
    summary: {
      featureSetAvailable,
      featureSetStatus: featureSet?.status ?? 'missing',
      requiredFeaturesPresent,
      previewNoLeakage: preview.snapshot.noLeakage,
      featureStoreValidation: featureValidation.success,
      registryValidation: registryValidation.success,
      intelligenceValidation: intelligenceValidation.success,
      previewQuality: preview.snapshot.featureQualityScore,
      previewSufficiency: preview.snapshot.dataSufficiencyScore,
      realDataValidationPending: false,
      historicalCalibrationPending: true,
    },
    warnings: preview.warnings,
  }
}
