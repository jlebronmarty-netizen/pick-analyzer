alter table if exists prediction_history
  add column if not exists lifecycle_status text not null default 'generated',
  add column if not exists selection text,
  add column if not exists line numeric,
  add column if not exists projected_line numeric,
  add column if not exists odds_timestamp timestamptz,
  add column if not exists generated_at timestamptz not null default now(),
  add column if not exists cutoff_at timestamptz,
  add column if not exists model_version text,
  add column if not exists feature_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists validation_warnings jsonb not null default '[]'::jsonb,
  add column if not exists validation_status text not null default 'pending',
  add column if not exists skip_reason text,
  add column if not exists settlement_market text,
  add column if not exists settlement_source text,
  add column if not exists settlement_version text,
  add column if not exists settlement_details jsonb not null default '{}'::jsonb,
  add column if not exists manual_adjustment boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prediction_history_nba_lifecycle_status_check'
  ) then
    alter table prediction_history
      add constraint prediction_history_nba_lifecycle_status_check
      check (
        lifecycle_status in (
          'generated',
          'active',
          'skipped',
          'closed',
          'settled',
          'void'
        )
      ) not valid;
  end if;
end $$;

alter table if exists prediction_history
  validate constraint prediction_history_nba_lifecycle_status_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prediction_history_nba_validation_status_check'
  ) then
    alter table prediction_history
      add constraint prediction_history_nba_validation_status_check
      check (validation_status in ('pending', 'valid', 'skipped', 'failed')) not valid;
  end if;
end $$;

alter table if exists prediction_history
  validate constraint prediction_history_nba_validation_status_check;

create index if not exists prediction_history_nba_lifecycle_idx
  on prediction_history (sport_key, lifecycle_status, result, commence_time);

create index if not exists prediction_history_nba_event_market_idx
  on prediction_history (sport_key, game_id, market, team, sportsbook);

create index if not exists prediction_history_nba_settlement_backlog_idx
  on prediction_history (sport_key, result, lifecycle_status, commence_time)
  where sport_key = 'basketball_nba';

grant usage on schema public to service_role, authenticated;

grant all privileges on table provider_entity_mappings to service_role;
grant all privileges on table sports_sync_jobs to service_role;
grant all privileges on table sports_teams to service_role;
grant all privileges on table sport_events to service_role;
grant all privileges on table sport_standings to service_role;
grant all privileges on table sport_game_stats to service_role;
grant all privileges on table sport_players to service_role;
grant all privileges on table sport_injuries to service_role;
grant all privileges on table sports_odds_snapshots to service_role;
grant all privileges on table prediction_history to service_role;

grant select on table provider_entity_mappings to authenticated;
grant select on table sports_sync_jobs to authenticated;
grant select on table sports_teams to authenticated;
grant select on table sport_events to authenticated;
grant select on table sport_standings to authenticated;
grant select on table sport_game_stats to authenticated;
grant select on table sport_players to authenticated;
grant select on table sport_injuries to authenticated;
grant select on table sports_odds_snapshots to authenticated;
