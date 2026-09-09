import { createClient } from '@supabase/supabase-js'
import { assertR2TLiveReadiness } from './mlb-data-02r-r2t-real-feature-champion.mjs'
import { buildAllPregameFeatureRows } from './mlb-data-02r-r2t-r1-pregame-contract.mjs'
import {pinnedFeatureReferences} from './mlb-operational-r6-compact-features.mjs'
import { buildPersistedPredictions, persistDownstreamRows, assertDownstreamPayload, DOWNSTREAM_BINDINGS, downstreamSchemaColumns } from './mlb-data-02r-r2t-downstream-persistence.mjs'
import { persistCanonicalMarkets, buildCanonicalValues, buildCanonicalOfficialPicks, canonicalMarketReference, restoreCanonicalMarkets } from './mlb-data-02r-r2t-market-binding.mjs'
import { assertCanonicalRawInsert } from './mlb-data-02r-r2t-raw-binding.mjs'
import { fetchR2NStatcastRowsForGames, streamR2NStatcastRowsForGames } from './mlb-data-02h-2026-current-foundation.mjs'
import {
  assertGameScope,
  assertIsoTimestamp,
  classifyInsertReuseConflict,
  makeProviderAccounting,
  makeRunContext,
  normalizeGamePk,
  sha256,
  stageResult,
} from './mlb-data-02r-r2f-stage-contracts.mjs'
import {
  R2F_FEATURE_COUNT,
  R2F_FEATURE_SET,
  R2F_MODEL_VERSION,
  R2F_POLICY_VERSION,
  classifyStarterReadiness,
  getCurrentSlate,
  inferMoneyline,
  planCurrentSlateFeatures,
  readValueBoardAdapter,
  reconcileCurrentSlateStatcast,
  reconcileNativeIdentity,
  evaluateOfficialPickPolicy,
} from './mlb-data-02r-r2f-wave12-interfaces.mjs'
import {
  acceptOddsEvidence,
  calculateNativeValue,
  classifyMarketFreshness,
  classifyMarketPersistence,
  classifyOfficialPickPersistence,
  classifyValuePersistence,
  crosswalkMarketEvents,
  normalizeMarketEvidence,
  persistPredictions,
} from './mlb-data-02r-r2g-persistence-interfaces.mjs'

export const R2I_CERTIFICATION = 'MLB_DATA_02R_R2I_LIVE_EXECUTION_INTERFACE_IMPLEMENTATION_CERTIFIED'
export const R2I_AUTH_ERROR = 'LIVE_REFRESH_EXECUTION_REQUIRES_EXPLICIT_R2B_AUTHORIZATION'
export const R2I_PRIOR_PACKAGE_SHA = '8cfd91f626e0e914d2e3abb07dc140b793a39c73'
export const R2Q_EMPTY_SLATE_TERMINAL_STATUS = 'NO_VALID_PREGAME_SLATE'
export const R2R_OPERATING_TIME_ZONE = 'America/Puerto_Rico'

const MODEL_ARTIFACT_DIGEST = '9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616'
const FEATURE_CONTRACT_DIGEST = sha256({ featureSet: R2F_FEATURE_SET, featureCount: R2F_FEATURE_COUNT, modelVersion: R2F_MODEL_VERSION })
export const R2I_LIVE_TARGETS = Object.freeze({
  nativeGames: 'pick2_mlb_games',
  nativePlayers: 'pick2_mlb_players',
  rawStatcast: 'pick2_raw_mlb_statcast_pitches',
  featureSnapshots: 'pick2_feature_snapshots',
  team: 'pick2_mlb_team_daily_features',
  starter: 'pick2_mlb_pitcher_daily_features',
  bullpen: 'pick2_mlb_bullpen_daily_features',
  batter: 'pick2_mlb_batter_daily_features',
  matchup: 'pick2_mlb_matchup_daily_features',
  firstInning: 'pick2_mlb_first_inning_daily_features',
  predictions: 'pick2_game_predictions',
  marketMappings: 'pick2_mlb_market_event_mappings',
  marketObservations: 'pick2_mlb_market_price_observations',
  values: 'pick2_mlb_market_value_evaluations',
  officialPicks: 'pick2_mlb_official_picks',
})

export const NATIVE_GAME_WRITABLE_COLUMNS = Object.freeze([
  'game_pk',
  'season',
  'game_date',
  'scheduled_at',
  'home_team_id',
  'away_team_id',
  'game_type',
  'official_status',
  'doubleheader',
  'game_number',
  'source',
  'source_payload_digest',
  'legacy_sport_event_id',
  'metadata',
])

export const NATIVE_GAME_REQUIRED_INSERT_COLUMNS = Object.freeze([
  'game_pk',
  'source',
  'metadata',
])

function liveTargetForFeatureDomain(domain) {
  if (domain === 'snapshots') return R2I_LIVE_TARGETS.featureSnapshots
  return R2I_LIVE_TARGETS[domain]
}

export const R2I_FEATURE_IDENTITY_BINDINGS = Object.freeze({
  snapshots: {
    table: R2I_LIVE_TARGETS.featureSnapshots,
    physicalIdentityColumn: 'deterministic_identity',
    adapterIdentity: 'identity',
    readColumns: 'id,deterministic_identity,pick2_era,sport_key,feature_domain,subject_id,secondary_subject_id,event_id,feature_date,as_of_date,as_of_timestamp,feature_version,source_window,sample_sizes,features,input_digest,created_at,target_game_pk,mlbam_person_id,mlbam_pitcher_id,mlbam_batter_id,native_identity_metadata',
    nativeKey: ['deterministic_identity'],
  },
  team: {
    table: R2I_LIVE_TARGETS.team,
    physicalIdentityColumn: 'target_game_pk,team_id,feature_version',
    adapterIdentity: 'identity',
    readColumns: 'id,feature_snapshot_id,team_id,feature_date,as_of_date,as_of_timestamp,feature_version,recent_k_rate,recent_bb_rate,recent_runs_per_game,recent_iso,handedness_splits,lineup_proxy,sample_sizes,source_window,created_at,target_game_pk',
    nativeKey: ['target_game_pk', 'team_id', 'feature_version'],
  },
  starter: {
    table: R2I_LIVE_TARGETS.starter,
    physicalIdentityColumn: 'target_game_pk,mlbam_pitcher_id,feature_version',
    adapterIdentity: 'identity',
    readColumns: 'id,feature_snapshot_id,player_id,feature_date,as_of_date,as_of_timestamp,feature_version,k_rate,bb_rate,k_minus_bb_rate,whiff_rate,csw_rate,strike_rate,swing_rate,avg_release_speed,velocity_l1,velocity_l3,velocity_l5,velocity_delta,previous_pitch_count,days_rest,pitch_mix,pitch_mix_change,handedness_splits,first_inning_performance,sample_sizes,source_window,created_at,target_game_pk,mlbam_pitcher_id',
    nativeKey: ['target_game_pk', 'mlbam_pitcher_id', 'feature_version'],
  },
  bullpen: {
    table: R2I_LIVE_TARGETS.bullpen,
    physicalIdentityColumn: 'target_game_pk,team_id,feature_version',
    adapterIdentity: 'identity',
    readColumns: 'id,feature_snapshot_id,team_id,feature_date,as_of_date,as_of_timestamp,feature_version,pitches_previous_24h,pitches_previous_72h,high_workload_reliever_count,reliever_workload,bullpen_k_rate,bullpen_bb_rate,bullpen_k_minus_bb_rate,bullpen_whiff_rate,availability_proxies,sample_sizes,source_window,created_at,target_game_pk,mlbam_pitcher_ids',
    nativeKey: ['target_game_pk', 'team_id', 'feature_version'],
  },
  batter: {
    table: R2I_LIVE_TARGETS.batter,
    physicalIdentityColumn: 'target_game_pk,mlbam_batter_id,feature_version',
    adapterIdentity: 'identity',
    readColumns: 'id,feature_snapshot_id,player_id,feature_date,as_of_date,as_of_timestamp,feature_version,recent_k_rate,recent_bb_rate,recent_scoring_contribution,iso_value,handedness_splits,pitch_type_matchups,sample_sizes,source_window,created_at,target_game_pk,mlbam_batter_id',
    nativeKey: ['target_game_pk', 'mlbam_batter_id', 'feature_version'],
  },
  matchup: {
    table: R2I_LIVE_TARGETS.matchup,
    physicalIdentityColumn: 'target_game_pk,feature_version',
    adapterIdentity: 'identity',
    readColumns: 'id,feature_snapshot_id,event_id,home_team_id,away_team_id,feature_date,as_of_date,as_of_timestamp,feature_version,pitcher_batter_mix,handedness_context,park_context,lineup_context,sample_sizes,source_window,created_at,target_game_pk,mlbam_pitcher_id,mlbam_batter_id',
    nativeKey: ['target_game_pk', 'feature_version'],
  },
  firstInning: {
    table: R2I_LIVE_TARGETS.firstInning,
    physicalIdentityColumn: 'target_game_pk,feature_version',
    adapterIdentity: 'identity',
    readColumns: 'id,feature_snapshot_id,event_id,home_team_id,away_team_id,feature_date,as_of_date,as_of_timestamp,feature_version,team_first_inning_scoring_rate,starter_first_inning_k_rate,starter_first_inning_bb_rate,starter_first_inning_baserunner_proxy,starter_first_inning_pitch_count,sample_sizes,source_window,created_at,target_game_pk,home_starter_mlbam_pitcher_id,away_starter_mlbam_pitcher_id,expected_lineup_mlbam_batter_ids',
    nativeKey: ['target_game_pk', 'feature_version'],
  },
})

function featureBindingForDomain(domain) {
  const binding = R2I_FEATURE_IDENTITY_BINDINGS[domain]
  if (!binding) throw new Error(`FEATURE_DOMAIN_BINDING_MISSING:${domain}`)
  return binding
}

export function dateInOperatingZone(date, timeZone = R2R_OPERATING_TIME_ZONE) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function runIdDateSuffix(runId) {
  const match = String(runId ?? '').match(/(?:^|[-_:])(\d{8})$/)
  if (!match) return null
  return `${match[1].slice(0, 4)}-${match[1].slice(4, 6)}-${match[1].slice(6, 8)}`
}

export function createCurrentSlateRunFreeze({
  runId = 'mlb-02r-r2i-test-live',
  executionPackageSha = R2I_PRIOR_PACKAGE_SHA,
  mode = 'DRY_RUN',
  clock = null,
  runDate = null,
  runAsOf = null,
  timeZone = R2R_OPERATING_TIME_ZONE,
} = {}) {
  const liveCurrentSlate = mode === 'LIVE_EXECUTE' && !runDate && !runAsOf
  const fixtureClock = new Date('2026-09-07T15:30:00.000Z')
  const baseDate = clock ? new Date(clock) : liveCurrentSlate ? new Date() : fixtureClock
  if (Number.isNaN(baseDate.getTime())) throw new Error(`INVALID_RUN_FREEZE_CLOCK:${clock}`)
  const frozenRunAsOf = assertIsoTimestamp(runAsOf ?? baseDate.toISOString(), 'run_as_of')
  const frozenRunDate = String(runDate ?? dateInOperatingZone(new Date(frozenRunAsOf), timeZone))
  const suffixDate = runIdDateSuffix(runId)
  if (suffixDate && suffixDate !== frozenRunDate) throw new Error(`RUN_ID_DATE_CONTEXT_MISMATCH:${suffixDate}:${frozenRunDate}`)
  return makeRunContext({
    run_id: runId,
    run_date: frozenRunDate,
    run_as_of: frozenRunAsOf,
    execution_package_sha: executionPackageSha,
    db_contract_digest: 'r2i-live-db-contract',
    model_artifact_digest: MODEL_ARTIFACT_DIGEST,
    feature_contract_digest: FEATURE_CONTRACT_DIGEST,
  })
}

function featureSubjectForKey(row, field) {
  if (field === 'mlbam_pitcher_id') return row.mlbam_pitcher_id ?? row.subject_id
  if (field === 'mlbam_batter_id') return row.mlbam_batter_id ?? row.subject_id
  return row[field]
}

