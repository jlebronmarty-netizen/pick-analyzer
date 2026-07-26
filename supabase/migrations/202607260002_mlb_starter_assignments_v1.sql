create table if not exists mlb_starter_assignments (
  id text primary key,
  event_id text not null references sport_events(id),
  team_id text references sports_teams(id),
  opponent_team_id text references sports_teams(id),
  pitcher_id text,
  provider_pitcher_id text,
  historical_pitcher_id text,
  role text not null,
  status text not null,
  source text not null,
  source_updated_at timestamptz,
  observed_at timestamptz not null,
  confirmed_at timestamptz,
  valid_from timestamptz,
  valid_until timestamptz,
  mapping_status text not null,
  mapping_method text not null,
  confidence numeric not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role in ('STARTER', 'OPENER', 'BULK', 'UNKNOWN')),
  check (status in ('CONFIRMED', 'PROBABLE', 'EXPECTED', 'UNDECIDED', 'SCRATCHED', 'REPLACED')),
  check (mapping_status in ('EXACT_PROVIDER_ID', 'EXACT_MLB_ID', 'EXACT_CANONICAL_MAPPING', 'EXACT_NAME_TEAM', 'REVIEW_REQUIRED', 'AMBIGUOUS', 'UNMAPPED')),
  check (confidence >= 0 and confidence <= 100)
);

create unique index if not exists mlb_starter_assignments_active_event_team_idx
  on mlb_starter_assignments (event_id, team_id)
  where valid_until is null;

create index if not exists mlb_starter_assignments_event_idx
  on mlb_starter_assignments (event_id, status, role);

create index if not exists mlb_starter_assignments_pitcher_idx
  on mlb_starter_assignments (pitcher_id, observed_at desc);

create index if not exists mlb_starter_assignments_historical_pitcher_idx
  on mlb_starter_assignments (historical_pitcher_id, observed_at desc);

grant all privileges on table mlb_starter_assignments to service_role;
grant select on table mlb_starter_assignments to authenticated;
