-- Prediction Epoch Governance Seeding V1 precheck
-- Read-only. Run before applying:
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
    (select count(*) from public.prediction_epochs where epoch_key = 'DATA_FOUNDATION_V2_EPOCH' and status = 'ACTIVE') as active_v2_rows,
    (select count(*) from public.prediction_epochs where epoch_key = 'LEGACY_EPOCH_V1') as legacy_rows,
    (select count(*) from public.prediction_epochs where epoch_key = 'DATA_FOUNDATION_V2_EPOCH') as v2_rows,
    (select count(*) from public.prediction_epochs where status = 'ACTIVE' and epoch_key <> 'LEGACY_EPOCH_V1') as active_noncanonical_rows
),
canonical_conflicts as (
  select
    (select count(*)
     from public.prediction_epochs
     where epoch_key = 'LEGACY_EPOCH_V1'
       and not (
         epoch_name = 'Legacy Certified Prediction Epoch V1'
         and status = 'ACTIVE'
         and rollback_epoch_key is null
         and activated_at is not null
         and archived_at is null
       )) as conflicting_legacy_rows,
    (select count(*)
     from public.prediction_epochs
     where epoch_key = 'DATA_FOUNDATION_V2_EPOCH'
       and not (
         epoch_name = 'Historical Sports Data Foundation V2 Epoch'
         and status = 'SHADOW'
         and rollback_epoch_key = 'LEGACY_EPOCH_V1'
         and activated_at is null
         and archived_at is null
       )) as conflicting_v2_rows
),
checks as (
  select
    'prediction_epochs_table_exists' as check_name,
    to_regclass('public.prediction_epochs') is not null as passed,
    (to_regclass('public.prediction_epochs') is not null)::text as observed,
    'true' as expected
  union all
  select
    'prediction_history_epoch_id_column_exists',
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'prediction_history'
        and column_name = 'prediction_epoch_id'
    ),
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'prediction_history'
        and column_name = 'prediction_epoch_id'
    )::text,
    'true'
  union all
  select
    'prediction_history_epoch_key_column_exists',
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'prediction_history'
        and column_name = 'prediction_epoch_key'
    ),
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'prediction_history'
        and column_name = 'prediction_epoch_key'
    )::text,
    'true'
  union all
  select
    'migration_state_applied_empty_or_seeded_compatible',
    (epoch_rows = 0 and active_epoch_rows = 0)
      or (epoch_rows = 2 and active_epoch_rows = 1 and legacy_rows = 1 and v2_rows = 1 and active_v2_rows = 0),
    ('epoch_rows=' || epoch_rows || ', active_epoch_rows=' || active_epoch_rows || ', legacy_rows=' || legacy_rows || ', v2_rows=' || v2_rows || ', active_v2_rows=' || active_v2_rows),
    'empty table before first seed or exact two-row seeded state'
  from row_counts
  union all
  select
    'no_conflicting_legacy_epoch',
    conflicting_legacy_rows = 0,
    conflicting_legacy_rows::text,
    '0'
  from canonical_conflicts
  union all
  select
    'no_conflicting_v2_epoch',
    conflicting_v2_rows = 0,
    conflicting_v2_rows::text,
    '0'
  from canonical_conflicts
  union all
  select
    'no_noncanonical_active_epoch',
    active_noncanonical_rows = 0,
    active_noncanonical_rows::text,
    '0'
  from row_counts
  union all
  select
    'v2_not_active',
    active_v2_rows = 0,
    active_v2_rows::text,
    '0'
  from row_counts
  union all
  select
    'prediction_history_row_count_matches_certification',
    prediction_history_rows = expected_prediction_history_rows,
    prediction_history_rows::text,
    expected_prediction_history_rows::text
  from row_counts, expected
  union all
  select
    'settled_at_row_count_matches_certification',
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
  case when bool_and(passed) then 'PASS' else 'FAIL' end as precheck_status,
  count(*) as checks_run,
  count(*) filter (where passed) as checks_passed,
  count(*) filter (where not passed) as checks_failed
from checks;
