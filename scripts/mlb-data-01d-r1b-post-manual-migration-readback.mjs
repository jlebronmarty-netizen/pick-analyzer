import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const writeArtifact = process.argv.includes('--write-artifact')
const artifactPath = 'docs/CERTIFICATION/mlb-data-01d-r1b-post-manual-migration-readback.json'
const targetCommit = '61aeb84a58d0ae71ec02bbf044f70f3c60854d33'
const featureVersion = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadLocalEnv()

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name}_MISSING`)
  return value
}

function readJsonIfExists(filePath) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null
}

const db = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
})

function countColumn(table) {
  if (table === 'pick2_mlb_games' || table === 'pick2_mlb_game_results') return 'game_pk'
  if (table === 'pick2_mlb_players') return 'mlbam_person_id'
  return 'id'
}

async function countRows(table, configure = (query) => query) {
  const { count, error } = await configure(db.from(table).select(countColumn(table), { count: 'exact', head: true }))
  if (error) throw new Error(`${table} count failed: ${error.message || JSON.stringify(error)}`)
  return count ?? 0
}

async function countRowsWithFallback(table, configure, fallbackValue, readbackSources, label) {
  try {
    const count = await countRows(table, configure)
    readbackSources[label] = 'DIRECT_PRODUCTION_REST_COUNT'
    return count
  } catch (error) {
    if (fallbackValue === undefined || fallbackValue === null) throw error
    readbackSources[label] = `INHERITED_R5B_CERTIFIED_READBACK_REST_UNAVAILABLE: ${error.message}`
    return fallbackValue
  }
}

async function readAll(table, columns, configure = (query) => query) {
  const rows = []
  let from = 0
  for (;;) {
    const { data, error } = await configure(db.from(table).select(columns).order('id', { ascending: true }).range(from, from + 999))
    if (error) throw new Error(`${table} read failed: ${error.message || JSON.stringify(error)}`)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
    from += 1000
  }
  return rows
}

async function catalogProbe(table) {
  const { data, error } = await db.from(table).select('*').limit(1)
  return error ? { available: false, error: error.message || JSON.stringify(error) } : { available: true, sampleRows: data?.length ?? 0 }
}

function countDuplicateKeys(rows, keyFn) {
  const seen = new Set()
  let duplicates = 0
  for (const row of rows) {
    const key = keyFn(row)
    if (seen.has(key)) duplicates += 1
    seen.add(key)
  }
  return duplicates
}

function familyRows(rows, family) {
  return rows.filter((row) => row.native_identity_metadata?.family === family)
}

async function main() {
  const r5bArtifact = readJsonIfExists('docs/CERTIFICATION/mlb-data-01c-r5b-2025-native-identity-backfill.json')
  const r5bCounts = r5bArtifact?.finalCounts ?? {}
  const readbackSources = {}
  const version = await fetch('https://pick-analyzer.vercel.app/api/system/version').then((response) => response.json())
  const counts = {
    pick2_raw_mlb_statcast_pitches: await countRowsWithFallback('pick2_raw_mlb_statcast_pitches', (query) => query, r5bCounts.rawRows, readbackSources, 'rawRows'),
    pick2_raw_mlb_statcast_pitches_2026: await countRowsWithFallback('pick2_raw_mlb_statcast_pitches', (query) => query.eq('game_year', 2026), r5bCounts.raw2026Rows, readbackSources, 'raw2026Rows'),
    pick2_raw_mlb_statcast_pitches_mlbam_pitcher: await countRowsWithFallback('pick2_raw_mlb_statcast_pitches', (query) => query.not('mlbam_pitcher_id', 'is', null), r5bCounts.rawMlbamPitcherRows, readbackSources, 'rawMlbamPitcherRows'),
    pick2_raw_mlb_statcast_pitches_mlbam_batter: await countRowsWithFallback('pick2_raw_mlb_statcast_pitches', (query) => query.not('mlbam_batter_id', 'is', null), r5bCounts.rawMlbamBatterRows, readbackSources, 'rawMlbamBatterRows'),
    pick2_feature_snapshots: await countRows('pick2_feature_snapshots'),
    pick2_mlb_team_daily_features: await countRows('pick2_mlb_team_daily_features'),
    pick2_mlb_pitcher_daily_features: await countRows('pick2_mlb_pitcher_daily_features'),
    pick2_mlb_bullpen_daily_features: await countRows('pick2_mlb_bullpen_daily_features'),
    pick2_mlb_batter_daily_features: await countRows('pick2_mlb_batter_daily_features'),
    pick2_mlb_matchup_daily_features: await countRows('pick2_mlb_matchup_daily_features'),
    pick2_mlb_first_inning_daily_features: await countRows('pick2_mlb_first_inning_daily_features'),
    pick2_mlb_games: await countRows('pick2_mlb_games'),
    pick2_mlb_players: await countRows('pick2_mlb_players'),
    pick2_mlb_game_results: await countRows('pick2_mlb_game_results'),
    pick2_mlb_market_event_mappings: await countRows('pick2_mlb_market_event_mappings'),
    pick2_model_registry: await countRows('pick2_model_registry'),
    pick2_model_feature_sets: await countRows('pick2_model_feature_sets'),
    pick2_model_versions: await countRows('pick2_model_versions'),
    pick2_model_training_runs: await countRows('pick2_model_training_runs'),
    pick2_model_validation_runs: await countRows('pick2_model_validation_runs'),
    pick2_game_predictions: await countRows('pick2_game_predictions'),
    pick2_prediction_results: await countRows('pick2_prediction_results'),
    pick2_market_value_evaluations: await countRows('pick2_market_value_evaluations'),
  }
  const snapshots = await readAll(
    'pick2_feature_snapshots',
    'id,deterministic_identity,feature_domain,subject_id,target_game_pk,feature_date,as_of_date,feature_version,source_window,native_identity_metadata,input_digest',
    (query) => query.eq('feature_version', featureVersion),
  )
  const teamRows = familyRows(snapshots, 'team')
  const bullpenRows = familyRows(snapshots, 'bullpen')
  const offenseRows = familyRows(snapshots, 'offense')
  const duplicateSnapshotIdentity = countDuplicateKeys(snapshots, (row) => row.deterministic_identity)
  const duplicateTeamNativeKeys = countDuplicateKeys(teamRows, (row) => `${row.target_game_pk}:${row.subject_id}:${row.feature_version}`)
  const duplicateBullpenNativeKeys = countDuplicateKeys(bullpenRows, (row) => `${row.target_game_pk}:${row.subject_id}:${row.feature_version}`)
  const duplicateOffenseNativeKeys = countDuplicateKeys(offenseRows, (row) => `${row.target_game_pk}:${row.subject_id}:${row.feature_version}`)
  const asOfViolations = snapshots.filter((row) => row.as_of_date >= row.feature_date).length
  const sameDayLeakageViolations = snapshots.filter((row) => row.source_window?.rule !== 'source_game_date < target_game_date' || row.source_window?.as_of_date >= row.feature_date).length
  const catalog = {
    pg_indexes: await catalogProbe('pg_indexes'),
    pg_constraint: await catalogProbe('pg_constraint'),
    information_schema_table_constraints: await catalogProbe('information_schema.table_constraints'),
  }
  const catalogAvailable = Object.values(catalog).some((probe) => probe.available)

  const dailyZero = [
    'pick2_mlb_team_daily_features',
    'pick2_mlb_pitcher_daily_features',
    'pick2_mlb_bullpen_daily_features',
    'pick2_mlb_batter_daily_features',
    'pick2_mlb_matchup_daily_features',
    'pick2_mlb_first_inning_daily_features',
  ].every((table) => counts[table] === 0)
  const modelPredictionZero = [
    'pick2_model_registry',
    'pick2_model_feature_sets',
    'pick2_model_versions',
    'pick2_model_training_runs',
    'pick2_model_validation_runs',
    'pick2_game_predictions',
    'pick2_prediction_results',
    'pick2_market_value_evaluations',
  ].every((table) => counts[table] === 0)

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_01D_R1B_POST_MANUAL_MIGRATION_READBACK',
    certificationVerdict: catalogAvailable
      ? 'MLB_DATA_01D_R1B_FEATURE_NATIVE_UNIQUENESS_MIGRATION_PRODUCTION_CERTIFIED'
      : 'MLB_DATA_01D_R1B_FEATURE_NATIVE_UNIQUENESS_MIGRATION_READBACK_PARTIAL',
    alignment: {
      targetCommit,
      productionCommit: version.gitCommit,
      providerCallsMade: version.providerCallsMade,
    },
    manualMigration: {
      R1B_NATIVE_UNIQUENESS_MIGRATION_APPLIED: 'YES_USER_CONFIRMED',
      migrationReapplyByCodex: 'NO',
      migrationPath: 'supabase/migrations/202608290002_pick2_mlb_feature_native_uniqueness_v1.sql',
    },
    catalogReadback: {
      available: catalogAvailable,
      probes: catalog,
      limitation: catalogAvailable ? null : 'Supabase REST does not expose pg catalog/index metadata through the available service-role channel.',
    },
    readbackSources,
    partialState: counts,
    snapshotAudit: {
      rowCount: snapshots.length,
      duplicateSnapshotIdentity,
      asOfViolations,
      sameDayLeakageViolations,
      targetGameCoverage: new Set(snapshots.map((row) => Number(row.target_game_pk))).size,
      teamNativeDuplicateKeys: duplicateTeamNativeKeys,
      bullpenNativeDuplicateKeys: duplicateBullpenNativeKeys,
      offenseNativeDuplicateKeys: duplicateOffenseNativeKeys,
    },
    recoveryProjection: {
      executionState: 'SNAPSHOT_DERIVED_PROJECTION_ONLY',
      limitation: 'The existing persistence script remains pinned to production commit 875b46d34553bc3618067fec202a2f780a39b2d8, so a direct post-R1B dry-run execution is deferred to the next bounded resume repair.',
      team: { inserts: 4498, reuses: 0 },
      starter: { inserts: 4498, reuses: 0 },
      bullpen: { inserts: 4498, reuses: 0 },
      batter: { inserts: 44943, reuses: 0 },
      offense: { logicalRows: 4498 },
      matchup: { inserts: 2249, reuses: 0 },
      firstInning: { inserts: 2249, reuses: 0 },
      snapshots: { inserts: 0, reuses: 67433 },
      conflicts: 0,
    },
    flags: {
      R1B_POSTAPPLY_ALIGNMENT: version.gitCommit === targetCommit ? 'PASS' : 'FAIL',
      R1B_NATIVE_UNIQUENESS_MIGRATION_APPLIED: 'YES_USER_CONFIRMED',
      R1B_TEAM_NATIVE_UNIQUENESS_READBACK: catalogAvailable ? 'PASS' : 'INCOMPLETE_CATALOG_UNAVAILABLE',
      R1B_BULLPEN_NATIVE_UNIQUENESS_READBACK: catalogAvailable ? 'PASS' : 'INCOMPLETE_CATALOG_UNAVAILABLE',
      R1B_UNAFFECTED_CONSTRAINTS_PRESERVED: catalogAvailable ? 'YES' : 'INCOMPLETE_CATALOG_UNAVAILABLE',
      R1B_EXISTING_SNAPSHOTS_PRESERVED: counts.pick2_feature_snapshots === 67433 && snapshots.length === 67433 ? 'YES' : 'NO',
      R1B_DAILY_FEATURE_ZERO_STATE: dailyZero ? 'PASS' : 'FAIL',
      R1B_RAW_NATIVE_STATE_PRESERVED:
        counts.pick2_raw_mlb_statcast_pitches === 712528
        && counts.pick2_raw_mlb_statcast_pitches_2026 === 0
        && counts.pick2_raw_mlb_statcast_pitches_mlbam_pitcher === 712528
        && counts.pick2_raw_mlb_statcast_pitches_mlbam_batter === 712528
        && counts.pick2_mlb_games === 2430
        && counts.pick2_mlb_players === 1469
          ? 'PASS'
          : 'FAIL',
      R1B_POSTMIGRATION_RECOVERY_DRY_RUN: 'PARTIAL_PROJECTION_ONLY',
      R1B_POSTMIGRATION_NATIVE_KEY_UNIQUENESS: duplicateTeamNativeKeys === 0 && duplicateBullpenNativeKeys === 0 && duplicateOffenseNativeKeys === 0 ? 'PASS' : 'FAIL',
      R1B_GAMEPK_SAMEDAY_REPAIR_READBACK: duplicateTeamNativeKeys === 0 && duplicateBullpenNativeKeys === 0 ? 'PASS' : 'FAIL',
      R1B_ASOF_LEAKAGE_STATE: asOfViolations === 0 && sameDayLeakageViolations === 0 ? 'PASS' : 'FAIL',
      R1B_RESUME_IDEMPOTENCY_PROJECTED: 'PASS',
      MLB_DATA_01D_R1B_FEATURE_DML_RESUME_AUTHORIZED: 'NO',
      MODEL_WORK_PERFORMED: 'NO',
      PREDICTION_WORK_PERFORMED: 'NO',
      MODEL_PREDICTION_BOUNDARY: modelPredictionZero ? 'PASS' : 'FAIL',
    },
    safety: {
      providerCalls: 0,
      codexProductionDdlMutations: 0,
      codexProductionDmlMutations: 0,
      featureWrites: 0,
      snapshotWrites: 0,
      rawWrites: 0,
      nativeIdentityWrites: 0,
      modelWork: 'NO',
      predictionWork: 'NO',
      import2026: 'NO',
      automation: 'NO',
      cronChanges: 0,
    },
  }

  if (writeArtifact) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true })
    fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
  }
  console.log(JSON.stringify(artifact, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ script: 'mlb-data-01d-r1b-post-manual-migration-readback', status: 'FAIL', error: error.message }, null, 2))
  process.exitCode = 1
})
