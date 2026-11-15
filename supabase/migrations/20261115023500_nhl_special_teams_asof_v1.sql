-- Immutable NHL official PP/PK source snapshots. Research only; never a bettor record.
create table if not exists public.nhl_special_teams_asof_v1 (
  id text primary key,
  snapshot_day date not null unique,
  captured_at timestamptz not null,
  source_version text not null default 'NHL_SPECIAL_TEAMS_ASOF_V3',
  season_id integer not null default 20262027,
  source_url text not null,
  source_hash text not null,
  teams jsonb not null,
  team_count integer not null,
  used_by_official_model boolean not null default false,
  created_at timestamptz not null default now(),
  constraint nhl_st_source_check check (source_version = 'NHL_SPECIAL_TEAMS_ASOF_V3'),
  constraint nhl_st_source_url check (source_url = 'https://api.nhle.com/stats/rest/en/team/summary?cayenneExp=seasonId%3D20262027%20and%20gameTypeId%3D2&isAggregate=true&isGame=false&limit=40'),
  constraint nhl_st_id_check check (id ~ '^[0-9a-f]{64}$'),
  constraint nhl_st_hash_check check (source_hash ~ '^[0-9a-f]{64}$'),
  constraint nhl_st_season_check check (season_id = 20262027),
  constraint nhl_st_team_count check (team_count between 30 and 32 and jsonb_typeof(teams)='array' and jsonb_array_length(teams)=team_count),
  constraint nhl_st_day_check check (snapshot_day=(captured_at at time zone 'UTC')::date),
  constraint nhl_st_time_check check (created_at >= captured_at - interval '10 seconds'
    and created_at <= captured_at + interval '90 seconds'),
  constraint nhl_st_no_official_model check (used_by_official_model = false)
);
create index if not exists nhl_st_asof_captured_idx on public.nhl_special_teams_asof_v1(captured_at desc);
alter table public.nhl_special_teams_asof_v1 enable row level security;
revoke all on public.nhl_special_teams_asof_v1 from anon,authenticated;
revoke update,delete,truncate on public.nhl_special_teams_asof_v1 from service_role;
grant select,insert on public.nhl_special_teams_asof_v1 to service_role;
comment on table public.nhl_special_teams_asof_v1 is
'Append-only official NHL season-to-date team PP/PK observations, captured prospectively and excluded from automatic NHL/other model formulas.';
