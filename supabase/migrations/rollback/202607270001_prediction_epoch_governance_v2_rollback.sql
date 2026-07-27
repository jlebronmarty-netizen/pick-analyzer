-- Prediction Epoch Governance V2 rollback
--
-- ROLLBACK_ALLOWED_ONLY_BEFORE_EPOCH_ACTIVATION
--
-- This rollback removes only schema objects introduced by
-- 202607270001_prediction_epoch_governance_v2.sql.
--
-- It never deletes legacy predictions, never rewrites settled rows and never
-- removes production prediction history. It fails if epoch rows have been
-- inserted, DATA_FOUNDATION_V2_EPOCH has been activated, or prediction rows
-- have been linked to an epoch.

do $$
declare
  epoch_rows bigint := 0;
  active_v2_rows bigint := 0;
  linked_prediction_rows bigint := 0;
begin
  if to_regclass('public.prediction_epochs') is not null then
    execute 'select count(*) from public.prediction_epochs' into epoch_rows;
    execute 'select count(*) from public.prediction_epochs where epoch_key = ''DATA_FOUNDATION_V2_EPOCH'' and status = ''ACTIVE''' into active_v2_rows;
  end if;

  if to_regclass('public.prediction_history') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'prediction_history'
         and column_name = 'prediction_epoch_id'
     )
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'prediction_history'
         and column_name = 'prediction_epoch_key'
     ) then
    execute 'select count(*) from public.prediction_history where prediction_epoch_id is not null or prediction_epoch_key is not null' into linked_prediction_rows;
  end if;

  if active_v2_rows > 0 then
    raise exception 'Rollback blocked: DATA_FOUNDATION_V2_EPOCH is active. Manual deactivation and archival review required.';
  end if;

  if epoch_rows > 0 then
    raise exception 'Rollback blocked: prediction_epochs contains % row(s). Rollback is allowed only before epoch rows are inserted or activation begins.', epoch_rows;
  end if;

  if linked_prediction_rows > 0 then
    raise exception 'Rollback blocked: % prediction_history row(s) are epoch-linked. Rollback would orphan epoch lineage.', linked_prediction_rows;
  end if;
end $$;

drop policy if exists prediction_epochs_authenticated_select on public.prediction_epochs;
drop policy if exists prediction_epochs_service_role_all on public.prediction_epochs;

drop index if exists public.prediction_history_epoch_learning_idx;
drop index if exists public.prediction_history_epoch_performance_idx;
drop index if exists public.prediction_history_epoch_settlement_idx;
drop index if exists public.prediction_history_epoch_id_idx;
drop index if exists public.prediction_history_epoch_key_idx;
drop index if exists public.prediction_epochs_created_at_idx;
drop index if exists public.prediction_epochs_status_idx;
drop index if exists public.prediction_epochs_one_active_idx;

alter table if exists public.prediction_history
  drop constraint if exists prediction_history_prediction_epoch_id_fkey;

alter table if exists public.prediction_history
  drop column if exists prediction_epoch_id,
  drop column if exists prediction_epoch_key;

drop table if exists public.prediction_epochs;
