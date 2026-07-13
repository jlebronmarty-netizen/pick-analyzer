create table if not exists sport_lineups (
  id text primary key,
  sport_key text not null,
  league_key text not null,
  season text,
  event_id text references sport_events(id),
  team_id text references sports_teams(id),
  player_id text references sport_players(id),
  player_name text,
  provider text not null,
  lineup_type text not null,
  position text,
  depth_order integer,
  role text,
  starter boolean,
  lineup_status text,
  confirmation_level text,
  source_timestamp timestamptz,
  provider_ids jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lineup_type in ('depth_chart', 'starting_lineup')),
  check (confirmation_level in ('confirmed', 'expected', 'projected', 'unknown'))
);

create index if not exists sport_lineups_event_idx
  on sport_lineups (sport_key, league_key, event_id, lineup_type);

create index if not exists sport_lineups_team_idx
  on sport_lineups (sport_key, league_key, team_id, lineup_type, updated_at desc);

create index if not exists sport_lineups_provider_idx
  on sport_lineups using gin (provider_ids);

grant all privileges on table sport_lineups to service_role;
grant select on table sport_lineups to authenticated;