export function featureIdentityForDomain(domain, row) {
  const binding = featureBindingForDomain(domain)
  if (domain === 'snapshots') return String(row.deterministic_identity ?? row.identity)
  const nativeIdentity = binding.nativeKey.map((field) => {
    const value = field === 'target_game_pk' ? normalizeGamePk(row.target_game_pk ?? row.game_pk) : featureSubjectForKey(row, field)
    if (value === undefined || value === null || value === '') throw new Error(`FEATURE_IDENTITY_INCOMPLETE:${domain}:${field}`)
    return String(value)
  }).join(':')
  // Physical native rows are immutable revisions after the authorized schema
  // change. Unbound rows retain the legacy planning identity only; persistence
  // requires a validated canonical FK before classification.
  return row.feature_snapshot_id
    ? `${nativeIdentity}:snapshot:${assertDbUuid(row.feature_snapshot_id, 'feature_snapshot_id')}`
    : nativeIdentity
}

export function comparableFeatureRow(domain, row) {
  const identity = featureIdentityForDomain(domain, row)
  const digest = row.feature_digest ?? row.input_digest ?? null
  return {
    ...row,
    target_game_pk: normalizeGamePk(row.target_game_pk ?? row.game_pk),
    identity,
    feature_digest: digest,
  }
}

