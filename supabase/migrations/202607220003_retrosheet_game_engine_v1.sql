create table if not exists historical_baseball_games (
  id text primary key,
  canonical_game_id text not null unique,
  source_game_id text not null,
  import_id uuid references historical_import_registry(id),
  source_registry_id text references historical_source_registry(id),
  source text not null,
  sport_key text not null,
  league_key text not null,
  season text not null,
  game_date date,
  game_number text,
  home_team text,
  away_team text,
  canonical_home_team text,
  canonical_away_team text,
  venue text,
  start_time_local text,
  day_night text,
  designated_hitter boolean,
  attendance integer,
  weather jsonb not null default '{}'::jsonb,
  umpires jsonb not null default '{}'::jsonb,
  winning_pitcher_source_id text,
  losing_pitcher_source_id text,
  save_pitcher_source_id text,
  final_score jsonb not null default '{}'::jsonb,
  duration_minutes integer,
  innings integer,
  parser_version text not null,
  game_engine_version text not null,
  checksum_sha256 text not null,
  validation_status text not null,
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  source_lineage jsonb not null default '{}'::jsonb,
  historical_only boolean not null default true,
  postgame_known boolean not null default true,
  training_eligible boolean not null default false,
  pregame_eligible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (validation_status in ('VALID', 'VALID_WITH_WARNINGS', 'QUARANTINED'))
);

create index if not exists historical_baseball_games_date_idx
  on historical_baseball_games (sport_key, league_key, season, game_date);

create table if not exists historical_baseball_lineups (
  id text primary key,
  canonical_game_id text not null references historical_baseball_games(canonical_game_id),
  player_source_id text not null,
  canonical_player_id text not null,
  player_name text,
  team_side text not null,
  batting_order integer not null,
  field_position integer not null,
  starter boolean not null default false,
  entry_inning integer,
  entry_half text,
  exit_inning integer,
  exit_half text,
  source_line integer not null,
  source_lineage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (team_side in ('away', 'home')),
  check (entry_half in ('top', 'bottom') or entry_half is null),
  check (exit_half in ('top', 'bottom') or exit_half is null)
);

create index if not exists historical_baseball_lineups_game_idx
  on historical_baseball_lineups (canonical_game_id, team_side, batting_order);

create table if not exists historical_baseball_substitutions (
  id text primary key,
  canonical_game_id text not null references historical_baseball_games(canonical_game_id),
  player_source_id text not null,
  canonical_player_id text not null,
  player_name text,
  team_side text not null,
  batting_order integer not null,
  field_position integer not null,
  classification text not null,
  entry_inning integer not null,
  entry_half text not null,
  source_line integer not null,
  source_lineage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (classification in ('pitching_change', 'pinch_hitter', 'pinch_runner', 'defensive_replacement', 'position_switch'))
);

create table if not exists historical_baseball_plays (
  id text primary key,
  canonical_game_id text not null references historical_baseball_games(canonical_game_id),
  inning integer not null,
  half text not null,
  batter_source_id text not null,
  pitcher_source_id text,
  count_text text,
  pitch_sequence text,
  play_description text not null,
  raw_event text not null,
  parsed_event jsonb not null default '{}'::jsonb,
  runs integer not null default 0,
  outs integer not null default 0,
  score_after jsonb not null default '{}'::jsonb,
  base_state_before jsonb not null default '{}'::jsonb,
  base_state_after jsonb not null default '{}'::jsonb,
  source_line integer not null,
  source_lineage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (half in ('top', 'bottom'))
);

create index if not exists historical_baseball_plays_game_idx
  on historical_baseball_plays (canonical_game_id, inning, half, source_line);

create table if not exists historical_baseball_pitcher_appearances (
  id text primary key,
  canonical_game_id text not null references historical_baseball_games(canonical_game_id),
  pitcher_source_id text not null,
  canonical_pitcher_id text not null,
  pitcher_name text,
  team_side text not null,
  starter boolean not null default false,
  role text not null,
  entry_inning integer not null,
  entry_half text not null,
  exit_inning integer,
  exit_half text,
  outs integer not null default 0,
  batters_faced integer not null default 0,
  hits integer not null default 0,
  walks integer not null default 0,
  strikeouts integer not null default 0,
  runs integer not null default 0,
  pitch_count integer,
  decision text,
  source_line integer not null,
  source_lineage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (team_side in ('away', 'home')),
  check (role in ('starter', 'reliever')),
  check (decision in ('win', 'loss', 'save') or decision is null)
);

create table if not exists historical_baseball_batter_appearances (
  id text primary key,
  canonical_game_id text not null references historical_baseball_games(canonical_game_id),
  batter_source_id text not null,
  canonical_batter_id text not null,
  pitcher_source_id text,
  inning integer not null,
  half text not null,
  plate_appearance boolean not null default true,
  at_bat boolean not null default false,
  hit boolean not null default false,
  single_hit boolean not null default false,
  double_hit boolean not null default false,
  triple_hit boolean not null default false,
  home_run boolean not null default false,
  walk boolean not null default false,
  strikeout boolean not null default false,
  stolen_base boolean not null default false,
  caught_stealing boolean not null default false,
  grounded_into_double_play boolean not null default false,
  runs integer not null default 0,
  rbi integer,
  source_line integer not null,
  source_lineage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (half in ('top', 'bottom'))
);

grant all privileges on table historical_baseball_games to service_role;
grant all privileges on table historical_baseball_lineups to service_role;
grant all privileges on table historical_baseball_substitutions to service_role;
grant all privileges on table historical_baseball_plays to service_role;
grant all privileges on table historical_baseball_pitcher_appearances to service_role;
grant all privileges on table historical_baseball_batter_appearances to service_role;

grant select on table historical_baseball_games to authenticated;
grant select on table historical_baseball_lineups to authenticated;
grant select on table historical_baseball_substitutions to authenticated;
grant select on table historical_baseball_plays to authenticated;
grant select on table historical_baseball_pitcher_appearances to authenticated;
grant select on table historical_baseball_batter_appearances to authenticated;
