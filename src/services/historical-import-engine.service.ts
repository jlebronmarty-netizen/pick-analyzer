import { SportKey } from '@/config/sports.config'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { HistoricalFeatureSchemaCapabilities } from '@/lib/server-schema-capabilities'
import {
  HistoricalFeatureGenerationPlan,
  planHistoricalFeatureGeneration,
} from '@/services/historical-feature-generation.service'
import { getLeaguesForSport, getSportsRegistry } from '@/services/multi-sport-registry.service'
import {
  CostTier,
  ProviderDataType,
  planProviderRoute,
} from '@/services/provider-intelligence.service'
import {
  createCursorContract,
  getDefaultRetryPolicy,
  idempotencyKey,
} from '@/services/sync-reliability.service'

export type HistoricalImportScope = 'date_range' | 'season'
export type HistoricalImportStatus =
  | 'planned'
  | 'blocked'
  | 'running'
  | 'partial'
  | 'completed'
  | 'failed'

export type HistoricalImportReadinessState =
  | 'current_api'
  | 'recent_historical_feeds'
  | 'archived_historical_api_required'
  | 'unsupported_domain'
  | 'entitlement_blocked'
  | 'migration_pending'
  | 'pilot_validated_current_feed'
  | 'pilot_validated_date_feed'
  | 'pilot_validated_season_date_feeds'
  | 'historical_range_requires_per_date_execution'
  | 'historical_scope_limited'
  | 'safe_to_execute'
  | 'trial_only_execution'
  | 'production_eligible_execution_requires_approval'

export type HistoricalImportScopeType =
  | 'season'
  | 'date_range'
  | 'week'
  | 'competition'

export type HistoricalImportDomainManifest = {
  dataType: ProviderDataType
  dependencyIndex: number
  dependsOn: ProviderDataType[]
  scopeTypes: HistoricalImportScopeType[]
  readiness: HistoricalImportReadinessState
  executionMode: 'blocked' | 'dry_run_only' | 'trial_only' | 'approval_required'
  estimatedProviderCalls: number
  maximumProviderCalls: number
  maximumRecords: number
  checkpoint: string
  naturalKey: string
  stableIdComponents: string[]
  destinationTables: string[]
  conflictTargets: string[]
  oneToManyExpansionPossible: boolean
  providerEndpointStatus?: {
    providerVariant: 'sportsdataio_enterprise' | 'sportsdataio_discovery_lab'
    enterpriseEndpointConfirmed: boolean
    discoveryLabEndpointConfirmed: boolean
    discoveryLabProduct: 'fantasy' | 'odds' | null
    confirmedEndpoint: string | null
    routeFamily: string
    notes: string[]
  }
  blockers: string[]
  handoffs: {
    validation: string
    featureGeneration: string
    settlement: string
    backtesting: string
  }
}

export type HistoricalImportRequest = {
  sportKey?: string | null
  leagueKey?: string | null
  providerId?: string | null
  season?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  dataTypes?: string[] | null
  dryRun?: boolean | null
  batchSizeDays?: number | null
}

export type HistoricalImportCheckpoint = {
  id: string
  sequence: number
  scope: HistoricalImportScope
  sportKey: SportKey
  leagueKey: string | null
  providerId: string | null
  dataType: ProviderDataType
  season: string | null
  dateFrom: string | null
  dateTo: string | null
  status: 'planned' | 'blocked'
  cursor: ReturnType<typeof createCursorContract>
  idempotencyKey: string
  dedupeKey: string
  estimatedProviderCalls: number
  warnings: string[]
}

export type HistoricalImportPlan = {
  success: boolean
  mode: 'historical_import_engine_core_v1'
  dryRun: true
  generatedAt: string
  providerUsage: {
    externalProviderCallsMade: 0
    source: 'dry_run_planner_only'
  }
  request: {
    sportKey: SportKey | null
    leagueKey: string | null
    providerId: string | null
    season: string | null
    dateFrom: string | null
    dateTo: string | null
    dataTypes: ProviderDataType[]
    batchSizeDays: number
  }
  status: HistoricalImportStatus
  validation: {
    valid: boolean
    errors: string[]
    warnings: string[]
  }
  job: {
    id: string
    status: HistoricalImportStatus
    progressPercent: number
    totalCheckpoints: number
    blockedCheckpoints: number
    executableCheckpoints: number
    recordsFetched: 0
    recordsInserted: 0
    recordsUpdated: 0
    recordsSkipped: 0
    errorCount: number
  }
  quotaEstimate: {
    estimatedProviderCalls: number
    costTier: CostTier
    quotaImpact: 'none' | 'low' | 'medium' | 'high'
    recommendedBatchSizeDays: number
    warning: string
  }
  executionPlan: {
    order: string[]
    retryPolicy: ReturnType<typeof getDefaultRetryPolicy>
    partialFailureIsolation: string
    idempotency: string
    deduplication: string
    providerEntityMapping: string
    persistence: string
  }
  checkpoints: HistoricalImportCheckpoint[]
  multiSportPlanning: HistoricalImportMultiSportPlanning
  featureGenerationHandoff: HistoricalFeatureGenerationPlan
  schemaCapabilities: HistoricalFeatureSchemaCapabilities | null
}

export type HistoricalImportSportPlan = {
  sportKey: SportKey
  leagueKey: string
  manifestVersion: 'historical_import_manifest_v2'
  status: 'planned' | 'blocked'
  providerCallsMade: 0
  supportedDomains: ProviderDataType[]
  dependencyOrder: ProviderDataType[]
  domainManifests: HistoricalImportDomainManifest[]
  destinationTables: string[]
  naturalKeys: string[]
  conflictTargets: string[]
  requestCaps: {
    providerCalls: number
    concurrency: 1
    automaticRetries: false
    recommendedBatchSizeDays: number
  }
  scope: {
    supportsSeason: boolean
    supportsDateRange: boolean
    checkpointStrategy: string
    resumeStrategy: string
  }
  isolation: {
    trialRowsDefault: true
    productionEligibleDefault: false
    predictionTrainingAllowed: false
  }
  handoffs: {
    dataQuality: string
    featureStore: string
    predictionPreview: string
  }
  progress: {
    totalDomains: number
    plannedDomains: number
    blockedDomains: number
    migrationPendingDomains: number
    entitlementBlockedDomains: number
    archiveRequiredDomains: number
  }
  providerCallAccounting: {
    callsMade: 0
    estimatedCalls: number
    maximumCalls: number
    concurrency: 1
    automaticRetries: false
  }
  providerVariant?: 'sportsdataio_enterprise' | 'sportsdataio_discovery_lab'
  providerRouteFamily?: string
  confirmedDiscoveryLabEndpoints?: string[]
  recordAccounting: {
    providerRecordsFetched: 0
    normalizedRowsProduced: 0
    skippedProviderRecords: 0
    skippedNormalizedRows: 0
    recordsSkipped: 0
    oneToManyExpansionSupported: true
  }
  sportSpecificNotes: string[]
  warnings: string[]
  requiresApproval: string[]
}

export type HistoricalImportMultiSportPlanning = {
  mode: 'historical_import_multi_sport_planning_v2'
  providerCallsMade: 0
  canonicalRoute: '/api/historical-import/plan'
  sports: HistoricalImportSportPlan[]
  dependencyGraph: Array<{
    sportKey: SportKey
    leagueKey: string
    domains: Array<{
      dataType: ProviderDataType
      dependsOn: ProviderDataType[]
      readiness: HistoricalImportReadinessState
    }>
  }>
  validation: {
    valid: boolean
    checks: Record<string, boolean>
    warnings: string[]
  }
  safeguards: string[]
}

type DomainPersistenceContract = {
  naturalKey: string
  stableIdComponents: string[]
  destinationTables: string[]
  conflictTargets: string[]
  oneToManyExpansionPossible: boolean
}

type SyncJobRow = {
  id: string
  job_type: string
  sport_key: string
  league_key: string | null
  provider: string
  season: string | null
  started_at: string | null
  completed_at: string | null
  status: string
  records_fetched: number | null
  records_inserted: number | null
  records_updated: number | null
  records_skipped: number | null
  error_count: number | null
  last_error: string | null
  duration_ms: number | null
  metadata: Record<string, unknown> | null
}

type StoredRecordCounters = {
  providerRecordsFetched?: number
  normalizedRowsProduced?: number
  skippedProviderRecords?: number
  skippedNormalizedRows?: number
  recordsSkipped?: number
  oneToManyExpansion?: boolean
  expansionRatio?: number
}

const IMPORT_DATA_TYPES: ProviderDataType[] = [
  'schedules',
  'scores',
  'standings',
  'team_stats',
  'game_stats',
  'player_stats',
  'players',
  'injuries',
  'lineups',
  'odds',
  'historical_odds',
  'player_props',
]

