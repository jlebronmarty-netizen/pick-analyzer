import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  createFeatureSnapshot,
  getFeatureDefinitions,
  runFeatureStoreValidation,
  type FeatureSnapshotValue,
} from '@/services/feature-store-core.service'
import {
  getNbaInjuryLineupConfidenceStatus,
  runNbaInjuryLineupConfidenceValidation,
} from '@/services/nba-injury-lineup-confidence.service'
import {
  lookupFeatureSet,
  runMultiSportFeatureRegistryValidation,
} from '@/services/multi-sport-feature-registry.service'

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

async function loadRecentNbaFeatureRows() {
  const result = await supabaseAdmin
    .from('prediction_history')
    .select('id, sport_key, game_id, market, model_version, feature_snapshot, cutoff_at, commence_time')
    .eq('sport_key', 'basketball_nba')
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

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function average(values: number[]) {
  if (!values.length) return 0
  return round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

export async function previewNbaFeatureStoreSnapshot() {
  const snapshot = createFeatureSnapshot({
    sportKey: 'basketball_nba',
    leagueKey: 'nba',
    eventId: 'nba_feature_preview',
    market: 'moneyline',
    generatedAt: '2026-01-01T12:00:00.000Z',
    cutoffAt: '2026-01-01T12:00:00.000Z',
    eventStartTime: '2026-01-01T20:00:00.000Z',
  })
  const featureSet = lookupFeatureSet({
    sportKey: 'basketball_nba',
    leagueKey: 'nba',
    market: 'moneyline',
  })
  const availability = await getNbaInjuryLineupConfidenceStatus()
  const values = snapshot.values.map((value): FeatureSnapshotValue => {
    if (value.key === 'injury_context') {
      return {
        ...value,
        value: availability.featureValues.injuryAvailability,
        freshnessMinutes: availability.injuryFeed.freshnessMinutes ?? value.freshnessMinutes,
        qualityScore: clamp(90 - availability.confidence.featureQualityPenalty, 0, 100),
        sampleSize: availability.injuryFeed.totalInjuryRows,
        provenance: [
          {
            provider: 'sportsdataio-stored',
            sourceTable: 'sport_injuries',
            sourceId: 'nba_injury_lineup_confidence_v1',
            observedAt: availability.injuryFeed.latestUpdatedAt ?? snapshot.generatedAt,
          },
        ],
        warnings: availability.warnings,
      }
    }

    if (value.key === 'lineup_context') {
      return {
        ...value,
        value: availability.featureValues.lineupAvailability,
        freshnessMinutes: 0,
        qualityScore: 55,
        sampleSize: 0,
        provenance: [
          {
            provider: 'unavailable',
            sourceTable: 'sport_players',
            sourceId: 'nba_lineup_unavailable',
            observedAt: snapshot.generatedAt,
          },
        ],
        warnings: availability.lineupFeed.warnings,
      }
    }

    return value
  })
  const required = values.filter((value) =>
    ['event_context', 'team_form', 'market_odds'].includes(value.key)
  )
  const enrichedSnapshot = {
    ...snapshot,
    values,
    featureQualityScore: average(values.map((value) => value.qualityScore)),
    dataSufficiencyScore: clamp(
      average(required.map((value) => (value.sampleSize > 0 ? value.qualityScore : 0))) -
        availability.confidence.dataSufficiencyPenalty,
      0,
      100
    ),
    warnings: Array.from(new Set([...snapshot.warnings, ...availability.warnings])),
  }

  return {
    success: true,
    mode: 'nba_feature_store_preview_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_feature_store_preview',
    },
    featureSet: featureSet.featureSets[0] ?? null,
    injuryLineup: availability,
    snapshot: enrichedSnapshot,
  }
}

export async function getNbaFeatureStoreIntegrationStatus() {
  const definitions = getFeatureDefinitions({
    sportKey: 'basketball_nba',
    market: 'moneyline',
  })
  const featureSet = lookupFeatureSet({
    sportKey: 'basketball_nba',
    leagueKey: 'nba',
    market: 'moneyline',
  })
  const preview = await previewNbaFeatureStoreSnapshot()
  const rows = await loadRecentNbaFeatureRows()
  const compatible = rows.rows.filter((row) =>
    isFeatureStoreCompatible(row.feature_snapshot)
  )

  return {
    success: true,
    mode: 'nba_feature_store_integration_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'feature_contracts_and_prediction_history_metadata',
    },
    status:
      featureSet.summary.ready > 0 && preview.snapshot.noLeakage
        ? 'ready'
        : 'degraded',
    summary: {
      nbaDefinitions: definitions.summary.definitions,
      featureSets: featureSet.summary.matches,
      readyFeatureSets: featureSet.summary.ready,
      previewQuality: preview.snapshot.featureQualityScore,
      previewSufficiency: preview.snapshot.dataSufficiencyScore,
      previewNoLeakage: preview.snapshot.noLeakage,
      recentPredictionRows: rows.rows.length,
      compatiblePredictionSnapshots: compatible.length,
      injuryFeedStatus: preview.injuryLineup.injuryFeed.status,
      activeInjuryCount: preview.injuryLineup.injuryFeed.activeInjuryCount,
      unresolvedInjuryPlayers: preview.injuryLineup.injuryFeed.unresolvedPlayerCount,
      unresolvedInjuryTeams: preview.injuryLineup.injuryFeed.unresolvedTeamCount,
      injuryFreshnessMinutes: preview.injuryLineup.injuryFeed.freshnessMinutes,
      injuryConfidencePenalty: preview.injuryLineup.confidence.penalty,
      injuryProductionEligible: preview.injuryLineup.injuryFeed.productionEligible,
      lineupFeedStatus: preview.injuryLineup.lineupFeed.availabilityStatus,
    },
    compatibility: {
      usesExistingPredictionHistoryFeatureSnapshot: true,
      changesPredictionGeneration: false,
      requiresMigration: false,
      durableFeatureStorePersistence: false,
    },
    definitions: definitions.definitions,
    featureSet: featureSet.featureSets[0] ?? null,
    preview: preview.snapshot,
    injuryLineup: preview.injuryLineup,
    warnings: [
      ...(rows.warning ? [rows.warning] : []),
      ...preview.injuryLineup.warnings,
      'NBA Feature Store Integration V1 does not alter NBA prediction generation.',
      'Existing prediction_history.feature_snapshot remains the persistence surface for NBA predictions.',
    ],
  }
}

