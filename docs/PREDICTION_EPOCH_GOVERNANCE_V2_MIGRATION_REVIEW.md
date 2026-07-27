# Prediction Epoch Governance V2 Migration Review

Status: `MIGRATION_READY_FOR_MANUAL_APPLICATION`

Reviewed migration:

`supabase/migrations/202607270001_prediction_epoch_governance_v2.sql`

This review covers the hardened migration only. The migration has not been applied to production and does not activate `DATA_FOUNDATION_V2_EPOCH`.

## SQL Inventory

Tables created:

- `public.prediction_epochs`

Existing tables altered:

- `public.prediction_history`

Columns created:

- `prediction_epochs.id uuid primary key default gen_random_uuid()`
- `prediction_epochs.epoch_key text not null unique`
- `prediction_epochs.epoch_name text not null`
- `prediction_epochs.status text not null default 'MIGRATION_READY'`
- `prediction_epochs.training_window_start timestamptz`
- `prediction_epochs.training_window_end timestamptz`
- `prediction_epochs.data_window_start timestamptz`
- `prediction_epochs.data_window_end timestamptz`
- `prediction_epochs.model_versions jsonb not null default '[]'::jsonb`
- `prediction_epochs.feature_versions jsonb not null default '[]'::jsonb`
- `prediction_epochs.activation_reason text`
- `prediction_epochs.rollback_epoch_key text`
- `prediction_epochs.created_at timestamptz not null default now()`
- `prediction_epochs.activated_at timestamptz`
- `prediction_epochs.archived_at timestamptz`
- `prediction_epochs.metadata jsonb not null default '{}'::jsonb`
- `prediction_history.prediction_epoch_id uuid null`
- `prediction_history.prediction_epoch_key text null`

Columns altered:

- None. Existing columns are not rewritten or changed.

Indexes created:

- `prediction_epochs_one_active_idx`
- `prediction_epochs_status_idx`
- `prediction_epochs_created_at_idx`
- `prediction_history_epoch_key_idx`
- `prediction_history_epoch_id_idx`
- `prediction_history_epoch_settlement_idx`
- `prediction_history_epoch_performance_idx`
- `prediction_history_epoch_learning_idx`

Unique constraints:

- `prediction_epochs.epoch_key`
- `prediction_epochs_one_active_idx`, enforcing at most one `ACTIVE` epoch row.

Foreign keys:

- `prediction_history.prediction_epoch_id -> prediction_epochs.id` with `on update restrict` and `on delete restrict`.

Check constraints:

- `prediction_epochs_status_check`
- `prediction_epochs_window_check`
- `prediction_epochs_activation_check`

Triggers:

- None.

Functions:

- None.

Views:

- None.

RLS enablement:

- RLS enabled on `public.prediction_epochs`.

RLS policies:

- `prediction_epochs_service_role_all`: service-role full access.
- `prediction_epochs_authenticated_select`: authenticated read access only.

Grants:

- `select` on `prediction_epochs` to `authenticated`.
- `all privileges` on `prediction_epochs` to `service_role`.

Seed rows:

- None.

Default rows:

- None.

Comments:

- Comments added on `prediction_epochs`, `prediction_epochs.status`, `prediction_history.prediction_epoch_id` and `prediction_history.prediction_epoch_key`.

Backfills:

- None.

Updates:

- None.

Deletes:

- None.

Drops:

- None in the root migration.

Statement counts:

- Destructive statements: 0
- `UPDATE`: 0
- `DELETE`: 0
- `DROP`: 0
- `TRUNCATE`: 0
- `ALTER TYPE`: 0

## Production Compatibility

Applying the migration alone does not require immediate code changes or epoch activation.

The deployed code already handles the migration-pending state by reporting read-only contract responses from `/api/data-foundation/epochs`, `/api/data-foundation/legacy-metrics`, `/api/data-foundation/future-predictions` and `/api/data-foundation/epoch-performance`.

The migration does not change:

- prediction settlement
- current dashboard behavior
- Current Board filtering
- Most Likely
- Best Value
- Probability Picks
- performance APIs
- calibration APIs
- learning labels
- scheduler behavior
- operating-day behavior
- feature store rows
- historical replay contracts

## Existing Data Compatibility

All added columns on `prediction_history` are nullable.

The new foreign key is safe because the migration does not populate `prediction_history.prediction_epoch_id`; existing rows remain null and valid.

The unique `epoch_key` constraint is safe because the table is new.