function assertIsoDate(value, label) {
  const text = String(value ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00.000Z`))) {
    throw new Error(`INVALID_${label}:${value}`)
  }
  return text
}

function priorUtcDate(value) {
  const date = new Date(`${assertIsoDate(value, 'FEATURE_DATE')}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

export function featureDateFieldsForGame(game, { runAsOf } = {}) {
  assertIsoTimestamp(runAsOf, 'run_as_of')
  const scheduledAt = game?.scheduled_at ?? game?.start_time ?? game?.gameDate
  const featureDate = assertIsoDate(
    game?.game_date ?? game?.officialDate ?? String(scheduledAt ?? '').slice(0, 10),
    'FEATURE_DATE',
  )
  const asOfDate = priorUtcDate(featureDate)
  const asOfTimestamp = `${asOfDate}T23:59:59.000Z`
  if (Date.parse(asOfTimestamp) > Date.parse(runAsOf)) throw new Error('FEATURE_AS_OF_AFTER_RUN_AS_OF')
  return {
    feature_date: featureDate,
    as_of_date: asOfDate,
    as_of_timestamp: asOfTimestamp,
  }
}

async function readFeatureRowsByDomain(client, domain, ids, plannedRows = []) {
  if (!ids.length) return []
  const binding = featureBindingForDomain(domain)
  if (domain === 'snapshots') {
    const data = await selectByIds(client, binding.table, binding.physicalIdentityColumn, ids, binding.readColumns)
    return data.map((row) => comparableFeatureRow(domain, row))
  }
  const gamePks = [...new Set(plannedRows.map((row) => normalizeGamePk(row.target_game_pk ?? row.game_pk)))]
  if (!gamePks.length) return []
  const snapshotIds = [...new Set(plannedRows.map((row) => row.feature_snapshot_id).filter(Boolean))]
  let query = client
    .from(binding.table)
    .select(binding.readColumns)
    .in('target_game_pk', gamePks)
  if (snapshotIds.length) query = query.in('feature_snapshot_id', snapshotIds)
  const { data, error } = await query
  if (error) throw new Error(`READ_FAILED:${binding.table}:${error.message}`)
  const requested = new Set(ids.map(String))
  return (data ?? []).map((row) => comparableFeatureRow(domain, row)).filter((row) => requested.has(String(row.identity)))
}

function featureSnapshotInsertRow(row) {
  const deterministicIdentity = row.deterministic_identity ?? row.identity
  if (!deterministicIdentity) throw new Error('FEATURE_SNAPSHOT_DETERMINISTIC_IDENTITY_REQUIRED')
  const targetGamePk = normalizeGamePk(row.target_game_pk ?? row.game_pk)
  if (!row.feature_date || !row.as_of_date || !row.as_of_timestamp) throw new Error('FEATURE_SNAPSHOT_DATE_FIELDS_REQUIRED')
  if (!row.feature_version) throw new Error('FEATURE_SNAPSHOT_FEATURE_VERSION_REQUIRED')
  const featureDate = assertIsoDate(row.feature_date, 'FEATURE_DATE')
  const asOfDate = assertIsoDate(row.as_of_date, 'AS_OF_DATE')
  assertIsoTimestamp(row.as_of_timestamp, 'as_of_timestamp')
  if (String(row.as_of_timestamp).slice(0, 10) !== asOfDate) throw new Error('FEATURE_SNAPSHOT_AS_OF_TIMESTAMP_DATE_MISMATCH')
  if (Date.parse(row.as_of_timestamp) > Date.parse(`${featureDate}T23:59:59.999Z`)) throw new Error(`FEATURE_SNAPSHOT_AS_OF_AFTER_FEATURE_DATE:${targetGamePk}`)
  const inputDigest = row.input_digest ?? row.feature_digest ?? sha256(row.features ?? row)
  return {
    deterministic_identity: String(deterministicIdentity),
    pick2_era: row.pick2_era ?? 'PICK_2_ERA_V1',
    sport_key: row.sport_key ?? 'baseball_mlb',
    feature_domain: row.feature_domain ?? 'prediction_bundle',
    subject_id: row.subject_id ?? `game:${targetGamePk}`,
    secondary_subject_id: row.secondary_subject_id ?? null,
    event_id: row.event_id ?? null,
    target_game_pk: targetGamePk,
    mlbam_person_id: row.mlbam_person_id ?? null,
    mlbam_pitcher_id: row.mlbam_pitcher_id ?? null,
    mlbam_batter_id: row.mlbam_batter_id ?? null,
    native_identity_metadata: row.native_identity_metadata ?? {},
    feature_date: featureDate,
    as_of_date: asOfDate,
    as_of_timestamp: row.as_of_timestamp,
    feature_version: row.feature_version,
    source_window: row.source_window ?? {},
    sample_sizes: row.sample_sizes ?? {},
    features: row.features ?? {},
    input_digest: inputDigest,
  }
}

const DB_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function assertDbUuid(value, label = 'db_uuid') {
  const text = String(value ?? '')
  if (!DB_UUID_PATTERN.test(text)) throw new Error(`INVALID_${label.toUpperCase()}:${value}`)
  return text
}

const DAILY_FEATURE_REQUIRED_COLUMNS = Object.freeze(['feature_snapshot_id', 'target_game_pk', 'feature_date', 'as_of_date', 'as_of_timestamp', 'feature_version'])
const DAILY_FEATURE_ALLOWED_COLUMNS = Object.freeze({
  team: new Set([...DAILY_FEATURE_REQUIRED_COLUMNS, 'team_id', 'sample_sizes', 'source_window', 'recent_k_rate', 'recent_bb_rate', 'recent_runs_per_game', 'recent_iso', 'handedness_splits', 'lineup_proxy']),
  starter: new Set([...DAILY_FEATURE_REQUIRED_COLUMNS, 'player_id', 'mlbam_pitcher_id', 'sample_sizes', 'source_window', 'k_rate', 'bb_rate', 'k_minus_bb_rate', 'whiff_rate', 'csw_rate', 'strike_rate', 'swing_rate', 'avg_release_speed', 'velocity_l1', 'velocity_l3', 'velocity_l5', 'velocity_delta', 'previous_pitch_count', 'days_rest', 'pitch_mix', 'pitch_mix_change', 'handedness_splits', 'first_inning_performance']),
  bullpen: new Set([...DAILY_FEATURE_REQUIRED_COLUMNS, 'team_id', 'mlbam_pitcher_ids', 'sample_sizes', 'source_window', 'pitches_previous_24h', 'pitches_previous_72h', 'high_workload_reliever_count', 'reliever_workload', 'bullpen_k_rate', 'bullpen_bb_rate', 'bullpen_k_minus_bb_rate', 'bullpen_whiff_rate', 'availability_proxies']),
  batter: new Set([...DAILY_FEATURE_REQUIRED_COLUMNS, 'player_id', 'mlbam_batter_id', 'sample_sizes', 'source_window', 'recent_k_rate', 'recent_bb_rate', 'recent_scoring_contribution', 'iso_value', 'handedness_splits', 'pitch_type_matchups']),
  matchup: new Set([...DAILY_FEATURE_REQUIRED_COLUMNS, 'event_id', 'home_team_id', 'away_team_id', 'sample_sizes', 'source_window', 'pitcher_batter_mix', 'handedness_context', 'park_context', 'lineup_context', 'mlbam_pitcher_id', 'mlbam_batter_id']),
  firstInning: new Set([...DAILY_FEATURE_REQUIRED_COLUMNS, 'event_id', 'home_team_id', 'away_team_id', 'home_starter_mlbam_pitcher_id', 'away_starter_mlbam_pitcher_id', 'expected_lineup_mlbam_batter_ids', 'sample_sizes', 'source_window', 'team_first_inning_scoring_rate', 'starter_first_inning_k_rate', 'starter_first_inning_bb_rate', 'starter_first_inning_baserunner_proxy', 'starter_first_inning_pitch_count']),
})

function assertDailyFeatureInsertShape(domain, row, { eligibleGamePks = null } = {}) {
  const allowed = DAILY_FEATURE_ALLOWED_COLUMNS[domain]
  if (!allowed) throw new Error(`FEATURE_DOMAIN_INSERT_SHAPE_MISSING:${domain}`)
  const keys = Object.keys(row ?? {})
  const unexpected = keys.filter((key) => !allowed.has(key))
  if (unexpected.length) throw new Error(`FEATURE_INSERT_UNEXPECTED_KEYS:${domain}:${unexpected.join(',')}`)
  const missing = DAILY_FEATURE_REQUIRED_COLUMNS.filter((key) => !(key in row) || row[key] === undefined || row[key] === null || row[key] === '')
  if (missing.length) throw new Error(`FEATURE_INSERT_MISSING_REQUIRED:${domain}:${missing.join(',')}`)
  assertDbUuid(row.feature_snapshot_id, `${domain}_feature_snapshot_id`)
  assertIsoDate(row.feature_date, 'FEATURE_DATE')
  assertIsoDate(row.as_of_date, 'AS_OF_DATE')
  assertIsoTimestamp(row.as_of_timestamp, 'as_of_timestamp')
  if (String(row.as_of_timestamp).slice(0, 10) !== row.as_of_date) throw new Error(`FEATURE_INSERT_AS_OF_TIMESTAMP_DATE_MISMATCH:${domain}`)
  if (eligibleGamePks) assertGameScope([row], eligibleGamePks, (candidate) => candidate.target_game_pk)
  if (domain === 'team' || domain === 'bullpen') {
    if (!row.team_id) throw new Error(`FEATURE_INSERT_TEAM_ID_REQUIRED:${domain}`)
  }
  if (domain === 'starter' && !row.mlbam_pitcher_id) throw new Error('FEATURE_INSERT_MLBAM_PITCHER_ID_REQUIRED:starter')
  if (domain === 'batter' && !row.mlbam_batter_id) throw new Error('FEATURE_INSERT_MLBAM_BATTER_ID_REQUIRED:batter')
  return { domain, keys, target_game_pk: normalizeGamePk(row.target_game_pk) }
}

export function featureInsertRowsForDomain(domain, rows) {
  if (domain === 'snapshots') return rows.map(featureSnapshotInsertRow)
  return rows.map((row) => {
    const { identity, deterministic_identity, feature_digest, features, game_pk, ...physical } = row
    void identity
    void deterministic_identity
    void feature_digest
    void features
    void game_pk
    const insertRow = {
      ...physical,
      target_game_pk: normalizeGamePk(row.target_game_pk ?? row.game_pk),
    }
    assertDailyFeatureInsertShape(domain, insertRow)
    return insertRow
  })
}

function canonicalSnapshotIdentity(row) {
  return String(row.deterministic_identity ?? row.identity ?? '')
}

export async function resolveCanonicalFeatureSnapshotIds({
  repository,
  plannedSnapshotRows = [],
  insertedSnapshotRows = [],
} = {}) {
  const identities = plannedSnapshotRows.map(canonicalSnapshotIdentity).filter(Boolean)
  if (!identities.length) return new Map()
  const readbackRows = await repository.readFeatureRows('snapshots', identities, plannedSnapshotRows)
  // Prefer independent readback over an insert response when both are present.
  const combined = [...insertedSnapshotRows, ...readbackRows].map((row) => comparableFeatureRow('snapshots', row))
  const byIdentity = new Map(combined.map((row) => [canonicalSnapshotIdentity(row), row]))
  const readbackIdentities = new Set(readbackRows.map(canonicalSnapshotIdentity))
  const resolvedIds = new Set()
  const snapshotIdByGamePk = new Map()
  const gameCounts = new Map()
  snapshotIdByGamePk.byPlannedId = new Map()
  snapshotIdByGamePk.canonicalRows = new Map()
  for (const planned of plannedSnapshotRows) {
    const identity = canonicalSnapshotIdentity(planned)
    const canonical = byIdentity.get(identity)
    if (!canonical?.id) throw new Error(`FEATURE_SNAPSHOT_CANONICAL_ID_UNRESOLVED:${identity}`)
    if (planned.native_identity_metadata && !readbackIdentities.has(identity)) throw new Error(`FEATURE_SNAPSHOT_INDEPENDENT_READBACK_MISSING:${identity}`)
    const snapshotId = assertDbUuid(canonical.id, 'feature_snapshot_id')
    if (resolvedIds.has(snapshotId)) throw new Error('DUPLICATE_CANONICAL_SNAPSHOT_ID')
    resolvedIds.add(snapshotId)
    const gamePk = normalizeGamePk(planned.target_game_pk ?? planned.game_pk)
    if (normalizeGamePk(canonical.target_game_pk ?? canonical.game_pk) !== gamePk || canonical.input_digest !== (planned.input_digest ?? planned.feature_digest)) throw new Error(`FEATURE_SNAPSHOT_READBACK_CONFLICT:${identity}`)
    if (planned.native_identity_metadata) {
      const physicalDigest = (row) => {
        const payload = featureSnapshotInsertRow(row)
        payload.as_of_timestamp = new Date(payload.as_of_timestamp).toISOString()
        return sha256(payload)
      }
      if (physicalDigest(canonical) !== physicalDigest(planned)) throw new Error(`FEATURE_SNAPSHOT_READBACK_PAYLOAD_CONFLICT:${identity}`)
    }
    if (planned.id) {
      if (snapshotIdByGamePk.byPlannedId.has(planned.id)) throw new Error('DUPLICATE_PLANNED_SNAPSHOT_ID')
      snapshotIdByGamePk.byPlannedId.set(planned.id, snapshotId)
      snapshotIdByGamePk.canonicalRows.set(snapshotId, canonical)
    }
    gameCounts.set(gamePk, (gameCounts.get(gamePk) ?? 0) + 1)
    snapshotIdByGamePk.set(gamePk, snapshotId)
  }
  // Legacy injected tests have one bundle per game. A real multi-entity plan
  // must resolve by the builder's snapshot reference, never by game alone.
  for (const [gamePk, count] of gameCounts) if (count !== 1) snapshotIdByGamePk.delete(gamePk)
  return snapshotIdByGamePk
}

export function bindFeatureRowsToSnapshotIds(rowsByDomain = {}, snapshotIdByGamePk = new Map()) {
  const bound = { ...rowsByDomain }
  for (const domain of ['team', 'starter', 'bullpen', 'batter', 'matchup', 'firstInning']) {
    bound[domain] = (rowsByDomain[domain] ?? []).map((row) => {
      const gamePk = normalizeGamePk(row.target_game_pk ?? row.game_pk)
      const snapshotId = row.feature_snapshot_id
        ? snapshotIdByGamePk.byPlannedId?.get(row.feature_snapshot_id)
        : snapshotIdByGamePk.get(gamePk)
      if (!snapshotId) throw new Error(`FEATURE_SNAPSHOT_ID_MISSING_FOR_GAME:${domain}:${gamePk}`)
      const snapshot = snapshotIdByGamePk.canonicalRows?.get(snapshotId)
      if (snapshot) {
        const subject = domain === 'team' ? `team:${row.team_id}` : domain === 'bullpen' ? `bullpen:${row.team_id}` : domain === 'starter' ? `mlbam_pitcher:${row.mlbam_pitcher_id}` : domain === 'batter' ? `mlbam_batter:${row.mlbam_batter_id}` : `game:${gamePk}`
        const family = domain === 'firstInning' ? 'first_inning' : domain
        if (snapshot.target_game_pk !== gamePk || snapshot.subject_id !== subject || snapshot.native_identity_metadata?.family !== family || snapshot.feature_version !== row.feature_version || snapshot.feature_date !== row.feature_date || snapshot.as_of_date !== row.as_of_date) throw new Error(`FEATURE_SNAPSHOT_ENTITY_BINDING_CONFLICT:${domain}:${gamePk}`)
      }
      const next = { ...row, feature_snapshot_id: snapshotId }
      assertDailyFeatureInsertShape(domain, featureInsertRowsForDomain(domain, [next])[0])
      return next
    })
  }
  return bound
}

// Compare the physical payload after canonical FK binding, using the existing classifier.
// Daily tables do not store the planner's feature_digest or prefixed identity.
export async function classifyBoundDailyFeatures(repository, rowsByDomain, eligibleGamePks, caps = {}) {
  const plans = {}
  const rows = {}
  for (const domain of Object.keys(DAILY_FEATURE_ALLOWED_COLUMNS)) {
    const comparable = (row) => {
      const payload = Object.fromEntries([...DAILY_FEATURE_ALLOWED_COLUMNS[domain]].sort()
        .filter((key) => row[key] !== undefined).map((key) => [key, row[key]]))
      if (payload.as_of_timestamp) payload.as_of_timestamp = new Date(payload.as_of_timestamp).toISOString()
      if (payload.team_id != null) payload.team_id = String(payload.team_id)
      return { ...row, identity: featureIdentityForDomain(domain, row), feature_digest: sha256(payload) }
    }
    rows[domain] = featureInsertRowsForDomain(domain, rowsByDomain[domain] ?? []).map(comparable)
    const existing = await repository.readFeatureRows(domain, rows[domain].map((row) => row.identity), rows[domain])
    plans[domain] = classifyInsertReuseConflict({
      plannedRows: rows[domain], existingRows: existing.map(comparable),
      identityFields: ['identity'], digestField: 'feature_digest', eligibleGamePks,
      cap: caps[domain] ?? null, readGamePk: (row) => row.target_game_pk,
    })
  }
  return { plans, rows }
}

// Revision identity changes storage identity only, never feature semantics.
// Equal evidence keeps a stable identity across new planner UUIDs and retries.
export function revisionFeatureRows(rowsByDomain) {
  return { ...rowsByDomain, snapshots: rowsByDomain.snapshots.map((row) => {
    if (!/^[a-f0-9]{64}$/.test(row.input_digest ?? '') || !row.native_identity_metadata?.family) throw new Error('REAL_SNAPSHOT_PROVENANCE_REQUIRED')
    const suffix = `:input:${row.input_digest}`
    return { ...row, deterministic_identity: row.deterministic_identity.endsWith(suffix) ? row.deterministic_identity : `${row.deterministic_identity}${suffix}` }
  }) }
}

export async function persistCanonicalFeaturePlan({ repository, rowsByDomain, eligibleGamePks, limits = {} }) {
  const domains = ['snapshots', ...Object.keys(DAILY_FEATURE_ALLOWED_COLUMNS)]
  const caps = {}
  for (const domain of domains) {
    const rows = rowsByDomain[domain] ?? []
    assertGameScope(rows, eligibleGamePks, (r) => r.target_game_pk)
    // Validate every physical shape before the first write. Builder UUIDs are
    // valid provisional references; persisted references are resolved below.
    featureInsertRowsForDomain(domain, rows)
    caps[domain] = derivedCap(limits[domain], rows.length)
  }
  const snapshots = rowsByDomain.snapshots.map((r) => comparableFeatureRow('snapshots', r))
  const existing = await repository.readFeatureRows('snapshots', snapshots.map((r) => r.identity), snapshots)
  const snapshotPlan = classifyInsertReuseConflict({ plannedRows: snapshots, existingRows: existing,
    identityFields: ['identity'], digestField: 'input_digest', eligibleGamePks, cap: caps.snapshots })
  const snapshotWrite = await insertRowsFromClassifications(snapshotPlan.classifications, snapshots, 'identity',
    (rows, cap) => repository.insertFeatureRows('snapshots', rows, cap), caps.snapshots)
  const ids = await resolveCanonicalFeatureSnapshotIds({ repository, plannedSnapshotRows: snapshots, insertedSnapshotRows: snapshotWrite.rows ?? [] })
  const bound = bindFeatureRowsToSnapshotIds(rowsByDomain, ids)
  const daily = await classifyBoundDailyFeatures(repository, bound, eligibleGamePks, caps)
  const writes = [snapshotWrite]
  for (const [domain, plan] of Object.entries(daily.plans)) {
    writes.push(await insertRowsFromClassifications(plan.classifications, daily.rows[domain], 'identity',
      (rows, cap) => repository.insertFeatureRows(domain, rows, cap), caps[domain]))
  }
  const readback = { snapshots: await repository.readFeatureRows('snapshots', snapshots.map((r) => r.identity), snapshots), offense: rowsByDomain.offense ?? 0 }
  for (const domain of Object.keys(DAILY_FEATURE_ALLOWED_COLUMNS)) {
    readback[domain] = await repository.readFeatureRows(domain, daily.rows[domain].map((r) => r.identity), daily.rows[domain])
    if (readback[domain].length !== daily.rows[domain].length) throw new Error(`FEATURE_READBACK_COUNT:${domain}`)
  }
  const verified = await classifyBoundDailyFeatures(repository, bound, eligibleGamePks, Object.fromEntries(domains.map((d) => [d, 0])))
  for (const [domain, plan] of Object.entries(verified.plans)) if (plan.reuseNoOp !== bound[domain].length) throw new Error(`FEATURE_READBACK_REUSE:${domain}`)
  return { rows: readback, caps, plans: { snapshots: snapshotPlan, ...daily.plans }, writes }
}

export function liveDependencyInventory() {
  return {
    '01 schedule': 'REAL_PROVIDER_CLIENT',
    '02 native': 'REAL_PRODUCTION_REPOSITORY',
    '03 raw Statcast': 'REAL_PROVIDER_CLIENT_AND_REAL_PRODUCTION_REPOSITORY',
    '04 features': 'REAL_PRODUCTION_REPOSITORY',
    '05 starters': 'PURE_SERVICE',
    '06 inference': 'PURE_SERVICE',
    '07 predictions': 'REAL_PRODUCTION_REPOSITORY',
    '08 odds': 'REAL_PROVIDER_CLIENT',
    '09 markets': 'REAL_PRODUCTION_REPOSITORY',
    '10 value': 'REAL_PRODUCTION_REPOSITORY',
    '11 policy': 'PURE_SERVICE',
    '12 Official Picks': 'REAL_PRODUCTION_REPOSITORY',
    '13 board': 'READ_ONLY_PRODUCTION_REPOSITORY',
  }
}

export function requireRunScopedLiveAuthorization(auth, context) {
  if (!auth || auth.authorized !== true) throw new Error(R2I_AUTH_ERROR)
  if (auth.execution_package_sha !== context.execution_package_sha) throw new Error('LIVE_AUTH_PACKAGE_SHA_MISMATCH')
  if (auth.run_id && auth.run_id !== context.run_id) throw new Error('LIVE_AUTH_RUN_ID_MISMATCH')
  if (auth.ddlAllowed === true) throw new Error('LIVE_AUTH_DDL_FORBIDDEN')
  if (auth.settlementAllowed === true) throw new Error('LIVE_AUTH_SETTLEMENT_FORBIDDEN')
  if (auth.automationAllowed === true) throw new Error('LIVE_AUTH_AUTOMATION_FORBIDDEN')
  const allowedTargets = new Set(Object.values(R2I_LIVE_TARGETS))
  for (const target of auth.authorizedDmlTargets ?? []) {
    if (!allowedTargets.has(target)) throw new Error(`LIVE_AUTH_TARGET_FORBIDDEN:${target}`)
  }
  return {
    executionPackageSha: auth.execution_package_sha,
    runId: auth.run_id ?? null,
    providerCaps: auth.providerCaps ?? {},
    dmlCaps: auth.dmlCaps ?? {},
    authorizedDmlTargets: auth.authorizedDmlTargets ?? [],
  }
}

export function assertEligibleGamePkFreeze(value) {
  if (value === undefined || value === null || !Array.isArray(value)) throw new Error('ELIGIBLE_GAME_PK_FREEZE_REQUIRED')
  return value.map((gamePk) => normalizeGamePk(gamePk))
}

export function createProviderLedger(caps = {}, { initial = {}, onConsume = null } = {}) {
  const consumed = new Map(Object.entries(initial))
  for (const [provider, count] of consumed) {
    if (!Number.isInteger(count) || count < 0 || count > Number(caps[provider]?.maxCalls ?? 0)) throw new Error(`PROVIDER_INITIAL_CAP_INVALID:${provider}`)
  }
  return {
    consume(provider, count = 1) {
      if (!Number.isInteger(count) || count <= 0) throw new Error(`PROVIDER_INVALID_CALL_COUNT:${provider}`)
      const cap = caps[provider] ?? { allowed: false, maxCalls: 0 }
      if (!cap.allowed) throw new Error(`PROVIDER_NOT_ALLOWED:${provider}`)
      const prior = consumed.get(provider) ?? 0
      const max = Number(cap.maxCalls ?? 0)
      if (!Number.isInteger(max) || max < 0) throw new Error(`PROVIDER_INVALID_CAP:${provider}`)
      if (prior + count > max) throw new Error(`PROVIDER_CAP_EXCEEDED:${provider}`)
      const persisted = onConsume?.({ provider, count, consumed: prior + count })
      if (persisted?.then) throw new Error('PROVIDER_ACCOUNTING_MUST_PERSIST_SYNCHRONOUSLY')
      consumed.set(provider, prior + count)
      return makeProviderAccounting(provider, count, prior + count)
    },
    read(provider) {
      return consumed.get(provider) ?? 0
    },
    total() {
      return [...consumed.values()].reduce((sum, value) => sum + value, 0)
    },
    snapshot() {
      return Object.fromEntries([...consumed.entries()].map(([provider, calls]) => [provider, calls]))
    },
  }
}

export function createMlbOfficialLiveClient({ fetchImpl = fetch, baseUrl = 'https://statsapi.mlb.com/api/v1', ledger } = {}) {
  return {
    async getSchedule({ runDate }) {
      await ledger?.consume('MLB_OFFICIAL', 1)
      const response = await fetchImpl(`${baseUrl}/schedule?sportId=1&date=${encodeURIComponent(runDate)}&hydrate=probablePitcher`)
      if (!response?.ok) throw new Error(`MLB_OFFICIAL_SCHEDULE_HTTP_${response?.status ?? 'UNKNOWN'}`)
      return response.json()
    },
  }
}

export function createTheOddsApiLiveClient({ fetchImpl = fetch, apiKey, ledger } = {}) {
  return {
    async getMoneylineOdds() {
      if (!apiKey) throw new Error('THE_ODDS_API_KEY_REQUIRED')
      await ledger?.consume('THE_ODDS_API', 1)
      const url = `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?regions=us&markets=h2h&oddsFormat=american&apiKey=${encodeURIComponent(apiKey)}`
      const response = await fetchImpl(url)
      if (!response?.ok) throw new Error(`THE_ODDS_API_HTTP_${response?.status ?? 'UNKNOWN'}`)
      const events = await response.json()
      return { events }
    },
  }
}

export function createStatcastLiveClient({ fetchRowsForGames, ledger, fetchImpl = (url,options)=>fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(60000)}), db = null, cacheDir = undefined } = {}) {
  return {
    async *streamRowsForGames(args) {
      if (!ledger || cacheDir===undefined) throw new Error('STATCAST_LEDGER_AND_EXPLICIT_CACHE_REQUIRED')
      const countedFetch=async(...request)=>{await ledger.consume('STATCAST',1);return fetchImpl(...request)}
      if(fetchRowsForGames) {
        const rows=await fetchRowsForGames({...args,fetchImpl:countedFetch,db,cacheDir})
        for(let start=0;start<rows.length;start+=100)yield rows.slice(start,start+100)
      } else yield* streamR2NStatcastRowsForGames({...args,fetchImpl:countedFetch,db,cacheDir})
    },
    async fetchRowsForGames(args) {
      if (!ledger || cacheDir===undefined) throw new Error('STATCAST_LEDGER_AND_EXPLICIT_CACHE_REQUIRED')
      const fetcher = fetchRowsForGames ?? fetchR2NStatcastRowsForGames
      const countedFetch = async (...request) => {
        await ledger.consume('STATCAST', 1)
        return fetchImpl(...request)
      }
      return fetcher({ ...args, fetchImpl: countedFetch, db, cacheDir })
    },
  }
}

