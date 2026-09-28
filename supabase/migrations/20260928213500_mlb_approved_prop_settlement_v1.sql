create table if not exists public.mlb_approved_prop_settlement_v1 (
  id text primary key,
  approved_prop_daily_id uuid not null unique,
  tracking_date date not null,
  game_pk bigint not null,
  market text not null,
  candidate_id text not null,
  player_mlbam_id bigint not null,
  direction text not null,
  exact_line numeric null,
  actual_value numeric null,
  actual_label text null,
  result text null check (result is null or result in ('WIN','LOSS','PUSH','VOID')),
  outcome_source text not null,
  outcome_source_identity jsonb not null default '{}'::jsonb,
  settled_at timestamptz null,
  blocker text null,
  research_only boolean not null default true check (research_only=true),
  production_eligible boolean not null default false check (production_eligible=false),
  official_picks_eligible boolean not null default false check (official_picks_eligible=false),
  apostar_enabled boolean not null default false check (apostar_enabled=false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mlb_approved_prop_settlement_date_idx
  on public.mlb_approved_prop_settlement_v1(tracking_date,game_pk);
create index if not exists mlb_approved_prop_settlement_result_idx
  on public.mlb_approved_prop_settlement_v1(result,market);
alter table public.mlb_approved_prop_settlement_v1 enable row level security;
revoke all on table public.mlb_approved_prop_settlement_v1 from anon,authenticated;
grant select,insert,update on table public.mlb_approved_prop_settlement_v1 to service_role;
comment on table public.mlb_approved_prop_settlement_v1 is
'Research-only authoritative settlement for frozen exact-line rows from mlb_approved_prop_daily_v1. Missing exact outcome remains blocked/open.';
