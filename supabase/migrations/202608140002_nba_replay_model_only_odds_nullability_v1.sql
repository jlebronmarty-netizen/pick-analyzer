-- NBA Replay Model-Only Odds Nullability V1
--
-- Additive/non-destructive migration for historical replay persistence.
-- This migration permits odds to be null only for isolated
-- HISTORICAL_REPLAY_SHADOW model-only rows with certified no-price metadata.
-- It does not backfill rows, update existing rows, change RLS, activate NBA
-- production, create Official Picks, settle predictions, queue production
-- learning, or change production calibration.

alter table public.prediction_history
  alter column odds drop not null;

alter table public.prediction_history
  drop constraint if exists prediction_history_replay_model_only_odds_check;

alter table public.prediction_history
  add constraint prediction_history_replay_model_only_odds_check
  check (
    odds is not null
    or (
      coalesce(prediction_origin, '') = 'HISTORICAL_REPLAY_SHADOW'
      and coalesce(production_eligible, true) = false
      and coalesce(recommended_pick, true) = false
      and coalesce(is_current, true) = false
      and coalesce(model_role, '') = 'shadow'
      and coalesce(certification_status, '') in ('CERTIFIED', 'SHADOW_PENDING')
      and coalesce(certification_metadata ->> 'priceAware', '') = 'false'
      and coalesce(certification_metadata ->> 'priceEvidenceMode', '') in (
        'MODEL_ONLY_NO_CERTIFIED_PRICE',
        'PRICE_AWARE_FIRST_HALF_UNAVAILABLE'
      )
      and coalesce(certification_metadata ->> 'currentEra', '') = 'false'
      and coalesce(certification_metadata ->> 'officialPickEligible', '') = 'false'
      and coalesce(certification_metadata ->> 'productionCalibrationEligible', '') = 'false'
      and coalesce(certification_metadata ->> 'productionLearningEligible', '') = 'false'
      and coalesce(certification_metadata ->> 'productSurfaceVisible', '') = 'false'
    )
  );

comment on constraint prediction_history_replay_model_only_odds_check
  on public.prediction_history is
  'Allows odds NULL only for isolated HISTORICAL_REPLAY_SHADOW model-only replay rows with certified no-price metadata. Current/live, official, price-aware replay, product, production learning and production calibration rows still require odds.';
