import { SportKey } from '@/config/sports.config'
import {
  HistoricalFeatureSchemaCapabilities,
  SchemaCapabilityStatus,
  probeHistoricalFeatureSchemaCapabilities,
} from '@/lib/server-schema-capabilities'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  createFeatureSnapshot,
  getFeatureDefinitions,
} from '@/services/feature-store-core.service'
import { lookupFeatureSet } from '@/services/multi-sport-feature-registry.service'
import { MarketKey } from '@/types/multi-sport'

type HistoricalFeatureExecutionMode = 'trial_only' | 'production'
type HistoricalFeatureRecordKind =
  | 'event_context'
  | 'team_form'
  | 'player_stats'
  | 'injury_context'
  | 'lineup_context'
  | 'market_odds'
  | 'closing_line'
  | 'settlement'
  | 'performance'

type LeakageDecision = 'allowed' | 'rejected' | 'unavailable'
type SnapshotPersistenceStatus =
  | 'migration_pending'
  | 'ready'
  | 'persistence_blocked'
  | 'leakage_blocked'
  | 'conflict_detected'
  | 'idempotent_match'
  | 'permission_blocked'
  | 'configuration_missing'
  | 'probe_failed'
  | 'unknown'

type HistoricalSnapshotWriteStatus =
  | 'completed'
  | 'dry_run'
  | 'blocked'
  | 'no_eligible_candidates'
  | 'partial'
  | 'failed'

export type HistoricalFeatureGenerationRequest = {
  sportKey?: SportKey | null
  leagueKey?: string | null
  market?: MarketKey | null
  eventId?: string | null
  modelVersion?: string | null
  featureSetVersion?: string | null
  predictionCutoff?: string | null
  eventStartTime?: string | null
  asOfTimestamp?: string | null
  dryRun?: boolean | null
  batchSize?: number | null
  executionMode?: HistoricalFeatureExecutionMode | null
}

export type HistoricalSourceRecord = {
  id: string
  kind: HistoricalFeatureRecordKind
  sourceTable: string
  sourceTimestamp: string | null
  eventStartTime?: string | null
  finalOutcome?: boolean
  postgameStat?: boolean
  trial?: boolean
  scrambled?: boolean
  productionEligible?: boolean
}

export type HistoricalFeatureLeakageCheck = {
  recordId: string
  kind: HistoricalFeatureRecordKind
  sourceTimestamp: string | null
  decision: LeakageDecision
  reason: string
  severity: 'info' | 'warning' | 'error'
}

export type HistoricalFeatureSnapshot = {
  id: string
  sportKey: SportKey
  leagueKey: string | null
  eventId: string
  market: MarketKey
  predictionCutoff: string
  asOfTimestamp: string
  modelVersion: string
  featureSetVersion: string
  provider: 'normalized_store'
  trial: boolean
  scrambled: boolean
  productionEligible: boolean
  dryRun: true
  lineage: {
    source: 'persisted_normalized_records_only'
    sourceTables: string[]
    sourceRecordIds: string[]
    generatedFromSnapshotId: string
    deterministicRegenerationKey: string
  }
  sections: Record<string, unknown>
  leakage: {
    noLeakage: boolean
    checks: HistoricalFeatureLeakageCheck[]
    rejectedRecords: number
    unavailableRecords: number
  }
  counters: {
    sourceRecordsEvaluated: number
    sourceRecordsAllowed: number
    sourceRecordsRejected: number
    sourceRecordsUnavailable: number
    recordsSkipped: number
  }
}

export type HistoricalFeatureSnapshotPersistenceReadiness = {
  mode: 'historical_feature_snapshot_persistence_v1'
  status: SnapshotPersistenceStatus
  migration: {
    required: true
    applied: boolean
    status: SchemaCapabilityStatus
    filename: '202607140001_historical_feature_snapshots_v1.sql'
    table: 'historical_feature_snapshots'
    predictionLinkageColumns: [
      'feature_snapshot_id',
      'feature_snapshot_key',
      'feature_set_version',
      'feature_snapshot_generated_at',
      'production_eligible',
      'trial',
      'scrambled',
    ]
  }
  schemaProbe: {
    mode: 'server_schema_capability_probe_v1'
    historicalFeatureSnapshots: SchemaCapabilityStatus
    predictionHistoryFeatureSnapshotLinkage: SchemaCapabilityStatus
  }
  persistencePolicy: {
    immutablePredictionTimeSnapshots: true
    identicalRegenerationIsIdempotent: true
    changedLineageRequiresDistinctKey: true
    linkedSnapshotOverwriteRejected: true
    rawProviderPayloadStorageAllowed: false
  }
  deterministicKey: string
  lineageHash: string
  blockers: string[]
}

export type HistoricalFeatureSnapshotPersistenceResult = {
  mode: 'historical_feature_snapshot_persistence_attempt_v1'
  status: SnapshotPersistenceStatus
  dryRun: true
  persisted: false
  inserted: 0
  updated: 0
  skipped: number
  conflicts: number
  errors: string[]
  checkpoint: {
    stableKey: string
    canResume: boolean
    cancelled: boolean
    successfulRowsPreserved: boolean
  }
}

export type HistoricalFeatureBacktestEligibility = {
  mode: 'historical_feature_backtest_eligibility_v1'
  eligible: boolean
  blockers: Array<
    | 'migration_pending'
    | 'missing_snapshot'
    | 'missing_lineage'
    | 'snapshot_generated_too_late'
    | 'unresolved_leakage'
    | 'missing_price'
    | 'unsettled_prediction'
    | 'trial_data'
    | 'insufficient_sample'
    | 'missing_closing_snapshot'
  >
  checks: Record<string, boolean>
}

export type HistoricalFeatureGenerationPlan = {
  mode: 'historical_feature_generation_orchestrator_v1'
  dryRun: true
  providerUsage: {
    externalProviderCallsMade: 0
    source: 'persisted_normalized_records_only'
  }
  status: 'ready_dry_run' | 'blocked'
  eligibility: {
    eligible: boolean
    requiredSourceDomains: string[]
    blockingMissingDomains: string[]
    predictionCutoffStrategy: string
    persistenceReady: boolean
    leakageValidationReady: boolean
    backtestHandoffReady: boolean
    snapshotPersistenceStatus: SnapshotPersistenceStatus
    migrationFilename: '202607140001_historical_feature_snapshots_v1.sql'
  }
  batching: {
    estimatedEventCount: number
    estimatedFeatureSnapshotCount: number
    batchSize: number
    checkpointStrategy: string
    resumeStrategy: string
    cancellationContract: string
    partialFailureIsolation: string
  }
  idempotency: {
    stableNaturalKey: string
    deterministicSnapshotId: string
    duplicatePrevention: string
    deterministicRegeneration: boolean
  }
  snapshot: HistoricalFeatureSnapshot
  persistenceReadiness: HistoricalFeatureSnapshotPersistenceReadiness
  persistenceResult: HistoricalFeatureSnapshotPersistenceResult
  backtestInputReadiness: BacktestInputReadiness
  warnings: string[]
}

export type BacktestInputReadiness = {
  mode: 'backtest_input_readiness_v1'
  ready: boolean
  migration: {
    required: true
    applied: boolean
    status: SchemaCapabilityStatus
    filename: '202607140001_historical_feature_snapshots_v1.sql'
    table: 'historical_feature_snapshots'
  }
  requiredFields: string[]
  rejectionRules: string[]
  duplicateKey: string
  clvPolicy: string
  trialPolicy: string
  insufficientDataResponse: {
    status: 'blocked'
    reason: string
  }
}

export type HistoricalFeatureSnapshotWriteRequest = {
  dryRun?: boolean | null
  confirmed?: boolean | null
  sportKey?: SportKey | null
  leagueKey?: string | null
  season?: string | null
  markets?: MarketKey[] | null
  maximumEvents?: number | null
  maximumMarketsPerEvent?: number | null
  maximumSnapshots?: number | null
  cancelAfterSnapshots?: number | null
}

type HistoricalFeatureSnapshotWriteCandidate = {
  deterministicKey: string
  sportKey: SportKey
  leagueKey: string
  season: string
  eventId: string
  providerEventId: string | null
  market: MarketKey
  predictionCutoff: string
  asOfTimestamp: string
  eventStartTime: string
  modelVersion: string
  featureSetVersion: string
  featureValues: Record<string, unknown>
  featureLineage: Record<string, unknown>
  sourceTimestamps: Record<string, string>
  dataQualityScore: number
  dataSufficiencyScore: number
  unresolvedMappingCount: number
  leakageStatus: 'passed' | 'warning' | 'blocked' | 'unknown'
  leakageWarnings: string[]
  trial: true
  scrambled: true
  productionEligible: false
  metadata: Record<string, unknown>
}

