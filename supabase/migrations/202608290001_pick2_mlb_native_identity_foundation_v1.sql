begin;

create extension if not exists pgcrypto;

create table if not exists public.pick2_mlb_games (
  game_pk bigint primary key,
  season integer,
  game_date date,
  scheduled_at timestamptz,
  home_team_id text references public.sports_teams(id),
  away_team_id text references public.sports_teams(id),
  game_type text,
  official_status text,
  doubleheader text,
  game_number integer,
  source text not null default 'mlb_official',
  source_payload_digest text,
  legacy_sport_event_id text references public.sport_events(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (game_pk > 0),
  check (game_number is null or game_number > 0)
);

create table if not exists public.pick2_mlb_players (
  mlbam_person_id bigint primary key,
  full_name text,
  first_name text,
  last_name text,
  primary_position text,
  bat_side text,
  throw_side text,
  active boolean,
  first_seen_date date,
  last_seen_date date,
  source text not null default 'mlb_official',
  source_payload_digest text,
  legacy_sport_player_id text references public.sport_players(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (mlbam_person_id > 0)
);

create table if not exists public.pick2_mlb_game_results (
  game_pk bigint primary key references public.pick2_mlb_games(game_pk),
  final_home_score integer,
  final_away_score integer,
  winner_team_id text references public.sports_teams(id),
  official_status text,
  completed_at timestamptz,
  result_source text not null default 'mlb_official',
  source_payload_digest text,
  legacy_game_result_id uuid references public.game_results(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (game_pk > 0),
  check (final_home_score is null or final_home_score >= 0),
  check (final_away_score is null or final_away_score >= 0)
);

create table if not exists public.pick2_mlb_market_event_mappings (
  id uuid primary key default gen_random_uuid(),
  game_pk bigint not null references public.pick2_mlb_games(game_pk),
  market_provider text not null,
  provider_event_id text not null,
  market_sport_key text not null default 'baseball_mlb',
  matched_at timestamptz not null default timezone('utc', now()),
  evidence jsonb not null default '{}'::jsonb,
  mapping_version text not null default 'R5_NATIVE_IDENTITY_FOUNDATION_V1',
  source_payload_digest text,
  legacy_sport_event_id text references public.sport_events(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (market_provider, provider_event_id),
  unique (market_provider, game_pk),
  check (game_pk > 0),
  check (length(trim(market_provider)) > 0),
  check (length(trim(provider_event_id)) > 0)
);

alter table public.pick2_raw_mlb_statcast_pitches
  add column if not exists mlbam_pitcher_id bigint,
  add column if not exists mlbam_batter_id bigint;

alter table public.pick2_raw_mlb_statcast_pitches
  add constraint pick2_raw_mlb_statcast_pitches_mlbam_pitcher_id_positive check (mlbam_pitcher_id is null or mlbam_pitcher_id > 0) not valid,
  add constraint pick2_raw_mlb_statcast_pitches_mlbam_batter_id_positive check (mlbam_batter_id is null or mlbam_batter_id > 0) not valid;

alter table public.pick2_feature_snapshots
  add column if not exists target_game_pk bigint,
  add column if not exists mlbam_person_id bigint,
  add column if not exists mlbam_pitcher_id bigint,
  add column if not exists mlbam_batter_id bigint,
  add column if not exists native_identity_metadata jsonb not null default '{}'::jsonb;

alter table public.pick2_feature_snapshots
  add constraint pick2_feature_snapshots_target_game_pk_positive check (target_game_pk is null or target_game_pk > 0) not valid,
  add constraint pick2_feature_snapshots_mlbam_person_id_positive check (mlbam_person_id is null or mlbam_person_id > 0) not valid,
  add constraint pick2_feature_snapshots_mlbam_pitcher_id_positive check (mlbam_pitcher_id is null or mlbam_pitcher_id > 0) not valid,
  add constraint pick2_feature_snapshots_mlbam_batter_id_positive check (mlbam_batter_id is null or mlbam_batter_id > 0) not valid;

alter table public.pick2_mlb_pitcher_daily_features
  add column if not exists target_game_pk bigint,
  add column if not exists mlbam_pitcher_id bigint;

alter table public.pick2_mlb_pitcher_daily_features
  alter column player_id drop not null,
  add constraint pick2_mlb_pitcher_daily_features_target_game_pk_positive check (target_game_pk is null or target_game_pk > 0) not valid,
  add constraint pick2_mlb_pitcher_daily_features_mlbam_pitcher_id_positive check (mlbam_pitcher_id is null or mlbam_pitcher_id > 0) not valid;

alter table public.pick2_mlb_batter_daily_features
  add column if not exists target_game_pk bigint,
  add column if not exists mlbam_batter_id bigint;

alter table public.pick2_mlb_batter_daily_features
  alter column player_id drop not null,
  add constraint pick2_mlb_batter_daily_features_target_game_pk_positive check (target_game_pk is null or target_game_pk > 0) not valid,
  add constraint pick2_mlb_batter_daily_features_mlbam_batter_id_positive check (mlbam_batter_id is null or mlbam_batter_id > 0) not valid;

alter table public.pick2_mlb_team_daily_features
  add column if not exists target_game_pk bigint;

alter table public.pick2_mlb_team_daily_features
  add constraint pick2_mlb_team_daily_features_target_game_pk_positive check (target_game_pk is null or target_game_pk > 0) not valid;

alter table public.pick2_mlb_bullpen_daily_features
  add column if not exists target_game_pk bigint,
  add column if not exists mlbam_pitcher_ids bigint[] not null default '{}'::bigint[];

alter table public.pick2_mlb_bullpen_daily_features
  add constraint pick2_mlb_bullpen_daily_features_target_game_pk_positive check (target_game_pk is null or target_game_pk > 0) not valid;

alter table public.pick2_mlb_matchup_daily_features
  add column if not exists target_game_pk bigint,
  add column if not exists mlbam_pitcher_id bigint,
  add column if not exists mlbam_batter_id bigint;

alter table public.pick2_mlb_matchup_daily_features
  alter column event_id drop not null,
  add constraint pick2_mlb_matchup_daily_features_target_game_pk_positive check (target_game_pk is null or target_game_pk > 0) not valid,
  add constraint pick2_mlb_matchup_daily_features_mlbam_pitcher_id_positive check (mlbam_pitcher_id is null or mlbam_pitcher_id > 0) not valid,
  add constraint pick2_mlb_matchup_daily_features_mlbam_batter_id_positive check (mlbam_batter_id is null or mlbam_batter_id > 0) not valid;

alter table public.pick2_mlb_first_inning_daily_features
  add column if not exists target_game_pk bigint,
  add column if not exists home_starter_mlbam_pitcher_id bigint,
  add column if not exists away_starter_mlbam_pitcher_id bigint,
  add column if not exists expected_lineup_mlbam_batter_ids bigint[] not null default '{}'::bigint[];

alter table public.pick2_mlb_first_inning_daily_features
  alter column event_id drop not null,
  add constraint pick2_mlb_first_inning_daily_features_target_game_pk_positive check (target_game_pk is null or target_game_pk > 0) not valid,
  add constraint pick2_mlb_first_inning_daily_features_home_starter_mlbam_positive check (home_starter_mlbam_pitcher_id is null or home_starter_mlbam_pitcher_id > 0) not valid,
  add constraint pick2_mlb_first_inning_daily_features_away_starter_mlbam_positive check (away_starter_mlbam_pitcher_id is null or away_starter_mlbam_pitcher_id > 0) not valid;

alter table public.pick2_game_predictions
  add column if not exists game_pk bigint;

alter table public.pick2_game_predictions
  alter column event_id drop not null,
  add constraint pick2_game_predictions_game_pk_positive check (game_pk is null or game_pk > 0) not valid;

alter table public.pick2_prediction_results
  add column if not exists game_pk bigint,
  add column if not exists result_source text,
  add column if not exists source_payload_digest text;

alter table public.pick2_prediction_results
  add constraint pick2_prediction_results_game_pk_positive check (game_pk is null or game_pk > 0) not valid;

create index if not exists pick2_mlb_games_season_game_date_idx
  on public.pick2_mlb_games (season, game_date);

create index if not exists pick2_mlb_games_legacy_sport_event_idx
  on public.pick2_mlb_games (legacy_sport_event_id)
  where legacy_sport_event_id is not null;

create index if not exists pick2_mlb_players_name_idx
  on public.pick2_mlb_players (last_name, first_name)
  where last_name is not null;

create index if not exists pick2_mlb_players_legacy_sport_player_idx
  on public.pick2_mlb_players (legacy_sport_player_id)
  where legacy_sport_player_id is not null;

create index if not exists pick2_raw_mlb_statcast_pitches_mlbam_pitcher_idx
  on public.pick2_raw_mlb_statcast_pitches (mlbam_pitcher_id, game_date)
  where mlbam_pitcher_id is not null;

create index if not exists pick2_raw_mlb_statcast_pitches_mlbam_batter_idx
  on public.pick2_raw_mlb_statcast_pitches (mlbam_batter_id, game_date)
  where mlbam_batter_id is not null;

create index if not exists pick2_feature_snapshots_native_game_idx
  on public.pick2_feature_snapshots (sport_key, feature_domain, target_game_pk, feature_date desc)
  where target_game_pk is not null;

create index if not exists pick2_feature_snapshots_native_person_idx
  on public.pick2_feature_snapshots (sport_key, feature_domain, mlbam_person_id, feature_date desc)
  where mlbam_person_id is not null;

create unique index if not exists pick2_mlb_pitcher_daily_features_native_uidx
  on public.pick2_mlb_pitcher_daily_features (target_game_pk, mlbam_pitcher_id, feature_date, feature_version)
  where target_game_pk is not null and mlbam_pitcher_id is not null;

create unique index if not exists pick2_mlb_batter_daily_features_native_uidx
  on public.pick2_mlb_batter_daily_features (target_game_pk, mlbam_batter_id, feature_date, feature_version)
  where target_game_pk is not null and mlbam_batter_id is not null;

create unique index if not exists pick2_mlb_team_daily_features_native_uidx
  on public.pick2_mlb_team_daily_features (target_game_pk, team_id, feature_date, feature_version)
  where target_game_pk is not null;

create unique index if not exists pick2_mlb_bullpen_daily_features_native_uidx
  on public.pick2_mlb_bullpen_daily_features (target_game_pk, team_id, feature_date, feature_version)
  where target_game_pk is not null;

create unique index if not exists pick2_mlb_matchup_daily_features_native_uidx
  on public.pick2_mlb_matchup_daily_features (target_game_pk, feature_date, feature_version)
  where target_game_pk is not null;

create unique index if not exists pick2_mlb_first_inning_daily_features_native_uidx
  on public.pick2_mlb_first_inning_daily_features (target_game_pk, feature_date, feature_version)
  where target_game_pk is not null;

create index if not exists pick2_game_predictions_game_pk_idx
  on public.pick2_game_predictions (sport_key, game_pk, predicted_at desc)
  where game_pk is not null;

create index if not exists pick2_prediction_results_game_pk_idx
  on public.pick2_prediction_results (game_pk, evaluated_at desc)
  where game_pk is not null;

create index if not exists pick2_mlb_game_results_status_idx
  on public.pick2_mlb_game_results (official_status, completed_at desc);

create index if not exists pick2_mlb_market_event_mappings_game_idx
  on public.pick2_mlb_market_event_mappings (game_pk, market_provider);

alter table public.pick2_mlb_games enable row level security;
alter table public.pick2_mlb_players enable row level security;
alter table public.pick2_mlb_game_results enable row level security;
alter table public.pick2_mlb_market_event_mappings enable row level security;

create policy pick2_mlb_games_service_role_all on public.pick2_mlb_games for all to service_role using (true) with check (true);
create policy pick2_mlb_players_service_role_all on public.pick2_mlb_players for all to service_role using (true) with check (true);
create policy pick2_mlb_game_results_service_role_all on public.pick2_mlb_game_results for all to service_role using (true) with check (true);
create policy pick2_mlb_market_event_mappings_service_role_all on public.pick2_mlb_market_event_mappings for all to service_role using (true) with check (true);

grant select on public.pick2_mlb_games to authenticated;
grant select on public.pick2_mlb_players to authenticated;
grant select on public.pick2_mlb_game_results to authenticated;
grant select on public.pick2_mlb_market_event_mappings to authenticated;

grant all on public.pick2_mlb_games to service_role;
grant all on public.pick2_mlb_players to service_role;
grant all on public.pick2_mlb_game_results to service_role;
grant all on public.pick2_mlb_market_event_mappings to service_role;

commit;
