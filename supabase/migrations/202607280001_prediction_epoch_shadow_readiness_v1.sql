-- Prediction Epoch Shadow Readiness V1
--
-- Additive contract only.
-- Do not apply in production until explicitly approved.
-- This migration does not backfill prediction_history, activate epochs,
-- mark rows production_eligible, run replay, alter recommendation policy,
-- or modify prediction outputs.

alter table if exists public.prediction_history
  add column if not exists prediction_origin text,
  add column if not exists certification_status text,
  add column if not exists certification_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prediction_history_prediction_origin_check'
      and conrelid = 'public.prediction_history'::regclass
  ) then
    alter table public.prediction_history
      add constraint prediction_history_prediction_origin_check
      check (
        prediction_origin is null
        or prediction_origin in ('LIVE_PREGAME', 'HISTORICAL_WALK_FORWARD_REPLAY', 'LEGACY_PRE_CERTIFICATION')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prediction_history_certification_status_check'
      and conrelid = 'public.prediction_history'::regclass
  ) then
    alter table public.prediction_history
      add constraint prediction_history_certification_status_check
      check (
        certification_status is null
        or certification_status in ('SHADOW_PENDING', 'CERTIFIED', 'QUARANTINED', 'INVALID', 'REJECTED')
      );
  end if;
end $$;

create index if not exists prediction_history_certification_lookup_idx
  on public.prediction_history (prediction_origin, certification_status, sport_key, commence_time);

create index if not exists prediction_history_certification_metadata_idx
  on public.prediction_history using gin (certification_metadata);

comment on column public.prediction_history.prediction_origin is
  'Nullable future governance field. Allowed values: LIVE_PREGAME, HISTORICAL_WALK_FORWARD_REPLAY, LEGACY_PRE_CERTIFICATION. This migration does not backfill rows.';

comment on column public.prediction_history.certification_status is
  'Nullable future governance field. Allowed values: SHADOW_PENDING, CERTIFIED, QUARANTINED, INVALID, REJECTED. This migration does not certify or promote rows.';

comment on column public.prediction_history.certification_metadata is
  'Future isolated certification evidence metadata for lineage/readiness gates. Existing rows keep empty metadata until an approved bounded mutation plan exists.';

