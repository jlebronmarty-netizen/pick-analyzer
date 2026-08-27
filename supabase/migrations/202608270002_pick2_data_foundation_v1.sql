create extension if not exists pgcrypto;

create table if not exists public.pick2_raw_mlb_statcast_pitches (
  id text primary key,
  pick2_era text not null default 'PICK_2_ERA_V1',
  source text not null default 'statcast',
  source_version text not null,
  game_pk bigint not null,
  game_date date not null,
  source_home_team text,
  source_away_team text,
  canonical_home_team_id text references public.sports_teams(id),
  canonical_away_team_id text references public.sports_teams(id),
  event_id text references public.sport_events(id),
  event_mapping_state text not null default 'UNMAPPED',
  source_pitcher_id bigint,
  source_batter_id bigint,
  canonical_pitcher_id text references public.sport_players(id),
  canonical_batter_id text references public.sport_players(id),
  player_mapping_state text not null default 'UNMAPPED',
  source_player_name text,
  pitch_type text,
  release_speed numeric,
  p_throws text,
  stand text,
  balls integer,
  strikes integer,
  outs_when_up integer,
  post_home_score integer,
  post_away_score integer,
  events text,
  description text,
  inning integer,
  inning_topbot text,
  at_bat_number integer not null,
  pitch_number integer not null,
  raw_payload jsonb not null default '{}'::jsonb,
  raw_payload_digest text not null,
  mapping_metadata jsonb not null default '{}'::jsonb,
  mapped_at timestamptz,
  ingested_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (game_pk, at_bat_number, pitch_number),
  check (pick2_era = 'PICK_2_ERA_V1'),
  check (event_mapping_state in ('MAPPED', 'UNMAPPED', 'AMBIGUOUS', 'CONFLICT')),
  check (player_mapping_state in ('MAPPED', 'UNMAPPED', 'AMBIGUOUS', 'CONFLICT')),
  check (balls between 0 and 4),
  check (strikes between 0 and 3),
  check (outs_when_up between 0 and 3),
  check (post_home_score is null or post_home_score >= 0),
  check (post_away_score is null or post_away_score >= 0)
);

create index if not exists pick2_raw_mlb_statcast_pitches_game_idx
  on public.pick2_raw_mlb_statcast_pitches (game_pk, at_bat_number, pitch_number);

create index if not exists pick2_raw_mlb_statcast_pitches_event_idx
  on public.pick2_raw_mlb_statcast_pitches (event_id, game_date);

create index if not exists pick2_raw_mlb_statcast_pitches_pitcher_idx
  on public.pick2_raw_mlb_statcast_pitches (source_pitcher_id, game_date);

create index if not exists pick2_raw_mlb_statcast_pitches_batter_idx
  on public.pick2_raw_mlb_statcast_pitches (source_batter_id, game_date);

create index if not exists pick2_raw_mlb_statcast_pitches_mapping_idx
  on public.pick2_raw_mlb_statcast_pitches (event_mapping_state, player_mapping_state, game_date);

create table if not exists public.pick2_feature_snapshots (
  id uuid primary key default gen_random_uuid(),
  deterministic_identity text not null unique,
  pick2_era text not null default 'PICK_2_ERA_V1',
  sport_key text not null default 'baseball_mlb',
  feature_domain text not null,
  subject_id text not null,
  secondary_subject_id text,
  event_id text references public.sport_events(id),
  feature_date date not null,
  as_of_date date not null,
  as_of_timestamp timestamptz,
  feature_version text not null,
  source_window jsonb not null default '{}'::jsonb,
  sample_sizes jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  input_digest text not null,
  created_at timestamptz not null default timezone('utc', now()),
  check (pick2_era = 'PICK_2_ERA_V1'),
  check (feature_domain in ('pitcher', 'batter', 'team', 'bullpen', 'matchup', 'first_inning', 'prediction_bundle')),
  check (as_of_date <= feature_date)
);

create index if not exists pick2_feature_snapshots_subject_idx
  on public.pick2_feature_snapshots (sport_key, feature_domain, subject_id, feature_date desc);

create index if not exists pick2_feature_snapshots_event_idx
  on public.pick2_feature_snapshots (event_id, feature_version);

