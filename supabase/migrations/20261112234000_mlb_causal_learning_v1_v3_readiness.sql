create table if not exists public.mlb_causal_diagnostics_v1 (
  prediction_key text primary key,
  game_id text,
  model_id text,
  market text,
  outcome text,
  observed_labels jsonb not null default '[]'::jsonb,
  observed_evidence jsonb not null default '{}'::jsonb,
  evidence_quality text not null default 'LOW' check (evidence_quality in ('LOW','MEDIUM','HIGH')),
  causal_status text not null default 'HYPOTHESIS_ONLY' check (causal_status in ('HYPOTHESIS_ONLY','CORROBORATED','VALIDATED_PATTERN')),
  analyzed_at timestamptz not null default now()
);
create table if not exists public.mlb_game_context_v2 (
  game_id text primary key,
  context_payload jsonb not null default '{}'::jsonb,
  captured_at timestamptz,
  source_version text not null default 'MLB_CAUSAL_CONTEXT_V2',
  updated_at timestamptz not null default now()
);
create table if not exists public.mlb_batter_pitcher_v3 (
  game_id text not null,
  game_date date,
  batter_id text not null,
  pitcher_id text not null,
  batter_name text,
  pitcher_name text,
  plate_appearances integer,
  hits integer,
  walks integer,
  strikeouts integer,
  total_bases integer,
  source_version text not null default 'MLB_CAUSAL_MATCHUPS_V3',
  captured_at timestamptz,
  primary key(game_id,batter_id,pitcher_id)
);
create index if not exists mlb_batter_pitcher_pair_idx on public.mlb_batter_pitcher_v3(batter_id,pitcher_id,game_date);
alter table public.mlb_causal_diagnostics_v1 enable row level security;
alter table public.mlb_game_context_v2 enable row level security;
alter table public.mlb_batter_pitcher_v3 enable row level security;
revoke all on public.mlb_causal_diagnostics_v1 from anon,authenticated;
revoke all on public.mlb_game_context_v2 from anon,authenticated;
revoke all on public.mlb_batter_pitcher_v3 from anon,authenticated;
grant select,insert,update on public.mlb_causal_diagnostics_v1 to service_role;
grant select,insert,update on public.mlb_game_context_v2 to service_role;
grant select,insert,update on public.mlb_batter_pitcher_v3 to service_role;
comment on table public.mlb_game_context_v2 is 'MLB causal-learning V2 schema prepared for 2027. No offseason collector is activated by this migration.';
