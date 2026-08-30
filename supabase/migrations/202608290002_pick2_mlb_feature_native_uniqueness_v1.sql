begin;

alter table public.pick2_mlb_team_daily_features
  drop constraint if exists pick2_mlb_team_daily_features_team_id_feature_date_feature__key,
  drop constraint if exists pick2_mlb_team_daily_features_team_id_feature_date_feature_vers,
  drop constraint if exists pick2_mlb_team_daily_features_team_id_feature_date_feature_version_key;

alter table public.pick2_mlb_bullpen_daily_features
  drop constraint if exists pick2_mlb_bullpen_daily_features_team_id_feature_date_feature_key,
  drop constraint if exists pick2_mlb_bullpen_daily_features_team_id_feature_date_feature_v,
  drop constraint if exists pick2_mlb_bullpen_daily_features_team_id_feature_date_feature_version_key;

create unique index if not exists pick2_mlb_team_daily_features_native_uidx
  on public.pick2_mlb_team_daily_features (target_game_pk, team_id, feature_date, feature_version)
  where target_game_pk is not null;

create unique index if not exists pick2_mlb_bullpen_daily_features_native_uidx
  on public.pick2_mlb_bullpen_daily_features (target_game_pk, team_id, feature_date, feature_version)
  where target_game_pk is not null;

commit;