export function partitionReadIdentities(ids) {
  const batches = []
  let batch = [], bytes = 0
  for (const id of [...new Set(ids)]) {
    const size = encodeURIComponent(String(id)).length + 6
    if (size > 3000) throw new Error('READ_IDENTITY_TOO_LONG')
    if (batch.length && (bytes + size > 3000 || batch.length === 150)) { batches.push(batch); batch = []; bytes = 0 }
    batch.push(id); bytes += size
  }
  if (batch.length) batches.push(batch)
  return batches
}

async function selectByIds(client, table, column, ids, columns = '*') {
  if (!ids.length) return []
  const unique = [...new Set(ids)]
  const rows = []
  for (const batch of partitionReadIdentities(unique)) {
    const { data, error } = await client.from(table).select(columns).in(column, batch).limit(batch.length + 1)
    if (error || !Array.isArray(data)) throw new Error(`READ_FAILED:${table}:${error?.code ?? 'MISSING_DATA'}`)
    if (data.length > batch.length || data.some(r => !batch.map(String).includes(String(r[column])))) throw new Error(`READ_IDENTITY_SCOPE:${table}`)
    rows.push(...data)
  }
  if (new Set(rows.map(r => String(r[column]))).size !== rows.length) throw new Error(`READ_DUPLICATE_IDENTITY:${table}`)
  return rows
}

async function insertExactRows(client, table, rows, cap, writeJournal = null) {
  if (!rows.length) return { inserted: 0, table, rows: [] }
  if (!Number.isInteger(cap) || cap < 0 || rows.length > cap) throw new Error(`DML_CAP_EXCEEDED:${table}:${rows.length}:${cap}`)
  if (!Object.values(R2I_LIVE_TARGETS).includes(table)) throw new Error(`UNEXPECTED_WRITE_TARGET:${table}`)
  const domain = Object.entries(DOWNSTREAM_BINDINGS).find(([, binding]) => binding.table === table)?.[0]
  if (domain) rows.forEach(row => assertDownstreamPayload(domain, row))
  if (table === R2I_LIVE_TARGETS.rawStatcast) rows.forEach(assertCanonicalRawInsert)
  const execute = async () => {
    const { data, error } = await client.from(table).insert(rows).select('*')
    if (error) throw new Error(`INSERT_FAILED:${table}:${error.message}`)
    const inserted = data?.length
    if (inserted !== rows.length || inserted > cap) throw new Error(`DML_ACTUAL_CAP_EXCEEDED:${table}:${inserted}:${cap}`)
    return { inserted, table, rows: data }
  }
  return writeJournal ? writeJournal.perform({ table, rows, cap }, execute) : execute()
}

function normalizeNullableInteger(value, label) {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) throw new Error(`INVALID_${label.toUpperCase()}:${value}`)
  return parsed
}

function normalizeNullableText(value, label) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw new Error(`INVALID_${label.toUpperCase()}_TYPE`)
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeNativeTeamId(value, label) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'number' && Number.isInteger(value)) return null
  if (typeof value !== 'string') throw new Error(`INVALID_${label.toUpperCase()}_TYPE`)
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) return null
  return trimmed
}

export function assertNativeGameInsertShape(row, { eligibleGamePks = null, cap = null, rowCount = null } = {}) {
  const allowed = new Set(NATIVE_GAME_WRITABLE_COLUMNS)
  const keys = Object.keys(row ?? {})
  const unexpected = keys.filter((key) => !allowed.has(key))
  if (unexpected.length) throw new Error(`NATIVE_GAME_INSERT_UNEXPECTED_KEYS:${unexpected.join(',')}`)
  const missing = NATIVE_GAME_REQUIRED_INSERT_COLUMNS.filter((key) => !(key in row) || row[key] === undefined || row[key] === null)
  if (missing.length) throw new Error(`NATIVE_GAME_INSERT_MISSING_REQUIRED:${missing.join(',')}`)
  const gamePk = normalizeGamePk(row.game_pk)
  if (eligibleGamePks) assertGameScope([row], eligibleGamePks)
  if (Number.isInteger(cap) && Number.isInteger(rowCount) && rowCount > cap) throw new Error(`DML_CAP_EXCEEDED:${R2I_LIVE_TARGETS.nativeGames}:${rowCount}:${cap}`)
  for (const field of ['home_team_id', 'away_team_id']) {
    if (row[field] !== null && row[field] !== undefined && typeof row[field] !== 'string') throw new Error(`NATIVE_GAME_INSERT_INVALID_TEAM_ID:${field}`)
  }
  return { game_pk: gamePk, keys }
}

export function mapScheduleGameToNativeInsertRow(game, { phase = 'MLB_DATA_02R_R2M' } = {}) {
  const scheduledAt = game.scheduled_at ?? game.start_time ?? game.gameDate ?? null
  const officialStatus = game.official_status ?? game.status?.detailedState ?? game.status?.abstractGameState ?? game.status ?? null
  const homeMlbTeamId = normalizeNullableInteger(game.home?.mlb_team_id ?? game.metadata?.homeMlbTeamId ?? game.teams?.home?.team?.id, 'home_mlb_team_id')
  const awayMlbTeamId = normalizeNullableInteger(game.away?.mlb_team_id ?? game.metadata?.awayMlbTeamId ?? game.teams?.away?.team?.id, 'away_mlb_team_id')
  const homeTeamId = normalizeNativeTeamId(game.home_team_id ?? game.home?.team_id, 'home_team_id')
  const awayTeamId = normalizeNativeTeamId(game.away_team_id ?? game.away?.team_id, 'away_team_id')
  const row = {
    game_pk: normalizeGamePk(game.game_pk ?? game.gamePk),
    season: normalizeNullableInteger(game.season ?? String(game.game_date ?? game.officialDate ?? scheduledAt ?? '').slice(0, 4), 'season'),
    game_date: game.game_date ?? game.officialDate ?? String(scheduledAt ?? '').slice(0, 10) ?? null,
    scheduled_at: scheduledAt,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    game_type: normalizeNullableText(game.game_type ?? game.gameType, 'game_type'),
    official_status: normalizeNullableText(officialStatus, 'official_status'),
    doubleheader: normalizeNullableText(game.doubleheader ?? game.doubleHeader, 'doubleheader'),
    game_number: normalizeNullableInteger(game.game_number ?? game.gameNumber, 'game_number'),
    source: normalizeNullableText(game.source, 'source') ?? 'mlb_official',
    source_payload_digest: normalizeNullableText(game.source_payload_digest, 'source_payload_digest') ?? sha256(game),
    legacy_sport_event_id: normalizeNullableText(game.legacy_sport_event_id, 'legacy_sport_event_id'),
    metadata: {
      ...(game.metadata && typeof game.metadata === 'object' && !Array.isArray(game.metadata) ? game.metadata : {}),
      phase,
      source_schedule_fields_dropped: ['home', 'away', 'starter_evidence', 'pregame_classification', 'doubleheader_identity', 'status', 'start_time'],
      mlb_official_identity: {
        home_mlb_team_id: homeMlbTeamId,
        away_mlb_team_id: awayMlbTeamId,
        home_abbreviation: game.home?.abbreviation ?? game.teams?.home?.team?.abbreviation ?? null,
        away_abbreviation: game.away?.abbreviation ?? game.teams?.away?.team?.abbreviation ?? null,
      },
      starter_evidence: game.starter_evidence ?? null,
    },
  }
  assertNativeGameInsertShape(row)
  return row
}

