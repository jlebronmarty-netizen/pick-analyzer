create table if not exists public.nba_pregame_context_v1 (
  snapshot_id text primary key,
  captured_at timestamptz not null,
  schedule_snapshot_id text,
  game_ids jsonb not null default '[]'::jsonb,
  team_ids jsonb not null default '[]'::jsonb,
  projected_lineups jsonb not null default '{}'::jsonb,
  injuries jsonb not null default '{}'::jsonb,
  coverage jsonb not null default '{}'::jsonb,
  provider text not null default 'balldontlie',
  source_version text not null default 'NBA_GOAT_PREGAME_CONTEXT_V1'
);
create index if not exists nba_pregame_context_v1_captured_idx on public.nba_pregame_context_v1(captured_at desc);
alter table public.nba_pregame_context_v1 enable row level security;
revoke all on public.nba_pregame_context_v1 from anon,authenticated;
grant select,insert,update on public.nba_pregame_context_v1 to service_role;
comment on table public.nba_pregame_context_v1 is
'Immutable NBA GOAT pregame evidence archive for projected lineups and player injuries. Audit/context only; does not change model scoring by itself.';