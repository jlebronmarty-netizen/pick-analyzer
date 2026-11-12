create table if not exists public.nba_pbp_snapshots_v1 (
  game_id text primary key,
  provider_game_id bigint not null,
  provider text not null default 'balldontlie',
  captured_at timestamptz not null,
  play_count integer not null default 0,
  payload jsonb not null,
  source_version text not null default 'NBA_BDL_PBP_V1'
);
alter table public.nba_pbp_snapshots_v1 enable row level security;
revoke all on public.nba_pbp_snapshots_v1 from anon, authenticated;
grant select, insert, update on public.nba_pbp_snapshots_v1 to service_role;
comment on table public.nba_pbp_snapshots_v1 is
'Bounded BALLDONTLIE GOAT play-by-play archive for settled NBA learning diagnostics. Not a prediction input and not used to rewrite frozen picks.';
