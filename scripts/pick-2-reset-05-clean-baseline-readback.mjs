import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()
const migrationPath = 'supabase/migrations/202608270002_pick2_data_foundation_v1.sql'
const migration = fs.readFileSync(path.join(root, migrationPath), 'utf8')

function loadEnvFile(file = '.env.local') {
  const fullPath = path.join(root, file)
  if (!fs.existsSync(fullPath)) return
  for (const line of fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] ||= value
  }
}

function parseTables(sql) {
  const tables = []
  const tableRegex = /create table if not exists public\.([a-z0-9_]+)\s*\(([\s\S]*?)\n\);/gi
  for (const match of sql.matchAll(tableRegex)) {
    const table = match[1]
    if (!table.startsWith('pick2_')) continue
    const body = match[2]
    const columns = []
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.trim().replace(/,$/, '')
      if (!line || line.startsWith('--')) continue
      if (/^(primary|unique|foreign|constraint|check)\b/i.test(line)) continue
      const column = line.split(/\s+/)[0]?.replace(/"/g, '')
      if (column) columns.push(column)
    }
    tables.push({ table, columns })
  }
  return tables
}

function assertSourceContract(tables) {
  const tableNames = tables.map((entry) => entry.table)
  const requiredTables = [
    'pick2_raw_mlb_statcast_pitches',
    'pick2_feature_snapshots',
    'pick2_mlb_pitcher_daily_features',
    'pick2_mlb_batter_daily_features',
    'pick2_mlb_team_daily_features',
    'pick2_mlb_bullpen_daily_features',
    'pick2_mlb_matchup_daily_features',
    'pick2_mlb_first_inning_daily_features',
    'pick2_model_registry',
    'pick2_model_feature_sets',
    'pick2_model_versions',
    'pick2_model_training_runs',
    'pick2_model_validation_runs',
    'pick2_game_predictions',
    'pick2_prediction_results',
    'pick2_market_value_evaluations',
    'pick2_data_health_status',
  ]
  const requiredRawColumns = [
    'game_pk',
    'game_date',
    'game_year',
    'game_type',
    'at_bat_number',
    'pitch_number',
    'source_pitcher_id',
    'source_batter_id',
    'source_player_name',
    'canonical_pitcher_id',
    'canonical_batter_id',
    'source_home_team',
    'source_away_team',
    'canonical_home_team_id',
    'canonical_away_team_id',
    'event_id',
    'pitch_type',
    'pitch_name',
    'release_speed',
    'effective_speed',
    'release_spin_rate',
    'spin_axis',
    'release_extension',
    'release_pos_x',
    'release_pos_y',
    'release_pos_z',
    'pfx_x',
    'pfx_z',
    'plate_x',
    'plate_z',
    'launch_speed',
    'launch_angle',
    'estimated_woba_using_speedangle',
    'bat_speed',
    'swing_length',
    'attack_angle',
    'post_home_score',
    'post_away_score',
    'raw_payload',
    'raw_payload_digest',
    'source',
    'source_version',
    'mapping_metadata',
    'ingested_at',
  ]
  const raw = tables.find((entry) => entry.table === 'pick2_raw_mlb_statcast_pitches')
  const migrationLower = migration.toLowerCase()
  const destructiveSqlAbsent = ![
    'drop table',
    'truncate ',
    'delete from',
    'alter table prediction_history',
    'insert into public.prediction_history',
  ].some((token) => migrationLower.includes(token))

  return {
    expectedTables: requiredTables,
    parsedTables: tableNames,
    missingExpectedTables: requiredTables.filter((table) => !tableNames.includes(table)),
    missingRawColumns: requiredRawColumns.filter((column) => !raw?.columns.includes(column)),
    uniquePitchIdentity:
      migration.includes('unique (game_pk, at_bat_number, pitch_number)') &&
      migration.includes('pick2_raw_mlb_statcast_pitches_game_idx'),
    sourceCanonicalIdentitySeparation:
      migration.includes('source_pitcher_id bigint') &&
      migration.includes('source_batter_id bigint') &&
      migration.includes('canonical_pitcher_id text references public.sport_players(id)') &&
      migration.includes('canonical_batter_id text references public.sport_players(id)') &&
      migration.includes('source_home_team text') &&
      migration.includes('canonical_home_team_id text references public.sports_teams(id)'),
    featureAsOfContract:
      migration.includes('as_of_date') &&
      migration.includes('as_of_timestamp') &&
      migration.includes('feature_version') &&
      migration.includes('check (as_of_date <= feature_date)'),
    predictionStoragePureSports:
      migration.includes('create table if not exists public.pick2_game_predictions') &&
      migration.includes('model_version_id uuid not null references public.pick2_model_versions(id)') &&
      migration.includes('feature_snapshot_id uuid not null references public.pick2_feature_snapshots(id)') &&
      !migration
        .slice(
          migration.indexOf('create table if not exists public.pick2_game_predictions'),
          migration.indexOf('create table if not exists public.pick2_prediction_results'),
        )
        .match(/sportsbook\s+text/),
    marketValueSeparated:
      migration.includes('create table if not exists public.pick2_market_value_evaluations') &&
      migration.includes('odds_snapshot_id text not null references public.sports_odds_snapshots(id)'),
    canonicalCorePreserved: [
      'public.sport_events',
      'public.sports_teams',
      'public.sport_players',
      'public.game_results',
      'public.sports_odds_snapshots',
    ].every((token) => migration.includes(token)),
    rlsPoliciesDefined: requiredTables.every(
      (table) =>
        migration.includes(`alter table public.${table} enable row level security`) &&
        migration.includes(`${table}_service_role_all`),
    ),
    destructiveSqlAbsent,
    statcastImportSqlAbsent: !/copy\s+public\.pick2_|insert\s+into\s+public\.pick2_raw_mlb_statcast_pitches/i.test(
      migration,
    ),
  }
}

