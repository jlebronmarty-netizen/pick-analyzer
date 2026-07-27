create table if not exists prediction_epochs (
  id uuid primary key default gen_random_uuid(),
  epoch_key text not null unique,
  epoch_name text not null,
  status text not null,
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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prediction_epochs_status_check'
  ) then
    alter table prediction_epochs
      add constraint prediction_epochs_status_check
      check (status in ('ACTIVE', 'ARCHIVED', 'SHADOW', 'MIGRATION_READY', 'BLOCKED'));
  end if;
end $$;

alter table if exists prediction_history
  add column if not exists prediction_epoch_id uuid references prediction_epochs(id),
  add column if not exists prediction_epoch_key text;

create index if not exists prediction_epochs_status_idx
  on prediction_epochs (status, epoch_key);

create index if not exists prediction_history_epoch_key_idx
  on prediction_history (prediction_epoch_key, sport_key, commence_time);

create index if not exists prediction_history_epoch_id_idx
  on prediction_history (prediction_epoch_id, sport_key, commence_time);

grant all privileges on table prediction_epochs to service_role;
