import fs from 'node:fs'

const migrationPath = 'supabase/migrations/202608290001_pick2_mlb_native_identity_foundation_v1.sql'
const migration = fs.readFileSync(migrationPath, 'utf8')
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

function has(value) {
  return migration.includes(value)
}

for (const forbidden of [
  /\bdrop\s+table\b/i,
  /\btruncate\b/i,
  /\bdelete\s+from\b/i,
  /\bdrop\s+column\b/i,
  /\binsert\s+into\b/i,
  /\bupdate\s+public\./i,
  /sportsdataio[_\s-]*(game|player)?id/i,
  /SPORTSDATAIO_MLB_API_KEY/,
  /api\.sportsdata\.io/i,
  /fetch\s*\(/,
]) {
  check(`forbidden pattern absent: ${forbidden}`, !forbidden.test(migration))
}

check('transaction bounded', migration.trim().toLowerCase().startsWith('begin;') && migration.trim().toLowerCase().endsWith('commit;'))
check('game registry table', has('create table if not exists public.pick2_mlb_games') && has('game_pk bigint primary key') && has('legacy_sport_event_id text references public.sport_events(id)'))
check('game constraints', has('check (game_pk > 0)') && has('home_team_id text references public.sports_teams(id)') && has('away_team_id text references public.sports_teams(id)'))
check('player registry table', has('create table if not exists public.pick2_mlb_players') && has('mlbam_person_id bigint primary key') && has('legacy_sport_player_id text references public.sport_players(id)'))
check('player constraints', has('check (mlbam_person_id > 0)') && !/unique\s*\([^)]*name/i.test(migration))
check('native result adapter', has('create table if not exists public.pick2_mlb_game_results') && has('legacy_game_result_id uuid references public.game_results(id)'))
check('market mapping table', has('create table if not exists public.pick2_mlb_market_event_mappings') && has('unique (market_provider, provider_event_id)') && has('unique (market_provider, game_pk)'))
check('raw native columns', has('alter table public.pick2_raw_mlb_statcast_pitches') && has('add column if not exists mlbam_pitcher_id bigint') && has('add column if not exists mlbam_batter_id bigint'))
check('feature snapshot native columns', has('alter table public.pick2_feature_snapshots') && has('add column if not exists target_game_pk bigint') && has('add column if not exists mlbam_person_id bigint'))
check('pitcher feature native columns and legacy relaxation', has('alter table public.pick2_mlb_pitcher_daily_features') && has('add column if not exists mlbam_pitcher_id bigint') && has('alter column player_id drop not null'))
check('batter feature native columns and legacy relaxation', has('alter table public.pick2_mlb_batter_daily_features') && has('add column if not exists mlbam_batter_id bigint') && has('alter column player_id drop not null'))
check('team feature native target', has('alter table public.pick2_mlb_team_daily_features') && has('pick2_mlb_team_daily_features_native_uidx'))
check('bullpen feature native target', has('alter table public.pick2_mlb_bullpen_daily_features') && has('mlbam_pitcher_ids bigint[]'))
check('matchup feature native target and legacy relaxation', has('alter table public.pick2_mlb_matchup_daily_features') && has('mlbam_pitcher_id bigint') && has('mlbam_batter_id bigint') && has('alter column event_id drop not null'))
check('first inning native target and legacy relaxation', has('alter table public.pick2_mlb_first_inning_daily_features') && has('home_starter_mlbam_pitcher_id') && has('away_starter_mlbam_pitcher_id') && has('expected_lineup_mlbam_batter_ids') && has('alter column event_id drop not null'))
check('prediction native game id and legacy relaxation', has('alter table public.pick2_game_predictions') && has('add column if not exists game_pk bigint') && has('pick2_game_predictions_game_pk_idx') && has('alter column event_id drop not null'))
check('prediction result native game id', has('alter table public.pick2_prediction_results') && has('add column if not exists game_pk bigint') && has('pick2_prediction_results_game_pk_idx'))
for (const table of ['pick2_mlb_games', 'pick2_mlb_players', 'pick2_mlb_game_results', 'pick2_mlb_market_event_mappings']) {
  check(`${table} RLS enabled`, has(`alter table public.${table} enable row level security`))
  check(`${table} service role policy`, has(`create policy ${table}_service_role_all`))
  check(`${table} service role grant`, has(`grant all on public.${table} to service_role`))
}

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01c-r5-native-migration-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01c-r5-native-migration-validate',
    status: 'PASS',
    migration: migrationPath,
    R5_NATIVE_MIGRATION_ADDITIVE_ONLY: 'YES',
    R5_NATIVE_MIGRATION_FAILURE_SAFETY_READY: 'YES',
  }, null, 2))
}
