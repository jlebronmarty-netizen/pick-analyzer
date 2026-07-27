-- Prediction Epoch Governance V2
--
-- Safe application scope:
-- - Additive schema contract only.
-- - No seed rows.
-- - No prediction_history backfill.
-- - No epoch activation.
-- - No scheduler, settlement, metric, learning or feature-rebuild changes.

create table if not exists public.prediction_epochs (
  id uuid primary key default gen_random_uuid(),
  epoch_key text not null unique,
  epoch_name text not null,
  status text not null default 'MIGRATION_READY',
  training_window_start timestamptz,
  training_window_end timestamptz,
  data_window_start timestamptz,
  data_window_end timestamptz,
  model_versions jsonb not null default '[]'::jsonb,
  feature_versions jsonb not null default '[]'::jsonb,
  activation_reason text,
  rollback_epoch_key text,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  archived_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.prediction_epochs
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists epoch_key text,
  add column if not exists epoch_name text,
  add column if not exists status text default 'MIGRATION_READY',
  add column if not exists training_window_start timestamptz,
  add column if not exists training_window_end timestamptz,
  add column if not exists data_window_start timestamptz,
  add column if not exists data_window_end timestamptz,
  add column if not exists model_versions jsonb default '[]'::jsonb,
  add column if not exists feature_versions jsonb default '[]'::jsonb,
  add column if not exists activation_reason text,
  add column if not exists rollback_epoch_key text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists activated_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists metadata jsonb default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prediction_epochs_pkey'
      and conrelid = 'public.prediction_epochs'::regclass
  ) then
    alter table public.prediction_epochs
      add constraint prediction_epochs_pkey primary key (id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prediction_epochs_epoch_key_key'
      and conrelid = 'public.prediction_epochs'::regclass
  ) then
    alter table public.prediction_epochs
      add constraint prediction_epochs_epoch_key_key unique (epoch_key);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prediction_epochs_status_check'
      and conrelid = 'public.prediction_epochs'::regclass
  ) then
    alter table public.prediction_epochs
      add constraint prediction_epochs_status_check
      check (status in ('ACTIVE', 'ARCHIVED', 'SHADOW', 'MIGRATION_READY', 'BLOCKED'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prediction_epochs_window_check'
      and conrelid = 'public.prediction_epochs'::regclass
  ) then
    alter table public.prediction_epochs
      add constraint prediction_epochs_window_check
      check (
        (training_window_start is null or training_window_end is null or training_window_start <= training_window_end)
        and (data_window_start is null or data_window_end is null or data_window_start <= data_window_end)
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prediction_epochs_activation_check'
      and conrelid = 'public.prediction_epochs'::regclass
  ) then
    alter table public.prediction_epochs
      add constraint prediction_epochs_activation_check
      check (
        (status = 'ACTIVE' and activated_at is not null and archived_at is null)
        or (status = 'ARCHIVED' and archived_at is not null)
        or (status in ('SHADOW', 'MIGRATION_READY', 'BLOCKED') and activated_at is null and archived_at is null)
      );
  end if;
end $$;

alter table if exists public.prediction_history
  add column if not exists prediction_epoch_id uuid,
  add column if not exists prediction_epoch_key text;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'prediction_history'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'prediction_history_prediction_epoch_id_fkey'
      and conrelid = 'public.prediction_history'::regclass
  ) then
    alter table public.prediction_history
      add constraint prediction_history_prediction_epoch_id_fkey
      foreign key (prediction_epoch_id)
      references public.prediction_epochs(id)
      on update restrict
      on delete restrict;
  end if;
end $$;

create unique index if not exists prediction_epochs_one_active_idx
  on public.prediction_epochs ((status))
  where status = 'ACTIVE';

create index if not exists prediction_epochs_status_idx
  on public.prediction_epochs (status, epoch_key);

create index if not exists prediction_epochs_created_at_idx
  on public.prediction_epochs (created_at desc);

create index if not exists prediction_history_epoch_key_idx
  on public.prediction_history (prediction_epoch_key, sport_key, commence_time);

create index if not exists prediction_history_epoch_id_idx
  on public.prediction_history (prediction_epoch_id, sport_key, commence_time);

create index if not exists prediction_history_epoch_settlement_idx
  on public.prediction_history (prediction_epoch_key, sport_key, status, result, settled_at);

create index if not exists prediction_history_epoch_performance_idx
  on public.prediction_history (prediction_epoch_key, sport_key, model_version, generated_at);

create index if not exists prediction_history_epoch_learning_idx
  on public.prediction_history (prediction_epoch_key, feature_snapshot_id, settled_at);

alter table public.prediction_epochs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'prediction_epochs'
      and policyname = 'prediction_epochs_service_role_all'
  ) then
    create policy prediction_epochs_service_role_all
      on public.prediction_epochs
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'prediction_epochs'
      and policyname = 'prediction_epochs_authenticated_select'
  ) then
    create policy prediction_epochs_authenticated_select
      on public.prediction_epochs
      for select
      to authenticated
      using (true);
  end if;
end $$;

grant select on table public.prediction_epochs to authenticated;
grant all privileges on table public.prediction_epochs to service_role;

comment on table public.prediction_epochs is
  'Prediction epoch governance registry. This migration creates the contract only; it does not seed, activate, archive, backfill or mutate prediction rows.';
comment on column public.prediction_epochs.status is
  'Allowed values: ACTIVE, ARCHIVED, SHADOW, MIGRATION_READY, BLOCKED. DATA_FOUNDATION_V2_EPOCH activation is a separate manual gate.';
comment on column public.prediction_history.prediction_epoch_id is
  'Nullable link to prediction_epochs for future epoch-aware reporting. Existing legacy rows remain valid when null.';
comment on column public.prediction_history.prediction_epoch_key is
  'Nullable denormalized epoch key for future epoch-aware filters. This migration does not backfill or activate epoch filtering.';
