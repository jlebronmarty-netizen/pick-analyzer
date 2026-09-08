-- PROPOSAL ONLY: production DDL requires explicit user authorization.
-- Preserves every row, primary key and FK. Replaces native singleton uniqueness
-- with one row per canonical snapshot; retains legacy NULL-target uniqueness.
-- Application snapshot-pinned reads and R2T-R3 are required before live enablement.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
lock table public.pick2_mlb_team_daily_features, public.pick2_mlb_pitcher_daily_features, public.pick2_mlb_bullpen_daily_features, public.pick2_mlb_batter_daily_features, public.pick2_mlb_matchup_daily_features, public.pick2_mlb_first_inning_daily_features in access exclusive mode;
do $preflight$
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pick2_mlb_batter_daily_featur_player_id_feature_date_featur_key' and indexdef = 'CREATE UNIQUE INDEX pick2_mlb_batter_daily_featur_player_id_feature_date_featur_key ON public.pick2_mlb_batter_daily_features USING btree (player_id, feature_date, feature_version)') then
    raise exception 'SCHEMA_DRIFT:pick2_mlb_batter_daily_featur_player_id_feature_date_featur_key';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pick2_mlb_batter_daily_features_native_uidx' and indexdef = 'CREATE UNIQUE INDEX pick2_mlb_batter_daily_features_native_uidx ON public.pick2_mlb_batter_daily_features USING btree (target_game_pk, mlbam_batter_id, feature_date, feature_version) WHERE ((target_game_pk IS NOT NULL) AND (mlbam_batter_id IS NOT NULL))') then
    raise exception 'SCHEMA_DRIFT:pick2_mlb_batter_daily_features_native_uidx';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pick2_mlb_batter_daily_features_pkey' and indexdef = 'CREATE UNIQUE INDEX pick2_mlb_batter_daily_features_pkey ON public.pick2_mlb_batter_daily_features USING btree (id)') then
    raise exception 'SCHEMA_DRIFT:pick2_mlb_batter_daily_features_pkey';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pick2_mlb_bullpen_daily_features_native_uidx' and indexdef = 'CREATE UNIQUE INDEX pick2_mlb_bullpen_daily_features_native_uidx ON public.pick2_mlb_bullpen_daily_features USING btree (target_game_pk, team_id, feature_date, feature_version) WHERE (target_game_pk IS NOT NULL)') then
    raise exception 'SCHEMA_DRIFT:pick2_mlb_bullpen_daily_features_native_uidx';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pick2_mlb_bullpen_daily_features_pkey' and indexdef = 'CREATE UNIQUE INDEX pick2_mlb_bullpen_daily_features_pkey ON public.pick2_mlb_bullpen_daily_features USING btree (id)') then
    raise exception 'SCHEMA_DRIFT:pick2_mlb_bullpen_daily_features_pkey';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pick2_mlb_bullpen_daily_features_target_game_team_version_key' and indexdef = 'CREATE UNIQUE INDEX pick2_mlb_bullpen_daily_features_target_game_team_version_key ON public.pick2_mlb_bullpen_daily_features USING btree (target_game_pk, team_id, feature_version) WHERE (target_game_pk IS NOT NULL)') then
    raise exception 'SCHEMA_DRIFT:pick2_mlb_bullpen_daily_features_target_game_team_version_key';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pick2_mlb_first_inning_daily__event_id_feature_date_feature_key' and indexdef = 'CREATE UNIQUE INDEX pick2_mlb_first_inning_daily__event_id_feature_date_feature_key ON public.pick2_mlb_first_inning_daily_features USING btree (event_id, feature_date, feature_version)') then
    raise exception 'SCHEMA_DRIFT:pick2_mlb_first_inning_daily__event_id_feature_date_feature_key';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pick2_mlb_first_inning_daily_features_native_uidx' and indexdef = 'CREATE UNIQUE INDEX pick2_mlb_first_inning_daily_features_native_uidx ON public.pick2_mlb_first_inning_daily_features USING btree (target_game_pk, feature_date, feature_version) WHERE (target_game_pk IS NOT NULL)') then
    raise exception 'SCHEMA_DRIFT:pick2_mlb_first_inning_daily_features_native_uidx';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pick2_mlb_first_inning_daily_features_pkey' and indexdef = 'CREATE UNIQUE INDEX pick2_mlb_first_inning_daily_features_pkey ON public.pick2_mlb_first_inning_daily_features USING btree (id)') then
    raise exception 'SCHEMA_DRIFT:pick2_mlb_first_inning_daily_features_pkey';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pick2_mlb_matchup_daily_featu_event_id_feature_date_feature_key' and indexdef = 'CREATE UNIQUE INDEX pick2_mlb_matchup_daily_featu_event_id_feature_date_feature_key ON public.pick2_mlb_matchup_daily_features USING btree (event_id, feature_date, feature_version)') then
    raise exception 'SCHEMA_DRIFT:pick2_mlb_matchup_daily_featu_event_id_feature_date_feature_key';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pick2_mlb_matchup_daily_features_native_uidx' and indexdef = 'CREATE UNIQUE INDEX pick2_mlb_matchup_daily_features_native_uidx ON public.pick2_mlb_matchup_daily_features USING btree (target_game_pk, feature_date, feature_version) WHERE (target_game_pk IS NOT NULL)') then
    raise exception 'SCHEMA_DRIFT:pick2_mlb_matchup_daily_features_native_uidx';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pick2_mlb_matchup_daily_features_pkey' and indexdef = 'CREATE UNIQUE INDEX pick2_mlb_matchup_daily_features_pkey ON public.pick2_mlb_matchup_daily_features USING btree (id)') then
    raise exception 'SCHEMA_DRIFT:pick2_mlb_matchup_daily_features_pkey';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pick2_mlb_pitcher_daily_featu_player_id_feature_date_featur_key' and indexdef = 'CREATE UNIQUE INDEX pick2_mlb_pitcher_daily_featu_player_id_feature_date_featur_key ON public.pick2_mlb_pitcher_daily_features USING btree (player_id, feature_date, feature_version)') then
    raise exception 'SCHEMA_DRIFT:pick2_mlb_pitcher_daily_featu_player_id_feature_date_featur_key';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pick2_mlb_pitcher_daily_features_native_uidx' and indexdef = 'CREATE UNIQUE INDEX pick2_mlb_pitcher_daily_features_native_uidx ON public.pick2_mlb_pitcher_daily_features USING btree (target_game_pk, mlbam_pitcher_id, feature_date, feature_version) WHERE ((target_game_pk IS NOT NULL) AND (mlbam_pitcher_id IS NOT NULL))') then
    raise exception 'SCHEMA_DRIFT:pick2_mlb_pitcher_daily_features_native_uidx';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pick2_mlb_pitcher_daily_features_pkey' and indexdef = 'CREATE UNIQUE INDEX pick2_mlb_pitcher_daily_features_pkey ON public.pick2_mlb_pitcher_daily_features USING btree (id)') then
    raise exception 'SCHEMA_DRIFT:pick2_mlb_pitcher_daily_features_pkey';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pick2_mlb_team_daily_features_native_uidx' and indexdef = 'CREATE UNIQUE INDEX pick2_mlb_team_daily_features_native_uidx ON public.pick2_mlb_team_daily_features USING btree (target_game_pk, team_id, feature_date, feature_version) WHERE (target_game_pk IS NOT NULL)') then
    raise exception 'SCHEMA_DRIFT:pick2_mlb_team_daily_features_native_uidx';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pick2_mlb_team_daily_features_pkey' and indexdef = 'CREATE UNIQUE INDEX pick2_mlb_team_daily_features_pkey ON public.pick2_mlb_team_daily_features USING btree (id)') then
    raise exception 'SCHEMA_DRIFT:pick2_mlb_team_daily_features_pkey';
  end if;
  if exists (select feature_snapshot_id from public.pick2_mlb_team_daily_features where target_game_pk is not null group by feature_snapshot_id having count(*) > 1) then
    raise exception 'DUPLICATE_NATIVE_SNAPSHOT:pick2_mlb_team_daily_features';
  end if;
  if exists (select feature_snapshot_id from public.pick2_mlb_pitcher_daily_features where target_game_pk is not null group by feature_snapshot_id having count(*) > 1) then
    raise exception 'DUPLICATE_NATIVE_SNAPSHOT:pick2_mlb_pitcher_daily_features';
  end if;
  if exists (select feature_snapshot_id from public.pick2_mlb_bullpen_daily_features where target_game_pk is not null group by feature_snapshot_id having count(*) > 1) then
    raise exception 'DUPLICATE_NATIVE_SNAPSHOT:pick2_mlb_bullpen_daily_features';
  end if;
  if exists (select feature_snapshot_id from public.pick2_mlb_batter_daily_features where target_game_pk is not null group by feature_snapshot_id having count(*) > 1) then
    raise exception 'DUPLICATE_NATIVE_SNAPSHOT:pick2_mlb_batter_daily_features';
  end if;
  if exists (select feature_snapshot_id from public.pick2_mlb_matchup_daily_features where target_game_pk is not null group by feature_snapshot_id having count(*) > 1) then
    raise exception 'DUPLICATE_NATIVE_SNAPSHOT:pick2_mlb_matchup_daily_features';
  end if;
  if exists (select feature_snapshot_id from public.pick2_mlb_first_inning_daily_features where target_game_pk is not null group by feature_snapshot_id having count(*) > 1) then
    raise exception 'DUPLICATE_NATIVE_SNAPSHOT:pick2_mlb_first_inning_daily_features';
  end if;
