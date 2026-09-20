create table if not exists public.mlb_approved_prop_daily_v1 (
  id text primary key,
  tracking_date date not null,
  game_pk bigint not null,
  start_time timestamptz not null,
  market text not null,
  candidate_id text not null,
  player_mlbam_id bigint null,
  player_name text not null,
  direction text not null,
  required_line numeric null,
  sportsbook text null,
  observed_line numeric null,
  price numeric null,
  odds_snapshot_id text null,
  model_projection double precision null,
  model_probability double precision null,
  historical_accuracy double precision null,
  model_qualifies boolean null,
  market_verified boolean not null default false,
  status text not null,
  blocker text null,
  feature_snapshot jsonb not null default '{}'::jsonb,
  market_snapshot jsonb not null default '{}'::jsonb,
  frozen_at timestamptz not null,
  research_only boolean not null default true,
  production_eligible boolean not null default false,
  official_picks_eligible boolean not null default false,
  apostar_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mlb_approved_prop_daily_v1_direction_chk
    check (direction in ('UNDER','OVER','NO','YES')),
  constraint mlb_approved_prop_daily_v1_status_chk
    check (status in (
      'QUALIFIES_MARKET_VERIFIED',
      'MODEL_QUALIFIES_MARKET_NOT_VERIFIED',
      'NO_PLAY',
      'NO_EVALUABLE_EXACT_RUNTIME_PENDING',
      'NO_EVALUABLE_IDENTITY_UNRESOLVED',
      'NO_EVALUABLE_INSUFFICIENT_HISTORY',
      'NO_EVALUABLE_FEATURE_MISSING',
      'NO_EVALUABLE_LINEAGE_BLOCKED'
    )),
  constraint mlb_approved_prop_daily_v1_safety_chk
    check (
      research_only = true
      and production_eligible = false
      and official_picks_eligible = false
      and apostar_enabled = false
    )
);

create index if not exists mlb_approved_prop_daily_v1_date_status_idx
  on public.mlb_approved_prop_daily_v1 (tracking_date, status);
create index if not exists mlb_approved_prop_daily_v1_date_market_idx
  on public.mlb_approved_prop_daily_v1 (tracking_date, market);
create index if not exists mlb_approved_prop_daily_v1_game_player_idx
  on public.mlb_approved_prop_daily_v1 (game_pk, player_mlbam_id);

alter table public.mlb_approved_prop_daily_v1 enable row level security;
revoke all on table public.mlb_approved_prop_daily_v1 from anon, authenticated;
grant select, insert, update, delete on table public.mlb_approved_prop_daily_v1 to service_role;
grant all on table public.mlb_approved_prop_daily_v1 to postgres;