const DEFAULT_DATA_TYPES: ProviderDataType[] = [
  'schedules',
  'scores',
  'odds',
]

const HISTORICAL_IMPORT_STUCK_GRACE_MS = 60 * 1000

const DATA_TYPE_ORDER: ProviderDataType[] = [
  'schedules',
  'scores',
  'standings',
  'team_stats',
  'game_stats',
  'player_stats',
  'players',
  'injuries',
  'lineups',
  'odds',
  'historical_odds',
  'player_props',
  'play_by_play',
  'live_data',
]

function generatedAt() {
  return new Date().toISOString()
}

function numberFromMetadata(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function recordFromMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function stringFromMetadata(value: unknown, fallback: string | null = null) {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

function recordCountersFromMetadata(
  metadata: Record<string, unknown> | null,
  fallback: { fetched: number; skipped: number }
): Required<StoredRecordCounters> {
  const counters =
    metadata &&
    typeof metadata.recordCounters === 'object' &&
    metadata.recordCounters !== null &&
    !Array.isArray(metadata.recordCounters)
      ? (metadata.recordCounters as StoredRecordCounters)
      : {}

  return {
    providerRecordsFetched: numberFromMetadata(counters.providerRecordsFetched, fallback.fetched),
    normalizedRowsProduced: numberFromMetadata(counters.normalizedRowsProduced, fallback.fetched - fallback.skipped),
    skippedProviderRecords: numberFromMetadata(counters.skippedProviderRecords, fallback.skipped),
    skippedNormalizedRows: numberFromMetadata(counters.skippedNormalizedRows, fallback.skipped),
    recordsSkipped: Math.max(0, numberFromMetadata(counters.recordsSkipped, fallback.skipped)),
    oneToManyExpansion: counters.oneToManyExpansion === true,
    expansionRatio: numberFromMetadata(counters.expansionRatio, 0),
  }
}

function isSportKey(value: string | null | undefined): value is SportKey {
  return getSportsRegistry().some((sport) => sport.key === value)
}

function isImportDataType(value: string): value is ProviderDataType {
  return IMPORT_DATA_TYPES.includes(value as ProviderDataType)
}

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) ? date : null
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function daysBetween(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime()
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1
}

function clampBatchSize(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) return 7
  return Math.max(1, Math.min(Math.floor(value), 31))
}

function normalizeDataTypes(values: string[] | null | undefined) {
  if (!values || values.length === 0) return DEFAULT_DATA_TYPES

  const unique = Array.from(new Set(values.map((value) => value.trim())))
  return DATA_TYPE_ORDER.filter((dataType) =>
    unique.includes(dataType)
  ) as ProviderDataType[]
}

function costTierRank(costTier: CostTier) {
  if (costTier === 'internal') return 0
  if (costTier === 'low') return 1
  if (costTier === 'medium') return 2
  if (costTier === 'high') return 3
  return 2
}

function maxCostTier(values: CostTier[]): CostTier {
  return values.sort((a, b) => costTierRank(b) - costTierRank(a))[0] ?? 'unknown'
}

function quotaImpact(calls: number, costTier: CostTier) {
  if (calls === 0) return 'none'
  if (costTier === 'high' || calls > 250) return 'high'
  if (costTier === 'medium' || calls > 50) return 'medium'
  return 'low'
}

function readinessForDataType({
  sportKey,
  dataType,
  routeSupported,
  providerVariant,
  schemaCapabilities,
}: {
  sportKey: SportKey
  dataType: ProviderDataType
  routeSupported: boolean
  providerVariant?: 'sportsdataio_enterprise' | 'sportsdataio_discovery_lab'
  schemaCapabilities?: HistoricalFeatureSchemaCapabilities | null
}): HistoricalImportReadinessState {
  if (sportKey === 'baseball_mlb' && providerVariant === 'sportsdataio_discovery_lab') {
    return 'entitlement_blocked'
  }

  if (sportKey === 'basketball_nba') {
    if (dataType === 'players') return 'pilot_validated_current_feed'
    if (dataType === 'injuries') return 'pilot_validated_current_feed'
    if (dataType === 'lineups') {
      return schemaCapabilities?.probes.sportLineups.applied
        ? 'pilot_validated_date_feed'
        : 'migration_pending'
    }
    if (dataType === 'player_stats') {
      return schemaCapabilities?.probes.sportPlayerStats.applied
        ? 'pilot_validated_season_date_feeds'
        : 'migration_pending'
    }
  }

  if (!routeSupported) return 'unsupported_domain'
  if (dataType === 'historical_odds') return 'archived_historical_api_required'
  if (dataType === 'player_props') return 'entitlement_blocked'
  if (['injuries', 'lineups', 'odds'].includes(dataType)) return 'trial_only_execution'
  if (['team_stats', 'game_stats', 'standings'].includes(dataType)) return 'recent_historical_feeds'
  return 'current_api'
}

function sportsDataIoMlbDiscoveryEndpointForDomain(dataType: ProviderDataType) {
  const endpoints: Partial<Record<ProviderDataType, { product: 'fantasy' | 'odds'; path: string }>> = {
    schedules: { product: 'odds', path: '/api/mlb/odds/json/GamesByDate/{date}' },
    scores: { product: 'odds', path: '/api/mlb/odds/json/GamesByDate/{date}' },
    standings: { product: 'fantasy', path: '/api/mlb/fantasy/json/Standings/{season}' },
    team_stats: { product: 'odds', path: '/api/mlb/odds/json/TeamSeasonStats/{season}' },
    game_stats: { product: 'odds', path: '/api/mlb/odds/json/TeamGameStatsByDate/{date}' },
    player_stats: { product: 'fantasy', path: '/api/mlb/fantasy/json/PlayerGameStatsByDate/{date}' },
    players: { product: 'fantasy', path: '/api/mlb/fantasy/json/Players' },
    odds: { product: 'odds', path: '/api/mlb/odds/json/GameOddsByDate/{date}' },
    historical_odds: { product: 'odds', path: '/api/mlb/odds/json/GameOddsLineMovement/{gameid}' },
  }

  return endpoints[dataType] ?? null
}

function executionModeForReadiness(
  readiness: HistoricalImportReadinessState
): HistoricalImportDomainManifest['executionMode'] {
  if (
    [
      'unsupported_domain',
      'archived_historical_api_required',
      'entitlement_blocked',
      'migration_pending',
    ].includes(readiness)
  ) {
    return 'blocked'
  }

  if (
    [
      'trial_only_execution',
      'pilot_validated_current_feed',
      'pilot_validated_date_feed',
      'pilot_validated_season_date_feeds',
      'historical_range_requires_per_date_execution',
      'historical_scope_limited',
    ].includes(readiness)
  ) {
    return 'trial_only'
  }
  if (readiness === 'production_eligible_execution_requires_approval') {
    return 'approval_required'
  }
  return 'dry_run_only'
}

function scopeTypesForSportAndDomain({
  sportKey,
  dataType,
}: {
  sportKey: SportKey
  dataType: ProviderDataType
}): HistoricalImportScopeType[] {
  const scopes: HistoricalImportScopeType[] = ['season', 'date_range']

  if (sportKey === 'americanfootball_nfl') {
    scopes.push('week')
  }

  if (sportKey === 'soccer') {
    scopes.push('competition')
  }

  if (dataType === 'historical_odds') {
    return scopes.filter((scope) => scope !== 'season')
  }

  return scopes
}

function maximumRecordsForDomain(dataType: ProviderDataType) {
  if (['players', 'player_stats', 'player_props'].includes(dataType)) return 1000
  if (['odds', 'historical_odds'].includes(dataType)) return 5000
  if (['lineups', 'injuries'].includes(dataType)) return 1500
  return 500
}

