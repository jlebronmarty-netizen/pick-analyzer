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

-- RLS state: intentionally not enabled. This follows the existing certified
-- platform pattern for service-owned sports state tables in this repo:
-- service_role performs writes through protected server APIs, authenticated
-- clients may read canonical assignment rows, and no anon/public write policy
-- is created. UI routes should continue to access this table through
-- server-side API handlers. Rows are source evidence, not betting advice.

create unique index if not exists mlb_starter_assignments_active_event_team_idx
  on mlb_starter_assignments (event_id, team_id)
  where valid_until is null;

-- Query-oriented active lookup for WHERE event_id = ? AND team_id = ?
-- AND valid_until IS NULL, separate from the uniqueness guard above.
create index if not exists mlb_starter_assignments_active_lookup_idx
  on mlb_starter_assignments (event_id, team_id, valid_from desc)
  where valid_until is null;

-- Supports all active assignments for an event.
create index if not exists mlb_starter_assignments_active_event_idx
  on mlb_starter_assignments (event_id, observed_at desc)
  where valid_until is null;

create index if not exists mlb_starter_assignments_event_idx
  on mlb_starter_assignments (event_id, status, role);

create index if not exists mlb_starter_assignments_pitcher_idx
  on mlb_starter_assignments (pitcher_id, observed_at desc);

-- Supports provider pitcher lookup while canonical player rows are pending.
create index if not exists mlb_starter_assignments_provider_pitcher_idx
  on mlb_starter_assignments (provider_pitcher_id, observed_at desc)
  where provider_pitcher_id is not null;

create index if not exists mlb_starter_assignments_historical_pitcher_idx
  on mlb_starter_assignments (historical_pitcher_id, observed_at desc);

-- Supports source recency audits and replacement/scratch investigations.
create index if not exists mlb_starter_assignments_source_updated_idx
  on mlb_starter_assignments (source_updated_at desc)
  where source_updated_at is not null;

grant all privileges on table mlb_starter_assignments to service_role;
grant select on table mlb_starter_assignments to authenticated;

comment on table mlb_starter_assignments is
  'Additive MLB current-starter assignment table. RLS intentionally not enabled per existing certified service-owned table pattern; service_role writes through protected server APIs and authenticated read access is canonical assignment evidence only.';