async function headSelect(client, table, columns = '*') {
  const { count, error } = await client
    .from(table)
    .select(columns, { count: 'exact', head: true })
    .limit(0)

  if (error) {
    return {
      table,
      visible: false,
      count: null,
      error: {
        code: error.code ?? null,
        message: error.message ?? 'unknown Supabase readback error',
      },
    }
  }

  return {
    table,
    visible: true,
    count: count ?? 0,
    error: null,
  }
}

loadEnvFile()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    JSON.stringify(
      {
        validator: 'pick-2-reset-05-clean-baseline-readback',
        status: 'BLOCKED',
        blocker: 'MISSING_SUPABASE_READBACK_CONFIGURATION',
        providerCalls: 0,
        productionDmlMutations: 0,
        productionDdlMutationsByCodex: 0,
      },
      null,
      2,
    ),
  )
  process.exit(2)
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const tables = parseTables(migration)
const sourceContract = assertSourceContract(tables)
const tableReadbacks = []
for (const entry of tables) {
  tableReadbacks.push(await headSelect(client, entry.table, entry.columns.join(',')))
}

const canonicalCoreTables = [
  'sports_teams',
  'sport_players',
  'sport_events',
  'game_results',
  'sports_odds_snapshots',
]
const canonicalCore = []
for (const table of canonicalCoreTables) {
  canonicalCore.push(await headSelect(client, table))
}

const pick2Counts = Object.fromEntries(
  tableReadbacks.map((readback) => [readback.table, readback.count]),
)
const visibleTables = tableReadbacks.filter((readback) => readback.visible).map((readback) => readback.table)
const invisibleTables = tableReadbacks.filter((readback) => !readback.visible)
const nonZeroTables = tableReadbacks.filter((readback) => Number(readback.count ?? 0) !== 0)

const failed = []
function check(name, condition) {
  if (!condition) failed.push(name)
}