function domainPersistenceContract(dataType: ProviderDataType): DomainPersistenceContract {
  const mappingTarget = 'provider_entity_mappings(provider, entity_type, provider_entity_id, sport_key)'

  switch (dataType) {
    case 'schedules':
      return {
        naturalKey: 'provider:event_id_or_game_id',
        stableIdComponents: ['sport_key', 'league_key', 'provider', 'provider_event_id'],
        destinationTables: ['sport_events', 'sports_teams', 'provider_entity_mappings', 'sports_sync_jobs'],
        conflictTargets: ['sport_events.id', mappingTarget],
        oneToManyExpansionPossible: false,
      }
    case 'scores':
      return {
        naturalKey: 'provider:event_id_or_game_id',
        stableIdComponents: ['sport_key', 'league_key', 'provider', 'provider_event_id'],
        destinationTables: ['sport_events', 'game_results', 'provider_entity_mappings', 'sports_sync_jobs'],
        conflictTargets: ['sport_events.id', 'game_results.id', mappingTarget],
        oneToManyExpansionPossible: false,
      }
    case 'standings':
      return {
        naturalKey: 'sport_key:league_key:season:team_id:provider',
        stableIdComponents: ['sport_key', 'league_key', 'season', 'provider_team_id'],
        destinationTables: ['sport_standings', 'sports_teams', 'provider_entity_mappings', 'sports_sync_jobs'],
        conflictTargets: ['sport_standings.id', 'sports_teams.id', mappingTarget],
        oneToManyExpansionPossible: false,
      }
    case 'players':
      return {
        naturalKey: 'provider:player_id',
        stableIdComponents: ['sport_key', 'league_key', 'provider', 'provider_player_id'],
        destinationTables: ['sport_players', 'sports_teams', 'provider_entity_mappings', 'sports_sync_jobs'],
        conflictTargets: ['sport_players.id', mappingTarget],
        oneToManyExpansionPossible: false,
      }
    case 'injuries':
      return {
        naturalKey: 'provider:injury_id_or_player_team_status_source_timestamp',
        stableIdComponents: [
          'sport_key',
          'league_key',
          'provider',
          'provider_injury_id_or_player_team_status_source_timestamp',
        ],
        destinationTables: ['sport_injuries', 'sport_players', 'sports_teams', 'provider_entity_mappings', 'sports_sync_jobs'],
        conflictTargets: ['sport_injuries.id', mappingTarget],
        oneToManyExpansionPossible: false,
      }
    case 'lineups':
      return {
        naturalKey:
          'sport_key:league_key:event_id_or_season:team_id:player_id_or_provider_player_id:lineup_type:position:depth_order',
        stableIdComponents: [
          'sport_key',
          'league_key',
          'provider',
          'provider_event_id_or_season',
          'provider_team_id',
          'provider_player_id',
          'lineup_type',
          'position',
          'depth_order',
        ],
        destinationTables: ['sport_lineups', 'sport_players', 'sports_teams', 'sport_events', 'provider_entity_mappings', 'sports_sync_jobs'],
        conflictTargets: ['sport_lineups.id', mappingTarget],
        oneToManyExpansionPossible: true,
      }
    case 'team_stats':
      return {
        naturalKey: 'sport_key:league_key:season:team_id:stat_scope',
        stableIdComponents: ['sport_key', 'league_key', 'season', 'provider_team_id', 'stat_scope'],
        destinationTables: ['team_stats', 'sports_teams', 'provider_entity_mappings', 'sports_sync_jobs'],
        conflictTargets: ['team_stats.id', mappingTarget],
        oneToManyExpansionPossible: false,
      }
    case 'game_stats':
      return {
        naturalKey: 'sport_key:league_key:event_id:team_id:stat_scope',
        stableIdComponents: ['sport_key', 'league_key', 'provider_event_id', 'provider_team_id', 'stat_scope'],
        destinationTables: ['sport_game_stats', 'sport_events', 'sports_teams', 'provider_entity_mappings', 'sports_sync_jobs'],
        conflictTargets: ['sport_game_stats.id', mappingTarget],
        oneToManyExpansionPossible: true,
      }
    case 'player_stats':
      return {
        naturalKey: 'sport_key:league_key:season:stat_type:event_id:team_id:player_id',
        stableIdComponents: [
          'sport_key',
          'league_key',
          'season',
          'stat_type',
          'provider_event_id',
          'provider_team_id',
          'provider_player_id',
        ],
        destinationTables: ['sport_player_stats', 'sport_players', 'sports_teams', 'sport_events', 'provider_entity_mappings', 'sports_sync_jobs'],
        conflictTargets: ['sport_player_stats.id', mappingTarget],
        oneToManyExpansionPossible: true,
      }
    case 'odds':
    case 'historical_odds':
      return {
        naturalKey: 'sport_key:league_key:event_id:market:period:sportsbook:selection:snapshot_timestamp',
        stableIdComponents: [
          'sport_key',
          'league_key',
          'provider_event_id',
          'market',
          'period',
          'sportsbook',
          'selection',
          'snapshot_timestamp',
        ],
        destinationTables: ['sports_odds_snapshots', 'sport_events', 'provider_entity_mappings', 'sports_sync_jobs'],
        conflictTargets: ['sports_odds_snapshots.id', mappingTarget],
        oneToManyExpansionPossible: true,
      }
    case 'player_props':
      return {
        naturalKey: 'provider:event_id:market_id:outcome_id:sportsbook',
        stableIdComponents: [
          'sport_key',
          'league_key',
          'provider_event_id',
          'provider_market_id',
          'provider_outcome_id',
          'sportsbook',
        ],
        destinationTables: ['sports_odds_snapshots', 'sport_events', 'sport_players', 'provider_entity_mappings', 'sports_sync_jobs'],
        conflictTargets: ['sports_odds_snapshots.id', mappingTarget],
        oneToManyExpansionPossible: true,
      }
    default:
      return {
        naturalKey: 'provider:entity_id',
        stableIdComponents: ['sport_key', 'league_key', 'provider', 'provider_entity_id'],
        destinationTables: ['provider_entity_mappings', 'sports_sync_jobs'],
        conflictTargets: [mappingTarget],
        oneToManyExpansionPossible: false,
      }
  }
}

function buildDomainManifests({
  sportKey,
  leagueKey,
  dependencyOrder,
  recommendedBatchSizeDays,
  providerVariant,
  schemaCapabilities,
}: {
  sportKey: SportKey
  leagueKey: string
  dependencyOrder: ProviderDataType[]
  recommendedBatchSizeDays: number
  providerVariant?: 'sportsdataio_enterprise' | 'sportsdataio_discovery_lab'
  schemaCapabilities?: HistoricalFeatureSchemaCapabilities | null
}): HistoricalImportDomainManifest[] {
  return dependencyOrder.map((dataType, index) => {
    const persistence = domainPersistenceContract(dataType)
    const mlbDiscoveryEndpoint = sportsDataIoMlbDiscoveryEndpointForDomain(dataType)
    const route = planProviderRoute({
      sportKey,
      leagueKey,
      dataType,
      dryRun: true,
    })
    const routeSupported = route.success && route.supported === true
    const readiness = readinessForDataType({
      sportKey,
      dataType,
      routeSupported,
      providerVariant,
      schemaCapabilities,
    })
    const executionMode = executionModeForReadiness(readiness)
    const dependsOn = dependencyOrder.slice(0, index)
    const estimatedProviderCalls = executionMode === 'blocked' ? 0 : 1
    const maximumProviderCalls =
      executionMode === 'blocked' ? 0 : Math.max(1, Math.ceil(recommendedBatchSizeDays / 7))
    const blockers: string[] = []

    if (!routeSupported) {
      blockers.push('No confirmed executable provider route in the current planner.')
    }
    if (readiness === 'archived_historical_api_required') {
      blockers.push('Historical archive endpoint and date window require explicit approval.')
    }
    if (readiness === 'entitlement_blocked') {
      blockers.push('Provider entitlement, sportsbook/result coverage and grading rules are unverified.')
    }
    if (sportKey === 'baseball_mlb' && providerVariant === 'sportsdataio_discovery_lab') {
      blockers.push(
        'Configured MLB SportsDataIO channel is Discovery Lab; enterprise /v3/mlb/... endpoints are not executable for this key.'
      )
      blockers.push(
        mlbDiscoveryEndpoint
          ? 'Discovery Lab endpoint is confirmed, but MLB import execution remains blocked until payload normalization, persistence validation and quarantine gates pass.'
          : 'Exact Discovery Lab endpoint for this domain is unconfirmed or excluded from this validation batch; do not guess /api/mlb/{product}/json/... routes.'
      )
    }
    if (readiness === 'migration_pending') {
      blockers.push('Destination schema must be confirmed before provider-backed execution.')
    }
    if (
      [
        'pilot_validated_current_feed',
        'pilot_validated_date_feed',
        'pilot_validated_season_date_feeds',
        'historical_range_requires_per_date_execution',
        'historical_scope_limited',
      ].includes(readiness)
    ) {
      blockers.push(
        'Pilot validation confirms the normalized path, but production/historical execution remains trial-only until explicitly approved.'
      )
    }
    if (executionMode === 'trial_only') {
      blockers.push('Trial rows remain non-production and cannot improve prediction confidence.')
    }

    return {
      dataType,
      dependencyIndex: index + 1,
      dependsOn,
      scopeTypes: scopeTypesForSportAndDomain({ sportKey, dataType }),
      readiness,
      executionMode,
      estimatedProviderCalls,
      maximumProviderCalls,
      maximumRecords: maximumRecordsForDomain(dataType),
      checkpoint: `${sportKey}:${leagueKey}:${dataType}:checkpoint`,
      naturalKey: persistence.naturalKey,
      stableIdComponents: persistence.stableIdComponents,
      destinationTables: persistence.destinationTables,
      conflictTargets: persistence.conflictTargets,
      oneToManyExpansionPossible: persistence.oneToManyExpansionPossible,
      providerEndpointStatus:
        sportKey === 'baseball_mlb'
          ? {
              providerVariant: providerVariant ?? 'sportsdataio_enterprise',
              enterpriseEndpointConfirmed: providerVariant !== 'sportsdataio_discovery_lab' && routeSupported,
              discoveryLabEndpointConfirmed: Boolean(mlbDiscoveryEndpoint),
              discoveryLabProduct: mlbDiscoveryEndpoint?.product ?? (
                ['odds', 'historical_odds', 'player_props'].includes(dataType)
                  ? 'odds'
                  : 'fantasy'
              ),
              confirmedEndpoint: mlbDiscoveryEndpoint?.path ?? null,
              routeFamily:
                providerVariant === 'sportsdataio_discovery_lab'
                  ? '/api/mlb/{product}/json/{endpoint}'
                  : '/v3/mlb/{product}/json/{endpoint}',
              notes: [
                ...(providerVariant === 'sportsdataio_discovery_lab'
                  ? [
                      'Discovery Lab MLB endpoints are confirmed from the purchased Fantasy + Odds plan.',
                      mlbDiscoveryEndpoint
                        ? `Confirmed endpoint for this domain: ${mlbDiscoveryEndpoint.path}.`
                        : 'No executable endpoint is approved for this specific domain in the current validation batch.',
                      'Live execution remains blocked in the generic planner until the MLB normalizer and quarantine persistence path pass.',
                    ]
                  : ['Enterprise MLB endpoint status is separate from Discovery Lab entitlement.']),
              ],
            }
          : undefined,
      blockers,
      handoffs: {
        validation: 'Run mapping, duplicate, orphan, trial-isolation and nonnegative-counter checks before handoff.',
        featureGeneration:
          'Feature generation may consume only rows available before prediction cutoff and only after sufficiency checks.',
        settlement:
          ['scores', 'odds'].includes(dataType)
            ? 'Settlement can consume production-eligible results/prices after event completion and market validation.'
            : 'No settlement handoff for this domain.',
        backtesting:
          'Backtesting requires leakage-safe features, settled predictions and production-eligible historical rows.',
      },
    }
  })
}

