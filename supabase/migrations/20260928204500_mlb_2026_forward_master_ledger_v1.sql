create table if not exists public.mlb_2026_forward_master_ledger_v1 (
  id text primary key,
  season integer not null default 2026 check (season = 2026),
  season_phase text not null check (season_phase in ('REGULAR_SEASON','POSTSEASON')),
  game_type text null,
  target_date date not null,
  game_pk bigint not null,
  scheduled_at timestamptz null,

  engine text not null,
  model_id text not null,
  contract_id text null,
  evidence_class text not null,

  market text not null,
  line numeric null,
  direction text not null,
  selection text not null,
  player_mlbam_id bigint null,
  player_name text null,

  sportsbook text null,
  odds numeric null,
  odds_snapshot_id text null,

  projection double precision null,
  model_probability double precision null,
  historical_accuracy double precision null,
  threshold numeric null,

  freeze_timestamp timestamptz not null,
  source_relation text not null,
  source_row_id text not null,

  result text null check (result is null or result in ('WIN','LOSS','PUSH','VOID')),
  actual_value numeric null,
  actual_label text null,
  settled_at timestamptz null,

  metadata jsonb not null default '{}'::jsonb,
  research_only boolean not null default true check (research_only = true),
  production_eligible boolean not null default false check (production_eligible = false),
  official_picks_eligible boolean not null default false check (official_picks_eligible = false),
  apostar_enabled boolean not null default false check (apostar_enabled = false),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (source_relation, source_row_id, model_id)
);

create index if not exists mlb_2026_forward_master_ledger_date_idx
  on public.mlb_2026_forward_master_ledger_v1(target_date, game_pk);
create index if not exists mlb_2026_forward_master_ledger_model_idx
  on public.mlb_2026_forward_master_ledger_v1(engine, model_id, season_phase);
create index if not exists mlb_2026_forward_master_ledger_result_idx
  on public.mlb_2026_forward_master_ledger_v1(result, target_date);

alter table public.mlb_2026_forward_master_ledger_v1 enable row level security;

revoke all on table public.mlb_2026_forward_master_ledger_v1 from anon, authenticated;
grant select, insert, update on table public.mlb_2026_forward_master_ledger_v1 to service_role;

comment on table public.mlb_2026_forward_master_ledger_v1 is
'Research-only canonical 2026 MLB forward ledger. One row per frozen model contract selection. Regular season and postseason are separated by season_phase. No model recalculation authority.';
