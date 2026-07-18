create extension if not exists pgcrypto;

alter table if exists prediction_history
  add column if not exists is_current boolean not null default true,
  add column if not exists prediction_version integer not null default 1,
  add column if not exists model_role text not null default 'champion',
  add column if not exists prediction_group_key text,
  add column if not exists parent_prediction_id uuid references prediction_history(id),
  add column if not exists challenger_of_prediction_id uuid references prediction_history(id),
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_by_prediction_id uuid references prediction_history(id),
  add column if not exists version_created_reason text,
  add column if not exists idempotency_key text,
  add column if not exists version_lineage jsonb not null default '{}'::jsonb;

update prediction_history
set prediction_group_key = concat_ws(
  '|',
  sport_key,
  game_id,
  market,
  coalesce(team, selection, ''),
  coalesce(sportsbook, ''),
  coalesce(line::text, '')
)
where prediction_group_key is null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'prediction_history_unique_pick'
  ) then
    alter table prediction_history
      drop constraint prediction_history_unique_pick;
  end if;
end;
$$;

drop index if exists prediction_history_unique_pick;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prediction_history_model_role_check'
  ) then
    alter table prediction_history
      add constraint prediction_history_model_role_check
      check (model_role in ('champion', 'challenger', 'shadow', 'archived', 'rollback'));
  end if;
end;
$$;

alter table if exists prediction_history
  validate constraint prediction_history_model_role_check;

create unique index if not exists prediction_history_current_version_unique
  on prediction_history (prediction_group_key)
  where is_current = true;

create unique index if not exists prediction_history_version_lineage_unique
  on prediction_history (
    prediction_group_key,
    model_version,
    feature_set_version,
    coalesce(feature_snapshot_id::text, ''),
    coalesce(idempotency_key, '')
  );

create index if not exists prediction_history_versioning_lookup_idx
  on prediction_history (
    sport_key,
    game_id,
    market,
    is_current,
    model_role,
    model_version,
    feature_set_version
  );

create index if not exists prediction_history_version_lineage_gin_idx
  on prediction_history using gin (version_lineage);

grant all privileges on table prediction_history to service_role;