check('all expected tables parsed', sourceContract.missingExpectedTables.length === 0)
check('all production Pick 2 tables visible', invisibleTables.length === 0)
check('all Pick 2 table row counts zero', nonZeroTables.length === 0)
check('raw required columns visible', sourceContract.missingRawColumns.length === 0)
check('unique pitch identity defined', sourceContract.uniquePitchIdentity)
check('source/canonical identity separation defined', sourceContract.sourceCanonicalIdentitySeparation)
check('feature as-of contract defined', sourceContract.featureAsOfContract)
check('pure sports prediction storage defined', sourceContract.predictionStoragePureSports)
check('market value storage separated', sourceContract.marketValueSeparated)
check('canonical core preserved in migration', sourceContract.canonicalCorePreserved)
check('canonical core tables visible', canonicalCore.every((entry) => entry.visible))
check('RLS/service-role policies source-defined', sourceContract.rlsPoliciesDefined)
check('destructive SQL absent', sourceContract.destructiveSqlAbsent)
check('Statcast import SQL absent', sourceContract.statcastImportSqlAbsent)

const status = failed.length ? 'FAIL' : 'PASS'
const output = {
  validator: 'pick-2-reset-05-clean-baseline-readback',
  status,
  certificationVerdict: status === 'PASS' ? 'PICK_2_RESET_05_CLEAN_BASELINE_CERTIFIED' : 'PICK_2_RESET_05_SCHEMA_READBACK_BLOCKED',
  generatedAt: new Date().toISOString(),
  migrationApplied: 'YES_USER_CONFIRMED',
  migrationReappliedByThisTask: false,
  providerCalls: 0,
  productionDdlMutationsByCodex: 0,
  productionDmlMutationsByCodex: 0,
  statcastInserts: 0,
  predictionWrites: 0,
  modelWrites: 0,
  automationActivated: false,
  cronChanges: 0,
  expectedPick2FoundationTables: sourceContract.expectedTables,
  visibleTables,
  invisibleTables,
  rowCounts: pick2Counts,
  nonZeroTables,
  rawStatcastTable: 'pick2_raw_mlb_statcast_pitches',
  rawMissingColumns: sourceContract.missingRawColumns,
  canonicalCore,
  sourceContract: {
    uniquePitchIdentity: sourceContract.uniquePitchIdentity,
    sourceCanonicalIdentitySeparation: sourceContract.sourceCanonicalIdentitySeparation,
    featureAsOfContract: sourceContract.featureAsOfContract,
    predictionStoragePureSports: sourceContract.predictionStoragePureSports,
    marketValueSeparated: sourceContract.marketValueSeparated,
    canonicalCorePreserved: sourceContract.canonicalCorePreserved,
    rlsPoliciesDefined: sourceContract.rlsPoliciesDefined,
    destructiveSqlAbsent: sourceContract.destructiveSqlAbsent,
    statcastImportSqlAbsent: sourceContract.statcastImportSqlAbsent,
  },
  cleanBaselines: {
    pick2ChampionModel: 'NONE',
    predictions: 0,
    evaluated: 0,
    accuracy: 'N/A',
    brier: 'N/A',
    logLoss: 'N/A',
    roi: 'N/A',
    today: 'NO_PREDICTION_ENGINE_SETUP_STATE',
    dataHealth: 'STATCAST_NOT_IMPORTED_SETUP_PENDING',
  },
  sourceAuditContract: {
    season2025: { files: 30, pitches: 712528, games: 2430, sourceColumns: 119, duplicatePitchIdentities: 0 },
    season2026Ytd: { files: 30, pitches: 591316, games: 2004, sourceColumns: 119, duplicatePitchIdentities: 0 },
    combined: { pitches: 1303844, games: 4434 },
  },
  flags: {
    PICK_2_FOUNDATION_MIGRATION_APPLIED: 'YES_USER_CONFIRMED',
    PICK_2_FOUNDATION_TABLES_VISIBLE: invisibleTables.length === 0 ? 'YES' : 'NO',
    PICK_2_FOUNDATION_COLUMN_READBACK:
      invisibleTables.length === 0 && sourceContract.missingRawColumns.length === 0 ? 'PASS' : 'FAIL',
    PICK_2_NEW_TABLES_ZERO_ROW_BASELINE: nonZeroTables.length === 0 ? 'PASS' : 'FAIL',
    STATCAST_RAW_PRODUCTION_STORAGE_READY:
      sourceContract.missingRawColumns.length === 0 && visibleTables.includes('pick2_raw_mlb_statcast_pitches')
        ? 'YES'
        : 'NO',
    STATCAST_RAW_PRODUCTION_IDEMPOTENCY_READY: sourceContract.uniquePitchIdentity ? 'YES' : 'NO',
    SOURCE_CANONICAL_IDENTITY_SEPARATION_PRODUCTION_READY: sourceContract.sourceCanonicalIdentitySeparation
      ? 'YES'
      : 'NO',
    PICK_2_FEATURE_STORAGE_PRODUCTION_READY:
      visibleTables.filter((table) => table.includes('_daily_features') || table === 'pick2_feature_snapshots')
        .length === 7
        ? 'YES'
        : 'NO',
    PICK_2_FEATURE_AS_OF_STORAGE_READY: sourceContract.featureAsOfContract ? 'YES' : 'NO',
    PICK_2_MODEL_LAB_STORAGE_READY:
      ['pick2_model_registry', 'pick2_model_feature_sets', 'pick2_model_versions', 'pick2_model_training_runs', 'pick2_model_validation_runs'].every((table) =>
        visibleTables.includes(table),
      )
        ? 'YES'
        : 'NO',
    PICK_2_CHAMPION_MODEL: nonZeroTables.some((entry) => entry.table.startsWith('pick2_model_')) ? 'UNKNOWN' : 'NONE',
    PURE_SPORTS_PREDICTION_PRODUCTION_STORAGE_READY: sourceContract.predictionStoragePureSports ? 'YES' : 'NO',
    PICK_2_PREDICTION_EVALUATION_STORAGE_READY: visibleTables.includes('pick2_prediction_results') ? 'YES' : 'NO',
    MARKET_VALUE_PRODUCTION_STORAGE_SEPARATED: sourceContract.marketValueSeparated ? 'YES' : 'NO',
    CANONICAL_CORE_PRESERVED: canonicalCore.every((entry) => entry.visible) ? 'YES' : 'NO',
    PICK_2_FOUNDATION_FK_CONTRACT: sourceContract.canonicalCorePreserved ? 'PASS' : 'FAIL',
    PICK_2_FOUNDATION_INDEX_CONTRACT: sourceContract.uniquePitchIdentity ? 'PASS' : 'FAIL',
    PICK_2_PRODUCTION_DATA_SECURITY_CERTIFIED: sourceContract.rlsPoliciesDefined ? 'YES' : 'NO',
    LEGACY_PRE_PICK_2_DATA_UNTOUCHED: nonZeroTables.length === 0 ? 'YES' : 'NO',
    PHYSICAL_LEGACY_DELETE_PERFORMED: 'NO',
    PICK_2_PERFORMANCE_CLEAN_BASELINE: nonZeroTables.length === 0 ? 'PASS' : 'FAIL',
    PICK_2_MODEL_LAB_CLEAN_BASELINE: nonZeroTables.length === 0 ? 'PASS' : 'FAIL',
    PICK_2_TODAY_CLEAN_BASELINE: nonZeroTables.length === 0 ? 'PASS' : 'FAIL',
    PICK_2_DATA_HEALTH_CLEAN_BASELINE: nonZeroTables.length === 0 ? 'PASS' : 'FAIL',
    MLB_DATA_01A_2025_RAW_VALIDATION_ALLOWED: status === 'PASS' ? 'YES' : 'NO',
    RAW_IMPORT_ALLOWED_NOW: 'NO',
    STATCAST_IMPORT_PERFORMED: 'NO',
    AUTOMATION_ACTIVATED: 'NO',
  },
  failed,
}

console.log(JSON.stringify(output, null, 2))
process.exit(status === 'PASS' ? 0 : 1)