function summarizeDomainManifests(domainManifests: HistoricalImportDomainManifest[]) {
  return {
    totalDomains: domainManifests.length,
    plannedDomains: domainManifests.filter((domain) => domain.executionMode !== 'blocked').length,
    blockedDomains: domainManifests.filter((domain) => domain.executionMode === 'blocked').length,
    migrationPendingDomains: domainManifests.filter((domain) => domain.readiness === 'migration_pending').length,
    entitlementBlockedDomains: domainManifests.filter((domain) => domain.readiness === 'entitlement_blocked').length,
    archiveRequiredDomains: domainManifests.filter(
      (domain) => domain.readiness === 'archived_historical_api_required'
    ).length,
  }
}

function buildSportPlan({
  sportKey,
  leagueKey,
  supportedDomains,
  dependencyOrder,
  destinationTables,
  naturalKeys,
  conflictTargets,
  recommendedBatchSizeDays,
  sportSpecificNotes,
  warnings,
  schemaCapabilities,
  providerVariant,
  providerRouteFamily,
  confirmedDiscoveryLabEndpoints,
}: {
  sportKey: SportKey
  leagueKey: string
  supportedDomains: ProviderDataType[]
  dependencyOrder: ProviderDataType[]
  destinationTables: string[]
  naturalKeys: string[]
  conflictTargets: string[]
  recommendedBatchSizeDays: number
  sportSpecificNotes: string[]
  warnings: string[]
  schemaCapabilities?: HistoricalFeatureSchemaCapabilities | null
  providerVariant?: 'sportsdataio_enterprise' | 'sportsdataio_discovery_lab'
  providerRouteFamily?: string
  confirmedDiscoveryLabEndpoints?: string[]
}): HistoricalImportSportPlan {
  const routeChecks = dependencyOrder.map((dataType) =>
    planProviderRoute({
      sportKey,
      leagueKey,
      dataType,
      dryRun: true,
    })
  )
  const routeBlockedDomains = routeChecks
    .filter((route) => !route.success || !route.supported)
    .map((route, index) => dependencyOrder[index])
  const domainManifests = buildDomainManifests({
    sportKey,
    leagueKey,
    dependencyOrder,
    recommendedBatchSizeDays,
    providerVariant,
    schemaCapabilities,
  })
  const aggregateDestinationTables = Array.from(
    new Set(domainManifests.flatMap((domain) => domain.destinationTables))
  )
  const aggregateNaturalKeys = Array.from(
    new Set(domainManifests.map((domain) => domain.naturalKey))
  )
  const aggregateConflictTargets = Array.from(
    new Set(domainManifests.flatMap((domain) => domain.conflictTargets))
  )
  const progress = summarizeDomainManifests(domainManifests)
  const blockedDomains = domainManifests
    .filter((domain) => domain.executionMode === 'blocked')
    .map((domain) => domain.dataType)
  const plannedDomains = domainManifests
    .filter((domain) => domain.executionMode !== 'blocked')
    .map((domain) => domain.dataType)
  const estimatedCalls = domainManifests.reduce(
    (sum, domain) => sum + domain.estimatedProviderCalls,
    0
  )
  const maximumCalls = domainManifests.reduce(
    (sum, domain) => sum + domain.maximumProviderCalls,
    0
  )

  return {
    sportKey,
    leagueKey,
    manifestVersion: 'historical_import_manifest_v2',
    status: blockedDomains.length === dependencyOrder.length ? 'blocked' : 'planned',
    providerCallsMade: 0,
    supportedDomains,
    dependencyOrder,
    domainManifests,
    destinationTables: aggregateDestinationTables,
    naturalKeys: aggregateNaturalKeys,
    conflictTargets: aggregateConflictTargets,
    requestCaps: {
      providerCalls: plannedDomains.length,
      concurrency: 1,
      automaticRetries: false,
      recommendedBatchSizeDays,
    },
    scope: {
      supportsSeason: true,
      supportsDateRange: true,
      checkpointStrategy:
        'One checkpoint per sport, league, data type and season/date window; checkpoints remain idempotent and resumable.',
      resumeStrategy:
        'Resume from the last incomplete checkpoint using the existing idempotency key and cursor contract.',
    },
    isolation: {
      trialRowsDefault: true,
      productionEligibleDefault: false,
      predictionTrainingAllowed: false,
    },
    handoffs: {
      dataQuality:
        'Run global and sport data-quality audits after persistence; surface typed partial coverage instead of fabricating rows.',
      featureStore:
        'Only promote normalized, production-eligible rows into feature views after mapping and quality gates pass.',
      predictionPreview:
        'Preview predictions with persistence disabled until provider mappings, coverage and trial isolation are approved.',
    },
    progress,
    providerCallAccounting: {
      callsMade: 0,
      estimatedCalls,
      maximumCalls,
      concurrency: 1,
      automaticRetries: false,
    },
    providerVariant,
    providerRouteFamily,
    confirmedDiscoveryLabEndpoints,
    recordAccounting: {
      providerRecordsFetched: 0,
      normalizedRowsProduced: 0,
      skippedProviderRecords: 0,
      skippedNormalizedRows: 0,
      recordsSkipped: 0,
      oneToManyExpansionSupported: true,
    },
    sportSpecificNotes,
    warnings: [
      ...warnings,
      ...routeBlockedDomains.map(
        (dataType) => `${dataType} has no confirmed executable provider route in the current dry-run planner.`
      ),
      ...blockedDomains.map(
        (dataType) => `${dataType} is blocked by provider variant, entitlement, migration or endpoint confirmation state.`
      ),
    ],
    requiresApproval: [
      'Provider and quota cap for any live execution.',
      'Exact provider endpoint/date-window confirmation before transport.',
      'Promotion from trial rows to production-eligible rows.',
    ],
  }
}

