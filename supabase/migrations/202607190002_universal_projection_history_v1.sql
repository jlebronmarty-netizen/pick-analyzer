create table if not exists universal_projection_history (
  id text primary key,
  sport_key text not null,
  league_key text,
  season text,
  event_id text,
  entity_type text not null check (entity_type in ('team', 'player', 'pitcher', 'game')),
  entity_id text,
  entity_name text,
  team_id text,
  team_name text,
  projection_key text not null,
  projection_family text not null,
  model_version text,
  unit text,
  projection_origin text,
  validity_status text,
  projected_value numeric,
  confidence numeric,
  historical_accuracy numeric,
  feature_quality numeric,
  data_sufficiency numeric,
  prediction_interval_low numeric,
  prediction_interval_high numeric,
  readiness text not null,
  shadow_status text not null,
  rank_score numeric,
  rank_tier text,
  identity_confidence numeric,
  participation_status text,
  starter_status text,
  provider_player_id text,
  internal_player_id text,
  feature_contributions jsonb not null default '[]'::jsonb,
  explanation text not null,
  feature_snapshot jsonb not null default '{}'::jsonb,
  actual_value numeric,
  error numeric,
  absolute_error numeric,
  percentage_error numeric,
  calibration jsonb not null default '{}'::jsonb,
  drift jsonb not null default '{}'::jsonb,
  source text not null,
  generated_at timestamptz not null default now(),
  settled_at timestamptz,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key)
);

alter table universal_projection_history
  add column if not exists model_version text,
  add column if not exists unit text,
  add column if not exists projection_origin text,
  add column if not exists validity_status text,
  add column if not exists rank_score numeric,
  add column if not exists rank_tier text,
  add column if not exists identity_confidence numeric,
  add column if not exists participation_status text,
  add column if not exists starter_status text,
  add column if not exists provider_player_id text,
  add column if not exists internal_player_id text,
  add column if not exists squared_error numeric,
  add column if not exists invalidation_reason text;

create index if not exists universal_projection_history_sport_generated_idx
  on universal_projection_history (sport_key, generated_at desc);

create index if not exists universal_projection_history_event_idx
  on universal_projection_history (sport_key, event_id, projection_key);

create index if not exists universal_projection_history_entity_idx
  on universal_projection_history (sport_key, entity_type, entity_id, projection_key);

create index if not exists universal_projection_history_projection_idx
  on universal_projection_history (sport_key, projection_family, projection_key, generated_at desc);

create index if not exists universal_projection_history_model_idx
  on universal_projection_history (sport_key, model_version, generated_at desc);

create index if not exists universal_projection_history_rank_idx
  on universal_projection_history (sport_key, rank_tier, rank_score desc);

create index if not exists universal_projection_history_features_idx
  on universal_projection_history using gin (feature_snapshot);

grant all privileges on table universal_projection_history to service_role;
grant select on table universal_projection_history to authenticated;