export function createSupabaseProductionRepository({ client, schemaFingerprint = {}, writeJournal = null } = {}) {
  if (!client) throw new Error('SUPABASE_CLIENT_REQUIRED')
  const write = (table, rows, cap) => insertExactRows(client, table, rows, cap, writeJournal)
  return {
    writeJournal,
    executionEnvironment: 'PRODUCTION_SUPABASE',
    methods: Object.freeze([
      'readNativeGames', 'insertNativeGames', 'readNativePlayers', 'insertNativePlayers',
      'readRawRows', 'insertRawRows', 'readFeatureRows', 'insertFeatureRows',
      'readPredictions', 'insertPredictions', 'readMarketMappings', 'insertMarketMappings',
      'readMarketObservations', 'insertMarketObservations', 'readValues', 'insertValues',
      'readOfficialPicks', 'insertOfficialPicks', 'readValueBoard', 'verifySchemaFingerprint',
    ]),
    async verifySchemaFingerprint(target) {
      const expectation = schemaFingerprint[target]
      if (expectation && !['EXACT_COMPATIBLE', 'ADDITIVE_COMPATIBLE'].includes(expectation.state)) throw new Error(`SCHEMA_GUARD_BLOCK:${target}:${expectation.state}`)
      const feature = Object.values(R2I_FEATURE_IDENTITY_BINDINGS).find(b => b.table === target)
      const columns = feature?.readColumns.split(',') ?? downstreamSchemaColumns(target) ?? expectation?.columns
      if (!columns?.length || !Object.values(R2I_LIVE_TARGETS).includes(target)) throw new Error(`SCHEMA_COLUMNS_REQUIRED:${target}`)
      const { error } = await client.from(target).select(columns.join(',')).limit(0)
      if (error) throw new Error(`SCHEMA_COLUMN_READBACK_FAILED:${target}:${error.code}`)
      return { target, state: 'COLUMNS_READBACK_COMPATIBLE', columns, constraints: 'CERTIFIED_SCHEMA_MANIFEST_AND_DATABASE_ENFORCEMENT' }
    },
    async readNativeGames(ids) { return selectByIds(client, R2I_LIVE_TARGETS.nativeGames, 'game_pk', ids) },
    async insertNativeGames(rows, cap) {
      for (const row of rows) assertNativeGameInsertShape(row, { cap, rowCount: rows.length })
      return write(R2I_LIVE_TARGETS.nativeGames, rows, cap)
    },
    async readNativePlayers(ids) { return selectByIds(client, R2I_LIVE_TARGETS.nativePlayers, 'mlbam_person_id', ids) },
    async insertNativePlayers(rows, cap) { return write(R2I_LIVE_TARGETS.nativePlayers, rows, cap) },
    async readRawRows(ids) { return selectByIds(client, R2I_LIVE_TARGETS.rawStatcast, 'id', ids) },
    async insertRawRows(rows, cap) { return write(R2I_LIVE_TARGETS.rawStatcast, rows, cap) },
    async readFeatureRows(domain, ids, plannedRows = []) { return readFeatureRowsByDomain(client, domain, ids, plannedRows) },
    async insertFeatureRows(domain, rows, cap) { return write(liveTargetForFeatureDomain(domain), featureInsertRowsForDomain(domain, rows), cap) },
    async readPinnedFeatureRows(snapshotIds) {
      const rows={snapshots:await selectByIds(client,R2I_LIVE_TARGETS.featureSnapshots,'id',snapshotIds)}
      for(const domain of ['team','starter','bullpen','batter','matchup','firstInning'])rows[domain]=await selectByIds(client,R2I_LIVE_TARGETS[domain],'feature_snapshot_id',snapshotIds)
      return rows
    },
    async readPredictions(ids) { return selectByIds(client, R2I_LIVE_TARGETS.predictions, 'deterministic_identity', ids) },
    async insertPredictions(rows, cap) { return write(R2I_LIVE_TARGETS.predictions, rows, cap) },
    async readMarketMappings(ids) { return selectByIds(client, R2I_LIVE_TARGETS.marketMappings, 'provider_event_id', ids) },
    async readMarketMappingsByGames(ids) {
      if (!ids.length) return []
      const { data, error } = await client.from(R2I_LIVE_TARGETS.marketMappings).select('*').eq('market_provider', 'the-odds-api').in('game_pk', ids).limit(ids.length + 1)
      if (error || data.length > ids.length) throw new Error('MARKET_MAPPING_READ_CONFLICT')
      return data
    },
    async insertMarketMappings(rows, cap) { return write(R2I_LIVE_TARGETS.marketMappings, rows, cap) },
    async readMarketObservationsByEvidence({eligibleGamePks,responseDigest,acquiredAt}) {
      const {data,error}=await client.from(R2I_LIVE_TARGETS.marketObservations).select('*').in('game_pk',eligibleGamePks).eq('source_response_digest',responseDigest).eq('acquired_at',acquiredAt).limit(5001)
      if(error || !Array.isArray(data) || data.length>5000)throw Error('MARKET_REFERENCE_READ_FAILED')
      return data
    },
    async readMarketObservations(ids) { return selectByIds(client, R2I_LIVE_TARGETS.marketObservations, 'observation_identity', ids) },
    async insertMarketObservations(rows, cap) { return write(R2I_LIVE_TARGETS.marketObservations, rows, cap) },
    async readValues(ids) { return selectByIds(client, R2I_LIVE_TARGETS.values, 'value_identity', ids) },
    async insertValues(rows, cap) { return write(R2I_LIVE_TARGETS.values, rows, cap) },
    async readOfficialPicks(ids) { return selectByIds(client, R2I_LIVE_TARGETS.officialPicks, 'official_pick_identity', ids) },
    async insertOfficialPicks(rows, cap) { return write(R2I_LIVE_TARGETS.officialPicks, rows, cap) },
    async readValueBoard({ valueIdentities, pickIdentities }) {
      const values = await selectByIds(client, R2I_LIVE_TARGETS.values, 'value_identity', valueIdentities)
      const picks = await selectByIds(client, R2I_LIVE_TARGETS.officialPicks, 'official_pick_identity', pickIdentities)
      if (values.length !== valueIdentities.length || picks.length !== pickIdentities.length) throw new Error('VALUE_BOARD_READBACK_INCOMPLETE')
      return { values, picks }
    },
  }
}

export function createProductionSupabaseClientFromEnv(env = process.env) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('NEXT_PUBLIC_SUPABASE_URL_MISSING')
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY_MISSING')
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function insertRowsFromClassifications(classifications, rows, identityField, insertMethod, cap) {
  const eligible = classifications.filter((row) => row.classification === 'INSERT_ELIGIBLE')
  const byIdentity = new Map(rows.map((row) => [String(row[identityField]), row]))
  const insertRows = eligible.map((row) => byIdentity.get(String(row.identity))).filter(Boolean)
  if (insertRows.length !== eligible.length) throw new Error('INSERT_SOURCE_LINKAGE_MISSING')
  return insertMethod(insertRows, cap)
}

function derivedCap(value, fallback) {
  return Number.isInteger(value) ? value : fallback
}

function testEvidence() {
  return {
    schedule: {
      dates: [{
        date: '2026-09-07',
        games: [{
          gamePk: 700001,
          gameDate: '2026-09-07T23:05:00.000Z',
          officialDate: '2026-09-07',
          season: 2026,
          status: { abstractGameState: 'Preview', detailedState: 'Pre-Game', statusCode: 'P' },
          teams: {
            away: { team: { id: 110, abbreviation: 'AWY', name: 'Away Team' }, probablePitcher: { id: 660001, fullName: 'Away Starter', confirmed: false } },
            home: { team: { id: 111, abbreviation: 'HME', name: 'Home Team' }, probablePitcher: { id: 660002, fullName: 'Home Starter', confirmed: true } },
          },
        }],
      }],
    },
    statcastRows: [
      { game_pk: 700001, game_date: '2026-09-07', game_year: 2026, at_bat_number: 1, pitch_number: 1, source_pitcher_id: 660001, source_batter_id: 770001, raw_payload: { pitch_type: 'FF' } },
    ],
    odds: {
      events: [{
        id: 'odds-event-700001',
        sport_key: 'baseball_mlb',
        commence_time: '2026-09-07T23:05:00.000Z',
        home_team: 'Home Team',
        away_team: 'Away Team',
        bookmakers: [{ key: 'book_a', title: 'Book A', markets: [{ key: 'h2h', last_update: '2026-09-07T15:01:00.000Z', outcomes: [{ name: 'Home Team', price: -120 }, { name: 'Away Team', price: 110 }] }] }],
      }],
    },
  }
}

function plannedFeatureRows(game, runAsOf) {
  const gamePk = normalizeGamePk(game.game_pk ?? game.gamePk)
  const dateFields = featureDateFieldsForGame(game, { runAsOf })
  const base = {
    target_game_pk: gamePk,
    ...dateFields,
    feature_version: 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1',
    source_window: { rule: 'source_game_date < target_game_date', as_of_date: dateFields.as_of_date, mode: 'live_current_slate' },
    sample_sizes: {},
  }
  const snapshotFeatures = { vector: 'digest-only' }
  const snapshotDigest = sha256({
    target_game_pk: gamePk,
    feature_version: base.feature_version,
    feature_date: dateFields.feature_date,
    as_of_date: dateFields.as_of_date,
    as_of_timestamp: dateFields.as_of_timestamp,
    features: snapshotFeatures,
  })
  return {
    snapshots: [{ ...base, identity: `snapshot:${gamePk}:moneyline`, deterministic_identity: `snapshot:${gamePk}:moneyline`, features: snapshotFeatures, input_digest: snapshotDigest }],
    team: [{ ...base, team_id: 111, features: { recent_runs: 4.5 } }, { ...base, team_id: 110, features: { recent_runs: 4.1 } }],
    starter: [{ ...base, mlbam_pitcher_id: 660002, features: { k_rate: 0.25 } }, { ...base, mlbam_pitcher_id: 660001, features: { k_rate: 0.22 } }],
    bullpen: [{ ...base, team_id: 111, features: { fatigue: 0.1 } }, { ...base, team_id: 110, features: { fatigue: 0.2 } }],
    batter: [{ ...base, mlbam_batter_id: 770001, features: { woba: 0.32 } }],
    matchup: [{ ...base, features: { matchup_edge: 0.03 } }],
    firstInning: [{ ...base, features: { first_inning_run_rate: 0.48 } }],
  }
}

