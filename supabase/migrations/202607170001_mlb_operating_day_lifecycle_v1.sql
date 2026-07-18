create extension if not exists pgcrypto;

create table if not exists operating_days (
  id uuid primary key default gen_random_uuid(),
  sport_key text not null,
  league_key text not null,
  local_date date not null,
  timezone text not null default 'America/Puerto_Rico',
  status text not null default 'planned',
  morning_sync_at timestamptz,
  midday_refresh_at timestamptz,
  final_refresh_at timestamptz,
  recommendations_locked_at timestamptz,
  results_synced_at timestamptz,
  settlement_completed_at timestamptz,
  replay_completed_at timestamptz,
  calibration_completed_at timestamptz,
  report_generated_at timestamptz,
  provider_calls_used integer not null default 0,
  last_error text,
  retry_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sport_key, league_key, local_date),
  check (provider_calls_used >= 0),
  check (retry_count >= 0),
  check (
    status in (
      'planned',
      'morning_synced',
      'midday_refreshed',
      'final_refreshed',
      'locked',
      'games_in_progress',
      'results_pending',
      'results_synced',
      'settled',
      'replayed',
      'calibrated',
      'completed',
      'completed_with_warnings',
      'failed'
    )
  )
);

create index if not exists operating_days_lookup_idx
  on operating_days (sport_key, league_key, local_date);

create table if not exists operating_day_events (
  id uuid primary key default gen_random_uuid(),
  operating_day_id uuid not null references operating_days(id) on delete cascade,
  event_id text not null references sport_events(id),
  provider_event_id text,
  status text not null default 'planned',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (operating_day_id, event_id)
);

create index if not exists operating_day_events_event_idx
  on operating_day_events (event_id);

create table if not exists operating_day_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  operating_day_id uuid not null references operating_days(id) on delete cascade,
  request_id text,
  action text not null,
  status text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms integer,
  provider_calls_planned integer not null default 0,
  provider_calls_made integer not null default 0,
  database_writes integer not null default 0,
  reused_records integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  blocking_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (provider_calls_planned >= 0),
  check (provider_calls_made >= 0),
  check (database_writes >= 0),
  check (reused_records >= 0)
);

create index if not exists operating_day_lifecycle_events_day_idx
  on operating_day_lifecycle_events (operating_day_id, started_at desc);

create table if not exists operating_day_recommendation_locks (
  id uuid primary key default gen_random_uuid(),
  operating_day_id uuid not null references operating_days(id) on delete cascade,
  prediction_id uuid,
  event_id text not null,
  market text not null,
  selection text not null,
  sportsbook text,
  odds_snapshot_id text,
  model_probability numeric,
  book_probability numeric,
  edge numeric,
  ev numeric,
  confidence numeric,
  line numeric,
  odds numeric,
  readiness_state text not null,
  eligibility_status text not null,
  official_pick boolean not null default false,
  rejection_reasons jsonb not null default '[]'::jsonb,
  model_version text,
  policy_version text,
  locked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (operating_day_id, event_id, market, selection, sportsbook, odds_snapshot_id)
);

create index if not exists operating_day_recommendation_locks_day_idx
  on operating_day_recommendation_locks (operating_day_id, official_pick, locked_at desc);

create table if not exists operating_day_reports (
  id uuid primary key default gen_random_uuid(),
  operating_day_id uuid not null references operating_days(id) on delete cascade,
  report_type text not null,
  generated_at timestamptz not null default now(),
  summary jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  unique (operating_day_id, report_type)
);

alter table if exists sports_odds_snapshots
  add column if not exists operating_day_id uuid references operating_days(id),
  add column if not exists provider_timestamp timestamptz,
  add column if not exists odds_classification text not null default 'unknown';

alter table if exists prediction_history
  add column if not exists operating_day_id uuid references operating_days(id),
  add column if not exists recommendation_locked_at timestamptz,
  add column if not exists recommendation_lock_status text,
  add column if not exists official_pick_at_lock boolean not null default false,
  add column if not exists odds_snapshot_id text;

create index if not exists sports_odds_snapshots_operating_day_idx
  on sports_odds_snapshots (operating_day_id, event_id, market, snapshot_time desc);

create index if not exists prediction_history_operating_day_idx
  on prediction_history (operating_day_id, sport_key, game_id, market, status);

grant all privileges on table operating_days to service_role;
grant all privileges on table operating_day_events to service_role;
grant all privileges on table operating_day_lifecycle_events to service_role;
grant all privileges on table operating_day_recommendation_locks to service_role;
grant all privileges on table operating_day_reports to service_role;

grant select on table operating_days to authenticated;
grant select on table operating_day_events to authenticated;
grant select on table operating_day_lifecycle_events to authenticated;
grant select on table operating_day_recommendation_locks to authenticated;
grant select on table operating_day_reports to authenticated;
