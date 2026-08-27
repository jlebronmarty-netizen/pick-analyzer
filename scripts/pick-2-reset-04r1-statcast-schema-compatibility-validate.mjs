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
const doc = read('docs/CERTIFICATION/PICK_2_RESET_04_DATA_FOUNDATION.md')

check('verdict', artifact.certificationVerdict === 'PICK_2_RESET_04R1_STATCAST_SCHEMA_COMPATIBILITY_CERTIFIED')
check('safe to repair pre-apply', artifact.foundationMigrationSafeToRepairPreApply === true && artifact.flags.FOUNDATION_MIGRATION_SAFE_TO_REPAIR_PRE_APPLY === 'YES')
check('migration unapplied', artifact.migrationExecutionState === 'PREPARED_NOT_APPLIED')
check('source audit cardinality', artifact.statcastRawStorage.sourceRowsAudited === 591316 && artifact.statcastRawStorage.uniqueGames === 2004 && artifact.statcastRawStorage.teams === 30)
check('source audit date range', artifact.statcastRawStorage.dateRange.from === '2026-03-25' && artifact.statcastRawStorage.dateRange.through === '2026-08-26')
check('duplicate identities zero', artifact.statcastRawStorage.duplicateIdentities === 0)
check('source columns accounted', artifact.statcastRawStorage.sourceColumnsAccountedFor === '100%' && artifact.statcastRawStorage.sourceColumnMapping.length === 22)

const expectedColumns = [
  'game_pk',
  'game_date',
  'home_team',
  'away_team',
  'pitcher',
  'batter',
  'player_name',
  'pitch_type',
  'release_speed',
  'p_throws',
  'stand',
  'balls',
  'strikes',
  'outs_when_up',
  'events',
  'description',
  'inning',
  'inning_topbot',
  'at_bat_number',
  'pitch_number',
  'post_home_score',
  'post_away_score',
]

for (const sourceColumn of expectedColumns) {
  check(`source column mapped ${sourceColumn}`, artifact.statcastRawStorage.sourceColumnMapping.some((row) => row.sourceColumn === sourceColumn))
}

for (const token of [
  'source_home_team text',
  'source_away_team text',
  'canonical_home_team_id text references public.sports_teams(id)',
  'canonical_away_team_id text references public.sports_teams(id)',
  'source_pitcher_id bigint',
  'source_batter_id bigint',
  'canonical_pitcher_id text references public.sport_players(id)',
  'canonical_batter_id text references public.sport_players(id)',
  'source_player_name text',
  'post_home_score integer',
  'post_away_score integer',
  'mapping_metadata jsonb',
  'unique (game_pk, at_bat_number, pitch_number)',
]) {
  check(`migration contains ${token}`, migration.includes(token))
}

for (const forbidden of ['drop table', 'truncate ', 'delete from', 'insert into public.pick2_raw_mlb_statcast_pitches', 'update public.prediction_history']) {
  check(`migration excludes ${forbidden}`, !migration.toLowerCase().includes(forbidden))
}

check('source/canonical distinction documented', architecture.includes('Source identities and Pick identities are deliberately separate'))
check('label feature boundary documented', architecture.includes('must never become pregame features for the same game'))
check('unsupported feature boundary', artifact.statcastRawStorage.unsupportedCoreFeatures.includes('launch_speed') && doc.includes('launch_speed'))
check('F5 separation', artifact.flags.F5_LABEL_FEATURE_SEPARATION_CERTIFIED === 'YES')
check('NRFI YRFI separation', artifact.flags.NRFI_YRFI_LABEL_FEATURE_SEPARATION_CERTIFIED === 'YES')
check('pure totals contract', artifact.flags.PURE_TOTALS_MODEL_CONTRACT_READY === 'YES')
check('pure moneyline contract', artifact.flags.PURE_MONEYLINE_MODEL_CONTRACT_READY === 'YES')
check('monte carlo downstream', artifact.flags.MONTE_CARLO_DOWNSTREAM_CONTRACT_READY === 'YES')
check('as-of leakage guard', artifact.flags.STATCAST_AS_OF_LEAKAGE_GUARD_READY === 'YES')
check('game mapping contract', artifact.flags.STATCAST_GAME_MAPPING_CONTRACT_READY === 'YES')
check('player mapping contract', artifact.flags.STATCAST_PLAYER_MAPPING_CONTRACT_READY === 'YES')
check('batch ingest contract', artifact.flags.STATCAST_BATCH_INGEST_CONTRACT_READY === 'YES')
check('multi season ready', artifact.flags.MULTI_SEASON_STATCAST_STORAGE_READY === 'YES')
check('provider calls zero', artifact.providerCalls === 0)
check('production mutations zero', artifact.productionDbMutations === 0)
check('statcast import zero', artifact.flags.STATCAST_IMPORT_PERFORMED === 'NO')

const combined = [migration, architecture, doc, JSON.stringify(artifact)].join('\n')
check('secret scan', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test(combined))

if (failures.length) {
  console.error(JSON.stringify({ validator: 'pick-2-reset-04r1-statcast-schema-compatibility-validate', status: 'FAIL', failed: failures }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  validator: 'pick-2-reset-04r1-statcast-schema-compatibility-validate',
  status: 'PASS',
  sourceColumnsAccountedFor: '100%',
  providerCalls: 0,
  productionDbMutations: 0,
  migrationExecutionState: artifact.migrationExecutionState,
}, null, 2))
