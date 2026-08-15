-- Current Era Shadow Origin V1
--
-- Additive/non-destructive migration for forward shadow prediction governance.
-- This migration does not backfill rows, mutate existing predictions, activate
-- NBA production, create Official Picks, settle predictions, queue production
-- learning, or change production calibration.

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
      'LEGACY_PRE_CERTIFICATION',
      'CURRENT_ERA_SHADOW'
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
        'LEGACY_PRE_CERTIFICATION',
        'CURRENT_ERA_SHADOW'
      )
    );
end $$;

create index if not exists prediction_history_current_era_shadow_lookup_idx
  on public.prediction_history (
    sport_key,
    prediction_origin,
    model_version,
    feature_set_version,
    commence_time
  )
  where prediction_origin = 'CURRENT_ERA_SHADOW';

comment on column public.prediction_history.prediction_origin is
  'Nullable explicit prediction regime. CURRENT_ERA_SHADOW rows are real forward pregame shadow predictions and must be excluded from product recommendations, Official Picks, production calibration and production learning until a later explicit promotion.';