create table if not exists public.pick2_mlb_pitcher_daily_features (
  id uuid primary key default gen_random_uuid(),
  feature_snapshot_id uuid not null references public.pick2_feature_snapshots(id),
  player_id text not null references public.sport_players(id),
  feature_date date not null,
  as_of_date date not null,
  as_of_timestamp timestamptz,
  feature_version text not null,
  k_rate numeric,
  bb_rate numeric,
  k_minus_bb_rate numeric,
  whiff_rate numeric,
  csw_rate numeric,
  strike_rate numeric,
  swing_rate numeric,
  avg_release_speed numeric,
  velocity_l1 numeric,
  velocity_l3 numeric,
  velocity_l5 numeric,
  velocity_delta numeric,
  previous_pitch_count integer,
  days_rest integer,
  pitch_mix jsonb not null default '{}'::jsonb,
  pitch_mix_change jsonb not null default '{}'::jsonb,
  handedness_splits jsonb not null default '{}'::jsonb,
  first_inning_performance jsonb not null default '{}'::jsonb,
  sample_sizes jsonb not null default '{}'::jsonb,
  source_window jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (player_id, feature_date, feature_version),
  check (as_of_date <= feature_date)
);

create table if not exists public.pick2_mlb_batter_daily_features (
  id uuid primary key default gen_random_uuid(),
  feature_snapshot_id uuid not null references public.pick2_feature_snapshots(id),
  player_id text not null references public.sport_players(id),
  feature_date date not null,
  as_of_date date not null,
  as_of_timestamp timestamptz,
  feature_version text not null,
  recent_k_rate numeric,
  recent_bb_rate numeric,
  recent_scoring_contribution numeric,
  iso_value numeric,
  handedness_splits jsonb not null default '{}'::jsonb,
  pitch_type_matchups jsonb not null default '{}'::jsonb,
  sample_sizes jsonb not null default '{}'::jsonb,
  source_window jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (player_id, feature_date, feature_version),
  check (as_of_date <= feature_date)
);

create table if not exists public.pick2_mlb_team_daily_features (
  id uuid primary key default gen_random_uuid(),
  feature_snapshot_id uuid not null references public.pick2_feature_snapshots(id),
  team_id text not null references public.sports_teams(id),
  feature_date date not null,
  as_of_date date not null,
  as_of_timestamp timestamptz,
  feature_version text not null,
  recent_k_rate numeric,
  recent_bb_rate numeric,
  recent_runs_per_game numeric,
  recent_iso numeric,
  handedness_splits jsonb not null default '{}'::jsonb,
  lineup_proxy jsonb not null default '{}'::jsonb,
  sample_sizes jsonb not null default '{}'::jsonb,
  source_window jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (team_id, feature_date, feature_version),
  check (as_of_date <= feature_date)
);

create table if not exists public.pick2_mlb_bullpen_daily_features (
  id uuid primary key default gen_random_uuid(),
  feature_snapshot_id uuid not null references public.pick2_feature_snapshots(id),
  team_id text not null references public.sports_teams(id),
  feature_date date not null,
  as_of_date date not null,
  as_of_timestamp timestamptz,
  feature_version text not null,
  pitches_previous_24h integer,
  pitches_previous_72h integer,
  high_workload_reliever_count integer,
  reliever_workload jsonb not null default '{}'::jsonb,
  bullpen_k_rate numeric,
  bullpen_bb_rate numeric,
  bullpen_k_minus_bb_rate numeric,
  bullpen_whiff_rate numeric,
  availability_proxies jsonb not null default '{}'::jsonb,
  sample_sizes jsonb not null default '{}'::jsonb,
  source_window jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (team_id, feature_date, feature_version),
  check (as_of_date <= feature_date)
);

