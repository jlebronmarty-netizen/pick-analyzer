-- MLB Statcast analytics foundation v1
-- Reuses the certified Pick Analyzer raw table as the single source of truth.
-- No parallel raw-pitch table is created.

create index if not exists pick2_raw_mlb_statcast_pitches_season_pitcher_date_idx
  on public.pick2_raw_mlb_statcast_pitches (
    game_year,
    mlbam_pitcher_id,
    game_date desc,
    game_pk
  )
  where mlbam_pitcher_id is not null;

create index if not exists pick2_raw_mlb_statcast_pitches_season_batter_date_idx
  on public.pick2_raw_mlb_statcast_pitches (
    game_year,
    mlbam_batter_id,
    game_date desc,
    game_pk
  )
  where mlbam_batter_id is not null;

create index if not exists pick2_raw_mlb_statcast_pitches_season_pitch_type_idx
  on public.pick2_raw_mlb_statcast_pitches (
    game_year,
    mlbam_pitcher_id,
    pitch_type,
    game_date desc
  )
  where mlbam_pitcher_id is not null and pitch_type is not null;

create index if not exists pick2_raw_mlb_statcast_pitches_season_teams_date_idx
  on public.pick2_raw_mlb_statcast_pitches (
    game_year,
    source_home_team,
    source_away_team,
    game_date desc
  );
