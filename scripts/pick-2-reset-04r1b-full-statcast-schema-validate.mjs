import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const json = (relativePath) => JSON.parse(read(relativePath))

const failures = []
const check = (name, condition) => {
  if (!condition) failures.push(name)
}

const artifact = json('docs/CERTIFICATION/pick-2-reset-04-data-foundation.json')
const migration = read('supabase/migrations/202608270002_pick2_data_foundation_v1.sql')
const architecture = read('docs/ARCHITECTURE/PICK_2_DATA_FOUNDATION_V1.md')
const certification = read('docs/CERTIFICATION/PICK_2_RESET_04_DATA_FOUNDATION.md')

check('R1B verdict', artifact.certificationVerdict === 'PICK_2_RESET_04R1B_FULL_STATCAST_SCHEMA_CERTIFIED')
check('R1 commit preserved', artifact.r1Commit === 'e9dc6706c880b2f206259864693d94cb6e51b6c3')
check('migration unapplied', artifact.migrationExecutionState === 'PREPARED_NOT_APPLIED' && artifact.flags.PICK_2_FOUNDATION_MIGRATION_APPLIED === 'NO')
check('pre-apply repair safe', artifact.foundationMigrationSafeToRepairPreApply === true && artifact.flags.FULL_SCHEMA_PRE_APPLY_REPAIR_SAFE === 'YES')

const storage = artifact.statcastRawStorage
check('2025 audit', storage.seasonAudits['2025'].pitches === 712528 && storage.seasonAudits['2025'].games === 2430 && storage.seasonAudits['2025'].schemaColumns === 119)
check('2026 audit', storage.seasonAudits['2026'].pitches === 591316 && storage.seasonAudits['2026'].games === 2004 && storage.seasonAudits['2026'].schemaColumns === 119)
check('combined audit', storage.combinedAudit.pitches === 1303844 && storage.combinedAudit.games === 4434 && storage.combinedAudit.schemaCompatibility === 'PASS')
const sourceColumnInventory = storage.sourceColumnInventory || storage.sourceColumnMapping?.map((row) => row.sourceColumn) || []
check('119 inventory', sourceColumnInventory.length === 119 && new Set(sourceColumnInventory).size === 119)
check('source columns accounted', storage.sourceColumnsAccountedFor === '100%' && artifact.flags.FULL_SOURCE_COLUMNS_ACCOUNTED_FOR === '100%')

for (const sourceColumn of [
  'game_pk',
  'game_date',
  'game_year',
  'game_type',
  'home_team',
  'away_team',
  'pitcher',
  'batter',
  'player_name',
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
  'arm_angle',
  'pfx_x',
  'pfx_z',
  'plate_x',
  'plate_z',
  'zone',
  'vx0',
  'vy0',
  'vz0',
  'ax',
  'ay',
  'az',
  'api_break_z_with_gravity',
  'api_break_x_arm',
  'api_break_x_batter_in',
  'launch_speed',
  'launch_angle',
  'estimated_ba_using_speedangle',
  'estimated_woba_using_speedangle',
  'estimated_slg_using_speedangle',
  'launch_speed_angle',
  'hit_distance_sc',
  'bb_type',
  'hit_location',
  'hc_x',
  'hc_y',
  'bat_speed',
  'swing_length',
  'attack_angle',
  'attack_direction',
  'swing_path_tilt',
  'home_score',
  'away_score',
  'post_home_score',
  'post_away_score',
  'post_bat_score',
  'post_fld_score',
]) {
  check(`source inventory contains ${sourceColumn}`, sourceColumnInventory.includes(sourceColumn))
}

for (const row of storage.sourceColumnMapping || []) {
  for (const field of ['sourceColumn', 'sourceType', 'nullability2025', 'nullability2026', 'semantics', 'category', 'rawDestination', 'featureUse', 'labelUse', 'leakageRisk', 'indexPriority']) {
    check(`column classification ${row.sourceColumn} has ${field}`, Object.hasOwn(row, field))
  }
}

for (const sqlColumn of storage.explicitRawColumns) {
  check(`migration contains explicit raw column ${sqlColumn}`, migration.includes(`${sqlColumn} `))
}

for (const token of [
  'raw_payload jsonb not null',
  'raw_payload_digest text not null',
  'unique (game_pk, at_bat_number, pitch_number)',
  'source_pitcher_id bigint',
  'source_batter_id bigint',
  'canonical_pitcher_id text references public.sport_players(id)',
  'canonical_batter_id text references public.sport_players(id)',
  'source_home_team text',
  'source_away_team text',
  'canonical_home_team_id text references public.sports_teams(id)',
  'canonical_away_team_id text references public.sports_teams(id)',
  'check (home_score is null or home_score >= 0)',
  'check (post_home_score is null or post_home_score >= 0)',
]) {
  check(`migration contains ${token}`, migration.includes(token))
}