create table if not exists public.pick2_mlb_matchup_daily_features (
  id uuid primary key default gen_random_uuid(),
  feature_snapshot_id uuid not null references public.pick2_feature_snapshots(id),
  event_id text not null references public.sport_events(id),
  home_team_id text references public.sports_teams(id),
  away_team_id text references public.sports_teams(id),
  feature_date date not null,
  as_of_date date not null,
  as_of_timestamp timestamptz,
  feature_version text not null,
  pitcher_batter_mix jsonb not null default '{}'::jsonb,
  handedness_context jsonb not null default '{}'::jsonb,
  park_context jsonb not null default '{}'::jsonb,
  lineup_context jsonb not null default '{}'::jsonb,
  sample_sizes jsonb not null default '{}'::jsonb,
  source_window jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (event_id, feature_date, feature_version),
  check (as_of_date <= feature_date)
);

create table if not exists public.pick2_mlb_first_inning_daily_features (
  id uuid primary key default gen_random_uuid(),
  feature_snapshot_id uuid not null references public.pick2_feature_snapshots(id),
  event_id text not null references public.sport_events(id),
  home_team_id text references public.sports_teams(id),
  away_team_id text references public.sports_teams(id),
  feature_date date not null,
  as_of_date date not null,
  as_of_timestamp timestamptz,
  feature_version text not null,
  team_first_inning_scoring_rate jsonb not null default '{}'::jsonb,
  starter_first_inning_k_rate jsonb not null default '{}'::jsonb,
  starter_first_inning_bb_rate jsonb not null default '{}'::jsonb,
  starter_first_inning_baserunner_proxy jsonb not null default '{}'::jsonb,
  starter_first_inning_pitch_count jsonb not null default '{}'::jsonb,
  sample_sizes jsonb not null default '{}'::jsonb,
  source_window jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (event_id, feature_date, feature_version),
  check (as_of_date <= feature_date)
);

create table if not exists public.pick2_model_registry (
  id uuid primary key default gen_random_uuid(),
  model_family text not null,
  sport_key text not null default 'baseball_mlb',
  target text not null,
  purpose text not null default 'sports_probability',
  status text not null default 'candidate',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (sport_key, model_family, target),
  check (status in ('candidate', 'challenger', 'champion', 'retired', 'quarantined'))
);

create table if not exists public.pick2_model_feature_sets (
  id uuid primary key default gen_random_uuid(),
  deterministic_identity text not null unique,
  sport_key text not null default 'baseball_mlb',
  feature_set_version text not null,
  feature_domains jsonb not null default '[]'::jsonb,
  leakage_policy text not null default 'as_of_only',
  input_contract jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (sport_key, feature_set_version)
);

create table if not exists public.pick2_model_versions (
  id uuid primary key default gen_random_uuid(),
  deterministic_identity text not null unique,
  model_id uuid not null references public.pick2_model_registry(id),
  feature_set_id uuid not null references public.pick2_model_feature_sets(id),
  model_version text not null,
  role text not null default 'challenger',
  status text not null default 'draft',
  training_window jsonb not null default '{}'::jsonb,
  validation_window jsonb not null default '{}'::jsonb,
  sealed_holdout_window jsonb not null default '{}'::jsonb,
  hyperparameters jsonb not null default '{}'::jsonb,
  artifact_uri text,
  artifact_digest text not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  promoted_at timestamptz,
  unique (model_id, model_version),
  check (role in ('candidate', 'challenger', 'champion', 'shadow')),
  check (status in ('draft', 'validated', 'promoted', 'retired', 'quarantined'))
);

create table if not exists public.pick2_model_training_runs (
  id uuid primary key default gen_random_uuid(),
  deterministic_identity text not null unique,
  model_version_id uuid references public.pick2_model_versions(id),
  sport_key text not null default 'baseball_mlb',
  target text not null,
  training_window jsonb not null default '{}'::jsonb,
  feature_set_version text not null,
  row_counts jsonb not null default '{}'::jsonb,
  hyperparameters jsonb not null default '{}'::jsonb,
  artifact_digest text,
  status text not null default 'planned',
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  check (status in ('planned', 'running', 'completed', 'failed', 'quarantined'))
);

create table if not exists public.pick2_model_validation_runs (
  id uuid primary key default gen_random_uuid(),
  deterministic_identity text not null unique,
  model_version_id uuid not null references public.pick2_model_versions(id),
  validation_window jsonb not null default '{}'::jsonb,
  sealed_holdout boolean not null default true,
  metrics jsonb not null default '{}'::jsonb,
  calibration_metrics jsonb not null default '{}'::jsonb,
  status text not null default 'completed',
  created_at timestamptz not null default timezone('utc', now()),
  check (status in ('completed', 'failed', 'quarantined'))
);

