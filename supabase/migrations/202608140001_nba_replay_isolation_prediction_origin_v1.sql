-- NBA Replay Isolation Prediction Origin V1
--
-- Additive/non-destructive migration for historical replay regime isolation.
-- This migration does not backfill rows, alter existing prediction semantics,
-- activate NBA production, create Official Picks, settle predictions, queue
-- production learning, or change production calibration.

alter table if exists public.prediction_history
  add column if not exists prediction_origin text,
  add column if not exists certification_status text,
  add column if not exists certification_metadata jsonb;

do $$
declare
  invalid_origin_count integer;
begin
  select count(*)
    into invalid_origin_count
  from public.prediction_history
  where prediction_origin is not null
    and prediction_origin not in (
      'LIVE_PREGAME',
      'HISTORICAL_WALK_FORWARD_REPLAY',
      'HISTORICAL_REPLAY_SHADOW',
      'LEGACY_PRE_CERTIFICATION'
    );

  if invalid_origin_count > 0 then
    raise exception 'prediction_history contains % invalid prediction_origin value(s); migration blocked before constraint replacement', invalid_origin_count;
  end if;

  alter table public.prediction_history
    drop constraint if exists prediction_history_prediction_origin_check;

  alter table public.prediction_history
    add constraint prediction_history_prediction_origin_check
    check (
      prediction_origin is null
      or prediction_origin in (
        'LIVE_PREGAME',
        'HISTORICAL_WALK_FORWARD_REPLAY',
        'HISTORICAL_REPLAY_SHADOW',
        'LEGACY_PRE_CERTIFICATION'
      )
    );
end $$;

do $$
declare
  invalid_status_count integer;
begin
  select count(*)
    into invalid_status_count
  from public.prediction_history
  where certification_status is not null
    and certification_status not in (
      'SHADOW_PENDING',
      'CERTIFIED',
      'QUARANTINED',
      'INVALID',
      'REJECTED'
    );

  if invalid_status_count > 0 then
    raise exception 'prediction_history contains % invalid certification_status value(s); migration blocked before constraint replacement', invalid_status_count;
  end if;

  alter table public.prediction_history
    drop constraint if exists prediction_history_certification_status_check;

  alter table public.prediction_history
    add constraint prediction_history_certification_status_check
    check (
      certification_status is null
      or certification_status in (
        'SHADOW_PENDING',
        'CERTIFIED',
        'QUARANTINED',
        'INVALID',
        'REJECTED'
      )
    );
end $$;

create index if not exists prediction_history_replay_origin_lookup_idx
  on public.prediction_history (
    sport_key,
    prediction_origin,
    model_version,
    feature_set_version,
    commence_time
  )
  where prediction_origin = 'HISTORICAL_REPLAY_SHADOW';

create index if not exists prediction_history_certification_lookup_idx
  on public.prediction_history (prediction_origin, certification_status, sport_key, commence_time);

create index if not exists prediction_history_certification_metadata_idx
  on public.prediction_history using gin (certification_metadata);

comment on column public.prediction_history.prediction_origin is
  'Nullable explicit prediction regime. HISTORICAL_REPLAY_SHADOW rows are replay diagnostics only and must be excluded from current product, Official Pick, production settlement, production learning and production calibration paths by default.';

comment on column public.prediction_history.certification_status is
  'Nullable certification lifecycle for shadow/replay governance. This migration does not certify, promote, settle or recommend rows.';

comment on column public.prediction_history.certification_metadata is
  'Nullable isolated certification metadata for replay lineage/readiness evidence. This migration does not backfill rows.';

grant all privileges on table public.prediction_history to service_role;