end;
$preflight$;

create unique index pick2_mlb_team_daily_features_snapshot_uidx on public.pick2_mlb_team_daily_features (feature_snapshot_id) where target_game_pk is not null;
create unique index pick2_mlb_pitcher_daily_features_snapshot_uidx on public.pick2_mlb_pitcher_daily_features (feature_snapshot_id) where target_game_pk is not null;
create unique index pick2_mlb_bullpen_daily_features_snapshot_uidx on public.pick2_mlb_bullpen_daily_features (feature_snapshot_id) where target_game_pk is not null;
create unique index pick2_mlb_batter_daily_features_snapshot_uidx on public.pick2_mlb_batter_daily_features (feature_snapshot_id) where target_game_pk is not null;
create unique index pick2_mlb_matchup_daily_features_snapshot_uidx on public.pick2_mlb_matchup_daily_features (feature_snapshot_id) where target_game_pk is not null;
create unique index pick2_mlb_first_inning_daily_features_snapshot_uidx on public.pick2_mlb_first_inning_daily_features (feature_snapshot_id) where target_game_pk is not null;
create unique index pick2_mlb_batter_daily_features_legacy_uidx on public.pick2_mlb_batter_daily_features (player_id, feature_date, feature_version) where target_game_pk is null;
create unique index pick2_mlb_first_inning_daily_features_legacy_uidx on public.pick2_mlb_first_inning_daily_features (event_id, feature_date, feature_version) where target_game_pk is null;
create unique index pick2_mlb_matchup_daily_features_legacy_uidx on public.pick2_mlb_matchup_daily_features (event_id, feature_date, feature_version) where target_game_pk is null;
create unique index pick2_mlb_pitcher_daily_features_legacy_uidx on public.pick2_mlb_pitcher_daily_features (player_id, feature_date, feature_version) where target_game_pk is null;
alter table public.pick2_mlb_batter_daily_features drop constraint pick2_mlb_batter_daily_featur_player_id_feature_date_featur_key;
alter table public.pick2_mlb_first_inning_daily_features drop constraint pick2_mlb_first_inning_daily__event_id_feature_date_feature_key;
alter table public.pick2_mlb_matchup_daily_features drop constraint pick2_mlb_matchup_daily_featu_event_id_feature_date_feature_key;
alter table public.pick2_mlb_pitcher_daily_features drop constraint pick2_mlb_pitcher_daily_featu_player_id_feature_date_featur_key;
drop index public.pick2_mlb_batter_daily_features_native_uidx;
CREATE INDEX pick2_mlb_batter_daily_features_native_lookup ON public.pick2_mlb_batter_daily_features USING btree (target_game_pk, mlbam_batter_id, feature_date, feature_version) WHERE ((target_game_pk IS NOT NULL) AND (mlbam_batter_id IS NOT NULL));
drop index public.pick2_mlb_bullpen_daily_features_native_uidx;
CREATE INDEX pick2_mlb_bullpen_daily_features_native_lookup ON public.pick2_mlb_bullpen_daily_features USING btree (target_game_pk, team_id, feature_date, feature_version) WHERE (target_game_pk IS NOT NULL);
drop index public.pick2_mlb_bullpen_daily_features_target_game_team_version_key;
CREATE INDEX pick2_mlb_bullpen_daily_features_target_game_team_version_lookup ON public.pick2_mlb_bullpen_daily_features USING btree (target_game_pk, team_id, feature_version) WHERE (target_game_pk IS NOT NULL);
drop index public.pick2_mlb_first_inning_daily_features_native_uidx;
CREATE INDEX pick2_mlb_first_inning_daily_features_native_lookup ON public.pick2_mlb_first_inning_daily_features USING btree (target_game_pk, feature_date, feature_version) WHERE (target_game_pk IS NOT NULL);
drop index public.pick2_mlb_matchup_daily_features_native_uidx;
CREATE INDEX pick2_mlb_matchup_daily_features_native_lookup ON public.pick2_mlb_matchup_daily_features USING btree (target_game_pk, feature_date, feature_version) WHERE (target_game_pk IS NOT NULL);
drop index public.pick2_mlb_pitcher_daily_features_native_uidx;
CREATE INDEX pick2_mlb_pitcher_daily_features_native_lookup ON public.pick2_mlb_pitcher_daily_features USING btree (target_game_pk, mlbam_pitcher_id, feature_date, feature_version) WHERE ((target_game_pk IS NOT NULL) AND (mlbam_pitcher_id IS NOT NULL));
drop index public.pick2_mlb_team_daily_features_native_uidx;
CREATE INDEX pick2_mlb_team_daily_features_native_lookup ON public.pick2_mlb_team_daily_features USING btree (target_game_pk, team_id, feature_date, feature_version) WHERE (target_game_pk IS NOT NULL);
commit;
