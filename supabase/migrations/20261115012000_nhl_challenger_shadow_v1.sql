-- Research-only immutable NHL challenger ledger. Not an Official Picks or wager table.
-- Do not apply while Supabase Data API is unhealthy.
create table if not exists public.nhl_challenger_shadow_v1 (
  id text primary key,
  event_id text not null,
  model_version text not null default 'NHL_SCORES_POISSON_SHADOW_V1',
  scheduled_at timestamptz not null,
  frozen_at timestamptz not null,
  source_completed_at timestamptz not null,
  home_team_id bigint not null,
  away_team_id bigint not null,
  home_team text not null,
  away_team text not null,
  source_hash text not null,
  source_final_games integer not null,
  projection jsonb not null,
  market_proxies jsonb not null,
  features jsonb not null,
  status text not null default 'FROZEN_RESEARCH',
  official_pick boolean not null default false,
  production_eligible boolean not null default false,
  created_at timestamptz not null default now(),
  unique(event_id,model_version),
  constraint nhl_shadow_id_check check (id = model_version || ':' || event_id),
  constraint nhl_shadow_model_check check (model_version = 'NHL_SCORES_POISSON_SHADOW_V1'),
  constraint nhl_shadow_event_check check (event_id ~ '^nhl:202602[0-9]{4}$'),
  constraint nhl_shadow_home_away_check check (home_team_id <> away_team_id),
  constraint nhl_shadow_freeze_time_check check (
    frozen_at <= scheduled_at - interval '60 minutes'
    and source_completed_at <= frozen_at
    and created_at >= frozen_at - interval '10 seconds'
    and created_at <= scheduled_at - interval '60 minutes'
  ),
  constraint nhl_shadow_hash_check check (source_hash ~ '^[0-9a-f]{64}$'),
  constraint nhl_shadow_source_count_check check (source_final_games >= 25),
  constraint nhl_shadow_status_check check (status = 'FROZEN_RESEARCH'),
  constraint nhl_shadow_never_official_check check (official_pick = false and production_eligible = false)
);
create index if not exists nhl_challenger_shadow_scheduled_idx on public.nhl_challenger_shadow_v1(scheduled_at desc);
alter table public.nhl_challenger_shadow_v1 enable row level security;
revoke all on public.nhl_challenger_shadow_v1 from anon,authenticated;
revoke update,delete,truncate on public.nhl_challenger_shadow_v1 from service_role;
grant select,insert on public.nhl_challenger_shadow_v1 to service_role;
comment on table public.nhl_challenger_shadow_v1 is
'Immutable, prospectively captured NHL research forecasts. Independent Poisson three-market proxies; not sportsbook-certified, not official picks or profitability evidence.';
