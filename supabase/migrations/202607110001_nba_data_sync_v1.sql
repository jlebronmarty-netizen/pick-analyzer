create extension if not exists pgcrypto;

create table if not exists provider_entity_mappings (
  id uuid primary key default gen_random_uuid(),
  sport_key text not null,
  entity_type text not null,
  internal_id text not null,
  provider text not null,
  provider_id text not null,
  season text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sport_key, entity_type, provider, provider_id, season)
);

create index if not exists provider_entity_mappings_lookup_idx
  on provider_entity_mappings (sport_key, entity_type, internal_id);

create table if not exists sports_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  sport_key text not null,
  league_key text,
  provider text not null,
  season text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running',
  records_fetched integer not null default 0,
  records_inserted integer not null default 0,
  records_updated integer not null default 0,
  records_skipped integer not null default 0,
  error_count integer not null default 0,
  last_error text,
  duration_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('pending', 'running', 'completed', 'partial', 'failed'))
);

create index if not exists sports_sync_jobs_sport_status_idx
  on sports_sync_jobs (sport_key, job_type, status, started_at desc);

create table if not exists sports_teams (
  id text primary key,
  sport_key text not null,
  league_key text not null,
  name text not null,
  abbreviation text,
  city text,
  conference text,
  division text,
  logo_url text,
  active boolean not null default true,
  provider_ids jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sport_key, league_key, name)
);

create index if not exists sports_teams_provider_idx
  on sports_teams using gin (provider_ids);

create table if not exists sport_events (
  id text primary key,
  sport_key text not null,
  league_key text not null,
  season text not null,
  stage text,
  home_team_id text references sports_teams(id),
  away_team_id text references sports_teams(id),
  home_team text not null,
  away_team text not null,
  start_time timestamptz not null,
  venue text,
  status text not null,
  home_score integer,
  away_score integer,
  period_scores jsonb not null default '{}'::jsonb,
  overtime boolean not null default false,
  provider_ids jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('scheduled', 'live', 'completed', 'postponed', 'cancelled'))
);

create index if not exists sport_events_sport_start_idx
  on sport_events (sport_key, start_time);

create index if not exists sport_events_provider_idx
  on sport_events using gin (provider_ids);

create table if not exists sport_standings (
  id text primary key,
  sport_key text not null,
  league_key text not null,
  season text not null,
  team_id text not null,
  team_name text not null,
  conference text,
  division text,
  conference_rank integer,
  division_rank integer,
  wins integer not null default 0,
  losses integer not null default 0,
  win_percentage numeric,
  games_behind numeric,
  home_record text,
  away_record text,
  streak text,
  last_ten text,
  clinched jsonb not null default '{}'::jsonb,
  provider_ids jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (team_id) references sports_teams(id),
  unique (sport_key, league_key, season, team_id)
);

create index if not exists sport_standings_sport_season_idx
  on sport_standings (sport_key, season, conference, division);

create table if not exists sport_game_stats (
  id text primary key,
  sport_key text not null,
  league_key text not null,
  season text not null,
  event_id text not null,
  team_id text not null,
  team_name text not null,
  opponent_team_id text,
  opponent_team_name text,
  is_home boolean not null,
  points_for integer,
  points_against integer,
  first_half_points integer,
  quarter_scores jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  provider_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (event_id) references sport_events(id),
  foreign key (team_id) references sports_teams(id),
  unique (sport_key, event_id, team_id)
);

create index if not exists sport_game_stats_team_idx
  on sport_game_stats (sport_key, season, team_id);

create table if not exists sport_players (
  id text primary key,
  sport_key text not null,
  league_key text not null,
  team_id text references sports_teams(id),
  team_name text,
  display_name text not null,
  position text,
  jersey text,
  status text,
  height text,
  weight text,
  birth_date date,
  nationality text,
  active boolean not null default true,
  provider_ids jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sport_players_team_idx
  on sport_players (sport_key, team_id, active);

create table if not exists sport_injuries (
  id text primary key,
  sport_key text not null,
  league_key text not null,
  player_id text references sport_players(id),
  player_name text,
  team_id text references sports_teams(id),
  team_name text,
  injury_type text,
  status text not null,
  description text,
  reported_date date,
  expected_return date,
  source text,
  provider_ids jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status in (
      'active',
      'probable',
      'questionable',
      'doubtful',
      'out',
      'day-to-day',
      'inactive'
    )
  )
);

create index if not exists sport_injuries_team_status_idx
  on sport_injuries (sport_key, team_id, status, updated_at desc);

create table if not exists sports_odds_snapshots (
  id text primary key,
  sport_key text not null,
  league_key text not null,
  season text,
  event_id text not null,
  provider text not null,
  sportsbook text not null,
  market text not null,
  outcome text not null,
  price numeric,
  line numeric,
  snapshot_time timestamptz not null,
  is_opening boolean not null default false,
  is_closing boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sports_odds_snapshots_event_idx
  on sports_odds_snapshots (sport_key, event_id, snapshot_time desc);

create index if not exists sports_odds_snapshots_market_idx
  on sports_odds_snapshots (sport_key, market, sportsbook, snapshot_time desc);
