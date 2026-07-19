create table if not exists ai_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  scope text not null check (
    scope in (
      'ALL_SPORTS',
      'SPORT',
      'LEAGUE',
      'MODEL_VERSION',
      'CATEGORY',
      'TIME_PERIOD'
    )
  ),
  sport_key text,
  league_key text,
  model_version text,
  category text,
  sample_size integer not null default 0 check (sample_size >= 0),
  settled_sample integer not null default 0 check (settled_sample >= 0),
  accuracy numeric,
  brier_score numeric,
  log_loss numeric,
  calibration_error numeric,
  trust_score numeric,
  data_quality numeric,
  feature_quality numeric,
  confidence_quality numeric,
  readiness_score numeric,
  health text not null,
  blockers text[] not null default '{}'::text[],
  grade text not null,
  metrics jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key)
);

create index if not exists ai_performance_snapshots_scope_date_idx
  on ai_performance_snapshots (scope, snapshot_date desc);

create index if not exists ai_performance_snapshots_sport_date_idx
  on ai_performance_snapshots (sport_key, snapshot_date desc);

create index if not exists ai_performance_snapshots_model_idx
  on ai_performance_snapshots (sport_key, model_version, snapshot_date desc);

create index if not exists ai_performance_snapshots_metrics_idx
  on ai_performance_snapshots using gin (metrics);

grant all privileges on table ai_performance_snapshots to service_role;
grant select on table ai_performance_snapshots to authenticated;
