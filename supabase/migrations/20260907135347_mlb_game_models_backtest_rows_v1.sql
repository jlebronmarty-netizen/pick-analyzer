-- Leakage-safe MLB game-level research rows for Moneyline / Run Line / Totals.
-- Labels come from canonical Statcast; all feature inputs are strict prior-date Pick2 features.

create materialized view public.mlb_game_models_backtest_rows_v1_mv as
with labels as (
  select
    game_year::int as season,
    game_pk,
    min(game_date) as game_date,
    max(source_home_team) as statcast_home_team,
    max(source_away_team) as statcast_away_team,
    max(post_home_score)::int as home_score,
    max(post_away_score)::int as away_score
  from public.pick2_raw_mlb_statcast_pitches
  where game_year in (2025, 2026)
  group by game_year, game_pk
),
fi as (
  select
    target_game_pk,
    feature_date,
    as_of_date,
    home_team_id,
    away_team_id,
    home_starter_mlbam_pitcher_id,
    away_starter_mlbam_pitcher_id
  from public.pick2_mlb_first_inning_daily_features
  where feature_version = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
    and as_of_date < feature_date
    and source_window->>'rule' = 'source_game_date < target_game_date'
)
select
  l.season,
  l.game_pk,
  l.game_date,
  fi.home_team_id,
  fi.away_team_id,
  fi.home_starter_mlbam_pitcher_id,
  fi.away_starter_mlbam_pitcher_id,
  l.home_score,
  l.away_score,
  (l.home_score + l.away_score)::int as total_runs,
  (l.home_score - l.away_score)::int as home_run_margin,
  (l.home_score > l.away_score) as home_win,

  ht.recent_k_rate::double precision as home_team_k_rate,
  ht.recent_bb_rate::double precision as home_team_bb_rate,
  ht.recent_runs_per_game::double precision as home_team_runs_per_game,
  ht.recent_iso::double precision as home_team_iso,
  at.recent_k_rate::double precision as away_team_k_rate,
  at.recent_bb_rate::double precision as away_team_bb_rate,
  at.recent_runs_per_game::double precision as away_team_runs_per_game,
  at.recent_iso::double precision as away_team_iso,

  hp.k_minus_bb_rate::double precision as home_starter_k_minus_bb_rate,
  hp.whiff_rate::double precision as home_starter_whiff_rate,
  hp.csw_rate::double precision as home_starter_csw_rate,
  hp.strike_rate::double precision as home_starter_strike_rate,
  hp.velocity_delta::double precision as home_starter_velocity_delta,
  hp.previous_pitch_count::double precision as home_starter_previous_pitch_count,
  hp.days_rest::double precision as home_starter_days_rest,
  ap.k_minus_bb_rate::double precision as away_starter_k_minus_bb_rate,
  ap.whiff_rate::double precision as away_starter_whiff_rate,
  ap.csw_rate::double precision as away_starter_csw_rate,
  ap.strike_rate::double precision as away_starter_strike_rate,
  ap.velocity_delta::double precision as away_starter_velocity_delta,
  ap.previous_pitch_count::double precision as away_starter_previous_pitch_count,
  ap.days_rest::double precision as away_starter_days_rest,

  hb.bullpen_k_minus_bb_rate::double precision as home_bullpen_k_minus_bb_rate,
  hb.bullpen_whiff_rate::double precision as home_bullpen_whiff_rate,
  hb.pitches_previous_24h::double precision as home_bullpen_pitches_24h,
  hb.pitches_previous_72h::double precision as home_bullpen_pitches_72h,
  hb.high_workload_reliever_count::double precision as home_bullpen_high_workload_count,
  ab.bullpen_k_minus_bb_rate::double precision as away_bullpen_k_minus_bb_rate,
  ab.bullpen_whiff_rate::double precision as away_bullpen_whiff_rate,
  ab.pitches_previous_24h::double precision as away_bullpen_pitches_24h,
  ab.pitches_previous_72h::double precision as away_bullpen_pitches_72h,
  ab.high_workload_reliever_count::double precision as away_bullpen_high_workload_count,

  fi.as_of_date,
  fi.feature_date,
  case
    when l.season = 2026 then 'HOLDOUT'
    when l.game_date < date '2025-08-01' then 'TRAIN'
    when l.game_date < date '2025-09-01' then 'VALIDATION'
    else 'TEST'
  end as fixed_split
from labels l
join fi on fi.target_game_pk = l.game_pk and fi.feature_date = l.game_date
join public.pick2_mlb_team_daily_features ht
  on ht.target_game_pk = l.game_pk and ht.team_id = fi.home_team_id
  and ht.feature_version = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
  and ht.feature_date = l.game_date and ht.as_of_date < ht.feature_date
  and ht.source_window->>'rule' = 'source_game_date < target_game_date'
join public.pick2_mlb_team_daily_features at
  on at.target_game_pk = l.game_pk and at.team_id = fi.away_team_id
  and at.feature_version = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
  and at.feature_date = l.game_date and at.as_of_date < at.feature_date
  and at.source_window->>'rule' = 'source_game_date < target_game_date'
join public.pick2_mlb_pitcher_daily_features hp
  on hp.target_game_pk = l.game_pk and hp.mlbam_pitcher_id = fi.home_starter_mlbam_pitcher_id
  and hp.feature_version = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
  and hp.feature_date = l.game_date and hp.as_of_date < hp.feature_date
  and hp.source_window->>'rule' = 'source_game_date < target_game_date'
join public.pick2_mlb_pitcher_daily_features ap
  on ap.target_game_pk = l.game_pk and ap.mlbam_pitcher_id = fi.away_starter_mlbam_pitcher_id
  and ap.feature_version = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
  and ap.feature_date = l.game_date and ap.as_of_date < ap.feature_date
  and ap.source_window->>'rule' = 'source_game_date < target_game_date'
join public.pick2_mlb_bullpen_daily_features hb
  on hb.target_game_pk = l.game_pk and hb.team_id = fi.home_team_id
  and hb.feature_version = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
  and hb.feature_date = l.game_date and hb.as_of_date < hb.feature_date
  and hb.source_window->>'rule' = 'source_game_date < target_game_date'
join public.pick2_mlb_bullpen_daily_features ab
  on ab.target_game_pk = l.game_pk and ab.team_id = fi.away_team_id
  and ab.feature_version = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
  and ab.feature_date = l.game_date and ab.as_of_date < ab.feature_date
  and ab.source_window->>'rule' = 'source_game_date < target_game_date'
where l.home_score is not null and l.away_score is not null
with data;

create unique index mlb_game_models_backtest_rows_v1_mv_uidx
  on public.mlb_game_models_backtest_rows_v1_mv (season, game_pk);
create index mlb_game_models_backtest_rows_v1_mv_split_idx
  on public.mlb_game_models_backtest_rows_v1_mv (fixed_split, game_date, game_pk);

revoke all on public.mlb_game_models_backtest_rows_v1_mv from public, anon, authenticated;
grant select on public.mlb_game_models_backtest_rows_v1_mv to service_role;

create or replace function public.refresh_mlb_game_models_backtest_rows_v1()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.mlb_game_models_backtest_rows_v1_mv;
end;
$$;

revoke all on function public.refresh_mlb_game_models_backtest_rows_v1() from public, anon, authenticated;
grant execute on function public.refresh_mlb_game_models_backtest_rows_v1() to service_role;