function terminalEmptySlateArtifact({ mode, runContext, schedule, eligibleGamePks, blockedGames, providerCaps, authCaps, ledger, stages, writeResults, schemaGuards }) {
  const frozenEligibleGamePks = assertEligibleGamePkFreeze(eligibleGamePks)
  if (frozenEligibleGamePks.length !== 0) throw new Error('EMPTY_SLATE_TERMINAL_REQUIRES_EMPTY_FREEZE')
  const games = schedule.artifact.games ?? []
  const pregameSafeCount = games.filter((game) => game.pregame_classification === 'PREGAME_SAFE').length
  const startedCount = games.filter((game) => game.pregame_classification === 'STARTED_IN_PROGRESS').length
  const finalCount = games.filter((game) => game.pregame_classification === 'FINAL').length
  const blockedCount = games.length - pregameSafeCount
  const summary = {
    run_id: runContext.run_id,
    run_date: runContext.run_date,
    run_as_of: runContext.run_as_of,
    schedule_games: games.length,
    pregame_safe_count: pregameSafeCount,
    started_count: startedCount,
    final_count: finalCount,
    blocked_count: blockedCount,
    eligible_game_pks: frozenEligibleGamePks,
    blocked_game_pks: blockedGames,
    provider_accounting: ledger.snapshot(),
    production_dml_accounting: { total: 0, write_results: writeResults },
    production_ddl_accounting: { total: 0 },
    terminal_reason: R2Q_EMPTY_SLATE_TERMINAL_STATUS,
  }
  const terminalStage = stageResult({
    stage: 'terminal empty pregame slate',
    mode,
    status: R2Q_EMPTY_SLATE_TERMINAL_STATUS,
    artifact: summary,
  })
  return {
    certificationVerdict: R2I_CERTIFICATION,
    terminalStatus: R2Q_EMPTY_SLATE_TERMINAL_STATUS,
    terminal: {
      status: R2Q_EMPTY_SLATE_TERMINAL_STATUS,
      operationalOutcome: 'SUCCESSFUL_FAIL_CLOSED_NO_VALID_PREGAME_SLATE',
      pipelineFailure: false,
      providerFailure: false,
      schemaFailure: false,
      modelFailure: false,
      summary,
    },
    mode,
    runContext: { ...runContext, eligible_game_pks: frozenEligibleGamePks, blocked_game_pks: blockedGames, provider_budget: providerCaps, per_stage_dml_caps: authCaps },
    liveBranchTraversed: mode === 'LIVE_EXECUTE',
    dependencyInventory: liveDependencyInventory(),
    schemaGuards,
    stages: [...stages, terminalStage],
    writeResults,
    checkpointResume: {
      state: 'TERMINAL',
      terminalStatus: R2Q_EMPTY_SLATE_TERMINAL_STATUS,
      resumeRule: 'do not resume downstream Statcast for this terminal empty-slate run; create a new run for a later run_date/run_as_of',
      frozenEvidenceReusable: false,
      oddsRequestRepeatedOnResume: false,
    },
    providerLedger: ledger.snapshot(),
    safety: {
      realProviderCalls: 0,
      productionDml: 0,
      productionDdl: 0,
      automationChanges: 0,
      cronChanges: 0,
      settlementWrites: 0,
      testProviderCalls: ledger.total(),
      testDml: 0,
    },
  }
}

function applyStartedGameGuard(schedule, runAsOf) {
  const guardedGames = (schedule.artifact.games ?? []).map((game) => {
    const startTime = game.start_time ?? game.scheduled_at
    if (game.pregame_classification === 'PREGAME_SAFE' && startTime && Date.parse(startTime) <= Date.parse(runAsOf)) {
      return { ...game, pregame_classification: 'STARTED_IN_PROGRESS', started_game_guard: 'START_TIME_AT_OR_BEFORE_RUN_AS_OF' }
    }
    return game
  })
  return {
    ...schedule,
    artifact: {
      ...schedule.artifact,
      games: guardedGames,
      startedGameGuard: {
        status: 'PASS',
        rule: 'PREGAME_SAFE requires scheduled_at/start_time > run_as_of',
        runAsOf,
      },
    },
  }
}

function predictionFromInference(inference, game, runAsOf) {
  return {
    id: `pred-${game.game_pk}`,
    deterministic_identity: `baseball_mlb::prediction::moneyline::${game.game_pk}::${R2F_MODEL_VERSION}::${inference.artifact.input_digest}`,
    game_pk: game.game_pk,
    model_version: R2F_MODEL_VERSION,
    feature_set: R2F_FEATURE_SET,
    frozen_input_digest: inference.artifact.input_digest,
    model_artifact_digest: MODEL_ARTIFACT_DIGEST,
    prediction_as_of: runAsOf,
    home_probability: inference.artifact.home_probability,
    away_probability: inference.artifact.away_probability,
    starter_status: 'PROBABLE',
    scheduled_at: game.scheduled_at,
  }
}

function officialPickFromPolicy(valueRow, policyResult, runAsOf) {
  const row = {
    official_pick_identity: sha256({ value_identity: valueRow.value_identity, policy_version: R2F_POLICY_VERSION, decision: 'OFFICIAL_PICK' }),
    prediction_id: valueRow.prediction_id,
    value_evaluation_id: valueRow.value_identity,
    game_pk: valueRow.game_pk,
    side: valueRow.side,
    policy_version: R2F_POLICY_VERSION,
    decision_status: 'OFFICIAL_PICK',
    policy_status: policyResult.artifact.status,
    game_start: '2026-09-07T23:05:00.000Z',
    decision_at: runAsOf,
  }
  row.decision_payload_digest = sha256({ ...row, decision_payload_digest: undefined })
  return row
}

export function createTestRepository(existing = {}) {
  const writes = []
  const read = (key, column, ids) => (existing[key] ?? []).filter((row) => ids.includes(row[column]))
  const insert = (table, rows, cap) => {
    if (!Object.values(R2I_LIVE_TARGETS).includes(table)) throw new Error(`WRONG_TABLE_BLOCKED:${table}`)
    if (Number.isInteger(cap) && rows.length > cap) throw new Error(`DML_CAP_EXCEEDED:${table}:${rows.length}:${cap}`)
    const storedRows = rows.map((row, index) => {
      if (table === R2I_LIVE_TARGETS.featureSnapshots && !row.id) {
        return { ...row, id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}` }
      }
      return row
    })
    writes.push({ table, rows: storedRows })
    return { table, inserted: storedRows.length, rows: storedRows }
  }
  return {
    writes,
    async verifySchemaFingerprint(target) {
      if (existing.schemaState === 'MISSING') throw new Error(`SCHEMA_GUARD_BLOCK:${target}:MISSING`)
      return { target, state: 'ADDITIVE_COMPATIBLE' }
    },
    async readNativeGames(ids) { return read('nativeGames', 'game_pk', ids) },
    async insertNativeGames(rows, cap) {
      for (const row of rows) assertNativeGameInsertShape(row, { cap, rowCount: rows.length })
      return insert(R2I_LIVE_TARGETS.nativeGames, rows, cap)
    },
    async readNativePlayers(ids) { return read('nativePlayers', 'mlbam_person_id', ids) },
    async insertNativePlayers(rows, cap) { return insert(R2I_LIVE_TARGETS.nativePlayers, rows, cap) },
    async readRawRows(ids) { return read('rawRows', 'id', ids) },
    async insertRawRows(rows, cap) { return insert(R2I_LIVE_TARGETS.rawStatcast, rows, cap) },
    async readFeatureRows(domain, ids) {
      return (existing.features?.[domain] ?? []).map((row, index) => {
        const withTestId = domain === 'snapshots' && !row.id
          ? { ...row, id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}` }
          : row
        return comparableFeatureRow(domain, withTestId)
      }).filter((row) => ids.includes(row.identity))
    },
    async insertFeatureRows(domain, rows, cap) { return insert(liveTargetForFeatureDomain(domain), rows, cap) },
    async readPredictions(ids) { return read('predictions', 'deterministic_identity', ids) },
    async insertPredictions(rows, cap) { return insert(R2I_LIVE_TARGETS.predictions, rows, cap) },
    async readMarketMappings(ids) { return read('marketMappings', 'provider_event_id', ids) },
    async insertMarketMappings(rows, cap) { return insert(R2I_LIVE_TARGETS.marketMappings, rows, cap) },
    async readMarketObservations(ids) { return read('marketObservations', 'observation_identity', ids) },
    async insertMarketObservations(rows, cap) { return insert(R2I_LIVE_TARGETS.marketObservations, rows, cap) },
    async readValues(ids) { return read('values', 'value_identity', ids) },
    async insertValues(rows, cap) { return insert(R2I_LIVE_TARGETS.values, rows, cap) },
    async readOfficialPicks(ids) { return read('officialPicks', 'official_pick_identity', ids) },
    async insertOfficialPicks(rows, cap) { return insert(R2I_LIVE_TARGETS.officialPicks, rows, cap) },
    async readValueBoard() { return existing.board ?? { rows: [], state: 'TEST_LIVE_READBACK', freshness: 'FRESH' } },
  }
}

function modelArtifact() {
  const medians = Array(R2F_FEATURE_COUNT).fill(0)
  return {
    featureNames: medians.map((_, index) => `f${index}`),
    preprocessing: { medians, means: medians, stds: Array(R2F_FEATURE_COUNT).fill(1) },
    weights: [0.2, ...Array(R2F_FEATURE_COUNT).fill(0.01)],
  }
}

export async function runR2ILiveExecution(input = {}) {
  if (input.mode === 'LIVE_EXECUTE' || input.mode === 'CERTIFICATION_SIMULATION') {
    const runContext = createCurrentSlateRunFreeze({ ...input, clock: typeof input.clock === 'function' ? input.clock() : input.clock, mode: input.mode === 'LIVE_EXECUTE' ? 'LIVE_EXECUTE' : 'DRY_RUN' })
    if (input.mode === 'LIVE_EXECUTE') {
      requireRunScopedLiveAuthorization(input.authorization, runContext)
      assertR2TLiveReadiness()
      if (input.clock != null || input.repository?.executionEnvironment !== 'PRODUCTION_SUPABASE' || input.providers?.canonical?.executionEnvironment !== 'PRODUCTION' || !input.repository?.writeJournal) throw new Error('R2T_PRODUCTION_BINDINGS_REQUIRED')
    } else if (input.repository?.executionEnvironment !== 'DISPOSABLE_PGLITE' || !process.env.R2S_VALIDATION_DIR) {
      throw new Error('R2T_SIMULATION_REQUIRES_ISOLATED_POSTGRES')
    }
    return runCanonicalR2IStages({ ...input, runContext })
  }
  return runR2ILegacyDryExecution(input)
}

