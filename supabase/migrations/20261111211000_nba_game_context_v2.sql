create table if not exists public.nba_game_context_v2 (
  game_id text primary key,
  provider_game_id bigint not null,
  projected_lineups jsonb,
  projected_captured_at timestamptz,
  actual_lineups jsonb,
  actual_lineups_captured_at timestamptz,
  player_stats jsonb,
  player_stats_captured_at timestamptz,
  provider text not null default 'balldontlie',
  source_version text not null default 'NBA_CAUSAL_CONTEXT_V2',
  updated_at timestamptz not null default now()
);
alter table public.nba_game_context_v2 enable row level security;
revoke all on public.nba_game_context_v2 from anon, authenticated;
grant select, insert, update on public.nba_game_context_v2 to service_role;
comment on table public.nba_game_context_v2 is
'NBA causal-learning context: stored GOAT projected lineups, actual lineups and game player stats. Postgame analysis only; does not rewrite frozen predictions.';
