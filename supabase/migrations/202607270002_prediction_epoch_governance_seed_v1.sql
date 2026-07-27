-- Prediction Epoch Governance Seeding V1
--
-- Manual seed scope:
-- - Insert exactly two governance rows when absent:
--   LEGACY_EPOCH_V1 and DATA_FOUNDATION_V2_EPOCH.
-- - Keep LEGACY_EPOCH_V1 as the single ACTIVE fallback epoch.
-- - Keep DATA_FOUNDATION_V2_EPOCH as SHADOW and inactive.
-- - Do not update prediction_history, backfill epoch links, activate V2,
--   archive legacy, change scheduler behavior, run imports or rebuild features.
--
-- This file is intentionally additive and idempotent. It fails before insert
-- if canonical epoch keys already exist with conflicting governance values.

do $$
declare
  conflicting_legacy_rows integer;
  conflicting_v2_rows integer;
  active_noncanonical_rows integer;
  active_v2_rows integer;
  linked_prediction_rows integer;
begin
  if to_regclass('public.prediction_epochs') is null then
    raise exception 'Prediction epoch seed blocked: public.prediction_epochs does not exist. Apply schema migration 202607270001 first.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'prediction_history'
      and column_name = 'prediction_epoch_id'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'prediction_history'
      and column_name = 'prediction_epoch_key'
  ) then
    raise exception 'Prediction epoch seed blocked: prediction_history epoch columns are not visible.';
  end if;

  select count(*) into linked_prediction_rows
  from public.prediction_history
  where prediction_epoch_id is not null
     or prediction_epoch_key is not null;

  if linked_prediction_rows <> 0 then
    raise exception 'Prediction epoch seed blocked: % prediction_history row(s) are already linked to an epoch. This gate must not run after backfill.', linked_prediction_rows;
  end if;

  select count(*) into active_noncanonical_rows
  from public.prediction_epochs
  where status = 'ACTIVE'
    and epoch_key <> 'LEGACY_EPOCH_V1';

  if active_noncanonical_rows <> 0 then
    raise exception 'Prediction epoch seed blocked: % noncanonical active epoch row(s) exist.', active_noncanonical_rows;
  end if;

  select count(*) into active_v2_rows
  from public.prediction_epochs
  where epoch_key = 'DATA_FOUNDATION_V2_EPOCH'
    and status = 'ACTIVE';

  if active_v2_rows <> 0 then
    raise exception 'Prediction epoch seed blocked: DATA_FOUNDATION_V2_EPOCH is already ACTIVE.';
  end if;

  select count(*) into conflicting_legacy_rows
  from public.prediction_epochs
  where epoch_key = 'LEGACY_EPOCH_V1'
    and not (
      epoch_name = 'Legacy Certified Prediction Epoch V1'
      and status = 'ACTIVE'
      and rollback_epoch_key is null
      and activated_at is not null
      and archived_at is null
    );

  if conflicting_legacy_rows <> 0 then
    raise exception 'Prediction epoch seed blocked: LEGACY_EPOCH_V1 exists with conflicting values.';
  end if;

  select count(*) into conflicting_v2_rows
  from public.prediction_epochs
  where epoch_key = 'DATA_FOUNDATION_V2_EPOCH'
    and not (
      epoch_name = 'Historical Sports Data Foundation V2 Epoch'
      and status = 'SHADOW'
      and rollback_epoch_key = 'LEGACY_EPOCH_V1'
      and activated_at is null
      and archived_at is null
    );

  if conflicting_v2_rows <> 0 then
    raise exception 'Prediction epoch seed blocked: DATA_FOUNDATION_V2_EPOCH exists with conflicting values.';
  end if;
end $$;

