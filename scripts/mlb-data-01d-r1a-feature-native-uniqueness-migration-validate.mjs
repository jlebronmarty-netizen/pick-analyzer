import fs from 'node:fs'

const migrationPath = 'supabase/migrations/202608290002_pick2_mlb_feature_native_uniqueness_v1.sql'
const migration = fs.readFileSync(migrationPath, 'utf8')
const r1 = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-01d-r1-feature-persistence-key-repair.json', 'utf8'))

const checks = []
function check(name, condition) {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL' })
}

const requiredDrops = [
  'pick2_mlb_team_daily_features_team_id_feature_date_feature__key',
  'pick2_mlb_team_daily_features_team_id_feature_date_feature_vers',
  'pick2_mlb_team_daily_features_team_id_feature_date_feature_version_key',
  'pick2_mlb_bullpen_daily_features_team_id_feature_date_feature_key',
  'pick2_mlb_bullpen_daily_features_team_id_feature_date_feature_v',
  'pick2_mlb_bullpen_daily_features_team_id_feature_date_feature_version_key',
]

check('migration exists', fs.existsSync(migrationPath))
check('transaction bounded', /^\s*begin;/i.test(migration) && /\bcommit;\s*$/i.test(migration))
check('r1 authority loaded', r1.flags.MLB_DATA_01D_R1_LEGACY_KEY_DEFECT_PROVEN === 'YES' && r1.flags.MLB_DATA_01D_R1_EXISTING_SNAPSHOT_STATE === 'PASS')
check('only team/bullpen drops', requiredDrops.every((name) => migration.includes(`drop constraint if exists ${name}`)) && !/drop constraint if exists pick2_mlb_(pitcher|batter|matchup|first_inning)_daily_features/i.test(migration))
check('no broad dynamic sql', !/\bexecute\b|\bformat\s*\(|information_schema|pg_constraint|pg_indexes/i.test(migration))
check('no drop table', !/\bdrop\s+table\b/i.test(migration))
check('no drop column', !/\bdrop\s+column\b/i.test(migration))
check('no delete truncate update insert', !/\b(delete|truncate|update|insert)\b/i.test(migration))
check('snapshot table untouched', !/pick2_feature_snapshots/i.test(migration))
check('raw table untouched', !/pick2_raw_mlb_statcast_pitches/i.test(migration))
check('native identity tables untouched', !/pick2_mlb_games|pick2_mlb_players/i.test(migration))
check('model prediction untouched', !/pick2_model_|pick2_game_predictions|pick2_prediction_results|pick2_market_value_evaluations/i.test(migration))
check('team native index', /create unique index if not exists pick2_mlb_team_daily_features_native_uidx\s+on public\.pick2_mlb_team_daily_features \(target_game_pk, team_id, feature_date, feature_version\)\s+where target_game_pk is not null;/i.test(migration))
check('bullpen native index', /create unique index if not exists pick2_mlb_bullpen_daily_features_native_uidx\s+on public\.pick2_mlb_bullpen_daily_features \(target_game_pk, team_id, feature_date, feature_version\)\s+where target_game_pk is not null;/i.test(migration))
check('replacement uniqueness proven by r1', r1.flags.MLB_DATA_01D_R1_NATIVE_KEY_UNIQUENESS_PROOF === 'PASS')
check('resume projection preserved', r1.flags.MLB_DATA_01D_R1_RECOVERY_DRY_RUN === 'PASS' && r1.recoveryPlan.snapshots.reuses === 67433)
check('idempotency projected', r1.flags.MLB_DATA_01D_R1_PERSISTENCE_IDEMPOTENCY_PROJECTED === 'PASS')
check('feature definitions unchanged', r1.flags.MLB_DATA_01D_R1_FEATURE_DEFINITIONS_UNCHANGED === 'YES')
check('asof leakage preserved', r1.flags.MLB_DATA_01D_R1_ASOF_CONTRACT_PRESERVED === 'YES' && r1.flags.MLB_DATA_01D_R1_LEAKAGE_STATE === 'PASS')

const failures = checks.filter((item) => item.status !== 'PASS')
if (failures.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01d-r1a-feature-native-uniqueness-migration-validate', status: 'FAIL', failures }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  validator: 'mlb-data-01d-r1a-feature-native-uniqueness-migration-validate',
  status: 'PASS',
  migrationPath,
  classification: 'MLB_DATA_01D_R1A_FEATURE_NATIVE_UNIQUENESS_MIGRATION_CERTIFIED',
}, null, 2))
