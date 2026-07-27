-- Prediction Epoch Governance V2 precheck
-- Read-only. Run before applying:
-- supabase/migrations/202607270001_prediction_epoch_governance_v2.sql

with expected as (
  select
    1477::bigint as expected_prediction_history_rows,
    617::bigint as expected_sports_sync_jobs_rows,
    72270::bigint as expected_historical_feature_snapshot_rows
),
inventory as (
  select
    to_regclass('public.prediction_history') is not null as prediction_history_exists,
    to_regclass('public.sports_sync_jobs') is not null as sports_sync_jobs_exists,
    to_regclass('public.historical_feature_snapshots') is not null as historical_feature_snapshots_exists,
    to_regclass('public.prediction_epochs') is not null as prediction_epochs_exists,
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where p.proname = 'gen_random_uuid'
        and n.nspname in ('public', 'extensions', 'pg_catalog')
    ) as gen_random_uuid_available
),
prediction_columns as (
  select
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'prediction_history'
        and column_name = 'prediction_epoch_id'
    ) as prediction_epoch_id_exists,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'prediction_history'
        and column_name = 'prediction_epoch_key'
    ) as prediction_epoch_key_exists
),
row_counts as (
  select
    (select count(*) from public.prediction_history) as prediction_history_rows,
    (select count(*) from public.sports_sync_jobs) as sports_sync_jobs_rows,
    (select count(*) from public.historical_feature_snapshots) as historical_feature_snapshot_rows
),
duplicate_candidates as (
  select
    count(*) filter (where duplicate_count > 1) as duplicate_prediction_identity_groups
  from (
    select
      sport_key,
      game_id,
      market,
      team,
      model_version,
      generated_at,
      count(*) as duplicate_count
    from public.prediction_history
    group by sport_key, game_id, market, team, model_version, generated_at
  ) grouped
),
checks as (
  select
    'required_table_prediction_history_exists' as check_name,
    prediction_history_exists as passed,
    prediction_history_exists::text as observed,
    'true' as expected
  from inventory
  union all
  select
    'required_table_sports_sync_jobs_exists',
    sports_sync_jobs_exists,
    sports_sync_jobs_exists::text,
    'true'
  from inventory
  union all
  select
    'required_table_historical_feature_snapshots_exists',
    historical_feature_snapshots_exists,
    historical_feature_snapshots_exists::text,
    'true'
  from inventory
  union all
  select
    'prediction_epochs_not_already_present',
    not prediction_epochs_exists,
    prediction_epochs_exists::text,
    'false'
  from inventory
  union all
  select
    'gen_random_uuid_available',
    gen_random_uuid_available,
    gen_random_uuid_available::text,
    'true'
  from inventory
  union all
  select
    'prediction_epoch_id_column_not_already_present',
    not prediction_epoch_id_exists,
    prediction_epoch_id_exists::text,
    'false'
  from prediction_columns
  union all
  select
    'prediction_epoch_key_column_not_already_present',
    not prediction_epoch_key_exists,
    prediction_epoch_key_exists::text,
    'false'
  from prediction_columns
  union all
  select
    'prediction_history_row_count_matches_certification',
    prediction_history_rows = expected_prediction_history_rows,
    prediction_history_rows::text,
    expected_prediction_history_rows::text
  from row_counts, expected
  union all
  select
    'sports_sync_jobs_row_count_matches_certification',
    sports_sync_jobs_rows = expected_sports_sync_jobs_rows,
    sports_sync_jobs_rows::text,
    expected_sports_sync_jobs_rows::text
  from row_counts, expected
  union all
  select
    'historical_feature_snapshots_row_count_matches_certification',
    historical_feature_snapshot_rows = expected_historical_feature_snapshot_rows,
    historical_feature_snapshot_rows::text,
    expected_historical_feature_snapshot_rows::text
  from row_counts, expected
  union all
  select
    'duplicate_prediction_identity_groups_report_only',
    true,
    duplicate_prediction_identity_groups::text,
    'report_only'
  from duplicate_candidates
)
select
  case when bool_and(passed) then 'PASS' else 'FAIL' end as precheck_status,
  count(*) as checks_run,
  count(*) filter (where passed) as checks_passed,
  count(*) filter (where not passed) as checks_failed
from checks;

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
    (select count(*) from public.historical_feature_snapshots) as historical_feature_snapshot_rows
)
select
  'row_count_snapshot' as section,
  prediction_history_rows,
  expected_prediction_history_rows,
  sports_sync_jobs_rows,
  expected_sports_sync_jobs_rows,
  historical_feature_snapshot_rows,
  expected_historical_feature_snapshot_rows
from row_counts, expected;

with duplicate_candidates as (
  select
    sport_key,
    game_id,
    market,
    team,
    model_version,
    generated_at,
    count(*) as duplicate_count
  from public.prediction_history
  group by sport_key, game_id, market, team, model_version, generated_at
  having count(*) > 1
)
select
  'duplicate_prediction_identity_groups_report_only' as section,
  count(*) as duplicate_groups
from duplicate_candidates;
