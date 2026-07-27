-- Prediction Epoch Governance Seeding V1 postcheck
-- Read-only. Run immediately after applying:
-- supabase/migrations/202607270002_prediction_epoch_governance_seed_v1.sql

with expected as (
  select
    1477::bigint as expected_prediction_history_rows,
    1396::bigint as expected_settled_at_rows,
    617::bigint as expected_sports_sync_jobs_rows,
    72270::bigint as expected_historical_feature_snapshot_rows
),
row_counts as (
  select
    (select count(*) from public.prediction_history) as prediction_history_rows,
    (select count(*) from public.prediction_history where settled_at is not null) as settled_at_rows,
    (select count(*) from public.prediction_history where prediction_epoch_id is not null or prediction_epoch_key is not null) as epoch_linked_prediction_rows,
    (select count(*) from public.sports_sync_jobs) as sports_sync_jobs_rows,
    (select count(*) from public.historical_feature_snapshots) as historical_feature_snapshot_rows,
    (select count(*) from public.prediction_epochs) as epoch_rows,
    (select count(*) from public.prediction_epochs where status = 'ACTIVE') as active_epoch_rows,
    (select count(*) from public.prediction_epochs where epoch_key = 'LEGACY_EPOCH_V1') as legacy_rows,
    (select count(*) from public.prediction_epochs where epoch_key = 'DATA_FOUNDATION_V2_EPOCH') as v2_rows,
    (select count(*) from public.prediction_epochs where epoch_key = 'DATA_FOUNDATION_V2_EPOCH' and status = 'ACTIVE') as active_v2_rows
),
checks as (
  select
    'legacy_epoch_one_row' as check_name,
    legacy_rows = 1 as passed,
    legacy_rows::text as observed,
    '1' as expected
  from row_counts
  union all
  select
    'data_foundation_v2_epoch_one_row',
    v2_rows = 1,
    v2_rows::text,
    '1'
  from row_counts
  union all
  select
    'legacy_epoch_active',
    exists (
      select 1 from public.prediction_epochs
      where epoch_key = 'LEGACY_EPOCH_V1'
        and epoch_name = 'Legacy Certified Prediction Epoch V1'
        and status = 'ACTIVE'
        and rollback_epoch_key is null
        and activated_at is not null
        and archived_at is null
    ),
    exists (
      select 1 from public.prediction_epochs
      where epoch_key = 'LEGACY_EPOCH_V1'
        and epoch_name = 'Legacy Certified Prediction Epoch V1'
        and status = 'ACTIVE'
        and rollback_epoch_key is null
        and activated_at is not null
        and archived_at is null
    )::text,
    'true'
  union all
  select
    'data_foundation_v2_epoch_shadow',
    exists (
      select 1 from public.prediction_epochs
      where epoch_key = 'DATA_FOUNDATION_V2_EPOCH'
        and epoch_name = 'Historical Sports Data Foundation V2 Epoch'
        and status = 'SHADOW'
        and rollback_epoch_key = 'LEGACY_EPOCH_V1'
        and activated_at is null
        and archived_at is null
    ),
    exists (
      select 1 from public.prediction_epochs
      where epoch_key = 'DATA_FOUNDATION_V2_EPOCH'
        and epoch_name = 'Historical Sports Data Foundation V2 Epoch'
        and status = 'SHADOW'
        and rollback_epoch_key = 'LEGACY_EPOCH_V1'
        and activated_at is null
        and archived_at is null
    )::text,
    'true'
  union all
  select
    'active_epoch_count_exactly_one',
    active_epoch_rows = 1,
    active_epoch_rows::text,
    '1'
  from row_counts
  union all
  select
    'v2_active_count_zero',
    active_v2_rows = 0,
    active_v2_rows::text,
    '0'
  from row_counts
  union all
  select
    'total_epoch_row_count_two',
    epoch_rows = 2,
    epoch_rows::text,
    '2'
  from row_counts
  union all
  select
    'prediction_history_row_count_unchanged',
    prediction_history_rows = expected_prediction_history_rows,
    prediction_history_rows::text,
    expected_prediction_history_rows::text
  from row_counts, expected
  union all
  select
    'settled_at_row_count_unchanged',
    settled_at_rows = expected_settled_at_rows,
    settled_at_rows::text,
    expected_settled_at_rows::text
  from row_counts, expected
  union all
  select
    'prediction_rows_not_epoch_linked',
    epoch_linked_prediction_rows = 0,
    epoch_linked_prediction_rows::text,
    '0'
  from row_counts
  union all
  select
    'sports_sync_jobs_count_unchanged',
    sports_sync_jobs_rows = expected_sports_sync_jobs_rows,
    sports_sync_jobs_rows::text,
    expected_sports_sync_jobs_rows::text
  from row_counts, expected
  union all
  select
    'historical_feature_snapshots_count_unchanged',
    historical_feature_snapshot_rows = expected_historical_feature_snapshot_rows,
    historical_feature_snapshot_rows::text,
    expected_historical_feature_snapshot_rows::text
  from row_counts, expected
)
select
  case when bool_and(passed) then 'PASS' else 'FAIL' end as postcheck_status,
  count(*) as checks_run,
  count(*) filter (where passed) as checks_passed,
  count(*) filter (where not passed) as checks_failed
from checks;