create table if not exists public.pick2_game_predictions (
  id uuid primary key default gen_random_uuid(),
  deterministic_identity text not null unique,
  pick2_era text not null default 'PICK_2_ERA_V1',
  sport_key text not null default 'baseball_mlb',
  event_id text not null references public.sport_events(id),
  model_version_id uuid not null references public.pick2_model_versions(id),
  feature_snapshot_id uuid not null references public.pick2_feature_snapshots(id),
  predicted_at timestamptz not null,
  target text not null,
  home_probability numeric,
  away_probability numeric,
  expected_home_score numeric,
  expected_away_score numeric,
  expected_total numeric,
  expected_margin numeric,
  frozen_input_digest text not null,
  model_artifact_digest text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  check (pick2_era = 'PICK_2_ERA_V1'),
  check (home_probability is null or (home_probability >= 0 and home_probability <= 1)),
  check (away_probability is null or (away_probability >= 0 and away_probability <= 1))
);

create index if not exists pick2_game_predictions_event_idx
  on public.pick2_game_predictions (sport_key, event_id, predicted_at desc);

create table if not exists public.pick2_prediction_results (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null unique references public.pick2_game_predictions(id),
  result_id uuid references public.game_results(id),
  evaluated_at timestamptz not null default timezone('utc', now()),
  actual_result jsonb not null default '{}'::jsonb,
  binary_target integer,
  brier_score numeric,
  log_loss numeric,
  hit boolean,
  calibration_bucket text,
  evaluator_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (binary_target is null or binary_target in (0, 1))
);

create table if not exists public.pick2_market_value_evaluations (
  id uuid primary key default gen_random_uuid(),
  deterministic_identity text not null unique,
  prediction_id uuid not null references public.pick2_game_predictions(id),
  odds_snapshot_id text not null references public.sports_odds_snapshots(id),
  sportsbook text not null,
  market text not null,
  selection text not null,
  line numeric,
  odds numeric,
  implied_probability numeric,
  no_vig_probability numeric,
  pick_probability numeric not null,
  edge numeric,
  expected_value numeric,
  action text not null default 'NO_BET',
  evaluated_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  check (action in ('BET', 'NO_BET', 'REVIEW', 'UNAVAILABLE')),
  check (implied_probability is null or (implied_probability >= 0 and implied_probability <= 1)),
  check (no_vig_probability is null or (no_vig_probability >= 0 and no_vig_probability <= 1)),
  check (pick_probability >= 0 and pick_probability <= 1)
);

create table if not exists public.pick2_data_health_status (
  id uuid primary key default gen_random_uuid(),
  sport_key text not null default 'baseball_mlb',
  health_date date not null,
  statcast_imported_through date,
  games_mapped_percent numeric,
  features_built_through date,
  results_through date,
  odds_freshness jsonb not null default '{}'::jsonb,
  model_readiness text not null default 'NO_CHAMPION',
  prediction_readiness text not null default 'NO_PREDICTIONS',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (sport_key, health_date)
);

create or replace function public.pick2_prevent_prediction_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'pick2_game_predictions are immutable; write a new prediction version instead';
end;
$$;

drop trigger if exists pick2_game_predictions_no_update on public.pick2_game_predictions;
create trigger pick2_game_predictions_no_update
  before update on public.pick2_game_predictions
  for each row execute function public.pick2_prevent_prediction_update();

alter table public.pick2_raw_mlb_statcast_pitches enable row level security;
alter table public.pick2_feature_snapshots enable row level security;
alter table public.pick2_mlb_pitcher_daily_features enable row level security;
alter table public.pick2_mlb_batter_daily_features enable row level security;
alter table public.pick2_mlb_team_daily_features enable row level security;
alter table public.pick2_mlb_bullpen_daily_features enable row level security;
alter table public.pick2_mlb_matchup_daily_features enable row level security;
alter table public.pick2_mlb_first_inning_daily_features enable row level security;
alter table public.pick2_model_registry enable row level security;
alter table public.pick2_model_feature_sets enable row level security;
alter table public.pick2_model_versions enable row level security;
alter table public.pick2_model_training_runs enable row level security;
alter table public.pick2_model_validation_runs enable row level security;
alter table public.pick2_game_predictions enable row level security;
alter table public.pick2_prediction_results enable row level security;
alter table public.pick2_market_value_evaluations enable row level security;
alter table public.pick2_data_health_status enable row level security;

