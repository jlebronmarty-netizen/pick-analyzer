create table if not exists mlb_pitcher_projections (
  id text primary key,
  event_id text not null references sport_events(id),
  pitcher_id text not null,
  provider_pitcher_id text,
  projection_date date not null,
  starter_status text not null,
  projected_outs numeric,
  projected_innings numeric,
  projected_pitch_count numeric,
  projected_strikeouts numeric,
  projected_hits_allowed numeric,
  projected_earned_runs numeric,
  outs_distribution jsonb not null default '{}'::jsonb,
  threshold_probabilities jsonb not null default '{}'::jsonb,
  confidence numeric not null,
  quality_score numeric not null,
  data_sufficiency text not null,
  feature_snapshot jsonb not null default '{}'::jsonb,
  drivers jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  model_version text not null,
  generated_at timestamptz not null,
  cutoff_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starter_status in ('CONFIRMED', 'PROBABLE', 'EXPECTED', 'UNVERIFIED')),
  check (data_sufficiency in ('FULL', 'STANDARD', 'LIMITED', 'INSUFFICIENT')),
  check (projected_outs is null or (projected_outs >= 0 and projected_outs <= 27)),
  check (confidence >= 0 and confidence <= 100),
  check (quality_score >= 0 and quality_score <= 100)
);

-- RLS state: intentionally not enabled. This follows the existing certified
-- platform pattern for service-owned projection/history tables in this repo:
-- service_role performs writes through server APIs, authenticated clients may
-- read projection-only rows, and no anon/public write policy is created.
-- UI routes should continue to access this table through server-side API
-- handlers; this table must not be used for sportsbook recommendations,
-- official picks, stakes, or portfolio selection.

create index if not exists mlb_pitcher_projections_event_idx
  on mlb_pitcher_projections (event_id, projection_date, model_version);

create index if not exists mlb_pitcher_projections_pitcher_idx
  on mlb_pitcher_projections (pitcher_id, projection_date desc);

-- Supports provider pitcher lookups and latest provider-scoped rows while
-- canonical sport_players rows are pending.
create index if not exists mlb_pitcher_projections_provider_pitcher_generated_idx
  on mlb_pitcher_projections (provider_pitcher_id, generated_at desc)
  where provider_pitcher_id is not null;

-- Supports latest projections globally and recent generation audits.
create index if not exists mlb_pitcher_projections_generated_idx
  on mlb_pitcher_projections (generated_at desc);

-- Supports latest projections by event without relying on projection_date
-- granularity.
create index if not exists mlb_pitcher_projections_event_generated_idx
  on mlb_pitcher_projections (event_id, generated_at desc);

-- Supports latest projections by canonical or provider-scoped pitcher ID.
create index if not exists mlb_pitcher_projections_pitcher_generated_idx
  on mlb_pitcher_projections (pitcher_id, generated_at desc);

grant all privileges on table mlb_pitcher_projections to service_role;
grant select on table mlb_pitcher_projections to authenticated;

comment on table mlb_pitcher_projections is
  'Additive MLB pitcher recorded-outs projection table. RLS intentionally not enabled per existing certified service-owned table pattern; service_role writes through server APIs and authenticated read access is projection-only.';