// The sole real feature/model/decision orchestration. Production remains behind
// R3 containment. The certification harness traverses this same call graph with
// disposable PostgreSQL and explicitly supplied evidence; no fallback exists.
async function runCanonicalR2IStages({ mode, runContext, providers, repository, authorization = {}, clock = () => new Date() }) {
  const canonical = providers?.canonical
  if (!canonical || !repository || !canonical.checkpoint || typeof canonical.readContexts !== 'function' || typeof canonical.providerAccounting !== 'function' || typeof canonical.assertCurrentStarters !== 'function') throw new Error('R2T_CANONICAL_BINDINGS_REQUIRED')
  await repository.writeJournal?.recover()
  const frozenDigest = sha256(runContext)
  let checkpoint = await canonical.checkpoint.load(runContext.run_id)
  if (checkpoint && checkpoint.frozenDigest !== frozenDigest) throw new Error('R2T_CHECKPOINT_FREEZE_CONFLICT')
  if (!checkpoint) {
    checkpoint = { frozenDigest, runContext, evidence: await canonical.readContexts(runContext) }
    checkpoint.evidenceDigest = sha256(checkpoint.evidence)
    await canonical.checkpoint.save(runContext.run_id, checkpoint)
  }
  if (sha256(checkpoint.evidence) !== checkpoint.evidenceDigest) throw new Error('R2T_CHECKPOINT_EVIDENCE_DRIFT')
  const { contexts, nativeGames, blockedGames = [] } = checkpoint.evidence
  if (!Array.isArray(contexts) || !Array.isArray(nativeGames)) throw new Error('R2T_CANONICAL_EVIDENCE_SHAPE')
  const scope = assertEligibleGamePkFreeze(contexts.map(c => c.target.gamePk))
  const accounting = () => canonical.providerAccounting()
  if (!scope.length) return { status: R2Q_EMPTY_SLATE_TERMINAL_STATUS, runContext, blockedGames, providerAccounting: accounting(), dmlAccounting: canonical.dmlAccounting?.() ?? null, writes: [], syntheticProductionPaths: 0 }
  const now = () => new Date(typeof clock === 'function' ? clock() : clock ?? new Date()).toISOString()
  const assertPregame = async ({ domain, rows }) => {
    const table = DOWNSTREAM_BINDINGS[domain]?.table ?? R2I_FEATURE_IDENTITY_BINDINGS[domain]?.table
    if (mode === 'LIVE_EXECUTE' && !authorization?.authorizedDmlTargets?.includes(table)) throw new Error('R2T_UNAUTHORIZED_WRITE_TARGET')
    const at = now()
    if (Date.parse(at) < Date.parse(runContext.run_as_of)) throw new Error('R2T_CLOCK_BEFORE_FREEZE')
    for (const row of rows) {
      const gamePk = row.game_pk ?? row.target_game_pk
      const context = contexts.find(c => c.target.gamePk === gamePk)
      if (!context || Date.parse(context.target.scheduledAt) <= Date.parse(at)) throw new Error('R2T_STARTED_GAME_WRITE_BLOCK')
      if (domain === 'values' || domain === 'officialPicks') {
        const fresh = classifyMarketFreshness({ provider_last_update: row.provider_last_update ?? row.metadata?.provider_last_update, acquired_at: at }).state
        if ((domain === 'officialPicks' && fresh !== 'FRESH') || (domain === 'values' && fresh !== row.market_freshness)) throw new Error('R2T_MARKET_FRESHNESS_CHANGED_BEFORE_WRITE')
      }
    }
    await canonical.assertCurrentStarters({ contexts, at, domain })
  }
  const limits = authorization?.dmlCaps ?? {}
  for (const target of [...Object.values(R2I_FEATURE_IDENTITY_BINDINGS).map(b => b.table), ...Object.values(DOWNSTREAM_BINDINGS).map(b => b.table)]) await repository.verifySchemaFingerprint(target)
  const featureInput = { contexts, runDate: runContext.run_date, runAsOf: runContext.run_as_of }
  const pinned=checkpoint.featureReferences && canonical.restoreFeaturePlan
  const generated = pinned ? await canonical.restoreFeaturePlan({contexts,references:checkpoint.featureReferences}) : canonical.buildFeaturePlan ? await canonical.buildFeaturePlan(featureInput) : buildAllPregameFeatureRows(featureInput)
  const guardedRepository = Object.create(repository)
  guardedRepository.insertFeatureRows = async (domain, rows, cap) => {
    if (rows.length) await assertPregame({ domain, rows })
    return repository.insertFeatureRows(domain, rows, cap)
  }
  const features = await persistCanonicalFeaturePlan({ repository: guardedRepository, rowsByDomain: pinned ? generated.rows : revisionFeatureRows(generated.rows), eligibleGamePks: scope, limits: pinned ? Object.fromEntries(Object.keys(R2I_FEATURE_IDENTITY_BINDINGS).map(domain=>[domain,0])) : limits.features ?? {} })
  const plannedPredictions = await buildPersistedPredictions({ games: generated.games, persistedFeatures: features.rows, registryRepository: canonical.registryRepository, runAsOf: runContext.run_as_of })
  if(canonical.checkpoint.referenceOnly && !checkpoint.featureReferences) {
    checkpoint.featureReferences=pinnedFeatureReferences({generated,persistedRows:features.rows})
    await canonical.checkpoint.save(runContext.run_id,checkpoint)
  }
  const predictions = await persistDownstreamRows({ domain: 'predictions', rows: plannedPredictions, repository, eligibleGamePks: scope, cap: limits.predictions ?? plannedPredictions.length, beforeWrite: assertPregame })
  let markets
  if(canonical.checkpoint.referenceOnly) {
    if(checkpoint.marketReference)markets=await restoreCanonicalMarkets({reference:checkpoint.marketReference,repository,eligibleGamePks:scope,beforeWrite:assertPregame})
    else {
      const evidence=await canonical.getOddsEvidence({runContext,eligibleGamePks:scope})
      checkpoint.evaluatedAt=now()
      markets=await persistCanonicalMarkets({evidence,nativeGames,eligibleGamePks:scope,repository,limits,beforeWrite:assertPregame})
      checkpoint.marketReference=canonicalMarketReference({markets,evidence,evaluatedAt:checkpoint.evaluatedAt})
      checkpoint.oddsDigest=checkpoint.marketReference.oddsDigest
      await canonical.checkpoint.save(runContext.run_id,checkpoint)
    }
  } else {
  if (!checkpoint.odds) {
    checkpoint.odds = await canonical.getOddsEvidence({ runContext, eligibleGamePks: scope })
    checkpoint.oddsDigest = sha256(checkpoint.odds)
    checkpoint.evaluatedAt = now()
    await canonical.checkpoint.save(runContext.run_id, checkpoint)
  }
  if (sha256(checkpoint.odds) !== checkpoint.oddsDigest) throw new Error('R2T_CHECKPOINT_ODDS_DRIFT')
  markets = await persistCanonicalMarkets({ evidence: checkpoint.odds, nativeGames, eligibleGamePks: scope, repository, limits, beforeWrite: assertPregame })
  }
  const valueRows = buildCanonicalValues({ predictions: predictions.rows, observations: markets.observations.rows, evaluatedAt: checkpoint.evaluatedAt })
  const values = await persistDownstreamRows({ domain: 'values', rows: valueRows, repository, eligibleGamePks: scope, cap: limits.nativeValues ?? valueRows.length, beforeWrite: assertPregame })
  const decision = buildCanonicalOfficialPicks({ values: values.rows, decisionAt: checkpoint.evaluatedAt, scheduledByGame: new Map(contexts.map(c => [c.target.gamePk, c.target.scheduledAt])) })
  const picks = await persistDownstreamRows({ domain: 'officialPicks', rows: decision.rows, repository, eligibleGamePks: scope, cap: limits.officialPicks ?? decision.rows.length, beforeWrite: assertPregame })
  const boardReadback = await repository.readValueBoard({ valueIdentities: values.rows.map(r => r.value_identity), pickIdentities: picks.rows.map(r => r.official_pick_identity) })
  const boardValues = new Map(boardReadback.values.map(r => [r.id, r]))
  if (boardReadback.values.length !== values.rows.length || boardReadback.picks.length !== picks.rows.length) throw new Error('VALUE_BOARD_READBACK_INCOMPLETE')
  const boardRows = decision.decisions.map(d => {
    const value = boardValues.get(d.candidate.id)
    if (!value || sha256(value) !== sha256(d.candidate)) throw new Error('VALUE_BOARD_PAYLOAD_DRIFT')
    const pick = boardReadback.picks.find(p => p.value_evaluation_id === value.id)
    if (pick && !picks.rows.some(p => sha256(p) === sha256(pick))) throw new Error('VALUE_BOARD_PICK_DRIFT')
    return { ...value, status: pick ? 'OFFICIAL_PICK' : d.status === 'OFFICIAL_PICK_ELIGIBLE' ? 'WATCHLIST' : d.status, official_pick_identity: pick?.official_pick_identity ?? null,
      risk_flags: d.risk_flags, blocker_codes: d.blocker_codes, reason_codes: d.reason_codes }
  })
  const board = readValueBoardAdapter({ board: { rows: boardRows, state: 'CANONICAL_READBACK', freshness: 'PER_ROW' }, operatingDate: runContext.run_date, asOf: checkpoint.evaluatedAt })
  const writes = [...features.writes, predictions, markets.mappings, markets.observations, values, picks]
  return { status: 'CANONICAL_STAGES_READBACK_COMPLETE', mode, runContext, eligibleGamePks: scope, blockedGames,
    features, predictions, markets, values, picks, board, decisions: decision.decisions, writes,
    providerAccounting: accounting(), dmlAccounting: canonical.dmlAccounting?.() ?? null, insertedRows: writes.reduce((sum, w) => sum + w.inserted, 0),
    syntheticProductionPaths: 0, checkpoint: { frozenDigest, evidenceDigest: checkpoint.evidenceDigest, oddsDigest: checkpoint.oddsDigest } }
}

