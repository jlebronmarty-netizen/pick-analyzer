-- Cross-season pitcher strikeout backtest rows.
-- Feature snapshots are required to predate the target game. This is read-only research data.

create materialized view public.mlb_pitcher_strikeout_backtest_rows_v1_mv as
select
  extract(year from pf.feature_date)::integer as season,
  pf.target_game_pk,
  pf.feature_date,
  pf.as_of_date,
  pf.as_of_timestamp,
  pf.feature_version,
  pf.mlbam_pitcher_id,
  l.pitching_team,
  l.opponent_team,
  l.strikeouts as actual_strikeouts,
  l.total_pitches as actual_total_pitches,
  l.plate_appearances as actual_plate_appearances,
  pf.k_rate::double precision as pitcher_k_rate,
  pf.bb_rate::double precision as pitcher_bb_rate,
  pf.k_minus_bb_rate::double precision as pitcher_k_minus_bb_rate,
  pf.whiff_rate::double precision as pitcher_whiff_rate,
  pf.csw_rate::double precision as pitcher_csw_rate,
  pf.strike_rate::double precision as pitcher_strike_rate,
  pf.swing_rate::double precision as pitcher_swing_rate,
  pf.avg_release_speed::double precision as pitcher_avg_release_speed,
  pf.velocity_delta::double precision as pitcher_velocity_delta,
  pf.previous_pitch_count,
  pf.days_rest,
  (pf.sample_sizes ->> 'sample_size')::integer as prior_appearances,
  (pf.sample_sizes ->> 'pitches')::integer as prior_pitches,
  (pf.sample_sizes ->> 'plate_appearances')::integer as prior_plate_appearances,
  tf.recent_k_rate::double precision as opponent_k_rate,
  tf.recent_bb_rate::double precision as opponent_bb_rate,
  tf.recent_runs_per_game::double precision as opponent_runs_per_game,
  tf.recent_iso::double precision as opponent_iso,
  pf.source_window ->> 'rule' as source_rule,
  pf.source_window ->> 'as_of_date' as source_as_of_date
from public.pick2_mlb_pitcher_daily_features pf
join public.mlb_statcast_pitcher_game_logs l
  on l.game_pk = pf.target_game_pk
 and l.pitcher = pf.mlbam_pitcher_id
join public.sports_teams st
  on st.sport_key = 'baseball_mlb'
 and upper(st.abbreviation) = case upper(l.opponent_team)
   when 'AZ' then 'ARI'
   when 'CWS' then 'CHW'
   else upper(l.opponent_team)
 end
join public.pick2_mlb_team_daily_features tf
  on tf.target_game_pk = pf.target_game_pk
 and tf.team_id = st.id
left join public.pick2_mlb_games g
  on g.game_pk = pf.target_game_pk
where pf.feature_version = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
  and pf.as_of_date < pf.feature_date
  and (pf.source_window ->> 'rule') = 'source_game_date < target_game_date'
  and (g.scheduled_at is null or pf.as_of_timestamp < g.scheduled_at);

create unique index mlb_pitcher_strikeout_backtest_rows_v1_uidx
  on public.mlb_pitcher_strikeout_backtest_rows_v1_mv (target_game_pk, mlbam_pitcher_id);
create index mlb_pitcher_strikeout_backtest_rows_v1_season_date_idx
  on public.mlb_pitcher_strikeout_backtest_rows_v1_mv (season, feature_date, target_game_pk);

revoke all on public.mlb_pitcher_strikeout_backtest_rows_v1_mv from public, anon, authenticated;
grant select on public.mlb_pitcher_strikeout_backtest_rows_v1_mv to service_role;
