-- Canonical research storage for the 2026 BALLDONTLIE opening Run Line + Total backfill.
-- Applied directly to canonical Supabase during research preparation on 2026-09-27.
-- Service-role-only by design: RLS enabled and public client grants revoked.

create table if not exists public.mlb_bdl_opening_runline_total_2026_v1 (
  id text primary key,
  season integer not null check (season = 2026),
  game_date date not null,
  xyear_canonical_game_id text not null,
  game_pk bigint,
  home_team text not null,
  away_team text not null,
  game_number integer,
  provider text not null default 'balldontlie',
  vendor text not null check (vendor in ('betmgm','betrivers')),
  market text not null check (market in ('run_line','total')),
  outcome text not null,
  line numeric not null,
  price integer not null check (price <> 0),
  opened_at timestamptz not null,
  provider_game_ids bigint[] not null default '{}',
  provider_odds_ids bigint[] not null default '{}',
  source text not null default 'BDL_2026_RUNLINE_TOTAL_OPENING_V1',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (xyear_canonical_game_id, vendor, market, outcome, line)
);

create index if not exists mlb_bdl_opening_rl_total_2026_date_idx
  on public.mlb_bdl_opening_runline_total_2026_v1(game_date);
create index if not exists mlb_bdl_opening_rl_total_2026_game_idx
  on public.mlb_bdl_opening_runline_total_2026_v1(game_pk);
create index if not exists mlb_bdl_opening_rl_total_2026_market_idx
  on public.mlb_bdl_opening_runline_total_2026_v1(market,vendor,game_date);

alter table public.mlb_bdl_opening_runline_total_2026_v1 enable row level security;
revoke all on table public.mlb_bdl_opening_runline_total_2026_v1 from anon, authenticated, public;
