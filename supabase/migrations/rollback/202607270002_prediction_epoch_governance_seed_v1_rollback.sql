-- Prediction Epoch Governance Seeding V1 rollback
--
-- ROLLBACK_ALLOWED_ONLY_BEFORE_EPOCH_LINKING_OR_V2_ACTIVATION
--
-- This rollback removes only unused governance rows introduced by:
-- supabase/migrations/202607270002_prediction_epoch_governance_seed_v1.sql
--
-- It must not delete predictions, modify prediction_history, rewrite
-- settlements, change learning labels or remove schema objects from
-- migration 202607270001.

do $$
declare
  linked_prediction_rows integer;
  active_v2_rows integer;
  noncanonical_rows integer;
begin
  if to_regclass('public.prediction_epochs') is null then
    raise exception 'Seed rollback blocked: public.prediction_epochs does not exist.';
  end if;

  select count(*) into linked_prediction_rows
  from public.prediction_history
  where prediction_epoch_id in (
    select id
    from public.prediction_epochs
    where epoch_key in ('LEGACY_EPOCH_V1', 'DATA_FOUNDATION_V2_EPOCH')
  )
     or prediction_epoch_key in ('LEGACY_EPOCH_V1', 'DATA_FOUNDATION_V2_EPOCH');

  if linked_prediction_rows <> 0 then
    raise exception 'Seed rollback blocked: % prediction_history row(s) are linked to seed epochs.', linked_prediction_rows;
  end if;

  select count(*) into active_v2_rows
  from public.prediction_epochs
  where epoch_key = 'DATA_FOUNDATION_V2_EPOCH'
    and (
      status = 'ACTIVE'
      or activated_at is not null
      or archived_at is not null
    );

  if active_v2_rows <> 0 then
    raise exception 'Seed rollback blocked: DATA_FOUNDATION_V2_EPOCH has activation or archive evidence.';
  end if;

  select count(*) into noncanonical_rows
  from public.prediction_epochs
  where epoch_key in ('LEGACY_EPOCH_V1', 'DATA_FOUNDATION_V2_EPOCH')
    and not (
      (
        epoch_key = 'LEGACY_EPOCH_V1'
        and epoch_name = 'Legacy Certified Prediction Epoch V1'
        and status = 'ACTIVE'
        and rollback_epoch_key is null
        and activated_at is not null
        and archived_at is null
      )
      or (
        epoch_key = 'DATA_FOUNDATION_V2_EPOCH'
        and epoch_name = 'Historical Sports Data Foundation V2 Epoch'
        and status = 'SHADOW'
        and rollback_epoch_key = 'LEGACY_EPOCH_V1'
        and activated_at is null
        and archived_at is null
      )
    );

  if noncanonical_rows <> 0 then
    raise exception 'Seed rollback blocked: canonical seed rows have changed since seeding.';
  end if;
end $$;

delete from public.prediction_epochs
where epoch_key in ('DATA_FOUNDATION_V2_EPOCH', 'LEGACY_EPOCH_V1');
