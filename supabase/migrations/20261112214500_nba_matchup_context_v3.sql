create table if not exists public.nba_matchup_context_v3 (
  game_id text primary key,
  provider_game_id bigint not null,
  matchups jsonb,
  advanced_stats jsonb,
  matchups_captured_at timestamptz,
  advanced_captured_at timestamptz,
  last_attempt_at timestamptz,
  next_retry_at timestamptz,
  attempt_count integer not null default 0,
  coverage_status text not null default 'PENDING'
    check (coverage_status in ('PENDING','PARTIAL','COMPLETE','EXHAUSTED')),
  provider text not null default 'balldontlie',
  source_version text not null default 'NBA_CAUSAL_MATCHUPS_V3',
  updated_at timestamptz not null default now()
);
alter table public.nba_matchup_context_v3 enable row level security;
revoke all on public.nba_matchup_context_v3 from anon, authenticated;
grant select, insert, update on public.nba_matchup_context_v3 to service_role;
comment on table public.nba_matchup_context_v3 is
'NBA causal-learning V3 matchup and advanced tracking context. Postgame research only; never rewrites frozen predictions or promotes models automatically.';