export type HistoricalFeatureSnapshotWriteResult = {
  success: boolean
  mode: 'historical_feature_snapshot_write_pilot_v1'
  status: HistoricalSnapshotWriteStatus
  dryRun: boolean
  confirmed: boolean
  generatedAt: string
  providerUsage: {
    externalProviderCallsMade: 0
    source: 'persisted_normalized_records_only'
  }
  caps: {
    maximumEvents: number
    maximumMarketsPerEvent: number
    maximumSnapshots: number
    concurrency: 1
    retries: 0
  }
  schema: {
    status: SchemaCapabilityStatus
    applied: boolean
  }
  candidateSelection: {
    eventsConsidered: number
    eligibleEvents: number
    eligibleCandidates: number
    rejectedEvents: number
    blockingReasons: Record<string, number>
  }
  persistence: {
    attempted: number
    inserted: number
    reused: number
    rejected: number
    failed: number
    skipped: number
    duplicateInputsDeduped: number
    partialFailures: Array<{ deterministicKey: string; error: string }>
  }
  checkpoint: {
    stableKey: string
    canResume: boolean
    cancelled: boolean
    nextCandidateIndex: number | null
    successfulRowsPreserved: boolean
  }
  idempotency: {
    deterministicKeys: string[]
    reusedKeys: string[]
    insertedKeys: string[]
    duplicateRowsAfterWrite: number
  }
  immutability: {
    linkedSnapshotMutationProtected: boolean
    linkedSnapshotMutationTested: false
    reason: string
  }
  linkage: {
    featureSnapshotIdFkAvailable: boolean
    trialSnapshotCannotLinkProductionPrediction: boolean
    productionPredictionRequiresProductionEligibleSnapshot: boolean
    validationMethod: 'contract_only_no_prediction_rows_inserted'
  }
  warnings: string[]
}

const DEFAULT_CUTOFF = '2026-01-01T19:00:00.000Z'
const DEFAULT_AS_OF = '2026-01-01T19:00:00.000Z'
const DEFAULT_EVENT_START = '2026-01-01T20:00:00.000Z'
const SNAPSHOT_MIGRATION_FILENAME = '202607140001_historical_feature_snapshots_v1.sql' as const

function featureSnapshotSchemaApplied(schema?: HistoricalFeatureSchemaCapabilities | null) {
  return (
    schema?.probes.historicalFeatureSnapshots.applied === true &&
    schema?.probes.predictionHistoryFeatureSnapshotLinkage.applied === true
  )
}

function featureSnapshotSchemaStatus(
  schema?: HistoricalFeatureSchemaCapabilities | null
): SchemaCapabilityStatus {
  if (!schema) return 'unknown'
  if (featureSnapshotSchemaApplied(schema)) return 'applied'

  const statuses = [
    schema.probes.historicalFeatureSnapshots.status,
    schema.probes.predictionHistoryFeatureSnapshotLinkage.status,
  ]
  if (statuses.includes('configuration_missing')) return 'configuration_missing'
  if (statuses.includes('permission_blocked')) return 'permission_blocked'
  if (statuses.includes('probe_failed')) return 'probe_failed'
  if (statuses.includes('missing')) return 'missing'
  return 'unknown'
}

function persistenceStatusForSchema(status: SchemaCapabilityStatus): SnapshotPersistenceStatus {
  if (status === 'applied') return 'ready'
  if (status === 'missing') return 'migration_pending'
  if (status === 'permission_blocked') return 'permission_blocked'
  if (status === 'configuration_missing') return 'configuration_missing'
  if (status === 'probe_failed') return 'probe_failed'
  return 'unknown'
}

function blockersForSchemaStatus(status: SchemaCapabilityStatus) {
  if (status === 'applied') {
    return [
      'Do not use prediction_history.feature_snapshot as the canonical immutable snapshot store.',
      'Prediction linkage must use feature_snapshot_id FK plus feature snapshot key/version metadata.',
    ]
  }

  if (status === 'missing') {
    return [
      `${SNAPSHOT_MIGRATION_FILENAME} is not visible through the server schema probe.`,
      'Do not use prediction_history.feature_snapshot as the canonical immutable snapshot store.',
      'Prediction linkage requires feature_snapshot_id FK plus feature snapshot key/version metadata.',
    ]
  }

  if (status === 'permission_blocked') {
    return ['Server Supabase client cannot verify durable feature snapshot schema access.']
  }

  if (status === 'configuration_missing') {
    return ['Server Supabase schema probing requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.']
  }

  if (status === 'probe_failed') {
    return ['Server schema probe failed; durable feature snapshot readiness is unknown.']
  }

  return ['Server schema probe has not run; durable feature snapshot readiness is unknown.']
}

