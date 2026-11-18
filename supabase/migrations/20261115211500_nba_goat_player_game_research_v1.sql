-- Research-only compact verified NBA GOAT player-game facts. No model or pick writes.
-- Source raw payloads stay in private Storage; never store raw JSON in Postgres.
create table if not exists public.nba_goat_player_game_research_v1 (
 season integer not null check (season between 1946 and 2100),
 provider_game_id bigint not null,
 player_id bigint not null,
 team_id bigint,
 opponent_team_id bigint,
 game_datetime timestamptz not null,
 source_captured_at timestamptz not null,
 source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
 minutes_played numeric(7,3) not null check (minutes_played >= 0 and minutes_played <= 80),
 pts smallint check (pts between 0 and 200),
 reb smallint check (reb between 0 and 100),
 ast smallint check (ast between 0 and 100),
 fg3m smallint check (fg3m between 0 and 100),
 stl smallint check (stl between 0 and 100),
 blk smallint check (blk between 0 and 100),
 turnover smallint check (turnover between 0 and 100),
 projection_eligible boolean not null default false,
 materialized_at timestamptz not null default now(),
 primary key (season,provider_game_id,player_id)
);
create index if not exists nba_goat_player_game_research_player_time_idx
 on public.nba_goat_player_game_research_v1(player_id,game_datetime desc,source_captured_at);
create index if not exists nba_goat_player_game_research_season_time_idx
 on public.nba_goat_player_game_research_v1(season,game_datetime desc);
alter table public.nba_goat_player_game_research_v1 enable row level security;
revoke all on public.nba_goat_player_game_research_v1 from anon,authenticated;
grant select,insert,update on public.nba_goat_player_game_research_v1 to service_role;
comment on table public.nba_goat_player_game_research_v1 is
 'Research-only, verified compact player-game facts, provenance from private GOAT Storage. Not official model inputs.';
