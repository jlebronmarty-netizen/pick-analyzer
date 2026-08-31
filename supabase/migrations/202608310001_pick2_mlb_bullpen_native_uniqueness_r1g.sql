begin;

alter table public.pick2_mlb_bullpen_daily_features
  drop constraint if exists pick2_mlb_bullpen_daily_featu_team_id_feature_date_feature__key;

create unique index if not exists pick2_mlb_bullpen_daily_features_target_game_team_version_key
  on public.pick2_mlb_bullpen_daily_features (target_game_pk, team_id, feature_version)
  where target_game_pk is not null;

commit;
