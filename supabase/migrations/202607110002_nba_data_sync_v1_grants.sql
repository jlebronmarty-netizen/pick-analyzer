grant usage on schema public to service_role;

grant all privileges on table provider_entity_mappings to service_role;
grant all privileges on table sports_sync_jobs to service_role;
grant all privileges on table sports_teams to service_role;
grant all privileges on table sport_events to service_role;
grant all privileges on table sport_standings to service_role;
grant all privileges on table sport_game_stats to service_role;
grant all privileges on table sport_players to service_role;
grant all privileges on table sport_injuries to service_role;
grant all privileges on table sports_odds_snapshots to service_role;

grant select on table provider_entity_mappings to authenticated;
grant select on table sports_sync_jobs to authenticated;
grant select on table sports_teams to authenticated;
grant select on table sport_events to authenticated;
grant select on table sport_standings to authenticated;
grant select on table sport_game_stats to authenticated;
grant select on table sport_players to authenticated;
grant select on table sport_injuries to authenticated;
grant select on table sports_odds_snapshots to authenticated;