insert into public.prediction_epochs (
  epoch_key,
  epoch_name,
  status,
  training_window_start,
  training_window_end,
  data_window_start,
  data_window_end,
  model_versions,
  feature_versions,
  activation_reason,
  rollback_epoch_key,
  activated_at,
  archived_at,
  metadata
)
values (
  'LEGACY_EPOCH_V1',
  'Legacy Certified Prediction Epoch V1',
  'ACTIVE',
  null,
  null,
  null,
  null,
  '["legacy_certified_platform", "v1.0-platform-certified"]'::jsonb,
  '["legacy_certified_platform", "pre_epoch_governance_rows"]'::jsonb,
  'Certified legacy production behavior preserved during V2 governance rollout',
  null,
  now(),
  null,
  jsonb_build_object(
    'seed_phase', 'PREDICTION_EPOCH_GOVERNANCE_SEEDING_V1',
    'source_commit', '0ef408be1ddea79f56b04a0c1a5fc92411bbb61b',
    'certified_platform_commit', 'eb15613efd81ff1a8e57797e11feb7254c1b604a',
    'activation_scope', 'legacy_fallback_only',
    'activation_timestamp_source', 'manual_seed_execution_timestamp',
    'prediction_history_backfilled', false,
    'scheduler_behavior_changed', false,
    'settlement_behavior_changed', false,
    'historical_imports_executed', false,
    'feature_rebuilds_executed', false
  )
)
on conflict (epoch_key) do nothing;

insert into public.prediction_epochs (
  epoch_key,
  epoch_name,
  status,
  training_window_start,
  training_window_end,
  data_window_start,
  data_window_end,
  model_versions,
  feature_versions,
  activation_reason,
  rollback_epoch_key,
  activated_at,
  archived_at,
  metadata
)
values (
  'DATA_FOUNDATION_V2_EPOCH',
  'Historical Sports Data Foundation V2 Epoch',
  'SHADOW',
  null,
  null,
  null,
  null,
  '["data_foundation_v2_contracts", "migration_ready_only"]'::jsonb,
  '["sports_data_warehouse_v2_contract", "feature_rebuild_plan_v2_not_executed"]'::jsonb,
  'Historical Sports Data Foundation V2 migration-ready governance row; activation pending separate approval',
  'LEGACY_EPOCH_V1',
  null,
  null,
  jsonb_build_object(
    'seed_phase', 'PREDICTION_EPOCH_GOVERNANCE_SEEDING_V1',
    'source_commit', '0ef408be1ddea79f56b04a0c1a5fc92411bbb61b',
    'certified_platform_commit', 'eb15613efd81ff1a8e57797e11feb7254c1b604a',
    'activation_scope', 'shadow_governance_only',
    'production_historical_imports_complete', false,
    'production_feature_rebuild_complete', false,
    'production_v2_predictions_exist', false,
    'prediction_history_backfilled', false,
    'scheduler_behavior_changed', false,
    'settlement_behavior_changed', false,
    'historical_imports_executed', false,
    'feature_rebuilds_executed', false
  )
)
on conflict (epoch_key) do nothing;

do $$
declare
  legacy_rows integer;
  v2_rows integer;
  active_rows integer;
  active_v2_rows integer;
begin
  select count(*) into legacy_rows
  from public.prediction_epochs
  where epoch_key = 'LEGACY_EPOCH_V1'
    and status = 'ACTIVE'
    and rollback_epoch_key is null
    and activated_at is not null
    and archived_at is null;

  select count(*) into v2_rows
  from public.prediction_epochs
  where epoch_key = 'DATA_FOUNDATION_V2_EPOCH'
    and status = 'SHADOW'
    and rollback_epoch_key = 'LEGACY_EPOCH_V1'
    and activated_at is null
    and archived_at is null;

  select count(*) into active_rows
  from public.prediction_epochs
  where status = 'ACTIVE';

  select count(*) into active_v2_rows
  from public.prediction_epochs
  where epoch_key = 'DATA_FOUNDATION_V2_EPOCH'
    and status = 'ACTIVE';

  if legacy_rows <> 1 then
    raise exception 'Prediction epoch seed failed: expected exactly one active LEGACY_EPOCH_V1 row, observed %.', legacy_rows;
  end if;

  if v2_rows <> 1 then
    raise exception 'Prediction epoch seed failed: expected exactly one shadow DATA_FOUNDATION_V2_EPOCH row, observed %.', v2_rows;
  end if;

  if active_rows <> 1 then
    raise exception 'Prediction epoch seed failed: expected exactly one active epoch row, observed %.', active_rows;
  end if;

  if active_v2_rows <> 0 then
    raise exception 'Prediction epoch seed failed: DATA_FOUNDATION_V2_EPOCH must remain inactive.';
  end if;
end $$;
