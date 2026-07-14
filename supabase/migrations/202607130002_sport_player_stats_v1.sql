create table if not exists sport_player_stats (
  id text primary key,
  sport_key text not null,
  league_key text not null,
  season text not null,
  stat_type text not null,
  event_id text references sport_events(id),
  team_id text references sports_teams(id),
  player_id text references sport_players(id),
  player_name text,
  provider text not null,
  games integer,
  starts integer,
  minutes numeric,
  points numeric,
  rebounds numeric,
  assists numeric,
  steals numeric,
  blocks numeric,
  turnovers numeric,
  field_goals_made numeric,
  field_goals_attempted numeric,
  field_goal_percentage numeric,
  three_pointers_made numeric,
  three_pointers_attempted numeric,
  three_point_percentage numeric,
  free_throws_made numeric,
  free_throws_attempted numeric,
  free_throw_percentage numeric,
  usage_rate numeric,
  starter boolean,
  source_timestamp timestamptz,
  provider_ids jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (stat_type in ('season', 'game'))
);

create index if not exists sport_player_stats_player_idx
  on sport_player_stats (sport_key, league_key, season, player_id, stat_type);

create index if not exists sport_player_stats_event_idx
  on sport_player_stats (sport_key, league_key, event_id, team_id);

create index if not exists sport_player_stats_provider_idx
  on sport_player_stats using gin (provider_ids);

grant all privileges on table sport_player_stats to service_role;
grant select on table sport_player_stats to authenticated;