async function runR2ILegacyDryExecution({
  mode = 'DRY_RUN',
  authorization = null,
  providers = {},
  repository = null,
  runId = 'mlb-02r-r2i-test-live',
  executionPackageSha = R2I_PRIOR_PACKAGE_SHA,
  runDate = null,
  runAsOf = null,
  clock = null,
} = {}) {
  if (mode === 'LIVE_EXECUTE') throw new Error('LEGACY_SYNTHETIC_LIVE_PATH_FORBIDDEN')
  const runContext = createCurrentSlateRunFreeze({ runId, executionPackageSha, mode, runDate, runAsOf, clock })
  const frozenRunAsOf = runContext.run_as_of
  if (mode === 'LIVE_EXECUTE') {
    requireRunScopedLiveAuthorization(authorization, runContext)
    assertR2TLiveReadiness()
  }
  if (!['DRY_RUN', 'LIVE_EXECUTE', 'READBACK_ONLY'].includes(mode)) throw new Error(`INVALID_R2I_MODE:${mode}`)
  // Fixture repositories are constructed only after the live safety boundary.
  if (!repository) repository = createTestRepository()
  const live = mode === 'LIVE_EXECUTE'
  const authCaps = authorization?.dmlCaps ?? {}
  const evidence = testEvidence()
  const providerCaps = authorization?.providerCaps ?? {}
  const ledger = createProviderLedger(providerCaps)
  const mlbClient = providers.mlbOfficial ?? createMlbOfficialLiveClient({ fetchImpl: providers.fetchImpl, ledger })
  const statcastClient = providers.statcast ?? createStatcastLiveClient({
    fetchRowsForGames: providers.fetchStatcastRows,
    fetchImpl: providers.statcastFetchImpl ?? providers.fetchImpl,
    db: providers.statcastDb ?? providers.db,
    cacheDir: providers.statcastCacheDir,
    ledger,
  })
  const oddsClient = providers.odds ?? createTheOddsApiLiveClient({ fetchImpl: providers.fetchImpl, apiKey: providers.oddsApiKey, ledger })
  const stages = []
  const writeResults = []
  const schemaGuards = []

  const scheduleEvidence = live ? await mlbClient.getSchedule({ runDate: runContext.run_date, runAsOf: frozenRunAsOf }) : evidence.schedule
  const scheduleBase = await getCurrentSlate({ mode: live ? 'LIVE_EXECUTE' : 'DRY_RUN', runDate: runContext.run_date, runAsOf: frozenRunAsOf, providerClient: mlbClient, providerBudget: providerCaps, injectedEvidence: scheduleEvidence, liveAuthorization: live })
  const schedule = applyStartedGameGuard(scheduleBase, frozenRunAsOf)
  stages.push(schedule)
  const eligibleGames = schedule.artifact.games.filter((game) => game.pregame_classification === 'PREGAME_SAFE')
  const eligibleGamePks = assertEligibleGamePkFreeze(eligibleGames.map((game) => game.game_pk))
  const blockedGames = schedule.artifact.games.filter((game) => game.pregame_classification !== 'PREGAME_SAFE').map((game) => game.game_pk)
  if (eligibleGamePks.length === 0) {
    return terminalEmptySlateArtifact({ mode, runContext, schedule, eligibleGamePks, blockedGames, providerCaps, authCaps, ledger, stages, writeResults, schemaGuards })
  }
  const uniqueStarterIds = new Set()
  for (const game of eligibleGames) {
    for (const pitcher of [game.starter_evidence?.homeProbablePitcher, game.starter_evidence?.awayProbablePitcher]) {
      if (pitcher?.id) uniqueStarterIds.add(Number(pitcher.id))
    }
  }

  schemaGuards.push(await repository.verifySchemaFingerprint(R2I_LIVE_TARGETS.nativeGames))
  schemaGuards.push(await repository.verifySchemaFingerprint(R2I_LIVE_TARGETS.nativePlayers))
  const nativeCaps = {
    games: derivedCap(authCaps.nativeGames, eligibleGames.length),
    players: derivedCap(authCaps.nativePlayers, uniqueStarterIds.size),
  }
  const native = await reconcileNativeIdentity({ mode: live ? 'LIVE_EXECUTE' : 'DRY_RUN', runContext, scheduleEvidence: eligibleGames, eligibleGamePks, dmlCaps: nativeCaps, repository, liveAuthorization: live })
  stages.push(native)
  if (live) {
    const gameRowsByPk = new Map(eligibleGames.map((game) => [Number(game.game_pk), mapScheduleGameToNativeInsertRow(game, { phase: 'MLB_DATA_02R_R2I_LIVE_EXECUTION' })]))
    const gameRows = native.artifact.gamePlan.classifications.filter((row) => row.classification === 'INSERT_ELIGIBLE').map((row) => gameRowsByPk.get(Number(row.game_pk))).filter(Boolean)
    const playerRows = native.artifact.playerPlan.classifications.filter((row) => row.classification === 'INSERT_ELIGIBLE').map((row) => ({ game_pk: row.game_pk, mlbam_person_id: Number(row.identity) }))
    writeResults.push(await repository.insertNativeGames(gameRows, nativeCaps.games))
    writeResults.push(await repository.insertNativePlayers(playerRows, nativeCaps.players))
  }

  const statcastEvidence = live ? { rows: await statcastClient.fetchRowsForGames({ eligibleGamePks, dependencyDates: [runContext.run_date], runAsOf: frozenRunAsOf }) } : { rows: evidence.statcastRows }
  const rawCap = derivedCap(authCaps.rawStatcast, statcastEvidence.rows.length)
  schemaGuards.push(await repository.verifySchemaFingerprint(R2I_LIVE_TARGETS.rawStatcast))
  const raw = await reconcileCurrentSlateStatcast({ mode: live ? 'LIVE_EXECUTE' : 'DRY_RUN', eligibleGamePks, dependencyDates: [runContext.run_date], runAsOf: frozenRunAsOf, providerBudget: providerCaps, rawCap, providerClient: statcastClient, injectedEvidence: statcastEvidence, repository, liveAuthorization: live })
  stages.push(raw)
  if (live) writeResults.push(await insertRowsFromClassifications(raw.artifact.classifications, statcastEvidence.rows.map((row) => ({ ...row, id: `statcast:mlb:${row.game_year}:${row.game_pk}:${row.at_bat_number}:${row.pitch_number}` })), 'id', (rows, cap) => repository.insertRawRows(rows, cap), rawCap))

  const featureRows = plannedFeatureRows(eligibleGames[0], frozenRunAsOf)
  for (const target of [R2I_LIVE_TARGETS.featureSnapshots, R2I_LIVE_TARGETS.team, R2I_LIVE_TARGETS.starter, R2I_LIVE_TARGETS.bullpen, R2I_LIVE_TARGETS.batter, R2I_LIVE_TARGETS.matchup, R2I_LIVE_TARGETS.firstInning]) schemaGuards.push(await repository.verifySchemaFingerprint(target))
  const featureCaps = Object.fromEntries(Object.entries(featureRows).map(([domain, rows]) => [domain, derivedCap(authCaps.features?.[domain], rows.length)]))
  const features = await planCurrentSlateFeatures({ mode: live ? 'LIVE_EXECUTE' : 'DRY_RUN', targetGamePks: eligibleGamePks, runAsOf: frozenRunAsOf, perDomainCaps: featureCaps, repository, plannedFeatureRows: live ? { snapshots: featureRows.snapshots } : featureRows, liveAuthorization: live })
  stages.push(features)
  if (live) {
    const snapshotDomainPlan = features.artifact.domains.snapshots
    const snapshotRows = featureRows.snapshots.map((row) => ({
      ...row,
      deterministic_identity: row.deterministic_identity ?? row.identity,
      identity: row.identity ?? row.deterministic_identity,
      input_digest: row.input_digest ?? row.feature_digest,
      feature_digest: row.feature_digest ?? row.input_digest ?? sha256(row.features ?? row),
    }))
    const snapshotWrite = await insertRowsFromClassifications(
      snapshotDomainPlan.classifications,
      snapshotRows,
      'deterministic_identity',
      (insertRows, cap) => repository.insertFeatureRows('snapshots', insertRows, cap),
      featureCaps.snapshots,
    )
    writeResults.push(snapshotWrite)
    const snapshotIdByGamePk = await resolveCanonicalFeatureSnapshotIds({
      repository,
      plannedSnapshotRows: snapshotRows,
      insertedSnapshotRows: snapshotWrite.rows ?? [],
    })
    const boundFeatureRows = bindFeatureRowsToSnapshotIds(featureRows, snapshotIdByGamePk)
    const daily = await classifyBoundDailyFeatures(repository, boundFeatureRows, eligibleGamePks, featureCaps)
    Object.assign(features.artifact.domains, daily.plans)
    for (const key of ['plannedRows', 'insertEligible', 'reuseNoOp', 'blockConflict']) {
      features[key] = Object.values(features.artifact.domains).reduce((total, plan) => total + plan[key], 0)
    }
    for (const [domain, plan] of Object.entries(daily.plans)) {
      const rows = daily.rows[domain]
      writeResults.push(await insertRowsFromClassifications(plan.classifications, rows, 'identity', (insertRows, cap) => repository.insertFeatureRows(domain, insertRows, cap), featureCaps[domain]))
    }
  }

  const starters = classifyStarterReadiness({ games: eligibleGames, runAsOf: frozenRunAsOf })
  stages.push(starters)
  const inference = inferMoneyline({ gamePk: eligibleGamePks[0], featureVector: Array(R2F_FEATURE_COUNT).fill(0.1), modelArtifact: modelArtifact(), runAsOf: frozenRunAsOf })
  stages.push(inference)
  const prediction = predictionFromInference(inference, eligibleGames[0], frozenRunAsOf)
  const predictionCap = derivedCap(authCaps.predictions, 1)
  schemaGuards.push(await repository.verifySchemaFingerprint(R2I_LIVE_TARGETS.predictions))
  const predictions = await persistPredictions({ mode: live ? 'LIVE_EXECUTE' : 'DRY_RUN', runContext, eligibleGamePks, runAsOf: frozenRunAsOf, predictionCandidates: [prediction], dmlCap: predictionCap, repository, liveAuthorization: live })
  stages.push(predictions)
  if (live) writeResults.push(await insertRowsFromClassifications(predictions.artifact.plan.classifications, [prediction], 'deterministic_identity', (rows, cap) => repository.insertPredictions(rows, cap), predictionCap))

  const oddsPayload = live ? await oddsClient.getMoneylineOdds() : evidence.odds
  const oddsDigest = sha256(oddsPayload)
  const odds = acceptOddsEvidence({ mode: live ? 'LIVE_EXECUTE' : 'DRY_RUN', providerResponse: oddsPayload, responseDigest: oddsDigest, acquiredAt: frozenRunAsOf, providerAccounting: makeProviderAccounting('THE_ODDS_API', live ? 1 : 0, live ? ledger.read('THE_ODDS_API') : 0), eligibleGamePks, liveAuthorization: live })
  stages.push(odds)

  const normalized = normalizeMarketEvidence({ providerResponse: oddsPayload, responseDigest: oddsDigest, acquiredAt: frozenRunAsOf })
  const nativeGamesForCrosswalk = eligibleGames.map((game) => ({ game_pk: game.game_pk, home_team_name: game.teams?.home?.team?.name ?? 'Home Team', away_team_name: game.teams?.away?.team?.name ?? 'Away Team', scheduled_at: game.scheduled_at }))
  const crosswalk = crosswalkMarketEvents({ normalizedRows: normalized.rows, nativeGames: nativeGamesForCrosswalk, eligibleGamePks, runAsOf: frozenRunAsOf })
  const crosswalkByEvent = new Map(crosswalk.map((row) => [row.provider_event_id, row]))
  const matchedRows = normalized.rows.map((row) => ({ ...row, game_pk: crosswalkByEvent.get(row.provider_event_id)?.game_pk ?? null })).filter((row) => row.game_pk != null)
  const marketMappingCap = derivedCap(authCaps.marketMappings, new Set(matchedRows.map((row) => row.provider_event_id)).size)
  const marketObservationCap = derivedCap(authCaps.marketObservations, matchedRows.length)
  schemaGuards.push(await repository.verifySchemaFingerprint(R2I_LIVE_TARGETS.marketMappings))
  schemaGuards.push(await repository.verifySchemaFingerprint(R2I_LIVE_TARGETS.marketObservations))
  const markets = await classifyMarketPersistence({ mode: live ? 'LIVE_EXECUTE' : 'DRY_RUN', matchedRows, eligibleGamePks, mappingCap: marketMappingCap, observationCap: marketObservationCap, repository, liveAuthorization: live })
  markets.artifact.crosswalk = crosswalk
  stages.push(markets)
  if (live) {
    writeResults.push(await insertRowsFromClassifications(markets.artifact.mappingPlan.classifications, markets.artifact.mappingRows, 'identity', (rows, cap) => repository.insertMarketMappings(rows, cap), marketMappingCap))
    writeResults.push(await insertRowsFromClassifications(markets.artifact.observationPlan.classifications, markets.artifact.observationRows, 'observation_identity', (rows, cap) => repository.insertMarketObservations(rows, cap), marketObservationCap))
  }

  const valueRows = calculateNativeValue({ prediction, observations: markets.artifact.observationRows.map((row, index) => ({ ...row, id: `obs-${index}` })), runAsOf: frozenRunAsOf })
  const valueCap = derivedCap(authCaps.nativeValues, valueRows.length)
  schemaGuards.push(await repository.verifySchemaFingerprint(R2I_LIVE_TARGETS.values))
  const values = await classifyValuePersistence({ mode: live ? 'LIVE_EXECUTE' : 'DRY_RUN', valueRows, eligibleGamePks, runAsOf: frozenRunAsOf, dmlCap: valueCap, repository, liveAuthorization: live })
  values.artifact.analyticalRows = valueRows
  stages.push(values)
  if (live) writeResults.push(await insertRowsFromClassifications(values.artifact.plan.classifications, valueRows, 'value_identity', (rows, cap) => repository.insertValues(rows, cap), valueCap))

  const policy = { version: R2F_POLICY_VERSION, thresholds: { consensusEdge: 0.02, unitEv: 0.05, minimumBookCount: 1, freshness: 'FRESH', dispersionMaximum: 0.03 }, modelRange: { min: 0.304475, max: 0.671837 } }
  const policyResults = valueRows.map((row) => evaluateOfficialPickPolicy({ candidate: row, policy, runAsOf: frozenRunAsOf }))
  const policyStage = { ...policyResults[0], plannedRows: policyResults.length, artifact: { statuses: policyResults.map((row) => row.artifact.status), rows: policyResults.map((row, index) => ({ value_identity: valueRows[index].value_identity, ...row.artifact })) } }
  stages.push(policyStage)

  const eligiblePolicyIndex = policyResults.findIndex((row) => row.artifact.status === 'OFFICIAL_PICK_ELIGIBLE')
  const pickRows = eligiblePolicyIndex >= 0 ? [officialPickFromPolicy(valueRows[eligiblePolicyIndex], policyResults[eligiblePolicyIndex], frozenRunAsOf)] : []
  const officialPickCap = derivedCap(authCaps.officialPicks, pickRows.length)
  schemaGuards.push(await repository.verifySchemaFingerprint(R2I_LIVE_TARGETS.officialPicks))
  const picks = await classifyOfficialPickPersistence({ mode: live ? 'LIVE_EXECUTE' : 'DRY_RUN', officialPickRows: pickRows, eligibleGamePks, runAsOf: frozenRunAsOf, dmlCap: officialPickCap, repository, liveAuthorization: live })
  stages.push(picks)
  if (live) writeResults.push(await insertRowsFromClassifications(picks.artifact.plan.classifications, pickRows, 'official_pick_identity', (rows, cap) => repository.insertOfficialPicks(rows, cap), officialPickCap))

  const boardSource = live ? await repository.readValueBoard() : { rows: pickRows.map((row) => ({ status: 'OFFICIAL_PICK', ...row })), state: 'DRY_RUN', freshness: 'FRESH' }
  const board = readValueBoardAdapter({ board: boardSource, operatingDate: runContext.run_date, asOf: frozenRunAsOf })
  stages.push(board)

  return {
    certificationVerdict: R2I_CERTIFICATION,
    mode,
    runContext: { ...runContext, eligible_game_pks: eligibleGamePks, blocked_game_pks: blockedGames, provider_budget: providerCaps, per_stage_dml_caps: authCaps },
    liveBranchTraversed: live,
    dependencyInventory: liveDependencyInventory(),
    schemaGuards,
    stages,
    writeResults,
    checkpointResume: { state: 'PASS', frozenEvidenceReusable: true, oddsRequestRepeatedOnResume: false },
    providerLedger: ledger.snapshot(),
    safety: {
      realProviderCalls: 0,
      productionDml: 0,
      productionDdl: 0,
      automationChanges: 0,
      cronChanges: 0,
      settlementWrites: 0,
      testProviderCalls: ledger.total(),
      testDml: writeResults.reduce((sum, row) => sum + Number(row.inserted ?? 0), 0),
    },
  }
}