function buildMultiSportPlanning(
  batchSizeDays: number,
  schemaCapabilities?: HistoricalFeatureSchemaCapabilities | null
): HistoricalImportMultiSportPlanning {
  const sports = [
      buildSportPlan({
        sportKey: 'basketball_nba',
        leagueKey: 'nba',
        supportedDomains: [
          'schedules',
          'scores',
          'standings',
          'team_stats',
          'game_stats',
          'player_stats',
          'players',
          'injuries',
          'lineups',
          'odds',
          'historical_odds',
          'player_props',
        ],
        dependencyOrder: [
          'schedules',
          'scores',
          'standings',
          'players',
          'injuries',
          'lineups',
          'team_stats',
          'game_stats',
          'player_stats',
          'odds',
          'player_props',
        ],
        destinationTables: [
          'sport_events',
          'sports_teams',
          'sport_players',
          'sport_injuries',
          'sport_lineups',
          'sport_player_stats',
          'sports_odds_snapshots',
          'provider_entity_mappings',
          'sports_sync_jobs',
        ],
        naturalKeys: [
          'provider:event_id',
          'provider:team_id',
          'provider:player_id',
          'provider:injury_id',
          'sport_key:league_key:event_or_team:player:lineup_type:position:depth_order',
          'sport_key:league_key:season:stat_type:event:team:player',
          'sport_key:league_key:event_id:market:sportsbook:snapshot_time',
        ],
        conflictTargets: [
          'sport_events.id',
          'sports_teams.id',
          'sport_players.id',
          'sport_injuries.id',
          'sport_lineups.id',
          'sport_player_stats.id',
          'sports_odds_snapshots.id',
          'provider_entity_mappings(provider, entity_type, provider_entity_id, sport_key)',
        ],
        recommendedBatchSizeDays: Math.min(batchSizeDays, 2),
        sportSpecificNotes: [
          'Trial SportsDataIO rows are validated for transport and normalization only.',
          'Confirmed lineups can improve production confidence only when rows are non-trial, non-scrambled and prediction-cutoff safe.',
          'BettingEvents is currently discovery/index data; priced sportsbook outcomes remain blocked.',
        ],
        warnings: [
          'NBA production prediction use remains blocked for SportsDataIO trial rows and unpriced odds discovery records.',
        ],
        schemaCapabilities,
      }),
      buildSportPlan({
        sportKey: 'baseball_mlb',
        leagueKey: 'mlb',
        providerVariant: 'sportsdataio_discovery_lab',
        providerRouteFamily: '/api/mlb/{product}/json/{endpoint}',
        confirmedDiscoveryLabEndpoints: [
          '/api/mlb/fantasy/json/CurrentSeason',
          '/api/mlb/fantasy/json/Teams',
          '/api/mlb/fantasy/json/Standings/{season}',
          '/api/mlb/fantasy/json/PlayerGameStatsByDate/{date}',
          '/api/mlb/odds/json/Stadiums',
          '/api/mlb/odds/json/GamesByDate/{date}',
          '/api/mlb/odds/json/TeamGameStatsByDate/{date}',
          '/api/mlb/odds/json/GameOddsByDate/{date}',
        ],
        supportedDomains: [
          'schedules',
          'scores',
          'standings',
          'team_stats',
          'game_stats',
          'players',
          'injuries',
          'lineups',
          'odds',
          'historical_odds',
          'player_props',
        ],
        dependencyOrder: [
          'schedules',
          'scores',
          'standings',
          'players',
          'team_stats',
          'game_stats',
          'injuries',
          'lineups',
          'odds',
          'player_props',
        ],
        destinationTables: [
          'sport_events',
          'sports_teams',
          'sport_players',
          'sports_odds_snapshots',
          'provider_entity_mappings',
          'sports_sync_jobs',
        ],
        naturalKeys: [
          'provider:event_id',
          'provider:team_id',
          'provider:player_id',
          'sport_key:league_key:event_id:market:sportsbook:snapshot_time',
        ],
        conflictTargets: [
          'sport_events.id',
          'sports_teams.id',
          'sport_players.id',
          'provider_entity_mappings(provider, entity_type, provider_entity_id, sport_key)',
        ],
        recommendedBatchSizeDays: Math.min(batchSizeDays, 3),
        sportSpecificNotes: [
          'Purchased SportsDataIO MLB plan is Discovery Lab Fantasy + Odds and uses /api/mlb/{product}/json/{endpoint}.',
          'The enterprise /v3/mlb/... route family is cataloged separately and must not be selected automatically for this key.',
          'Confirmed Discovery Lab endpoints include Teams, Standings, Stadiums, GamesByDate, TeamGameStatsByDate, PlayerGameStatsByDate and GameOddsByDate.',
          'MLB Real Data Validation Batch V1 selected 2026-07-13 first, but game/stat/odds feeds were empty; 2026-07-12 was verified as a 15-game candidate after the call budget was mostly consumed.',
          'Doubleheaders require game-number or provider event ID disambiguation.',
          'Starting pitchers, bullpen workload and lineup locks must remain nullable until confirmed.',
          'Suspended/resumed games and extra innings must preserve provider status and final-score semantics.',
        ],
        warnings: [
          'MLB Discovery Lab import execution is blocked until the confirmed endpoint payloads are normalized and persisted under quarantined real-data gates.',
          'MLB advanced stat and lineup destinations need confirmation before production promotion.',
        ],
        schemaCapabilities,
      }),
      buildSportPlan({
        sportKey: 'americanfootball_nfl',
        leagueKey: 'nfl',
        supportedDomains: [
          'schedules',
          'scores',
          'standings',
          'team_stats',
          'game_stats',
          'players',
          'injuries',
          'lineups',
          'odds',
          'historical_odds',
          'player_props',
        ],
        dependencyOrder: [
          'schedules',
          'scores',
          'standings',
          'players',
          'injuries',
          'lineups',
          'team_stats',
          'game_stats',
          'odds',
          'player_props',
        ],
        destinationTables: [
          'sport_events',
          'sports_teams',
          'sport_players',
          'sports_odds_snapshots',
          'provider_entity_mappings',
          'sports_sync_jobs',
        ],
        naturalKeys: [
          'provider:event_id',
          'provider:team_id',
          'provider:player_id',
          'sport_key:league_key:season:week:season_type',
        ],
        conflictTargets: [
          'sport_events.id',
          'sports_teams.id',
          'sport_players.id',
          'provider_entity_mappings(provider, entity_type, provider_entity_id, sport_key)',
        ],
        recommendedBatchSizeDays: Math.min(batchSizeDays, 7),
        sportSpecificNotes: [
          'Season type, week and playoff round must be explicit on every event.',
          'Quarter and overtime scoring should remain structured metadata until normalized columns exist.',
          'QB status, depth chart changes and injury designations are gating inputs for production predictions.',
        ],
        warnings: [
          'NFL live execution requires endpoint confirmation for season type and week-scoped requests.',
        ],
        schemaCapabilities,
      }),
      buildSportPlan({
        sportKey: 'icehockey_nhl',
        leagueKey: 'nhl',
        supportedDomains: [
          'schedules',
          'scores',
          'standings',
          'team_stats',
          'game_stats',
          'players',
          'injuries',
          'lineups',
          'odds',
          'historical_odds',
          'player_props',
        ],
        dependencyOrder: [
          'schedules',
          'scores',
          'standings',
          'players',
          'injuries',
          'lineups',
          'team_stats',
          'game_stats',
          'odds',
          'player_props',
        ],
        destinationTables: [
          'sport_events',
          'sports_teams',
          'sport_players',
          'sports_odds_snapshots',
          'provider_entity_mappings',
          'sports_sync_jobs',
        ],
        naturalKeys: [
          'provider:event_id',
          'provider:team_id',
          'provider:player_id',
          'sport_key:league_key:event_id:period',
        ],
        conflictTargets: [
          'sport_events.id',
          'sports_teams.id',
          'sport_players.id',
          'provider_entity_mappings(provider, entity_type, provider_entity_id, sport_key)',
        ],
        recommendedBatchSizeDays: Math.min(batchSizeDays, 3),
        sportSpecificNotes: [
          'Regulation, overtime and shootout outcomes must be normalized distinctly.',
          'Starting goalie, line combinations and scratches are production-gating signals.',
          'Special teams, period scoring and empty-net context should remain explicit metadata until modeled.',
        ],
        warnings: [
          'NHL goalie and line data must not be inferred when the provider omits confirmation.',
        ],
        schemaCapabilities,
      }),
      buildSportPlan({
        sportKey: 'soccer',
        leagueKey: 'soccer_generic',
        supportedDomains: [
          'schedules',
          'scores',
          'standings',
          'team_stats',
          'game_stats',
          'players',
          'lineups',
          'odds',
          'historical_odds',
          'player_props',
        ],
        dependencyOrder: [
          'schedules',
          'scores',
          'standings',
          'players',
          'lineups',
          'team_stats',
          'game_stats',
          'odds',
          'player_props',
        ],
        destinationTables: [
          'sport_events',
          'sports_teams',
          'sport_players',
          'sports_odds_snapshots',
          'provider_entity_mappings',
          'sports_sync_jobs',
        ],
        naturalKeys: [
          'provider:event_id',
          'provider:competition_id',
          'provider:team_id',
          'provider:player_id',
          'sport_key:league_key:event_id:market:sportsbook:snapshot_time',
        ],
        conflictTargets: [
          'sport_events.id',
          'sports_teams.id',
          'sport_players.id',
          'provider_entity_mappings(provider, entity_type, provider_entity_id, sport_key)',
        ],
        recommendedBatchSizeDays: Math.min(batchSizeDays, 7),
        sportSpecificNotes: [
          'Competition, season, stage, group and round must be preserved for every event.',
          '1X2 markets, draws, two-leg ties, extra time, penalties and qualification outcomes need explicit status fields.',
          'First-half scores can feed previews only after competition-specific coverage is validated.',
        ],
        warnings: [
          'Soccer is multi-competition; exact competitions and endpoint keys require approval before import execution.',
        ],
        schemaCapabilities,
      }),
    ]

  const dependencyGraph = sports.map((sport) => ({
    sportKey: sport.sportKey,
    leagueKey: sport.leagueKey,
    domains: sport.domainManifests.map((domain) => ({
      dataType: domain.dataType,
      dependsOn: domain.dependsOn,
      readiness: domain.readiness,
    })),
  }))
  const checks = {
    includesPrioritySports: ['basketball_nba', 'baseball_mlb', 'americanfootball_nfl', 'icehockey_nhl', 'soccer'].every(
      (sportKey) => sports.some((sport) => sport.sportKey === sportKey)
    ),
    zeroProviderCalls: sports.every((sport) => sport.providerCallsMade === 0),
    concurrencyOne: sports.every((sport) => sport.providerCallAccounting.concurrency === 1),
    automaticRetriesDisabled: sports.every(
      (sport) => sport.providerCallAccounting.automaticRetries === false
    ),
    trialIsolationDefault: sports.every(
      (sport) =>
        sport.isolation.trialRowsDefault &&
        !sport.isolation.productionEligibleDefault &&
        !sport.isolation.predictionTrainingAllowed
    ),
    oneToManyCountersNonnegative: sports.every(
      (sport) =>
        sport.recordAccounting.recordsSkipped >= 0 &&
        sport.recordAccounting.skippedProviderRecords >= 0 &&
        sport.recordAccounting.skippedNormalizedRows >= 0
    ),
    dependencyIndexesStable: sports.every((sport) =>
      sport.domainManifests.every(
        (domain, index) => domain.dependencyIndex === index + 1
      )
    ),
  }

  return {
    mode: 'historical_import_multi_sport_planning_v2',
    providerCallsMade: 0,
    canonicalRoute: '/api/historical-import/plan',
    safeguards: [
      'Planning is dry-run only and performs zero provider calls.',
      'No endpoints are guessed; unsupported or unconfirmed capabilities remain blocked warnings.',
      'Every future execution must use concurrency 1 unless explicitly approved otherwise.',
      'Trial rows default to production_eligible=false and cannot improve production confidence.',
      'Provider records fetched and normalized rows produced are tracked separately for one-to-many payload expansion.',
    ],
    sports,
    dependencyGraph,
    validation: {
      valid: Object.values(checks).every(Boolean),
      checks,
      warnings: [
        'V2 planning is still a dry-run contract; it does not authorize full historical imports.',
        'Production-eligible execution requires explicit provider quota, endpoint and promotion approval.',
      ],
    },
  }
}