create policy pick2_raw_mlb_statcast_pitches_service_role_all on public.pick2_raw_mlb_statcast_pitches for all to service_role using (true) with check (true);
create policy pick2_feature_snapshots_service_role_all on public.pick2_feature_snapshots for all to service_role using (true) with check (true);
create policy pick2_mlb_pitcher_daily_features_service_role_all on public.pick2_mlb_pitcher_daily_features for all to service_role using (true) with check (true);
create policy pick2_mlb_batter_daily_features_service_role_all on public.pick2_mlb_batter_daily_features for all to service_role using (true) with check (true);
create policy pick2_mlb_team_daily_features_service_role_all on public.pick2_mlb_team_daily_features for all to service_role using (true) with check (true);
create policy pick2_mlb_bullpen_daily_features_service_role_all on public.pick2_mlb_bullpen_daily_features for all to service_role using (true) with check (true);
create policy pick2_mlb_matchup_daily_features_service_role_all on public.pick2_mlb_matchup_daily_features for all to service_role using (true) with check (true);
create policy pick2_mlb_first_inning_daily_features_service_role_all on public.pick2_mlb_first_inning_daily_features for all to service_role using (true) with check (true);
create policy pick2_model_registry_service_role_all on public.pick2_model_registry for all to service_role using (true) with check (true);
create policy pick2_model_feature_sets_service_role_all on public.pick2_model_feature_sets for all to service_role using (true) with check (true);
create policy pick2_model_versions_service_role_all on public.pick2_model_versions for all to service_role using (true) with check (true);
create policy pick2_model_training_runs_service_role_all on public.pick2_model_training_runs for all to service_role using (true) with check (true);
create policy pick2_model_validation_runs_service_role_all on public.pick2_model_validation_runs for all to service_role using (true) with check (true);
create policy pick2_game_predictions_service_role_all on public.pick2_game_predictions for all to service_role using (true) with check (true);
create policy pick2_prediction_results_service_role_all on public.pick2_prediction_results for all to service_role using (true) with check (true);
create policy pick2_market_value_evaluations_service_role_all on public.pick2_market_value_evaluations for all to service_role using (true) with check (true);
create policy pick2_data_health_status_service_role_all on public.pick2_data_health_status for all to service_role using (true) with check (true);

grant select on public.pick2_model_registry to authenticated;
grant select on public.pick2_model_versions to authenticated;
grant select on public.pick2_model_validation_runs to authenticated;
grant select on public.pick2_game_predictions to authenticated;
grant select on public.pick2_prediction_results to authenticated;
grant select on public.pick2_market_value_evaluations to authenticated;
grant select on public.pick2_data_health_status to authenticated;

grant all on public.pick2_raw_mlb_statcast_pitches to service_role;
grant all on public.pick2_feature_snapshots to service_role;
grant all on public.pick2_mlb_pitcher_daily_features to service_role;
grant all on public.pick2_mlb_batter_daily_features to service_role;
grant all on public.pick2_mlb_team_daily_features to service_role;
grant all on public.pick2_mlb_bullpen_daily_features to service_role;
grant all on public.pick2_mlb_matchup_daily_features to service_role;
grant all on public.pick2_mlb_first_inning_daily_features to service_role;
grant all on public.pick2_model_registry to service_role;
grant all on public.pick2_model_feature_sets to service_role;
grant all on public.pick2_model_versions to service_role;
grant all on public.pick2_model_training_runs to service_role;
grant all on public.pick2_model_validation_runs to service_role;
grant all on public.pick2_game_predictions to service_role;
grant all on public.pick2_prediction_results to service_role;
grant all on public.pick2_market_value_evaluations to service_role;
grant all on public.pick2_data_health_status to service_role;
