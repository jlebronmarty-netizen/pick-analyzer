create extension if not exists pgcrypto;

create table if not exists historical_feature_snapshots (
  id uuid primary key default gen_random_uuid(),
  deterministic_key text not null,
  sport_key text not null,
  league_key text,
  event_id text references sport_events(id),
  provider_event_id text,
  market text not null,
  prediction_cutoff timestamptz not null,
  as_of_timestamp timestamptz not null,
  generated_at timestamptz not null default now(),
  model_version text not null,
  feature_set_version text not null,
  snapshot_version integer not null default 1,
  feature_values jsonb not null default '{}'::jsonb,
  feature_lineage jsonb not null default '{}'::jsonb,
  source_timestamps jsonb not null default '{}'::jsonb,
  data_quality_score numeric,
  data_sufficiency_score numeric,
  unresolved_mapping_count integer not null default 0,
  leakage_status text not null default 'unknown',
  leakage_warnings jsonb not null default '[]'::jsonb,
  trial boolean not null default true,
  scrambled boolean not null default false,
  production_eligible boolean not null default false,
  generation_job_id uuid references sports_sync_jobs(id),
  immutable_after_prediction_link boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deterministic_key),
  check (snapshot_version >= 1),
  check (unresolved_mapping_count >= 0),
  check (data_quality_score is null or (data_quality_score >= 0 and data_quality_score <= 100)),
  check (data_sufficiency_score is null or (data_sufficiency_score >= 0 and data_sufficiency_score <= 100)),
  check (leakage_status in ('passed', 'warning', 'blocked', 'unknown')),
  check (prediction_cutoff <= as_of_timestamp),
  check (not production_eligible or (trial = false and scrambled = false))
);

create index if not exists historical_feature_snapshots_sport_event_idx
  on historical_feature_snapshots (
    sport_key,
    event_id,
    market,
    prediction_cutoff,
    model_version,
    feature_set_version
  );

create index if not exists historical_feature_snapshots_cutoff_idx
  on historical_feature_snapshots (sport_key, market, prediction_cutoff desc);

create index if not exists historical_feature_snapshots_production_idx
  on historical_feature_snapshots (sport_key, production_eligible, trial, scrambled);

create index if not exists historical_feature_snapshots_lineage_idx
  on historical_feature_snapshots using gin (feature_lineage);

create index if not exists historical_feature_snapshots_values_idx
  on historical_feature_snapshots using gin (feature_values);

alter table if exists prediction_history
  add column if not exists feature_snapshot_id uuid references historical_feature_snapshots(id),
  add column if not exists feature_snapshot_key text,
  add column if not exists feature_set_version text,
  add column if not exists feature_snapshot_generated_at timestamptz,
  add column if not exists production_eligible boolean not null default false,
  add column if not exists trial boolean not null default false,
  add column if not exists scrambled boolean not null default false;

create or replace function prevent_linked_feature_snapshot_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.immutable_after_prediction_link
    and exists (
      select 1
      from prediction_history
      where feature_snapshot_id = old.id
      limit 1
    )
    and (
      old.deterministic_key is distinct from new.deterministic_key
      or old.sport_key is distinct from new.sport_key
      or old.league_key is distinct from new.league_key
      or old.event_id is distinct from new.event_id
      or old.market is distinct from new.market
      or old.prediction_cutoff is distinct from new.prediction_cutoff
      or old.as_of_timestamp is distinct from new.as_of_timestamp
      or old.model_version is distinct from new.model_version
      or old.feature_set_version is distinct from new.feature_set_version
      or old.snapshot_version is distinct from new.snapshot_version
      or old.feature_values is distinct from new.feature_values
      or old.feature_lineage is distinct from new.feature_lineage
      or old.source_timestamps is distinct from new.source_timestamps
      or old.leakage_status is distinct from new.leakage_status
      or old.trial is distinct from new.trial
      or old.scrambled is distinct from new.scrambled
      or old.production_eligible is distinct from new.production_eligible
    )
  then
    raise exception 'prediction-linked historical feature snapshots are immutable; create a new snapshot version instead';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists historical_feature_snapshots_immutability_trg
  on historical_feature_snapshots;

create trigger historical_feature_snapshots_immutability_trg
before update on historical_feature_snapshots
for each row
execute function prevent_linked_feature_snapshot_mutation();

create index if not exists prediction_history_feature_snapshot_idx
  on prediction_history (feature_snapshot_id);

create index if not exists prediction_history_feature_lineage_idx
  on prediction_history (
    sport_key,
    game_id,
    market,
    model_version,
    feature_set_version,
    feature_snapshot_id
  );

create index if not exists prediction_history_production_eligibility_idx
  on prediction_history (sport_key, production_eligible, trial, scrambled);

grant all privileges on table historical_feature_snapshots to service_role;
grant select on table historical_feature_snapshots to authenticated;