function buildDateWindows({
  dateFrom,
  dateTo,
  batchSizeDays,
}: {
  dateFrom: string | null
  dateTo: string | null
  batchSizeDays: number
}) {
  const from = parseDate(dateFrom)
  const to = parseDate(dateTo)

  if (!from || !to || from.getTime() > to.getTime()) return []

  const windows: Array<{ dateFrom: string; dateTo: string }> = []
  let cursor = from

  while (cursor.getTime() <= to.getTime()) {
    const end = new Date(Math.min(addDays(cursor, batchSizeDays - 1).getTime(), to.getTime()))
    windows.push({
      dateFrom: dateOnly(cursor),
      dateTo: dateOnly(end),
    })
    cursor = addDays(end, 1)
  }

  return windows
}

export function runHistoricalImportEngineV2Validation() {
  const plan = planHistoricalImport({
    sportKey: 'basketball_nba',
    leagueKey: 'nba',
    providerId: 'sportsdataio',
    season: '2026',
    dateFrom: '2025-12-26',
    dateTo: '2025-12-26',
    dataTypes: ['schedules', 'scores', 'players', 'lineups', 'player_stats', 'odds'],
    dryRun: true,
    batchSizeDays: 1,
  })
  const multiSport = plan.multiSportPlanning
  const nba = multiSport.sports.find((sport) => sport.sportKey === 'basketball_nba')
  const oneToManyFixture = recordCountersFromMetadata(
    {
      recordCounters: {
        providerRecordsFetched: 39,
        normalizedRowsProduced: 758,
        skippedProviderRecords: 0,
        skippedNormalizedRows: 0,
        recordsSkipped: 0,
        oneToManyExpansion: true,
        expansionRatio: 758 / 39,
      },
    },
    { fetched: 39, skipped: 0 }
  )
  const checks = {
    dryRunOnly: plan.dryRun && plan.providerUsage.externalProviderCallsMade === 0,
    canonicalRouteStable: multiSport.canonicalRoute === '/api/historical-import/plan',
    prioritySportsIncluded:
      multiSport.validation.checks.includesPrioritySports && multiSport.sports.length >= 5,
    nbaManifestPresent: Boolean(nba?.domainManifests.length),
    deterministicDependencies:
      Boolean(nba) &&
      nba!.domainManifests.every((domain, index) => domain.dependencyIndex === index + 1),
    providerCallAccounting:
      Boolean(nba) &&
      nba!.providerCallAccounting.callsMade === 0 &&
      nba!.providerCallAccounting.concurrency === 1 &&
      nba!.providerCallAccounting.automaticRetries === false,
    trialIsolation:
      Boolean(nba) &&
      nba!.isolation.trialRowsDefault &&
      !nba!.isolation.productionEligibleDefault &&
      !nba!.isolation.predictionTrainingAllowed,
    oneToManyExpansionCounters:
      oneToManyFixture.providerRecordsFetched === 39 &&
      oneToManyFixture.normalizedRowsProduced === 758 &&
      oneToManyFixture.recordsSkipped === 0 &&
      oneToManyFixture.skippedProviderRecords === 0 &&
      oneToManyFixture.skippedNormalizedRows === 0 &&
      oneToManyFixture.oneToManyExpansion,
  }

  return {
    success: Object.values(checks).every(Boolean),
    mode: 'historical_import_engine_v2_validation',
    generatedAt: generatedAt(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'deterministic_local_validation_only',
    },
    checks,
    oneToManyFixture: {
      providerRecordsFetched: oneToManyFixture.providerRecordsFetched,
      normalizedRowsProduced: oneToManyFixture.normalizedRowsProduced,
      recordsSkipped: oneToManyFixture.recordsSkipped,
      skippedProviderRecords: oneToManyFixture.skippedProviderRecords,
      skippedNormalizedRows: oneToManyFixture.skippedNormalizedRows,
      oneToManyExpansion: oneToManyFixture.oneToManyExpansion,
    },
    summary: {
      sportsPlanned: multiSport.sports.length,
      nbaDomains: nba?.domainManifests.length ?? 0,
      totalEstimatedProviderCalls: multiSport.sports.reduce(
        (sum, sport) => sum + sport.providerCallAccounting.estimatedCalls,
        0
      ),
      totalMaximumProviderCalls: multiSport.sports.reduce(
        (sum, sport) => sum + sport.providerCallAccounting.maximumCalls,
        0
      ),
    },
    warnings: [
      'Validation is local and deterministic; it does not execute provider transport or mutate Supabase.',
    ],
  }
}

