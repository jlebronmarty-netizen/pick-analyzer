create table if not exists public.mlb_exact_line_forward_shadow_v1 (
  id text primary key,
  tracking_date date not null,
  game_pk bigint not null,
  start_time timestamptz not null,
  game_type text not null,
  season_phase text not null check (season_phase in ('REGULAR_SEASON','POSTSEASON')),

  market text not null,
  contract_id text not null,
  player_mlbam_id bigint not null,
  player_name text not null,
  direction text not null check (direction in ('OVER','UNDER')),
  exact_line numeric not null,

  sportsbook text null,
  price numeric null,
  odds_snapshot_id text null,
  quotes jsonb not null default '[]'::jsonb,

  projection double precision not null,
  threshold numeric not null,
  historical_accuracy_2025 double precision null,
  historical_accuracy_2026_diagnostic double precision null,
  evidence_class text not null,

  freeze_timestamp timestamptz not null,
  latest_prior_date date not null,
  prior_starts integer not null check (prior_starts >= 5),

  result text null check (result is null or result in ('WIN','LOSS','PUSH','VOID')),
  actual_value numeric null,
  settled_at timestamptz null,

  metadata jsonb not null default '{}'::jsonb,
  research_only boolean not null default true check (research_only = true),
  production_eligible boolean not null default false check (production_eligible = false),
  official_picks_eligible boolean not null default false check (official_picks_eligible = false),
  apostar_enabled boolean not null default false check (apostar_enabled = false),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tracking_date, game_pk, contract_id, player_mlbam_id)
);

create index if not exists mlb_exact_line_forward_shadow_date_idx
  on public.mlb_exact_line_forward_shadow_v1(tracking_date, game_pk);
create index if not exists mlb_exact_line_forward_shadow_contract_idx
  on public.mlb_exact_line_forward_shadow_v1(contract_id, season_phase, result);

alter table public.mlb_exact_line_forward_shadow_v1 enable row level security;

revoke all on table public.mlb_exact_line_forward_shadow_v1 from anon, authenticated;
grant select, insert, update on table public.mlb_exact_line_forward_shadow_v1 to service_role;

comment on table public.mlb_exact_line_forward_shadow_v1 is
'Persisted research-only forward freezes for exact MLB pitcher K/outs contracts. Selection is independent of price; quotes are provenance only. Postseason evidence is domain-shift shadow evidence.';