The single-active-epoch unique partial index is safe because the migration inserts no epoch rows.

Legacy prediction rows, settled rows and non-production/trial rows remain valid and visible to existing queries.

No existing row becomes invisible by default because no deployed production query filters on `prediction_epoch_key` until a separate activation gate.

## Activation Separation

The migration does not:

- insert an `ACTIVE` V2 epoch
- insert any epoch rows
- archive `LEGACY_EPOCH_V1`
- update prediction rows to V2
- change active epoch selection
- change scheduler configuration
- change performance filtering

`DATA_FOUNDATION_V2_EPOCH` activation remains a separate later gate.

## RLS And Security Review

`prediction_epochs` has RLS enabled.

Service-role behavior:

- service-role can select, insert, update and delete rows through `prediction_epochs_service_role_all`.

Authenticated-user behavior:

- authenticated users can read rows through `prediction_epochs_authenticated_select`.
- authenticated users cannot insert, update or delete rows unless granted a later explicit policy.

Anonymous-user behavior:

- no anon grant or policy is created.
- anonymous clients cannot mutate `prediction_epochs`.

Epoch activation and archival are not writable by normal clients.

## Index Review

The index set supports:

- active epoch lookup: `prediction_epochs_one_active_idx`, `prediction_epochs_status_idx`
- prediction lookup by epoch: `prediction_history_epoch_key_idx`, `prediction_history_epoch_id_idx`
- prediction lookup by sport and epoch: `prediction_history_epoch_key_idx`, `prediction_history_epoch_id_idx`
- settlement lookup by epoch: `prediction_history_epoch_settlement_idx`
- performance aggregation by epoch: `prediction_history_epoch_performance_idx`
- calibration aggregation by epoch/model version/generated time: `prediction_history_epoch_performance_idx`
- learning-label lookup by epoch: `prediction_history_epoch_learning_idx`
- created-at filtering on epochs: `prediction_epochs_created_at_idx`
- generated-at filtering: `prediction_history_epoch_performance_idx`
- status filtering: `prediction_history_epoch_settlement_idx`
- model-version filtering: `prediction_history_epoch_performance_idx`

No duplicate existing epoch indexes are present because the epoch columns do not currently exist in production.

## Concurrency And Locking

Risk level: low for the certified production size.

Known production counts from deployment certification:

- `prediction_history`: 1477
- `sports_sync_jobs`: 617
- `historical_feature_snapshots`: 72270

Locking notes:

- `create table` affects only the new table.
- `alter table prediction_history add column` requires a brief table lock but adds nullable columns without defaults.
- `add foreign key` validates nullable existing rows; current table size is small.
- normal `create index` on `prediction_history` briefly locks writes; current table size is small enough for SQL Editor application.
- no long-running data backfill exists.
- no transaction contains mass row writes.
- Supabase/PostgREST schema cache may need a short refresh after application.

Recommended application blocks:

1. Precheck.
2. Root migration.
3. Postcheck.
4. API smoke.
5. UI smoke.

## Rollback

Rollback file:

`supabase/migrations/rollback/202607270001_prediction_epoch_governance_v2_rollback.sql`

Rollback is guarded by:

- no active `DATA_FOUNDATION_V2_EPOCH`
- zero rows in `prediction_epochs`
- zero epoch-linked rows in `prediction_history`

Rollback classification:

`ROLLBACK_ALLOWED_ONLY_BEFORE_EPOCH_ACTIVATION`

After epoch rows are inserted or prediction rows are linked, rollback must become a separate lineage-preserving deactivation/archive plan rather than dropping epoch objects.

## Final Classification

`MIGRATION_READY_FOR_MANUAL_APPLICATION`

Certifications:

`PREDICTION_EPOCH_MIGRATION_REVIEW_PASS`

`PREDICTION_EPOCH_NO_DESTRUCTIVE_SQL_PASS`

`PREDICTION_EPOCH_NO_AUTO_ACTIVATION_PASS`

`LEGACY_PREDICTION_PRESERVATION_PASS`

`PREDICTION_EPOCH_RLS_PASS`

`PREDICTION_EPOCH_INDEX_PASS`

`PREDICTION_EPOCH_PRECHECK_PASS`

`PREDICTION_EPOCH_POSTCHECK_PASS`

`PREDICTION_EPOCH_ROLLBACK_PASS`

`PREDICTION_EPOCH_RUNBOOK_PASS`

`NO_CERTIFIED_PLATFORM_REGRESSION_PASS`