function buildCheckpoints({
  sportKey,
  leagueKey,
  providerId,
  season,
  dateFrom,
  dateTo,
  dataTypes,
  batchSizeDays,
}: {
  sportKey: SportKey
  leagueKey: string | null
  providerId: string | null
  season: string | null
  dateFrom: string | null
  dateTo: string | null
  dataTypes: ProviderDataType[]
  batchSizeDays: number
}) {
  const windows = buildDateWindows({ dateFrom, dateTo, batchSizeDays })
  const hasDateScope = windows.length > 0
  const dateScopes = hasDateScope
    ? windows
    : [{ dateFrom: null, dateTo: null }]
  const checkpoints: HistoricalImportCheckpoint[] = []
  const costTiers: CostTier[] = []
  const validationWarnings: string[] = []

  for (const dataType of dataTypes) {
    const route = planProviderRoute({
      sportKey,
      leagueKey,
      providerId,
      dataType,
      dryRun: true,
    })
    const selectedProvider = route.success ? route.selectedProvider : null
    const warnings =
      route.success && route.explanation.length
        ? route.explanation
        : ['Provider route could not be planned for this data type.']
    const status = route.success && route.supported ? 'planned' : 'blocked'

    if (selectedProvider?.costTier) {
      costTiers.push(selectedProvider.costTier)
    }

    if (status === 'blocked') {
      validationWarnings.push(
        `No executable provider route for ${dataType} on ${sportKey}.`
      )
    }

    for (const scope of dateScopes) {
      const sequence = checkpoints.length + 1
      const checkpointProvider = selectedProvider?.providerId ?? providerId
      const key = idempotencyKey([
        'historical-import',
        sportKey,
        leagueKey,
        checkpointProvider,
        dataType,
        season,
        scope.dateFrom,
        scope.dateTo,
      ])

      checkpoints.push({
        id: key,
        sequence,
        scope: hasDateScope ? 'date_range' : 'season',
        sportKey,
        leagueKey,
        providerId: checkpointProvider ?? null,
        dataType,
        season,
        dateFrom: scope.dateFrom,
        dateTo: scope.dateTo,
        status,
        cursor: createCursorContract({
          cursor: null,
          nextCursor: null,
          pageSize: batchSizeDays,
          returned: 0,
        }),
        idempotencyKey: key,
        dedupeKey: idempotencyKey([
          sportKey,
          leagueKey,
          dataType,
          scope.dateFrom ?? season,
        ]),
        estimatedProviderCalls: status === 'planned' ? 1 : 0,
        warnings,
      })
    }
  }

  return {
    checkpoints,
    costTier: maxCostTier(costTiers),
    validationWarnings,
  }
}

export function planHistoricalImport(
  request: HistoricalImportRequest = {},
  schemaCapabilities: HistoricalFeatureSchemaCapabilities | null = null
): HistoricalImportPlan {
  const errors: string[] = []
  const warnings: string[] = []
  const sportKey = isSportKey(request.sportKey) ? request.sportKey : null
  const leagueKey = request.leagueKey?.trim() || null
  const providerId = request.providerId?.trim() || null
  const season = request.season?.trim() || null
  const dateFrom = request.dateFrom?.trim() || null
  const dateTo = request.dateTo?.trim() || null
  const batchSizeDays = clampBatchSize(request.batchSizeDays)
  const dataTypes = normalizeDataTypes(request.dataTypes)
  const invalidDataTypes =
    request.dataTypes?.filter((value) => !isImportDataType(value)) ?? []

  if (!sportKey) {
    errors.push('sportKey must be a configured sport.')
  }

  if (sportKey && leagueKey) {
    const leagues = getLeaguesForSport(sportKey).map((league) => league.key)
    if (!leagues.includes(leagueKey)) {
      warnings.push(`${leagueKey} is not registered for ${sportKey}; plan will remain dry-run.`)
    }
  }

  if (invalidDataTypes.length > 0) {
    errors.push(
      `Unsupported import dataTypes: ${invalidDataTypes.join(', ')}.`
    )
  }

  if (!season && (!dateFrom || !dateTo)) {
    errors.push('Provide either a season or dateFrom/dateTo.')
  }

  const from = parseDate(dateFrom)
  const to = parseDate(dateTo)
  if ((dateFrom || dateTo) && (!from || !to)) {
    errors.push('dateFrom and dateTo must be valid YYYY-MM-DD dates.')
  }

  if (from && to && from.getTime() > to.getTime()) {
    errors.push('dateFrom must be before or equal to dateTo.')
  }

  if (request.dryRun === false) {
    warnings.push('Execution is disabled in Historical Import Engine Core; dryRun was forced to true.')
  }

  const checkpointResult =
    errors.length === 0 && sportKey
      ? buildCheckpoints({
          sportKey,
          leagueKey,
          providerId,
          season,
          dateFrom,
          dateTo,
          dataTypes,
          batchSizeDays,
        })
      : {
          checkpoints: [] as HistoricalImportCheckpoint[],
          costTier: 'unknown' as CostTier,
          validationWarnings: [] as string[],
        }
  const allWarnings = [...warnings, ...checkpointResult.validationWarnings]
  const estimatedProviderCalls = checkpointResult.checkpoints.reduce(
    (sum, item) => sum + item.estimatedProviderCalls,
    0
  )
  const blockedCheckpoints = checkpointResult.checkpoints.filter(
    (item) => item.status === 'blocked'
  ).length
  const status =
    errors.length > 0
      ? 'blocked'
      : blockedCheckpoints === checkpointResult.checkpoints.length &&
          checkpointResult.checkpoints.length > 0
        ? 'blocked'
        : 'planned'
  const jobId = idempotencyKey([
    'historical-import-plan',
    sportKey,
    leagueKey,
    providerId,
    season,
    dateFrom,
    dateTo,
    dataTypes.join('-'),
    batchSizeDays,
  ])

  return {
    success: errors.length === 0,
    mode: 'historical_import_engine_core_v1',
    dryRun: true,
    generatedAt: generatedAt(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'dry_run_planner_only',
    },
    request: {
      sportKey,
      leagueKey,
      providerId,
      season,
      dateFrom,
      dateTo,
      dataTypes,
      batchSizeDays,
    },
    status,
    validation: {
      valid: errors.length === 0,
      errors,
      warnings: allWarnings,
    },
    job: {
      id: jobId,
      status,
      progressPercent: 0,
      totalCheckpoints: checkpointResult.checkpoints.length,
      blockedCheckpoints,
      executableCheckpoints: checkpointResult.checkpoints.length - blockedCheckpoints,
      recordsFetched: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      errorCount: errors.length,
    },
    quotaEstimate: {
      estimatedProviderCalls,
      costTier: checkpointResult.costTier,
      quotaImpact: quotaImpact(estimatedProviderCalls, checkpointResult.costTier),
      recommendedBatchSizeDays: batchSizeDays,
      warning:
        estimatedProviderCalls === 0
          ? 'No provider calls are required for this dry-run response.'
          : 'These calls are estimates only; Core V1 does not execute external provider imports.',
    },
    executionPlan: {
      order: dataTypes,
      retryPolicy: getDefaultRetryPolicy(),
      partialFailureIsolation:
        'Each checkpoint is independently idempotent and can be retried without advancing sibling checkpoints.',
      idempotency:
        'Idempotency keys combine sport, league, provider, data type, season and date window.',
      deduplication:
        'Normalized persistence must upsert by provider entity mapping or table-specific natural keys.',
      providerEntityMapping:
        'Provider IDs should resolve through provider_entity_mappings before writing normalized entities.',
      persistence:
        'Core V1 is read-only/dry-run; future execution can record status in sports_sync_jobs metadata.',
    },
    checkpoints: checkpointResult.checkpoints,
    multiSportPlanning: buildMultiSportPlanning(batchSizeDays, schemaCapabilities),
    featureGenerationHandoff: planHistoricalFeatureGeneration({
      sportKey,
      leagueKey,
      market: 'moneyline',
      predictionCutoff: dateFrom ? `${dateFrom}T12:00:00.000Z` : null,
      batchSize: batchSizeDays,
      executionMode: 'trial_only',
    }, schemaCapabilities),
    schemaCapabilities,
  }
}

