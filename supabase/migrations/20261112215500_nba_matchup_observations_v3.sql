create table if not exists public.nba_matchup_observations_v3 (
  game_id text not null,
  provider_game_id bigint not null,
  game_date date,
  offensive_player_id bigint not null,
  defender_player_id bigint not null,
  offensive_player_name text,
  defender_player_name text,
  matchup_seconds double precision,
  player_points double precision,
  fgm double precision,
  fga double precision,
  fg_pct double precision,
  assists double precision,
  turnovers double precision,
  switches_on double precision,
  shooting_fouls double precision,
  captured_at timestamptz not null,
  source_version text not null default 'NBA_CAUSAL_MATCHUPS_V3',
  primary key (game_id, offensive_player_id, defender_player_id)
);
create index if not exists nba_matchup_observations_pair_idx
  on public.nba_matchup_observations_v3(offensive_player_id, defender_player_id, game_date);
alter table public.nba_matchup_observations_v3 enable row level security;
revoke all on public.nba_matchup_observations_v3 from anon, authenticated;
grant select, insert, update on public.nba_matchup_observations_v3 to service_role;
comment on table public.nba_matchup_observations_v3 is
'Normalized NBA offensive-player vs defender observations from confirmed BALLDONTLIE matchups. Research/learning only; not a direct production prediction input.';