export async function runNbaFeatureStoreIntegrationValidation() {
  const preview = await previewNbaFeatureStoreSnapshot()
  const featureValidation = runFeatureStoreValidation()
  const registryValidation = runMultiSportFeatureRegistryValidation()
  const injuryLineupValidation = runNbaInjuryLineupConfidenceValidation()
  const featureSetReady = Boolean(preview.featureSet?.ready)
  const requiredFeaturesPresent =
    preview.featureSet?.missingRequiredFeatures.length === 0

  return {
    success:
      featureValidation.success &&
      registryValidation.success &&
      injuryLineupValidation.success &&
      featureSetReady &&
      requiredFeaturesPresent &&
      preview.snapshot.noLeakage,
    mode: 'nba_feature_store_integration_validation_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_nba_feature_contract_validation',
    },
    summary: {
      featureSetReady,
      requiredFeaturesPresent,
      previewNoLeakage: preview.snapshot.noLeakage,
      featureStoreValidation: featureValidation.success,
      registryValidation: registryValidation.success,
      injuryLineupValidation: injuryLineupValidation.success,
      previewQuality: preview.snapshot.featureQualityScore,
      previewSufficiency: preview.snapshot.dataSufficiencyScore,
      injuryConfidencePenalty: preview.injuryLineup.confidence.penalty,
      trialDataExcludedFromProductionConfidence:
        preview.injuryLineup.confidence.trialDataExcludedFromProductionConfidence,
    },
    warnings: [
      ...(preview.featureSet?.warnings ?? []),
      ...preview.injuryLineup.warnings,
    ],
  }
}
