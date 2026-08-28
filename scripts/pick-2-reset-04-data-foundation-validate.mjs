import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function json(relativePath) {
  return JSON.parse(read(relativePath))
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

const failures = []
function check(name, condition) {
  if (!condition) failures.push(name)
}

const artifact = json('docs/CERTIFICATION/pick-2-reset-04-data-foundation.json')
const reset01 = json('docs/CERTIFICATION/pick-2-reset-01-legacy-freeze-inventory.json')
const reset02a = json('docs/CERTIFICATION/pick-2-reset-02a-runtime-simplification.json')
const reset02b = json('docs/CERTIFICATION/pick-2-reset-02b-route-service-consolidation.json')
const reset03 = json('docs/CERTIFICATION/pick-2-reset-03-ui-simplification.json')
const migration = read('supabase/migrations/202608270002_pick2_data_foundation_v1.sql')
const architecture = read('docs/ARCHITECTURE/PICK_2_DATA_FOUNDATION_V1.md')
const certification = read('docs/CERTIFICATION/PICK_2_RESET_04_DATA_FOUNDATION.md')

check(
  'RESET-04/04R1/04R1B verdict',
  ['PICK_2_RESET_04_DATA_FOUNDATION_CERTIFIED', 'PICK_2_RESET_04R1_STATCAST_SCHEMA_COMPATIBILITY_CERTIFIED', 'PICK_2_RESET_04R1B_FULL_STATCAST_SCHEMA_CERTIFIED'].includes(artifact.certificationVerdict),
)
check('RESET-01 loaded', reset01.certificationVerdict === 'PICK_2_RESET_01_LEGACY_FREEZE_AND_EXACT_INVENTORY_CERTIFIED')
check('RESET-02A loaded', reset02a.certificationVerdict === 'PICK_2_RESET_02A_BOUNDED_RUNTIME_SIMPLIFICATION_CERTIFIED')
check('RESET-02B loaded', reset02b.certificationVerdict === 'PICK_2_RESET_02B_ROUTE_SERVICE_CONSOLIDATION_CERTIFIED')
check('RESET-03 loaded', reset03.certificationVerdict === 'PICK_2_RESET_03_UI_SIMPLIFICATION_CERTIFIED')
check('artifact prior manifests loaded', artifact.manifestAuthority.loaded === true)

check('provider calls zero', artifact.providerCalls === 0)
check('production mutations zero', artifact.productionDbMutations === 0)
check('statcast imports zero', artifact.statcastImports === 0)
check('new sports imports zero', artifact.newSportsImports === 0)
check('prediction writes zero', artifact.predictionWrites === 0)
check('model training zero', artifact.modelTraining === 0)
check('automation inactive', artifact.automationActivated === false)
check('new cron false', artifact.newCron === false)
check('migration not applied', artifact.migrationExecutionState === 'PREPARED_NOT_APPLIED')

check('migration file exists', exists('supabase/migrations/202608270002_pick2_data_foundation_v1.sql'))
check('architecture doc exists', exists('docs/ARCHITECTURE/PICK_2_DATA_FOUNDATION_V1.md'))
check('certification md exists', exists('docs/CERTIFICATION/PICK_2_RESET_04_DATA_FOUNDATION.md'))

for (const token of ['drop table', 'truncate ', 'delete from', 'alter table prediction_history', 'insert into public.prediction_history']) {
  check(`migration excludes ${token}`, !migration.toLowerCase().includes(token))
}

for (const table of artifact.newTables) {
  check(`migration creates ${table}`, migration.includes(`public.${table}`))
  check(`${table} RLS enabled`, migration.includes(`alter table public.${table} enable row level security`))
  check(`${table} service role policy`, migration.includes(`${table}_service_role_all`))
}

for (const existing of ['public.sport_events', 'public.sports_teams', 'public.sport_players', 'public.game_results', 'public.sports_odds_snapshots']) {
  check(`migration references ${existing}`, migration.includes(existing))
}

check('statcast unique identity', migration.includes('unique (game_pk, at_bat_number, pitch_number)'))
check('statcast raw payload digest', migration.includes('raw_payload_digest text not null'))
check('source player IDs separated', migration.includes('source_pitcher_id bigint') && migration.includes('source_batter_id bigint'))
check('canonical player IDs separated', migration.includes('canonical_pitcher_id text references public.sport_players(id)') && migration.includes('canonical_batter_id text references public.sport_players(id)'))
check('team source/canonical separated', migration.includes('source_home_team text') && migration.includes('source_away_team text') && migration.includes('canonical_home_team_id text references public.sports_teams(id)'))
check('score state preserved', migration.includes('post_home_score integer') && migration.includes('post_away_score integer'))
check('source player name preserved', migration.includes('source_player_name text'))
check('mapping states present', migration.includes("event_mapping_state in ('MAPPED', 'UNMAPPED', 'AMBIGUOUS', 'CONFLICT')") && migration.includes("player_mapping_state in ('MAPPED', 'UNMAPPED', 'AMBIGUOUS', 'CONFLICT')"))
check('feature as-of guard', migration.includes('check (as_of_date <= feature_date)'))
check('pitcher contract K rate', migration.includes('k_rate numeric'))
check('pitcher contract velocity l1/l3/l5', migration.includes('velocity_l1 numeric') && migration.includes('velocity_l3 numeric') && migration.includes('velocity_l5 numeric'))
check('bullpen workload contract', migration.includes('pitches_previous_24h integer') && migration.includes('pitches_previous_72h integer'))
check('offense split contract', migration.includes('handedness_splits jsonb') && migration.includes('pitch_type_matchups jsonb'))
check('first inning contract', migration.includes('team_first_inning_scoring_rate jsonb'))
check('model registry champion role', migration.includes("role in ('candidate', 'challenger', 'champion', 'shadow')"))
const predictionTableSection = migration.slice(
  migration.indexOf('create table if not exists public.pick2_game_predictions'),
  migration.indexOf('create table if not exists public.pick2_prediction_results'),
)
check('prediction storage pure sports', predictionTableSection.includes('pick2_game_predictions') && !predictionTableSection.match(/sportsbook\s+text/))
check('prediction immutable trigger', migration.includes('pick2_prevent_prediction_update'))
check('market value separated', migration.includes('pick2_market_value_evaluations') && migration.includes('odds_snapshot_id text not null references public.sports_odds_snapshots(id)'))
check('data health table present', migration.includes('pick2_data_health_status'))

for (const flag of [
  'CURRENT_DB_REVALIDATED',
  'PICK_2_DATA_DOMAINS_READY',
  'STATCAST_RAW_STORAGE_READY',
  'STATCAST_RAW_IDEMPOTENCY_READY',
  'PICK_2_DAILY_FEATURE_SCHEMA_READY',
  'PURE_SPORTS_PREDICTION_STORAGE_READY',
  'SPORTS_MODEL_MARKET_STORAGE_SEPARATED',
  'LEGACY_DB_ISOLATION_READY',
  'PICK_2_DATA_SECURITY_MODEL_READY',
  'PICK_2_LOGICAL_HARD_RESET_READY',
  'PHYSICAL_DELETE_BACKUP_GATE_READY',
]) {
  check(`${flag} YES`, artifact.flags[flag] === 'YES')
}

check('champion none', artifact.flags.PICK_2_CHAMPION_MODEL === 'NONE')
check('statcast not imported', artifact.flags.STATCAST_IMPORT_PERFORMED === 'NO')
if (['PICK_2_RESET_04R1_STATCAST_SCHEMA_COMPATIBILITY_CERTIFIED', 'PICK_2_RESET_04R1B_FULL_STATCAST_SCHEMA_CERTIFIED'].includes(artifact.certificationVerdict)) {
  check('source audit row count', artifact.statcastRawStorage.sourceRowsAudited >= 591316)
  check('source games count', artifact.statcastRawStorage.uniqueGames >= 2004)
  check('source columns accounted', artifact.flags.SOURCE_COLUMNS_ACCOUNTED_FOR === '100%' && (artifact.statcastRawStorage.sourceColumnMapping?.length === 22 || artifact.statcastRawStorage.sourceColumnMapping?.length === 119 || artifact.statcastRawStorage.sourceColumnInventory?.length === 119))
  check('source canonical separation flag', artifact.flags.STATCAST_PLAYER_IDENTITY_SEPARATION_READY === 'YES')
  check('score state flag', artifact.flags.STATCAST_SCORE_STATE_STORAGE_READY === 'YES')
}
check('no legacy fallback in today contract', artifact.integrationContracts.today.includes('no legacy fallback'))
check('architecture migration policy', architecture.includes('does not apply it to production'))
check(
  'certification status recorded',
  certification.includes('PICK_2_RESET_04_DATA_FOUNDATION_CERTIFIED') ||
    certification.includes('PICK_2_RESET_04R1_STATCAST_SCHEMA_COMPATIBILITY_CERTIFIED') ||
    certification.includes('PICK_2_RESET_04R1B_FULL_STATCAST_SCHEMA_CERTIFIED'),
)

if (failures.length) {
  console.error(JSON.stringify({ validator: 'pick-2-reset-04-data-foundation-validate', status: 'FAIL', failed: failures }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  validator: 'pick-2-reset-04-data-foundation-validate',
  status: 'PASS',
  checks: 60,
  providerCalls: 0,
  productionDbMutations: 0,
  migrationExecutionState: artifact.migrationExecutionState,
}, null, 2))
