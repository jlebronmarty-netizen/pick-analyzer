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

type PlayerStatFeatureRow = {
  id: string
  stat_type: string
  event_id: string | null
  team_id: string | null
  player_id: string | null
  games: number | null
  starts: number | null
  minutes: number | null
  points: number | null
  rebounds: number | null
  assists: number | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  updated_at: string | null
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

async function loadPlayerStatFeatureRows() {
  const result = await supabaseAdmin
    .from('sport_player_stats')
    .select('id, stat_type, event_id, team_id, player_id, games, starts, minutes, points, rebounds, assists, provider_ids, metadata, updated_at')
    .eq('sport_key', 'basketball_nba')
    .eq('league_key', 'nba')
    .order('updated_at', { ascending: false })
    .limit(5000)
    .then(
      (value) => ({ status: 'fulfilled' as const, value }),
      (reason) => ({ status: 'rejected' as const, reason })
    )

  if (result.status === 'rejected') {
    return {
      rows: [] as PlayerStatFeatureRow[],
      warning: `sport_player_stats unavailable: ${result.reason instanceof Error ? result.reason.message : 'unknown error'}`,
    }
  }

  if (result.value.error) {
    return {
      rows: [] as PlayerStatFeatureRow[],
      warning: `sport_player_stats unavailable: ${result.value.error.message}`,
    }
  }

  return {
    rows: (result.value.data ?? []) as PlayerStatFeatureRow[],
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

function minutesSince(value: string | null) {
  if (!value) return null
  const parsed = new Date(value).getTime()
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, round((Date.now() - parsed) / 60000))
}

function metadataFlag(row: { metadata: Record<string, unknown> | null }, key: string) {
  return row.metadata ? row.metadata[key] : undefined
}

function summarizePlayerStats(rows: PlayerStatFeatureRow[], warning: string | null) {
  const latestUpdatedAt = rows[0]?.updated_at ?? null
  const freshnessMinutes = minutesSince(latestUpdatedAt)
  const stale = rows.length > 0 && (freshnessMinutes === null || freshnessMinutes > 24 * 60)
  const seasonRows = rows.filter((row) => row.stat_type === 'season')
  const gameRows = rows.filter((row) => row.stat_type === 'game')
  const trialRows = rows.filter(
    (row) =>
      metadataFlag(row, 'trial') === true ||
      metadataFlag(row, 'scrambled') === true ||
      metadataFlag(row, 'production_eligible') === false
  )
  const productionEligibleRows = rows.filter(
    (row) => metadataFlag(row, 'trial') !== true && metadataFlag(row, 'production_eligible') !== false
  )
  const unresolvedPlayers = rows.filter((row) => !row.player_id).length
  const unresolvedTeams = rows.filter((row) => !row.team_id).length
  const unresolvedEvents = rows.filter((row) => row.stat_type === 'game' && !row.event_id).length
  const numericRows = rows.filter((row) =>
    [row.games, row.starts, row.minutes, row.points, row.rebounds, row.assists].some(
      (value) => value !== null && Number.isFinite(Number(value))
    )
  ).length
  const trialOnly = rows.length > 0 && trialRows.length === rows.length
  const qualityScore = rows.length === 0
    ? 45
    : clamp(
        82 -
          (trialOnly ? 12 : 0) -
          (stale ? 10 : 0) -
          Math.min(18, unresolvedPlayers * 0.05 + unresolvedTeams * 0.5 + unresolvedEvents),
        0,
        100
      )

  const warnings = [
    ...(warning ? [warning] : []),
    ...(rows.length === 0 ? ['No NBA player-stat rows are stored; player production context is unavailable.'] : []),
    ...(trialRows.length > 0 ? ['Stored NBA player-stat rows include trial/scrambled data and cannot improve production confidence.'] : []),
    ...(stale ? ['NBA player-stat feed is stale for the 24-hour freshness policy.'] : []),
    ...(unresolvedPlayers > 0 ? [`${unresolvedPlayers} NBA player-stat rows have unresolved player mappings.`] : []),
    ...(unresolvedTeams > 0 ? [`${unresolvedTeams} NBA player-stat rows have unresolved team mappings.`] : []),
    ...(unresolvedEvents > 0 ? [`${unresolvedEvents} NBA player game-stat rows have unresolved event mappings.`] : []),
  ]

  return {
    availabilityStatus:
      rows.length === 0
        ? 'player_stats_unavailable'
        : trialOnly
          ? 'player_stats_trial_records_only'
          : stale
            ? 'player_stats_stale'
            : 'player_stats_available',
    latestUpdatedAt,
    freshnessMinutes,
    stale,
    sampleSize: rows.length,
    seasonRows: seasonRows.length,
    gameRows: gameRows.length,
    numericRows,
    trialRows: trialRows.length,
    productionEligibleRows: productionEligibleRows.length,
    trialDataExcludedFromProductionConfidence: trialRows.length > 0,
    canImproveProductionConfidence: productionEligibleRows.length > 0 && !stale,
    unresolvedPlayerCount: unresolvedPlayers,
    unresolvedTeamCount: unresolvedTeams,
    unresolvedEventCount: unresolvedEvents,
    qualityScore: round(qualityScore),
    warnings,
  }
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
  const playerStatsRows = await loadPlayerStatFeatureRows()
  const playerStats = summarizePlayerStats(playerStatsRows.rows, playerStatsRows.warning)
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
      const hasStoredLineups = availability.lineupFeed.sampleSize > 0
      return {
        ...value,
        value: availability.featureValues.lineupAvailability,
        freshnessMinutes: availability.lineupFeed.freshnessMinutes ?? value.freshnessMinutes,
        qualityScore: clamp(85 - availability.lineupFeed.confidencePenalty * 2.5, 0, 100),
        sampleSize: availability.lineupFeed.sampleSize,
        provenance: [
          {
            provider: hasStoredLineups ? 'sportsdataio-stored' : 'unavailable',
            sourceTable: hasStoredLineups ? 'sport_lineups' : 'sport_players',
            sourceId: hasStoredLineups ? 'nba_injury_lineup_confidence_v1' : 'nba_lineup_unavailable',
            observedAt: availability.lineupFeed.latestUpdatedAt ?? snapshot.generatedAt,
          },
        ],
        warnings: availability.lineupFeed.warnings,
      }
    }

    if (value.key === 'player_stats_context') {
      return {
        ...value,
        value: playerStats,
        freshnessMinutes: playerStats.freshnessMinutes ?? value.freshnessMinutes,
        qualityScore: playerStats.qualityScore,
        sampleSize: playerStats.sampleSize,
        provenance: [
          {
            provider: playerStats.sampleSize > 0 ? 'sportsdataio-stored' : 'unavailable',
            sourceTable: 'sport_player_stats',
            sourceId: playerStats.sampleSize > 0 ? 'nba_player_stats_feature_context_v1' : 'nba_player_stats_unavailable',
            observedAt: playerStats.latestUpdatedAt ?? snapshot.generatedAt,
          },
        ],
        warnings: playerStats.warnings,
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
    warnings: Array.from(new Set([...snapshot.warnings, ...availability.warnings, ...playerStats.warnings])),
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
    playerStats,
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
      playerStatsStatus: preview.playerStats.availabilityStatus,
      playerStatsRows: preview.playerStats.sampleSize,
      playerStatsSeasonRows: preview.playerStats.seasonRows,
      playerStatsGameRows: preview.playerStats.gameRows,
      playerStatsUnresolvedPlayers: preview.playerStats.unresolvedPlayerCount,
      playerStatsTrialRows: preview.playerStats.trialRows,
      playerStatsCanImproveProductionConfidence: preview.playerStats.canImproveProductionConfidence,
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
    playerStats: preview.playerStats,
    warnings: [
      ...(rows.warning ? [rows.warning] : []),
      ...preview.injuryLineup.warnings,
      ...preview.playerStats.warnings,
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
        preview.injuryLineup.confidence.trialDataExcludedFromProductionConfidence ||
        preview.playerStats.trialDataExcludedFromProductionConfidence,
      playerStatsContextAvailable: preview.playerStats.sampleSize > 0,
      playerStatsCanImproveProductionConfidence: preview.playerStats.canImproveProductionConfidence,
    },
    warnings: [
      ...(preview.featureSet?.warnings ?? []),
      ...preview.injuryLineup.warnings,
      ...preview.playerStats.warnings,
    ],
  }
}
