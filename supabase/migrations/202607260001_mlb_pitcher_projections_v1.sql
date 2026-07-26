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

create index if not exists mlb_pitcher_projections_event_idx
  on mlb_pitcher_projections (event_id, projection_date, model_version);

create index if not exists mlb_pitcher_projections_pitcher_idx
  on mlb_pitcher_projections (pitcher_id, projection_date desc);

grant all privileges on table mlb_pitcher_projections to service_role;
grant select on table mlb_pitcher_projections to authenticated;