for (const forbidden of ['drop table', 'truncate ', 'delete from', 'insert into public.pick2_raw_mlb_statcast_pitches', 'insert into public.prediction_history', 'update public.prediction_history']) {
  check(`migration excludes ${forbidden}`, !migration.toLowerCase().includes(forbidden))
}

for (const supported of [
  'launch_speed',
  'launch_angle',
  'estimated_woba_using_speedangle',
  'release_spin_rate',
  'spin_axis',
  'plate_x',
  'plate_z',
  'pfx_x',
  'pfx_z',
  'release_extension',
  'arm_angle',
  'bat_speed',
  'swing_length',
  'attack_angle',
]) {
  check(`advanced support ${supported}`, storage.supportedAdvancedFields.includes(supported) && migration.includes(`${supported} `))
}

check('barrel derived only', storage.derivedOnlyFields.includes('barrel') && storage.derivedOnlyFields.includes('HardHit%'))
check('deprecated empty policy', storage.deprecatedEmptyFields.length === 8 && artifact.flags.DEPRECATED_EMPTY_COLUMN_POLICY_READY === 'YES')

for (const denied of [
  'home_score',
  'away_score',
  'post_home_score',
  'post_away_score',
  'bat_score',
  'fld_score',
  'post_bat_score',
  'post_fld_score',
  'home_win_exp',
  'bat_win_exp',
  'delta_home_win_exp',
  'delta_run_exp',
  'delta_pitcher_run_exp',
  'pitcher_days_until_next_game',
  'batter_days_until_next_game',
]) {
  check(`pregame denylist ${denied}`, storage.pregameDenylist.includes(denied))
}

check('label contract full game', artifact.labelContracts.fullGame.includes('FULL_GAME_WINNER'))
check('label contract F5', artifact.labelContracts.firstFive.includes('F5_TIE'))
check('label contract NRFI', artifact.labelContracts.firstInning.includes('NRFI'))
check('model foundations', artifact.modelFoundations.f5 === 'READY' && artifact.modelFoundations.nrfiYrfi === 'READY' && artifact.modelFoundations.monteCarlo === 'DOWNSTREAM_READY')
check('as-of leakage flag', artifact.flags.MULTI_SEASON_AS_OF_LEAKAGE_CONTRACT === 'PASS')
check('single table', artifact.flags.SINGLE_MULTI_SEASON_RAW_TABLE_READY === 'YES' && !migration.includes('pick2_statcast_2025') && !migration.includes('pick2_statcast_2026'))
check('scale strategy', artifact.flags.STATCAST_INITIAL_SCALE_STRATEGY_READY === 'YES')
check('raw schema v1', artifact.flags.STATCAST_RAW_SCHEMA_V1_READY === 'YES' && storage.sourceSchemaVersion === 'STATCAST_RAW_SCHEMA_V1')
check('reset 05 blocked', artifact.reset05State === 'BLOCKED_PENDING_FINAL_MIGRATION_PUBLICATION_AND_APPLY')
check('no import', artifact.flags.STATCAST_IMPORT_PERFORMED === 'NO' && artifact.statcastImports === 0)
check('provider calls zero', artifact.providerCalls === 0)
check('production mutations zero', artifact.productionDbMutations === 0)
check('automation off', artifact.automationActivated === false && artifact.flags.AUTOMATION_ACTIVATED === 'NO')
check('architecture updated', architecture.includes('complete 119-column original Baseball Savant row') && architecture.includes('same-target-game pregame denylist'))
check('certification updated', certification.includes('PICK_2_RESET_04R1B_FULL_STATCAST_SCHEMA_CERTIFIED') && certification.includes('All 119 source columns are accounted for'))

const combined = [migration, architecture, certification, JSON.stringify(artifact)].join('\n')
check('secret scan', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test(combined))

if (failures.length) {
  console.error(JSON.stringify({ validator: 'pick-2-reset-04r1b-full-statcast-schema-validate', status: 'FAIL', failed: failures }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  validator: 'pick-2-reset-04r1b-full-statcast-schema-validate',
  status: 'PASS',
  sourceColumns: sourceColumnInventory.length,
  sourceColumnsAccountedFor: storage.sourceColumnsAccountedFor,
  providerCalls: artifact.providerCalls,
  productionDbMutations: artifact.productionDbMutations,
  migrationExecutionState: artifact.migrationExecutionState,
}, null, 2))
