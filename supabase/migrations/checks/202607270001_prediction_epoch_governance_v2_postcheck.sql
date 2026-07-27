-- Prediction Epoch Governance V2 postcheck
-- Read-only. Run immediately after applying:
-- supabase/migrations/202607270001_prediction_epoch_governance_v2.sql

with expected as (
  select
    1477::bigint as expected_prediction_history_rows,
    617::bigint as expected_sports_sync_jobs_rows,
    72270::bigint as expected_historical_feature_snapshot_rows
),
row_counts as (
  select
    (select count(*) from public.prediction_history) as prediction_history_rows,
    (select count(*) from public.sports_sync_jobs) as sports_sync_jobs_rows,
    (select count(*) from public.historical_feature_snapshots) as historical_feature_snapshot_rows,
    (select count(*) from public.prediction_history where prediction_epoch_id is not null or prediction_epoch_key is not null) as epoch_linked_prediction_rows,
    (select count(*) from public.prediction_epochs where epoch_key = 'DATA_FOUNDATION_V2_EPOCH' and status = 'ACTIVE') as active_v2_epochs,
    (select count(*) from public.prediction_epochs where status = 'ACTIVE') as active_epoch_rows,
    (select count(*) from public.prediction_epochs) as prediction_epoch_rows
),
checks as (
  select
    'prediction_epochs_table_exists' as check_name,
    to_regclass('public.prediction_epochs') is not null as passed,
    (to_regclass('public.prediction_epochs') is not null)::text as observed,
    'true' as expected
  union all
  select
    'prediction_history_prediction_epoch_id_column_exists',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'prediction_history'
        and column_name = 'prediction_epoch_id'
        and is_nullable = 'YES'
    ),
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'prediction_history'
        and column_name = 'prediction_epoch_id'
        and is_nullable = 'YES'
    )::text,
    'true'
  union all
  select
    'prediction_history_prediction_epoch_key_column_exists',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'prediction_history'
        and column_name = 'prediction_epoch_key'
        and is_nullable = 'YES'
    ),
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'prediction_history'
        and column_name = 'prediction_epoch_key'
        and is_nullable = 'YES'
    )::text,
    'true'
  union all
  select
    'rls_enabled_prediction_epochs',
    relrowsecurity,
    relrowsecurity::text,
    'true'
  from pg_class
  where oid = 'public.prediction_epochs'::regclass
  union all
  select
    'service_role_all_policy_exists',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'prediction_epochs'
        and policyname = 'prediction_epochs_service_role_all'
    ),
    exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'prediction_epochs'
        and policyname = 'prediction_epochs_service_role_all'
    )::text,
    'true'
  union all
  select
    'authenticated_select_policy_exists',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'prediction_epochs'
        and policyname = 'prediction_epochs_authenticated_select'
    ),
    exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'prediction_epochs'
        and policyname = 'prediction_epochs_authenticated_select'
    )::text,
    'true'
  union all
  select
    'prediction_history_row_count_unchanged',
    prediction_history_rows = expected_prediction_history_rows,
    prediction_history_rows::text,
    expected_prediction_history_rows::text
  from row_counts, expected
  union all
  select
    'sports_sync_jobs_row_count_unchanged',
    sports_sync_jobs_rows = expected_sports_sync_jobs_rows,
    sports_sync_jobs_rows::text,
    expected_sports_sync_jobs_rows::text
  from row_counts, expected
  union all
  select
    'historical_feature_snapshots_row_count_unchanged',
    historical_feature_snapshot_rows = expected_historical_feature_snapshot_rows,
    historical_feature_snapshot_rows::text,
    expected_historical_feature_snapshot_rows::text
  from row_counts, expected
  union all
  select
    'no_prediction_rows_reclassified',
    epoch_linked_prediction_rows = 0,
    epoch_linked_prediction_rows::text,
    '0'
  from row_counts
  union all
  select
    'data_foundation_v2_epoch_not_active',
    active_v2_epochs = 0,
    active_v2_epochs::text,
    '0'
  from row_counts
  union all
  select
    'no_epoch_rows_seeded_by_migration',
    prediction_epoch_rows = 0,
    prediction_epoch_rows::text,
    '0'
  from row_counts
)
select
  case when bool_and(passed) then 'PASS' else 'FAIL' end as postcheck_status,
  count(*) as checks_run,
  count(*) filter (where passed) as checks_passed,
  count(*) filter (where not passed) as checks_failed
from checks;

select
  'indexes' as section,
  indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'prediction_epochs_one_active_idx',
    'prediction_epochs_status_idx',
    'prediction_epochs_created_at_idx',
    'prediction_history_epoch_key_idx',
    'prediction_history_epoch_id_idx',
    'prediction_history_epoch_settlement_idx',
    'prediction_history_epoch_performance_idx',
    'prediction_history_epoch_learning_idx'
  )
order by indexname;

select
  'constraints' as section,
  conname
from pg_constraint
where conrelid in ('public.prediction_epochs'::regclass, 'public.prediction_history'::regclass)
  and conname in (
    'prediction_epochs_pkey',
    'prediction_epochs_epoch_key_key',
    'prediction_epochs_status_check',
    'prediction_epochs_window_check',
    'prediction_epochs_activation_check',
    'prediction_history_prediction_epoch_id_fkey'
  )
order by conname;