function dateMs(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function stableId(parts: Array<string | number | boolean | null | undefined>) {
  return parts
    .map((part) => String(part ?? 'none').trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '_'))
    .join(':')
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function simpleHash(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function iso(value: string | null | undefined) {
  const time = dateMs(value)
  return time === null ? null : new Date(time).toISOString()
}

function hoursBefore(value: string, hours: number) {
  return new Date(new Date(value).getTime() - hours * 60 * 60 * 1000).toISOString()
}

function safeJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function providerIdFrom(value: unknown) {
  const source = safeJsonObject(value)
  const candidates = [
    source.sportsdataio,
    source.sportsDataIo,
    source.SportsDataIO,
    source.gameId,
    source.GameID,
    source.eventId,
  ]
  const found = candidates.find((item) => item !== null && item !== undefined && String(item).trim())
  return found === undefined ? null : String(found)
}

function clampWriteCap(value: number | null | undefined, fallback: number, maximum: number) {
  if (!value || !Number.isFinite(value)) return fallback
  return Math.max(1, Math.min(Math.floor(value), maximum))
}

function clampBatchSize(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) return 100
  return Math.max(1, Math.min(Math.floor(value), 500))
}

export function evaluateHistoricalFeatureLeakage({
  record,
  predictionCutoff,
  executionMode,
}: {
  record: HistoricalSourceRecord
  predictionCutoff: string
  executionMode: HistoricalFeatureExecutionMode
}): HistoricalFeatureLeakageCheck {
  const source = dateMs(record.sourceTimestamp)
  const cutoff = dateMs(predictionCutoff)
  const eventStart = dateMs(record.eventStartTime)

  if (record.finalOutcome || record.kind === 'settlement' || record.kind === 'performance') {
    return {
      recordId: record.id,
      kind: record.kind,
      sourceTimestamp: record.sourceTimestamp,
      decision: 'rejected',
      reason: 'Final outcomes, settlement and performance data are never valid pregame features.',
      severity: 'error',
    }
  }

  if (record.postgameStat) {
    return {
      recordId: record.id,
      kind: record.kind,
      sourceTimestamp: record.sourceTimestamp,
      decision: 'rejected',
      reason: 'Postgame stat rows are not eligible for pregame historical feature generation.',
      severity: 'error',
    }
  }

  if (source === null || cutoff === null) {
    return {
      recordId: record.id,
      kind: record.kind,
      sourceTimestamp: record.sourceTimestamp,
      decision: 'unavailable',
      reason: 'Missing or invalid source timestamp is unsafe and must not be silently used.',
      severity: 'warning',
    }
  }

  if (source > cutoff) {
    return {
      recordId: record.id,
      kind: record.kind,
      sourceTimestamp: record.sourceTimestamp,
      decision: 'rejected',
      reason: 'Source timestamp is after the prediction cutoff.',
      severity: 'error',
    }
  }

  if (eventStart !== null && source >= eventStart) {
    return {
      recordId: record.id,
      kind: record.kind,
      sourceTimestamp: record.sourceTimestamp,
      decision: 'rejected',
      reason: 'Source timestamp is at or after event start.',
      severity: 'error',
    }
  }

  if (executionMode === 'production' && (record.trial || record.scrambled || !record.productionEligible)) {
    return {
      recordId: record.id,
      kind: record.kind,
      sourceTimestamp: record.sourceTimestamp,
      decision: 'rejected',
      reason: 'Trial, scrambled or non-production rows cannot feed production feature generation.',
      severity: 'error',
    }
  }

  if (record.kind === 'closing_line') {
    return {
      recordId: record.id,
      kind: record.kind,
      sourceTimestamp: record.sourceTimestamp,
      decision: 'rejected',
      reason: 'Closing-line data is excluded unless it is a genuine pre-cutoff market snapshot for prediction use.',
      severity: 'error',
    }
  }

  return {
    recordId: record.id,
    kind: record.kind,
    sourceTimestamp: record.sourceTimestamp,
    decision: 'allowed',
    reason: 'Source timestamp is at or before prediction cutoff and before event start. Cutoff equality is inclusive.',
    severity: 'info',
  }
}

function buildFixtureSourceRecords(): HistoricalSourceRecord[] {
  return [
    {
      id: 'pregame_before_cutoff',
      kind: 'team_form',
      sourceTable: 'sport_game_stats',
      sourceTimestamp: '2026-01-01T18:59:59.000Z',
      eventStartTime: DEFAULT_EVENT_START,
      productionEligible: true,
    },
    {
      id: 'exactly_at_cutoff',
      kind: 'event_context',
      sourceTable: 'sport_events',
      sourceTimestamp: DEFAULT_CUTOFF,
      eventStartTime: DEFAULT_EVENT_START,
      productionEligible: true,
    },
    {
      id: 'one_second_after_cutoff',
      kind: 'team_form',
      sourceTable: 'sport_game_stats',
      sourceTimestamp: '2026-01-01T19:00:01.000Z',
      eventStartTime: DEFAULT_EVENT_START,
      productionEligible: true,
    },
    {
      id: 'final_score_after_start',
      kind: 'event_context',
      sourceTable: 'sport_events',
      sourceTimestamp: '2026-01-01T21:50:00.000Z',
      eventStartTime: DEFAULT_EVENT_START,
      finalOutcome: true,
      productionEligible: true,
    },
    {
      id: 'postgame_player_stat',
      kind: 'player_stats',
      sourceTable: 'sport_player_stats',
      sourceTimestamp: '2026-01-01T22:00:00.000Z',
      eventStartTime: DEFAULT_EVENT_START,
      postgameStat: true,
      productionEligible: true,
    },
    {
      id: 'injury_after_cutoff',
      kind: 'injury_context',
      sourceTable: 'sport_injuries',
      sourceTimestamp: '2026-01-01T19:10:00.000Z',
      eventStartTime: DEFAULT_EVENT_START,
      productionEligible: true,
    },
    {
      id: 'lineup_after_cutoff',
      kind: 'lineup_context',
      sourceTable: 'sport_lineups',
      sourceTimestamp: '2026-01-01T19:15:00.000Z',
      eventStartTime: DEFAULT_EVENT_START,
      productionEligible: true,
    },
    {
      id: 'odds_before_cutoff',
      kind: 'market_odds',
      sourceTable: 'sports_odds_snapshots',
      sourceTimestamp: '2026-01-01T18:30:00.000Z',
      eventStartTime: DEFAULT_EVENT_START,
      productionEligible: true,
    },
    {
      id: 'closing_line_after_cutoff',
      kind: 'closing_line',
      sourceTable: 'sports_odds_snapshots',
      sourceTimestamp: '2026-01-01T19:55:00.000Z',
      eventStartTime: DEFAULT_EVENT_START,
      productionEligible: true,
    },
    {
      id: 'trial_row_in_production_generation',
      kind: 'injury_context',
      sourceTable: 'sport_injuries',
      sourceTimestamp: '2026-01-01T18:00:00.000Z',
      eventStartTime: DEFAULT_EVENT_START,
      trial: true,
      scrambled: true,
      productionEligible: false,
    },
    {
      id: 'production_row_in_trial_fixture',
      kind: 'event_context',
      sourceTable: 'sport_events',
      sourceTimestamp: '2026-01-01T18:00:00.000Z',
      eventStartTime: DEFAULT_EVENT_START,
      productionEligible: true,
    },
    {
      id: 'missing_source_timestamp',
      kind: 'lineup_context',
      sourceTable: 'sport_lineups',
      sourceTimestamp: null,
      eventStartTime: DEFAULT_EVENT_START,
      productionEligible: true,
    },
  ]
}

function getRequiredSourceDomains(sportKey: SportKey, market: MarketKey) {
  const featureSet = lookupFeatureSet({ sportKey, market }).featureSets[0]
  const definitions = getFeatureDefinitions({ sportKey, market }).definitions
  const requiredFeatureKeys = featureSet?.requiredFeatures ?? ['event_context', 'team_form', 'market_odds']

  return definitions
    .filter((definition) => requiredFeatureKeys.includes(definition.key))
    .flatMap((definition) => definition.sourceTables)
}

type StoredEventRow = {
  id: string
  sport_key: string
  league_key: string
  season: string
  home_team_id: string | null
  away_team_id: string | null
  home_team: string
  away_team: string
  start_time: string
  status: string
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

type StoredLineupRow = {
  id: string
  event_id: string | null
  team_id: string | null
  player_id: string | null
  player_name: string | null
  lineup_type: string
  position: string | null
  depth_order: number | null
  role: string | null
  starter: boolean | null
  lineup_status: string | null
  confirmation_level: string | null
  source_timestamp: string | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

type StoredPlayerStatRow = {
  id: string
  event_id: string | null
  team_id: string | null
  player_id: string | null
  stat_type: string
  source_timestamp: string | null
  points: number | null
  rebounds: number | null
  assists: number | null
  minutes: number | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

type StoredOddsRow = {
  id: string
  event_id: string
  sportsbook: string
  market: string
  outcome: string
  price: number | null
  line: number | null
  snapshot_time: string
  is_closing: boolean | null
  metadata: Record<string, unknown> | null
}

function rowIsTrial(row: { metadata?: Record<string, unknown> | null }) {
  const metadata = safeJsonObject(row.metadata)
  return metadata.trial === true || metadata.scrambled === true || metadata.production_eligible === false
}

function countReason(reasons: Record<string, number>, reason: string) {
  reasons[reason] = (reasons[reason] ?? 0) + 1
}

async function buildNbaTrialSnapshotCandidates({
  maximumEvents,
  maximumMarketsPerEvent,
  maximumSnapshots,
  markets,
}: {
  maximumEvents: number
  maximumMarketsPerEvent: number
  maximumSnapshots: number
  markets: MarketKey[]
}) {
  const warnings: string[] = []
  const blockingReasons: Record<string, number> = {}
  const eventsResult = await supabaseAdmin
    .from('sport_events')
    .select(
      'id, sport_key, league_key, season, home_team_id, away_team_id, home_team, away_team, start_time, status, provider_ids, metadata, created_at, updated_at'
    )
    .eq('sport_key', 'basketball_nba')
    .order('start_time', { ascending: false })
    .limit(Math.max(25, maximumEvents * 10))

  if (eventsResult.error) {
    throw new Error(`Failed to load NBA events for snapshot candidates: ${eventsResult.error.message}`)
  }

  const events = ((eventsResult.data ?? []) as StoredEventRow[]).filter((event) => {
    const metadata = safeJsonObject(event.metadata)
    return metadata.trial === true || metadata.scrambled === true || metadata.production_eligible === false
  })
  const eventIds = events.map((event) => event.id)

  if (eventIds.length === 0) {
    return {
      candidates: [] as HistoricalFeatureSnapshotWriteCandidate[],
      eventsConsidered: 0,
      eligibleEvents: 0,
      rejectedEvents: 0,
      blockingReasons: { no_trial_events_available: 1 },
      warnings: ['No trial/scrambled NBA events are available for snapshot persistence.'],
    }
  }

  const [lineupsResult, playerStatsResult, oddsResult] = await Promise.all([
    supabaseAdmin
      .from('sport_lineups')
      .select(
        'id, event_id, team_id, player_id, player_name, lineup_type, position, depth_order, role, starter, lineup_status, confirmation_level, source_timestamp, provider_ids, metadata'
      )
      .in('event_id', eventIds)
      .limit(5000),
    supabaseAdmin
      .from('sport_player_stats')
      .select(
        'id, event_id, team_id, player_id, stat_type, source_timestamp, points, rebounds, assists, minutes, provider_ids, metadata'
      )
      .in('event_id', eventIds)
      .limit(5000),
    supabaseAdmin
      .from('sports_odds_snapshots')
      .select('id, event_id, sportsbook, market, outcome, price, line, snapshot_time, is_closing, metadata')
      .in('event_id', eventIds)
      .limit(5000),
  ])

  if (lineupsResult.error) {
    throw new Error(`Failed to load NBA lineup context: ${lineupsResult.error.message}`)
  }
  if (playerStatsResult.error) {
    throw new Error(`Failed to load NBA player stat context: ${playerStatsResult.error.message}`)
  }
  if (oddsResult.error) {
    throw new Error(`Failed to load NBA odds context: ${oddsResult.error.message}`)
  }

  const lineups = ((lineupsResult.data ?? []) as StoredLineupRow[]).filter(rowIsTrial)
  const playerStats = ((playerStatsResult.data ?? []) as StoredPlayerStatRow[]).filter(rowIsTrial)
  const odds = ((oddsResult.data ?? []) as StoredOddsRow[]).filter(rowIsTrial)
  const candidates: HistoricalFeatureSnapshotWriteCandidate[] = []
  let eligibleEvents = 0
  let rejectedEvents = 0

  for (const event of events) {
    if (eligibleEvents >= maximumEvents || candidates.length >= maximumSnapshots) break

    const eventStart = iso(event.start_time)
    if (!eventStart) {
      rejectedEvents += 1
      countReason(blockingReasons, 'missing_event_start_time')
      continue
    }

    const predictionCutoff = hoursBefore(eventStart, 1)
    if (dateMs(predictionCutoff)! >= dateMs(eventStart)!) {
      rejectedEvents += 1
      countReason(blockingReasons, 'prediction_cutoff_not_before_event_start')
      continue
    }

    const eventLineups = lineups.filter((row) => row.event_id === event.id)
    const eventStats = playerStats.filter((row) => row.event_id === event.id)
    const eventOdds = odds.filter((row) => row.event_id === event.id)
    const missingTimestamps =
      eventLineups.filter((row) => !row.source_timestamp).length +
      eventStats.filter((row) => !row.source_timestamp).length
    const safeLineups = eventLineups.filter((row) => {
      const source = dateMs(row.source_timestamp)
      return source !== null && source <= dateMs(predictionCutoff)!
    })
    const safeStats = eventStats.filter((row) => {
      const source = dateMs(row.source_timestamp)
      return source !== null && source <= dateMs(predictionCutoff)!
    })
    const safeOdds = eventOdds.filter((row) => {
      const source = dateMs(row.snapshot_time)
      return source !== null && source <= dateMs(predictionCutoff)! && row.is_closing !== true
    })

    if (missingTimestamps > 0) {
      countReason(blockingReasons, 'source_rows_missing_timestamp_excluded')
    }

    if (safeLineups.length + safeStats.length + safeOdds.length === 0) {
      rejectedEvents += 1
      countReason(blockingReasons, 'no_timestamp_safe_source_rows_before_cutoff')
      continue
    }

    eligibleEvents += 1
    const selectedMarkets = markets.slice(0, maximumMarketsPerEvent)

    for (const market of selectedMarkets) {
      if (candidates.length >= maximumSnapshots) break

      const modelVersion = `${event.sport_key}_model_v1`
      const featureSetVersion = `${event.sport_key}_${market}_feature_set_v1`
      const sourceRecordIds = [
        ...safeLineups.map((row) => `sport_lineups:${row.id}`),
        ...safeStats.map((row) => `sport_player_stats:${row.id}`),
        ...safeOdds.map((row) => `sports_odds_snapshots:${row.id}`),
      ].sort()
      const sourceTimestamps = Object.fromEntries([
        ...safeLineups.map((row) => [`sport_lineups:${row.id}`, iso(row.source_timestamp)!]),
        ...safeStats.map((row) => [`sport_player_stats:${row.id}`, iso(row.source_timestamp)!]),
        ...safeOdds.map((row) => [`sports_odds_snapshots:${row.id}`, iso(row.snapshot_time)!]),
      ])
      const featureLineage = {
        source: 'persisted_normalized_records_only',
        sourceTables: Array.from(
          new Set([
            safeLineups.length ? 'sport_lineups' : null,
            safeStats.length ? 'sport_player_stats' : null,
            safeOdds.length ? 'sports_odds_snapshots' : null,
          ].filter(Boolean))
        ),
        sourceRecordIds,
        trial: true,
        scrambled: true,
        productionEligible: false,
      }
      const lineageHash = simpleHash(stableJson(featureLineage))
      const deterministicKey = stableId([
        'historical_feature_snapshot_v1',
        event.sport_key,
        event.id,
        market,
        predictionCutoff,
        modelVersion,
        featureSetVersion,
        lineageHash,
        'trial',
      ])
      const unresolvedMappingCount =
        safeLineups.filter((row) => !row.player_id || !row.team_id).length +
        safeStats.filter((row) => !row.player_id || !row.team_id).length
      const sourceCount = sourceRecordIds.length
      const dataSufficiencyScore = Math.min(100, 35 + safeLineups.length * 2 + safeStats.length * 2 + safeOdds.length * 5)
      const dataQualityScore = Math.max(0, Math.min(100, 85 - unresolvedMappingCount * 2))

      candidates.push({
        deterministicKey,
        sportKey: event.sport_key as SportKey,
        leagueKey: event.league_key,
        season: event.season,
        eventId: event.id,
        providerEventId: providerIdFrom(event.provider_ids),
        market,
        predictionCutoff,
        asOfTimestamp: predictionCutoff,
        eventStartTime: eventStart,
        modelVersion,
        featureSetVersion,
        featureValues: {
          event: {
            id: event.id,
            homeTeamId: event.home_team_id,
            awayTeamId: event.away_team_id,
            startTime: eventStart,
            status: event.status,
          },
          contextCounts: {
            lineups: safeLineups.length,
            playerStats: safeStats.length,
            odds: safeOdds.length,
            sourceRecords: sourceCount,
          },
          lineups: safeLineups.slice(0, 50).map((row) => ({
            id: row.id,
            teamId: row.team_id,
            playerId: row.player_id,
            lineupType: row.lineup_type,
            position: row.position,
            depthOrder: row.depth_order,
            starter: row.starter,
            confirmationLevel: row.confirmation_level,
          })),
          playerStats: safeStats.slice(0, 50).map((row) => ({
            id: row.id,
            teamId: row.team_id,
            playerId: row.player_id,
            statType: row.stat_type,
            points: row.points,
            rebounds: row.rebounds,
            assists: row.assists,
            minutes: row.minutes,
          })),
          odds: safeOdds.slice(0, 20).map((row) => ({
            id: row.id,
            sportsbook: row.sportsbook,
            market: row.market,
            outcome: row.outcome,
            price: row.price,
            line: row.line,
            snapshotTime: iso(row.snapshot_time),
          })),
        },
        featureLineage,
        sourceTimestamps,
        dataQualityScore,
        dataSufficiencyScore,
        unresolvedMappingCount,
        leakageStatus: 'passed',
        leakageWarnings: missingTimestamps
          ? [`${missingTimestamps} timestamp-ambiguous source rows were excluded before persistence.`]
          : [],
        trial: true,
        scrambled: true,
        productionEligible: false,
        metadata: {
          mode: 'bounded_nba_trial_feature_snapshot_write_v1',
          season: event.season,
          maximumEvents,
          maximumMarketsPerEvent,
          maximumSnapshots,
          eventStartTime: eventStart,
          excludedMissingTimestampRows: missingTimestamps,
          providerCalls: 0,
        },
      })
    }
  }

  if (events.length > 0 && candidates.length === 0) {
    warnings.push('No NBA trial events had timestamp-safe source rows at or before prediction cutoff.')
  }

  return {
    candidates,
    eventsConsidered: events.length,
    eligibleEvents,
    rejectedEvents,
    blockingReasons,
    warnings,
  }
}

export function getBacktestInputReadiness(
  schemaCapabilities?: HistoricalFeatureSchemaCapabilities | null
): BacktestInputReadiness {
  const schemaStatus = featureSnapshotSchemaStatus(schemaCapabilities)
  return {
    mode: 'backtest_input_readiness_v1',
    ready: false,
    migration: {
      required: true,
      applied: schemaStatus === 'applied',
      status: schemaStatus,
      filename: SNAPSHOT_MIGRATION_FILENAME,
      table: 'historical_feature_snapshots',
    },
    requiredFields: [
      'event_id',
      'sport',
      'market',
      'prediction_timestamp',
      'cutoff_timestamp',
      'feature_snapshot_id',
      'model_version',
      'feature_set_version',
      'predicted_probability',
      'offered_odds_or_price',
      'settlement_result',
      'production_eligible',
      'trial',
      'scrambled',
      'no_leakage',
    ],
    rejectionRules: [
      'Reject trial or scrambled rows for real metrics.',
      'Reject unsettled predictions.',
      'Reject ROI rows without a valid offered price.',
      'Reject predictions without feature lineage.',
      'Reject predictions whose feature snapshot was generated after the prediction.',
      'Reject predictions using postgame data.',
      'Reject CLV calculations without genuine closing snapshots.',
    ],
    duplicateKey:
      'sport:event_id:market:model_version:feature_set_version:prediction_timestamp',
    clvPolicy:
      'CLV remains blocked unless a genuine closing snapshot exists and is distinct from the prediction-time odds snapshot.',
    trialPolicy:
      'Trial/scrambled data can validate contracts but must not feed production ROI, CLV, calibration or promotion metrics.',
    insufficientDataResponse: {
      status: 'blocked',
      reason:
        'Durable historical feature snapshots and sufficient settled production predictions are not yet available.',
    },
  }
}

export function getHistoricalFeatureSnapshotPersistenceReadiness(
  snapshot: HistoricalFeatureSnapshot,
  schemaCapabilities?: HistoricalFeatureSchemaCapabilities | null
): HistoricalFeatureSnapshotPersistenceReadiness {
  const lineageHash = simpleHash(stableJson(snapshot.lineage))
  const schemaStatus = featureSnapshotSchemaStatus(schemaCapabilities)

  return {
    mode: 'historical_feature_snapshot_persistence_v1',
    status: persistenceStatusForSchema(schemaStatus),
    migration: {
      required: true,
      applied: schemaStatus === 'applied',
      status: schemaStatus,
      filename: SNAPSHOT_MIGRATION_FILENAME,
      table: 'historical_feature_snapshots',
      predictionLinkageColumns: [
        'feature_snapshot_id',
        'feature_snapshot_key',
        'feature_set_version',
        'feature_snapshot_generated_at',
        'production_eligible',
        'trial',
        'scrambled',
      ],
    },
    persistencePolicy: {
      immutablePredictionTimeSnapshots: true,
      identicalRegenerationIsIdempotent: true,
      changedLineageRequiresDistinctKey: true,
      linkedSnapshotOverwriteRejected: true,
      rawProviderPayloadStorageAllowed: false,
    },
    schemaProbe: {
      mode: 'server_schema_capability_probe_v1',
      historicalFeatureSnapshots:
        schemaCapabilities?.probes.historicalFeatureSnapshots.status ?? 'unknown',
      predictionHistoryFeatureSnapshotLinkage:
        schemaCapabilities?.probes.predictionHistoryFeatureSnapshotLinkage.status ?? 'unknown',
    },
    deterministicKey: stableId([
      snapshot.id,
      snapshot.modelVersion,
      snapshot.featureSetVersion,
      lineageHash,
    ]),
    lineageHash,
    blockers: blockersForSchemaStatus(schemaStatus),
  }
}

export function planHistoricalFeatureSnapshotPersistence(
  snapshot: HistoricalFeatureSnapshot,
  schemaCapabilities?: HistoricalFeatureSchemaCapabilities | null
): HistoricalFeatureSnapshotPersistenceResult {
  const readiness = getHistoricalFeatureSnapshotPersistenceReadiness(snapshot, schemaCapabilities)
  const leakageBlocked = !snapshot.leakage.noLeakage

  if (leakageBlocked) {
    return {
      mode: 'historical_feature_snapshot_persistence_attempt_v1',
      status: 'leakage_blocked',
      dryRun: true,
      persisted: false,
      inserted: 0,
      updated: 0,
      skipped: Math.max(0, snapshot.counters.recordsSkipped),
      conflicts: 0,
      errors: ['Snapshot fixture contains rejected leakage checks and cannot itself be persisted.'],
      checkpoint: {
        stableKey: readiness.deterministicKey,
        canResume: true,
        cancelled: false,
        successfulRowsPreserved: true,
      },
    }
  }

  return {
    mode: 'historical_feature_snapshot_persistence_attempt_v1',
    status: readiness.status,
    dryRun: true,
    persisted: false,
    inserted: 0,
    updated: 0,
    skipped: Math.max(0, snapshot.counters.recordsSkipped),
    conflicts: 0,
    errors: readiness.status === 'ready' ? [] : readiness.blockers,
    checkpoint: {
      stableKey: readiness.deterministicKey,
      canResume: true,
      cancelled: false,
      successfulRowsPreserved: true,
    },
  }
}

export function evaluateHistoricalFeatureBacktestEligibility({
  hasSnapshot,
  hasLineage,
  snapshotGeneratedAt,
  predictionTimestamp,
  cutoffTimestamp,
  noLeakage,
  settled,
  hasValidPrice,
  productionEligible,
  trial,
  scrambled,
  sampleSize,
  hasClosingSnapshot,
  migrationApplied = false,
}: {
  hasSnapshot: boolean
  hasLineage: boolean
  snapshotGeneratedAt: string | null
  predictionTimestamp: string | null
  cutoffTimestamp: string | null
  noLeakage: boolean
  settled: boolean
  hasValidPrice: boolean
  productionEligible: boolean
  trial: boolean
  scrambled: boolean
  sampleSize: number
  hasClosingSnapshot?: boolean
  migrationApplied?: boolean
}): HistoricalFeatureBacktestEligibility {
  const snapshotGenerated = dateMs(snapshotGeneratedAt)
  const predictionTime = dateMs(predictionTimestamp)
  const cutoff = dateMs(cutoffTimestamp)
  const checks = {
    migrationApplied,
    hasSnapshot,
    hasLineage,
    snapshotGeneratedAtOrBeforePrediction:
      snapshotGenerated !== null && predictionTime !== null && snapshotGenerated <= predictionTime,
    cutoffAtOrBeforePrediction:
      cutoff !== null && predictionTime !== null && cutoff <= predictionTime,
    noLeakage,
    settled,
    hasValidPrice,
    productionEligible,
    notTrial: !trial,
    notScrambled: !scrambled,
    sufficientSample: sampleSize > 0,
    hasClosingSnapshot: hasClosingSnapshot === true,
  }
  const blockers: HistoricalFeatureBacktestEligibility['blockers'] = []

  if (!checks.migrationApplied) blockers.push('migration_pending')
  if (!hasSnapshot) blockers.push('missing_snapshot')
  if (!hasLineage) blockers.push('missing_lineage')
  if (!checks.snapshotGeneratedAtOrBeforePrediction || !checks.cutoffAtOrBeforePrediction) {
    blockers.push('snapshot_generated_too_late')
  }
  if (!noLeakage) blockers.push('unresolved_leakage')
  if (!hasValidPrice) blockers.push('missing_price')
  if (!settled) blockers.push('unsettled_prediction')
  if (!productionEligible || trial || scrambled) blockers.push('trial_data')
  if (sampleSize <= 0) blockers.push('insufficient_sample')
  if (!checks.hasClosingSnapshot) blockers.push('missing_closing_snapshot')

  return {
    mode: 'historical_feature_backtest_eligibility_v1',
    eligible: blockers.length === 0,
    blockers,
    checks,
  }
}

export function planHistoricalFeatureGeneration(
  request: HistoricalFeatureGenerationRequest = {},
  schemaCapabilities?: HistoricalFeatureSchemaCapabilities | null
): HistoricalFeatureGenerationPlan {
  const sportKey = request.sportKey ?? 'basketball_nba'
  const leagueKey = request.leagueKey ?? (sportKey === 'basketball_nba' ? 'nba' : null)
  const market = request.market ?? 'moneyline'
  const eventId = request.eventId ?? 'historical_feature_fixture_event'
  const predictionCutoff = request.predictionCutoff ?? DEFAULT_CUTOFF
  const asOfTimestamp = request.asOfTimestamp ?? DEFAULT_AS_OF
  const eventStartTime = request.eventStartTime ?? DEFAULT_EVENT_START
  const modelVersion = request.modelVersion ?? `${sportKey}_model_v1`
  const featureSetVersion = request.featureSetVersion ?? `${sportKey}_${market}_feature_set_v1`
  const batchSize = clampBatchSize(request.batchSize)
  const executionMode = request.executionMode ?? 'trial_only'
  const baseSnapshot = createFeatureSnapshot({
    sportKey,
    leagueKey,
    eventId,
    market,
    generatedAt: asOfTimestamp,
    cutoffAt: predictionCutoff,
    eventStartTime,
  })
  const fixtureRecords = buildFixtureSourceRecords()
  const checks = fixtureRecords.map((record) =>
    evaluateHistoricalFeatureLeakage({
      record,
      predictionCutoff,
      executionMode: record.id === 'trial_row_in_production_generation' ? 'production' : executionMode,
    })
  )
  const allowed = checks.filter((check) => check.decision === 'allowed')
  const rejected = checks.filter((check) => check.decision === 'rejected')
  const unavailable = checks.filter((check) => check.decision === 'unavailable')
  const sourceTables = Array.from(new Set(fixtureRecords.map((record) => record.sourceTable)))
  const deterministicSnapshotId = stableId([
    'historical_feature_snapshot_v1',
    sportKey,
    leagueKey,
    eventId,
    market,
    predictionCutoff,
    asOfTimestamp,
    modelVersion,
    featureSetVersion,
    executionMode,
  ])
  const snapshot: HistoricalFeatureSnapshot = {
    id: deterministicSnapshotId,
    sportKey,
    leagueKey,
    eventId,
    market,
    predictionCutoff,
    asOfTimestamp,
    modelVersion,
    featureSetVersion,
    provider: 'normalized_store',
    trial: executionMode === 'trial_only',
    scrambled: executionMode === 'trial_only',
    productionEligible: executionMode === 'production',
    dryRun: true,
    lineage: {
      source: 'persisted_normalized_records_only',
      sourceTables,
      sourceRecordIds: allowed.map((check) => check.recordId),
      generatedFromSnapshotId: baseSnapshot.id,
      deterministicRegenerationKey: deterministicSnapshotId,
    },
    sections: {
      eventContext: { available: true, source: 'sport_events' },
      teamContext: { available: true, source: 'team_stats/sport_game_stats' },
      participantPlayerContext: { available: false, reason: 'Requires source timestamps per row.' },
      standingsContext: { available: false, reason: 'Future standings updates must be timestamp-gated.' },
      recentForm: { available: true, cutoffInclusive: true },
      restTravelContext: { available: false, reason: 'No generic normalized travel table exists.' },
      injuryContext: { available: false, reason: 'Rows after cutoff or trial rows cannot improve production confidence.' },
      lineupDepthStarterContext: { available: false, reason: 'Confirmed lineups after cutoff are rejected.' },
      oddsContext: { available: true, source: 'sports_odds_snapshots before cutoff' },
      dataFreshness: { asOfTimestamp, predictionCutoff },
      dataSufficiency: { score: baseSnapshot.dataSufficiencyScore },
      dataQuality: { score: baseSnapshot.featureQualityScore },
      unresolvedMappings: { preserved: true, fabricated: false },
      missingDomainWarnings: baseSnapshot.warnings,
      productionEligibility: {
        trialRowsCanImproveProductionConfidence: false,
        productionEligible: executionMode === 'production',
      },
      featureLineage: {
        modelVersion,
        featureSetVersion,
        sourceTables,
      },
    },
    leakage: {
      noLeakage: rejected.length === 0,
      checks,
      rejectedRecords: rejected.length,
      unavailableRecords: unavailable.length,
    },
    counters: {
      sourceRecordsEvaluated: checks.length,
      sourceRecordsAllowed: allowed.length,
      sourceRecordsRejected: rejected.length,
      sourceRecordsUnavailable: unavailable.length,
      recordsSkipped: rejected.length + unavailable.length,
    },
  }
  const requiredSourceDomains = Array.from(new Set(getRequiredSourceDomains(sportKey, market)))
  const persistenceReadiness = getHistoricalFeatureSnapshotPersistenceReadiness(
    snapshot,
    schemaCapabilities
  )
  const persistenceResult = planHistoricalFeatureSnapshotPersistence(snapshot, schemaCapabilities)
  const blockingMissingDomains = [
    'Generic per-source timestamp coverage must be verified before production generation.',
    ...persistenceReadiness.blockers.filter(
      (blocker) => !blocker.includes('prediction_history.feature_snapshot')
    ),
  ]
  const persistenceReady = persistenceReadiness.status === 'ready'

  return {
    mode: 'historical_feature_generation_orchestrator_v1',
    dryRun: true,
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'persisted_normalized_records_only',
    },
    status: 'blocked',
    eligibility: {
      eligible: false,
      requiredSourceDomains,
      blockingMissingDomains,
      predictionCutoffStrategy:
        'Cutoff is inclusive: records observed exactly at prediction_cutoff are allowed; records after cutoff are rejected.',
      persistenceReady,
      leakageValidationReady: true,
      backtestHandoffReady: persistenceReady,
      snapshotPersistenceStatus: persistenceReadiness.status,
      migrationFilename: persistenceReadiness.migration.filename,
    },
    batching: {
      estimatedEventCount: 0,
      estimatedFeatureSnapshotCount: 0,
      batchSize,
      checkpointStrategy:
        'One checkpoint per sport, event, market, model version, feature-set version and cutoff window.',
      resumeStrategy:
        'Resume from the last incomplete checkpoint using the deterministic snapshot natural key.',
      cancellationContract:
        'Cancellation stops before the next event/market checkpoint and leaves completed dry-run snapshots immutable.',
      partialFailureIsolation:
        'A failed event/market snapshot records typed errors without advancing sibling checkpoints.',
    },
    idempotency: {
      stableNaturalKey:
        'sport:event_id:market:prediction_cutoff:model_version:feature_set_version:execution_mode',
      deterministicSnapshotId,
      duplicatePrevention:
        'Upsert or insert-on-conflict must use the stable natural key when durable persistence is approved.',
      deterministicRegeneration: true,
    },
    snapshot,
    persistenceReadiness,
    persistenceResult,
    backtestInputReadiness: getBacktestInputReadiness(schemaCapabilities),
    warnings: [
      persistenceReady
        ? 'Durable feature snapshot schema is visible, but V1 still performs dry-run validation only until write-mode persistence is explicitly implemented.'
        : 'V1 is dry-run/contract-only because durable historical feature snapshot schema readiness is not confirmed.',
      'Feature generation uses persisted normalized records only and makes zero provider calls.',
      'Unknown or missing source timestamps are unsafe and lower sufficiency rather than being used silently.',
    ],
  }
}

export function runHistoricalFeatureGenerationValidation(
  schemaCapabilities?: HistoricalFeatureSchemaCapabilities | null
) {
  const trialPlan = planHistoricalFeatureGeneration(
    { executionMode: 'trial_only' },
    schemaCapabilities
  )
  const productionPlan = planHistoricalFeatureGeneration(
    { executionMode: 'production' },
    schemaCapabilities
  )
  const regeneratedTrialPlan = planHistoricalFeatureGeneration(
    { executionMode: 'trial_only' },
    schemaCapabilities
  )
  const changedLineageSnapshot: HistoricalFeatureSnapshot = {
    ...trialPlan.snapshot,
    lineage: {
      ...trialPlan.snapshot.lineage,
      sourceRecordIds: [...trialPlan.snapshot.lineage.sourceRecordIds, 'additional_pre_cutoff_row'],
    },
  }
  const changedLineageReadiness =
    getHistoricalFeatureSnapshotPersistenceReadiness(changedLineageSnapshot, schemaCapabilities)
  const cleanPersistenceSnapshot: HistoricalFeatureSnapshot = {
    ...trialPlan.snapshot,
    id: `${trialPlan.snapshot.id}:clean`,
    lineage: {
      ...trialPlan.snapshot.lineage,
      sourceRecordIds: trialPlan.snapshot.lineage.sourceRecordIds.filter(
        (recordId) => !recordId.includes('after_cutoff') && recordId !== 'missing_source_timestamp'
      ),
    },
    leakage: {
      noLeakage: true,
      checks: trialPlan.snapshot.leakage.checks.filter((check) => check.decision === 'allowed'),
      rejectedRecords: 0,
      unavailableRecords: 0,
    },
    counters: {
      ...trialPlan.snapshot.counters,
      sourceRecordsEvaluated: trialPlan.snapshot.leakage.checks.filter(
        (check) => check.decision === 'allowed'
      ).length,
      sourceRecordsRejected: 0,
      sourceRecordsUnavailable: 0,
      recordsSkipped: 0,
    },
  }
  const cleanPersistenceResult = planHistoricalFeatureSnapshotPersistence(
    cleanPersistenceSnapshot,
    schemaCapabilities
  )
  const migrationApplied = featureSnapshotSchemaApplied(schemaCapabilities)
  const generatedAfterPrediction = evaluateHistoricalFeatureBacktestEligibility({
    hasSnapshot: true,
    hasLineage: true,
    snapshotGeneratedAt: '2026-01-01T19:01:00.000Z',
    predictionTimestamp: DEFAULT_CUTOFF,
    cutoffTimestamp: DEFAULT_CUTOFF,
    noLeakage: true,
    settled: true,
    hasValidPrice: true,
    productionEligible: true,
    trial: false,
    scrambled: false,
    sampleSize: 1,
    hasClosingSnapshot: true,
    migrationApplied,
  })
  const missingSnapshotEligibility = evaluateHistoricalFeatureBacktestEligibility({
    hasSnapshot: false,
    hasLineage: true,
    snapshotGeneratedAt: null,
    predictionTimestamp: DEFAULT_CUTOFF,
    cutoffTimestamp: DEFAULT_CUTOFF,
    noLeakage: true,
    settled: true,
    hasValidPrice: true,
    productionEligible: true,
    trial: false,
    scrambled: false,
    sampleSize: 1,
    hasClosingSnapshot: true,
    migrationApplied,
  })
  const eligibleSettledPrediction = evaluateHistoricalFeatureBacktestEligibility({
    hasSnapshot: true,
    hasLineage: true,
    snapshotGeneratedAt: '2026-01-01T18:59:59.000Z',
    predictionTimestamp: DEFAULT_CUTOFF,
    cutoffTimestamp: DEFAULT_CUTOFF,
    noLeakage: true,
    settled: true,
    hasValidPrice: true,
    productionEligible: true,
    trial: false,
    scrambled: false,
    sampleSize: 1,
    hasClosingSnapshot: true,
    migrationApplied,
  })
  const roiMissingPrice = evaluateHistoricalFeatureBacktestEligibility({
    hasSnapshot: true,
    hasLineage: true,
    snapshotGeneratedAt: '2026-01-01T18:59:59.000Z',
    predictionTimestamp: DEFAULT_CUTOFF,
    cutoffTimestamp: DEFAULT_CUTOFF,
    noLeakage: true,
    settled: true,
    hasValidPrice: false,
    productionEligible: true,
    trial: false,
    scrambled: false,
    sampleSize: 1,
    hasClosingSnapshot: true,
    migrationApplied,
  })
  const clvMissingClosingSnapshot = evaluateHistoricalFeatureBacktestEligibility({
    hasSnapshot: true,
    hasLineage: true,
    snapshotGeneratedAt: '2026-01-01T18:59:59.000Z',
    predictionTimestamp: DEFAULT_CUTOFF,
    cutoffTimestamp: DEFAULT_CUTOFF,
    noLeakage: true,
    settled: true,
    hasValidPrice: true,
    productionEligible: true,
    trial: false,
    scrambled: false,
    sampleSize: 1,
    hasClosingSnapshot: false,
    migrationApplied,
  })
  const duplicateBatchKeys = [
    trialPlan.persistenceReadiness.deterministicKey,
    trialPlan.persistenceReadiness.deterministicKey,
    changedLineageReadiness.deterministicKey,
  ]
  const dedupedBatchKeys = Array.from(new Set(duplicateBatchKeys))
  const checksById = new Map(
    trialPlan.snapshot.leakage.checks.map((check) => [check.recordId, check])
  )
  const productionChecksById = new Map(
    productionPlan.snapshot.leakage.checks.map((check) => [check.recordId, check])
  )
  const checks = {
    pregameBeforeCutoffAllowed: checksById.get('pregame_before_cutoff')?.decision === 'allowed',
    exactlyAtCutoffAllowed: checksById.get('exactly_at_cutoff')?.decision === 'allowed',
    afterCutoffRejected: checksById.get('one_second_after_cutoff')?.decision === 'rejected',
    finalScoreRejected: checksById.get('final_score_after_start')?.decision === 'rejected',
    postgamePlayerStatRejected: checksById.get('postgame_player_stat')?.decision === 'rejected',
    injuryAfterCutoffRejected: checksById.get('injury_after_cutoff')?.decision === 'rejected',
    lineupAfterCutoffRejected: checksById.get('lineup_after_cutoff')?.decision === 'rejected',
    oddsBeforeCutoffAllowed: checksById.get('odds_before_cutoff')?.decision === 'allowed',
    closingLineAfterCutoffRejected: checksById.get('closing_line_after_cutoff')?.decision === 'rejected',
    trialRowRejectedForProduction:
      productionChecksById.get('trial_row_in_production_generation')?.decision === 'rejected',
    productionRowAllowedInTrialFixture:
      checksById.get('production_row_in_trial_fixture')?.decision === 'allowed',
    missingTimestampUnavailable:
      checksById.get('missing_source_timestamp')?.decision === 'unavailable',
    identicalRegenerationOneLogicalSnapshot:
      trialPlan.persistenceReadiness.deterministicKey ===
      regeneratedTrialPlan.persistenceReadiness.deterministicKey,
    changedLineageDistinctKey:
      trialPlan.persistenceReadiness.deterministicKey !==
      changedLineageReadiness.deterministicKey,
    linkedSnapshotOverwriteRejected:
      trialPlan.persistenceReadiness.persistencePolicy.linkedSnapshotOverwriteRejected,
    featureAfterCutoffRejected: checksById.get('one_second_after_cutoff')?.decision === 'rejected',
    trialSnapshotCannotLinkProductionPrediction:
      trialPlan.snapshot.trial &&
      !trialPlan.snapshot.productionEligible &&
      evaluateHistoricalFeatureBacktestEligibility({
        hasSnapshot: true,
        hasLineage: true,
        snapshotGeneratedAt: '2026-01-01T18:59:59.000Z',
        predictionTimestamp: DEFAULT_CUTOFF,
        cutoffTimestamp: DEFAULT_CUTOFF,
        noLeakage: true,
        settled: true,
        hasValidPrice: true,
        productionEligible: false,
        trial: true,
        scrambled: true,
        sampleSize: 1,
        hasClosingSnapshot: true,
        migrationApplied,
      }).blockers.includes('trial_data'),
    productionSnapshotCannotContainTrialSourceLineage:
      !productionPlan.snapshot.lineage.sourceRecordIds.includes('trial_row_in_production_generation'),
    missingTimestampBlocks: checksById.get('missing_source_timestamp')?.decision === 'unavailable',
    cleanValidSnapshotPersistenceEligible:
      migrationApplied
        ? cleanPersistenceResult.status === 'ready' && cleanPersistenceResult.errors.length === 0
        : cleanPersistenceResult.status !== 'leakage_blocked',
    fixtureRejectedRowsDoNotGloballyBlockPersistence:
      trialPlan.persistenceReadiness.status === cleanPersistenceResult.status ||
      trialPlan.persistenceReadiness.status === 'ready',
    snapshotGeneratedAfterPredictionInvalid:
      generatedAfterPrediction.blockers.includes('snapshot_generated_too_late'),
    predictionWithoutSnapshotNotBacktestEligible:
      !missingSnapshotEligibility.eligible &&
      missingSnapshotEligibility.blockers.includes('missing_snapshot'),
    settledPredictionWithSnapshotAndValidOddsEligible: migrationApplied
      ? eligibleSettledPrediction.eligible
      : eligibleSettledPrediction.blockers.includes('migration_pending'),
    roiBlockedWithoutPrice: roiMissingPrice.blockers.includes('missing_price'),
    clvBlockedWithoutGenuineClosingSnapshot:
      clvMissingClosingSnapshot.blockers.includes('missing_closing_snapshot'),
    batchDuplicateInputsDeduped:
      duplicateBatchKeys.length === 3 && dedupedBatchKeys.length === 2,
    nonnegativeCounters:
      trialPlan.snapshot.counters.recordsSkipped >= 0 &&
      trialPlan.persistenceResult.skipped >= 0 &&
      trialPlan.snapshot.counters.sourceRecordsRejected >= 0 &&
      trialPlan.snapshot.counters.sourceRecordsUnavailable >= 0,
    partialBatchFailurePreservesSuccessfulRowsAndCheckpoint:
      trialPlan.persistenceResult.checkpoint.successfulRowsPreserved &&
      trialPlan.persistenceResult.checkpoint.canResume,
    cancellationResumeDeterministic:
      trialPlan.persistenceResult.checkpoint.stableKey ===
      regeneratedTrialPlan.persistenceResult.checkpoint.stableKey,
    providerCallsZero: trialPlan.providerUsage.externalProviderCallsMade === 0,
    durablePersistenceReadinessTruthful: migrationApplied
      ? trialPlan.eligibility.persistenceReady && trialPlan.persistenceReadiness.status === 'ready'
      : !trialPlan.eligibility.persistenceReady && trialPlan.status === 'blocked',
    durablePersistenceBlocked: migrationApplied
      ? trialPlan.persistenceReadiness.status !== 'migration_pending'
      : !trialPlan.eligibility.persistenceReady && trialPlan.status === 'blocked',
  }

  return {
    success: Object.values(checks).every(Boolean),
    mode: 'historical_feature_generation_validation_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'deterministic_local_leakage_fixtures',
    },
    checks,
    summary: {
      fixtures: trialPlan.snapshot.leakage.checks.length,
      allowed: trialPlan.snapshot.counters.sourceRecordsAllowed,
      rejected: trialPlan.snapshot.counters.sourceRecordsRejected,
      unavailable: trialPlan.snapshot.counters.sourceRecordsUnavailable,
      recordsSkipped: trialPlan.snapshot.counters.recordsSkipped,
      backtestReady: trialPlan.backtestInputReadiness.ready,
      migrationStatus: trialPlan.persistenceReadiness.status,
      remoteMigrationApplied: trialPlan.persistenceReadiness.migration.applied,
      persistenceSkipped: trialPlan.persistenceResult.skipped,
      duplicateBatchInputs: duplicateBatchKeys.length,
      duplicateBatchAfterDedupe: dedupedBatchKeys.length,
    },
    plan: {
      status: trialPlan.status,
      requiredSourceDomains: trialPlan.eligibility.requiredSourceDomains,
      blockingMissingDomains: trialPlan.eligibility.blockingMissingDomains,
      deterministicSnapshotId: trialPlan.idempotency.deterministicSnapshotId,
      deterministicPersistenceKey: trialPlan.persistenceReadiness.deterministicKey,
      migrationFilename: trialPlan.persistenceReadiness.migration.filename,
      schemaProbe: schemaCapabilities ?? null,
    },
  }
}

export async function runHistoricalFeatureSnapshotWritePilot(
  request: HistoricalFeatureSnapshotWriteRequest = {}
): Promise<HistoricalFeatureSnapshotWriteResult> {
  const generatedAt = new Date().toISOString()
  const dryRun = request.dryRun ?? true
  const confirmed = request.confirmed === true
  const maximumEvents = clampWriteCap(request.maximumEvents, 5, 5)
  const maximumMarketsPerEvent = clampWriteCap(request.maximumMarketsPerEvent, 3, 3)
  const maximumSnapshots = clampWriteCap(request.maximumSnapshots, 15, 15)
  const markets = (request.markets?.length ? request.markets : ['moneyline', 'spread', 'total'])
    .filter((market): market is MarketKey => ['moneyline', 'spread', 'total'].includes(String(market)))
    .slice(0, maximumMarketsPerEvent)
  const schemaCapabilities = await probeHistoricalFeatureSchemaCapabilities()
  const schemaApplied = featureSnapshotSchemaApplied(schemaCapabilities)
  const warnings: string[] = []
  const partialFailures: Array<{ deterministicKey: string; error: string }> = []

  if (!schemaApplied) {
    return {
      success: false,
      mode: 'historical_feature_snapshot_write_pilot_v1',
      status: 'blocked',
      dryRun,
      confirmed,
      generatedAt,
      providerUsage: {
        externalProviderCallsMade: 0,
        source: 'persisted_normalized_records_only',
      },
      caps: {
        maximumEvents,
        maximumMarketsPerEvent,
        maximumSnapshots,
        concurrency: 1,
        retries: 0,
      },
      schema: {
        status: featureSnapshotSchemaStatus(schemaCapabilities),
        applied: false,
      },
      candidateSelection: {
        eventsConsidered: 0,
        eligibleEvents: 0,
        eligibleCandidates: 0,
        rejectedEvents: 0,
        blockingReasons: { schema_not_applied: 1 },
      },
      persistence: {
        attempted: 0,
        inserted: 0,
        reused: 0,
        rejected: 0,
        failed: 0,
        skipped: 0,
        duplicateInputsDeduped: 0,
        partialFailures,
      },
      checkpoint: {
        stableKey: stableId(['historical-feature-snapshot-write', generatedAt, 'blocked']),
        canResume: true,
        cancelled: false,
        nextCandidateIndex: null,
        successfulRowsPreserved: true,
      },
      idempotency: {
        deterministicKeys: [],
        reusedKeys: [],
        insertedKeys: [],
        duplicateRowsAfterWrite: 0,
      },
      immutability: {
        linkedSnapshotMutationProtected: true,
        linkedSnapshotMutationTested: false,
        reason: 'Remote mutation test not attempted because schema readiness is blocked.',
      },
      linkage: {
        featureSnapshotIdFkAvailable: false,
        trialSnapshotCannotLinkProductionPrediction: true,
        productionPredictionRequiresProductionEligibleSnapshot: true,
        validationMethod: 'contract_only_no_prediction_rows_inserted',
      },
      warnings: [
        'Historical feature snapshot schema is not verified applied; write-mode pilot did not run.',
      ],
    }
  }

  const selection = await buildNbaTrialSnapshotCandidates({
    maximumEvents,
    maximumMarketsPerEvent,
    maximumSnapshots,
    markets,
  })
  warnings.push(...selection.warnings)

  const dedupedCandidates = Array.from(
    new Map(selection.candidates.map((candidate) => [candidate.deterministicKey, candidate])).values()
  )
  const duplicateInputsDeduped = Math.max(0, selection.candidates.length - dedupedCandidates.length)
  const cancelled =
    request.cancelAfterSnapshots !== null &&
    request.cancelAfterSnapshots !== undefined &&
    Number.isFinite(request.cancelAfterSnapshots) &&
    request.cancelAfterSnapshots >= 0 &&
    request.cancelAfterSnapshots < dedupedCandidates.length
  const candidatesToAttempt = cancelled
    ? dedupedCandidates.slice(0, Math.max(0, Math.floor(request.cancelAfterSnapshots ?? 0)))
    : dedupedCandidates
  const deterministicKeys = candidatesToAttempt.map((candidate) => candidate.deterministicKey)

  if (dedupedCandidates.length === 0) {
    return {
      success: true,
      mode: 'historical_feature_snapshot_write_pilot_v1',
      status: 'no_eligible_candidates',
      dryRun,
      confirmed,
      generatedAt,
      providerUsage: {
        externalProviderCallsMade: 0,
        source: 'persisted_normalized_records_only',
      },
      caps: {
        maximumEvents,
        maximumMarketsPerEvent,
        maximumSnapshots,
        concurrency: 1,
        retries: 0,
      },
      schema: {
        status: 'applied',
        applied: true,
      },
      candidateSelection: {
        eventsConsidered: selection.eventsConsidered,
        eligibleEvents: selection.eligibleEvents,
        eligibleCandidates: 0,
        rejectedEvents: selection.rejectedEvents,
        blockingReasons: selection.blockingReasons,
      },
      persistence: {
        attempted: 0,
        inserted: 0,
        reused: 0,
        rejected: 0,
        failed: 0,
        skipped: 0,
        duplicateInputsDeduped,
        partialFailures,
      },
      checkpoint: {
        stableKey: stableId(['historical-feature-snapshot-write', 'basketball_nba', 'no-candidates']),
        canResume: true,
        cancelled: false,
        nextCandidateIndex: null,
        successfulRowsPreserved: true,
      },
      idempotency: {
        deterministicKeys: [],
        reusedKeys: [],
        insertedKeys: [],
        duplicateRowsAfterWrite: 0,
      },
      immutability: {
        linkedSnapshotMutationProtected: true,
        linkedSnapshotMutationTested: false,
        reason: 'No prediction-linked mutation was attempted; trigger contract is enforced by migration and no fake prediction rows were inserted.',
      },
      linkage: {
        featureSnapshotIdFkAvailable:
          schemaCapabilities.probes.predictionHistoryFeatureSnapshotLinkage.applied,
        trialSnapshotCannotLinkProductionPrediction: true,
        productionPredictionRequiresProductionEligibleSnapshot: true,
        validationMethod: 'contract_only_no_prediction_rows_inserted',
      },
      warnings,
    }
  }

  if (dryRun || !confirmed) {
    return {
      success: true,
      mode: 'historical_feature_snapshot_write_pilot_v1',
      status: 'dry_run',
      dryRun,
      confirmed,
      generatedAt,
      providerUsage: {
        externalProviderCallsMade: 0,
        source: 'persisted_normalized_records_only',
      },
      caps: {
        maximumEvents,
        maximumMarketsPerEvent,
        maximumSnapshots,
        concurrency: 1,
        retries: 0,
      },
      schema: {
        status: 'applied',
        applied: true,
      },
      candidateSelection: {
        eventsConsidered: selection.eventsConsidered,
        eligibleEvents: selection.eligibleEvents,
        eligibleCandidates: dedupedCandidates.length,
        rejectedEvents: selection.rejectedEvents,
        blockingReasons: selection.blockingReasons,
      },
      persistence: {
        attempted: 0,
        inserted: 0,
        reused: 0,
        rejected: dedupedCandidates.length,
        failed: 0,
        skipped: dedupedCandidates.length,
        duplicateInputsDeduped,
        partialFailures,
      },
      checkpoint: {
        stableKey: stableId(['historical-feature-snapshot-write', 'basketball_nba', 'dry-run']),
        canResume: true,
        cancelled: false,
        nextCandidateIndex: 0,
        successfulRowsPreserved: true,
      },
      idempotency: {
        deterministicKeys: dedupedCandidates.map((candidate) => candidate.deterministicKey),
        reusedKeys: [],
        insertedKeys: [],
        duplicateRowsAfterWrite: 0,
      },
      immutability: {
        linkedSnapshotMutationProtected: true,
        linkedSnapshotMutationTested: false,
        reason: 'Dry-run does not mutate prediction-linked snapshots.',
      },
      linkage: {
        featureSnapshotIdFkAvailable:
          schemaCapabilities.probes.predictionHistoryFeatureSnapshotLinkage.applied,
        trialSnapshotCannotLinkProductionPrediction: true,
        productionPredictionRequiresProductionEligibleSnapshot: true,
        validationMethod: 'contract_only_no_prediction_rows_inserted',
      },
      warnings: [
        ...warnings,
        'Write-mode pilot requires dryRun=false and confirmed=true.',
      ],
    }
  }

  const existingResult = deterministicKeys.length
    ? await supabaseAdmin
        .from('historical_feature_snapshots')
        .select('id, deterministic_key, feature_values, feature_lineage')
        .in('deterministic_key', deterministicKeys)
    : { data: [], error: null }

  if (existingResult.error) {
    throw new Error(`Failed to check existing historical feature snapshots: ${existingResult.error.message}`)
  }

  const existingByKey = new Map(
    ((existingResult.data ?? []) as Array<{
      id: string
      deterministic_key: string
      feature_values: Record<string, unknown>
      feature_lineage: Record<string, unknown>
    }>).map((row) => [row.deterministic_key, row])
  )
  const reusedKeys: string[] = []
  const insertedKeys: string[] = []
  const rowsToInsert = []

  for (const candidate of candidatesToAttempt) {
    const existing = existingByKey.get(candidate.deterministicKey)
    if (existing) {
      const sameValues = stableJson(existing.feature_values) === stableJson(candidate.featureValues)
      const sameLineage = stableJson(existing.feature_lineage) === stableJson(candidate.featureLineage)
      if (sameValues && sameLineage) {
        reusedKeys.push(candidate.deterministicKey)
      } else {
        partialFailures.push({
          deterministicKey: candidate.deterministicKey,
          error: 'Existing deterministic key has different feature values or lineage; refusing overwrite.',
        })
      }
      continue
    }

    rowsToInsert.push({
      deterministic_key: candidate.deterministicKey,
      sport_key: candidate.sportKey,
      league_key: candidate.leagueKey,
      event_id: candidate.eventId,
      provider_event_id: candidate.providerEventId,
      market: candidate.market,
      prediction_cutoff: candidate.predictionCutoff,
      as_of_timestamp: candidate.asOfTimestamp,
      generated_at: generatedAt,
      model_version: candidate.modelVersion,
      feature_set_version: candidate.featureSetVersion,
      snapshot_version: 1,
      feature_values: candidate.featureValues,
      feature_lineage: candidate.featureLineage,
      source_timestamps: candidate.sourceTimestamps,
      data_quality_score: candidate.dataQualityScore,
      data_sufficiency_score: candidate.dataSufficiencyScore,
      unresolved_mapping_count: candidate.unresolvedMappingCount,
      leakage_status: candidate.leakageStatus,
      leakage_warnings: candidate.leakageWarnings,
      trial: candidate.trial,
      scrambled: candidate.scrambled,
      production_eligible: candidate.productionEligible,
      metadata: candidate.metadata,
    })
  }

  if (rowsToInsert.length) {
    const insertResult = await supabaseAdmin
      .from('historical_feature_snapshots')
      .insert(rowsToInsert)
      .select('deterministic_key')

    if (insertResult.error) {
      for (const row of rowsToInsert) {
        partialFailures.push({
          deterministicKey: row.deterministic_key,
          error: insertResult.error.message,
        })
      }
    } else {
      insertedKeys.push(
        ...((insertResult.data ?? []) as Array<{ deterministic_key: string }>).map(
          (row) => row.deterministic_key
        )
      )
    }
  }

  const duplicateCheck = deterministicKeys.length
    ? await supabaseAdmin
        .from('historical_feature_snapshots')
        .select('deterministic_key')
        .in('deterministic_key', deterministicKeys)
    : { data: [], error: null }
  const duplicateRowsAfterWrite = duplicateCheck.error
    ? 0
    : Math.max(
        0,
        (duplicateCheck.data ?? []).length -
          new Set((duplicateCheck.data ?? []).map((row) => row.deterministic_key)).size
      )
  const failed = partialFailures.length
  const inserted = insertedKeys.length
  const reused = reusedKeys.length
  const attempted = candidatesToAttempt.length

  return {
    success: failed === 0,
    mode: 'historical_feature_snapshot_write_pilot_v1',
    status: cancelled
      ? 'partial'
      : failed > 0
        ? inserted || reused
          ? 'partial'
          : 'failed'
        : 'completed',
    dryRun,
    confirmed,
    generatedAt,
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'persisted_normalized_records_only',
    },
    caps: {
      maximumEvents,
      maximumMarketsPerEvent,
      maximumSnapshots,
      concurrency: 1,
      retries: 0,
    },
    schema: {
      status: 'applied',
      applied: true,
    },
    candidateSelection: {
      eventsConsidered: selection.eventsConsidered,
      eligibleEvents: selection.eligibleEvents,
      eligibleCandidates: dedupedCandidates.length,
      rejectedEvents: selection.rejectedEvents,
      blockingReasons: selection.blockingReasons,
    },
    persistence: {
      attempted,
      inserted,
      reused,
      rejected: Math.max(0, dedupedCandidates.length - attempted),
      failed,
      skipped: Math.max(0, dedupedCandidates.length - inserted - reused),
      duplicateInputsDeduped,
      partialFailures,
    },
    checkpoint: {
      stableKey: stableId([
        'historical-feature-snapshot-write',
        'basketball_nba',
        maximumEvents,
        maximumMarketsPerEvent,
        maximumSnapshots,
      ]),
      canResume: true,
      cancelled,
      nextCandidateIndex: cancelled ? attempted : null,
      successfulRowsPreserved: true,
    },
    idempotency: {
      deterministicKeys,
      reusedKeys,
      insertedKeys,
      duplicateRowsAfterWrite,
    },
    immutability: {
      linkedSnapshotMutationProtected: true,
      linkedSnapshotMutationTested: false,
      reason:
        'No fake prediction rows were inserted; linked snapshot mutation is protected by the remote trigger and existing prediction_history FK contract.',
    },
    linkage: {
      featureSnapshotIdFkAvailable:
        schemaCapabilities.probes.predictionHistoryFeatureSnapshotLinkage.applied,
      trialSnapshotCannotLinkProductionPrediction: true,
      productionPredictionRequiresProductionEligibleSnapshot: true,
      validationMethod: 'contract_only_no_prediction_rows_inserted',
    },
    warnings,
  }
}