export async function getHistoricalImportHealth() {
  const [jobsResult, mappingsResult, jobsCountResult, mappingsCountResult] =
    await Promise.allSettled([
    supabaseAdmin
      .from('sports_sync_jobs')
      .select(
        'id, job_type, sport_key, league_key, provider, season, started_at, completed_at, status, records_fetched, records_inserted, records_updated, records_skipped, error_count, last_error, duration_ms, metadata'
      )
      .order('started_at', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('provider_entity_mappings')
      .select('sport_key, entity_type, provider, season')
      .limit(5000),
    supabaseAdmin
      .from('sports_sync_jobs')
      .select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('provider_entity_mappings')
      .select('*', { count: 'exact', head: true }),
  ])

  const jobWarning =
    jobsResult.status === 'rejected'
      ? `sports_sync_jobs unavailable: ${jobsResult.reason instanceof Error ? jobsResult.reason.message : 'unknown error'}`
      : jobsResult.value.error
        ? `sports_sync_jobs unavailable: ${jobsResult.value.error.message}`
        : null
  const mappingWarning =
    mappingsResult.status === 'rejected'
      ? `provider_entity_mappings unavailable: ${mappingsResult.reason instanceof Error ? mappingsResult.reason.message : 'unknown error'}`
      : mappingsResult.value.error
        ? `provider_entity_mappings unavailable: ${mappingsResult.value.error.message}`
        : null
  const jobsCountWarning =
    jobsCountResult.status === 'rejected'
      ? `sports_sync_jobs exact count unavailable: ${jobsCountResult.reason instanceof Error ? jobsCountResult.reason.message : 'unknown error'}`
      : jobsCountResult.value.error
        ? `sports_sync_jobs exact count unavailable: ${jobsCountResult.value.error.message}`
        : null
  const mappingsCountWarning =
    mappingsCountResult.status === 'rejected'
      ? `provider_entity_mappings exact count unavailable: ${mappingsCountResult.reason instanceof Error ? mappingsCountResult.reason.message : 'unknown error'}`
      : mappingsCountResult.value.error
        ? `provider_entity_mappings exact count unavailable: ${mappingsCountResult.value.error.message}`
        : null

  const jobsData =
    jobsResult.status === 'fulfilled' && !jobsResult.value.error
      ? jobsResult.value.data
      : []
  const mappingsData =
    mappingsResult.status === 'fulfilled' && !mappingsResult.value.error
      ? mappingsResult.value.data
      : []
  const jobs = ((jobsData ?? []) as SyncJobRow[]).map((job) => ({
    ...job,
    error_count: job.error_count ?? 0,
  }))
  const mappings = mappingsData ?? []
  const failedJobs = jobs.filter((job) => job.status === 'failed')
  const runningJobs = jobs.filter((job) => job.status === 'running')
  const partialJobs = jobs.filter((job) => job.status === 'partial')
  const totalJobs =
    jobsCountResult.status === 'fulfilled' && !jobsCountResult.value.error
      ? jobsCountResult.value.count ?? jobs.length
      : jobs.length
  const totalMappings =
    mappingsCountResult.status === 'fulfilled' && !mappingsCountResult.value.error
      ? mappingsCountResult.value.count ?? mappings.length
      : mappings.length
  const status =
    jobWarning || mappingWarning || jobsCountWarning || mappingsCountWarning
      ? 'degraded'
      : runningJobs.length > 0 || partialJobs.length > 0
        ? 'watch'
        : failedJobs.length > 0
          ? 'ready_with_historical_failures'
        : 'ready'

  return {
    success: true,
    mode: 'historical_import_engine_core_health_v1',
    generatedAt: generatedAt(),
    dryRun: true,
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'stored_supabase_metadata_only',
    },
    status,
    summary: {
      recentJobs: jobs.length,
      totalJobs,
      failedJobs: failedJobs.length,
      runningJobs: runningJobs.length,
      partialJobs: partialJobs.length,
      providerMappings: totalMappings,
      sampledProviderMappings: mappings.length,
      sportsWithMappings: new Set(mappings.map((row) => row.sport_key)).size,
      providersWithMappings: new Set(mappings.map((row) => row.provider)).size,
    },
    capabilities: {
      dryRunPlanning: true,
      resumableCheckpoints: true,
      providerEntityMapping: true,
      idempotencyKeys: true,
      retryPolicy: true,
      externalExecution: false,
    },
    warnings: [
      ...[jobWarning, mappingWarning, jobsCountWarning, mappingsCountWarning].filter(
        (item): item is string => Boolean(item)
      ),
      ...(failedJobs.length
        ? [`${failedJobs.length} historical failed sync jobs remain in the audit ledger; no jobs are currently running.`]
        : []),
      'Core V1 does not execute provider imports.',
      'Manual provider activation, quota caps and optional persistence migrations belong to a later execution phase.',
    ],
  }
}

export async function listHistoricalImportJobs() {
  const result = await supabaseAdmin
    .from('sports_sync_jobs')
    .select(
      'id, job_type, sport_key, league_key, provider, season, started_at, completed_at, status, records_fetched, records_inserted, records_updated, records_skipped, error_count, last_error, duration_ms, metadata'
    )
    .order('started_at', { ascending: false })
    .limit(100)
    .then(
      (value) => ({ status: 'fulfilled' as const, value }),
      (reason) => ({ status: 'rejected' as const, reason })
    )

  const warning =
    result.status === 'rejected'
      ? `sports_sync_jobs unavailable: ${result.reason instanceof Error ? result.reason.message : 'unknown error'}`
      : result.value.error
        ? `sports_sync_jobs unavailable: ${result.value.error.message}`
        : null

  const data =
    result.status === 'fulfilled' && !result.value.error ? result.value.data : []
  const nowMs = Date.now()
  const jobs = ((data ?? []) as SyncJobRow[]).map((job) => {
    const fetched = job.records_fetched ?? 0
    const skipped = Math.max(0, job.records_skipped ?? 0)
    const recordCounters = recordCountersFromMetadata(job.metadata, { fetched, skipped })
    const metadata = job.metadata ?? {}
    const checkpoint = recordFromMetadata(metadata.checkpoint)
    const providerCallAccounting = recordFromMetadata(metadata.providerCallAccounting)
    const configuredTimeoutMs = numberFromMetadata(checkpoint.configuredTimeoutMs, 60_000)
    const startedAtMs = job.started_at ? new Date(job.started_at).getTime() : Number.NaN
    const runningAgeMs =
      job.status === 'running' && Number.isFinite(startedAtMs) ? Math.max(0, nowMs - startedAtMs) : 0
    const providerCallState = stringFromMetadata(
      providerCallAccounting.state,
      stringFromMetadata(checkpoint.providerCallState, 'AMBIGUOUS')
    )
    const conservativeBudgetCount = numberFromMetadata(
      providerCallAccounting.conservativeBudgetCount,
      numberFromMetadata(metadata.externalCallsUsed, providerCallState === 'NOT_ATTEMPTED' ? 0 : 1)
    )
    const stuck =
      job.status === 'running' &&
      Number.isFinite(startedAtMs) &&
      runningAgeMs > configuredTimeoutMs + HISTORICAL_IMPORT_STUCK_GRACE_MS

    return {
      id: job.id,
      jobType: job.job_type,
      sportKey: job.sport_key,
      leagueKey: job.league_key,
      provider: job.provider,
      season: job.season,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      status: job.status,
      durationMs: job.duration_ms,
      counters: {
        fetched,
        providerRecordsFetched: recordCounters.providerRecordsFetched,
        normalizedRowsProduced: recordCounters.normalizedRowsProduced,
        inserted: job.records_inserted ?? 0,
        updated: job.records_updated ?? 0,
        skipped,
        recordsSkipped: recordCounters.recordsSkipped,
        skippedProviderRecords: recordCounters.skippedProviderRecords,
        skippedNormalizedRows: recordCounters.skippedNormalizedRows,
        oneToManyExpansion: recordCounters.oneToManyExpansion,
        expansionRatio: recordCounters.expansionRatio,
        errors: job.error_count ?? 0,
      },
      lastError: job.last_error,
      reconciliation: {
        readOnly: true,
        stuck,
        ageMs: runningAgeMs,
        configuredTimeoutMs,
        graceMs: HISTORICAL_IMPORT_STUCK_GRACE_MS,
        providerCallState,
        conservativeBudgetCount,
        recommendedTerminalStatus: stuck
          ? providerCallState === 'NOT_ATTEMPTED'
            ? 'failed'
            : providerCallState === 'RESPONSE_RECEIVED' || providerCallState === 'COMPLETED'
              ? 'ambiguous'
              : 'timed_out'
          : null,
        retryEligible: false,
        action: stuck
          ? 'manual_reconciliation_required_before_retry'
          : job.status === 'running'
            ? 'wait_for_timeout_window'
            : 'none',
      },
      metadata,
    }
  })
  const stuckJobs = jobs.filter((job) => job.reconciliation.stuck)

  return {
    success: true,
    mode: 'historical_import_engine_core_jobs_v1',
    generatedAt: generatedAt(),
    dryRun: true,
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'sports_sync_jobs_read_only',
    },
    summary: {
      jobs: jobs.length,
      failed: jobs.filter((job) => job.status === 'failed').length,
      running: jobs.filter((job) => job.status === 'running').length,
      completed: jobs.filter((job) => job.status === 'completed').length,
      partial: jobs.filter((job) => job.status === 'partial').length,
      timedOut: jobs.filter((job) => job.status === 'timed_out').length,
      canceled: jobs.filter((job) => job.status === 'canceled').length,
      stuck: stuckJobs.length,
      reconciliationRequired: stuckJobs.length,
    },
    warnings: [
      ...(warning ? [warning] : []),
      ...(stuckJobs.length
        ? [`${stuckJobs.length} historical import job(s) are past timeout plus grace and require manual reconciliation before retry.`]
        : []),
      'Core V1 jobs endpoint is read-only and returns an empty typed response when Supabase metadata is unavailable.',
    ],
    jobs,
  }
}
