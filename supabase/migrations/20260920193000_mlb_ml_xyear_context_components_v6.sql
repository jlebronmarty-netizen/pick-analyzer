-- MLB Moneyline PREGAME context-component parity extension.
-- Research/shadow only. No model, route, threshold, Official Picks, or APOSTAR changes.
-- Sep14 pre-write parity:
-- offense 120/120 feature cells exact
-- bullpen 120/120 exact
-- home_away 60/60 exact
-- defense_context 30/30 exact
-- fatigue_travel 100/100 exact
-- all five component scores 10/10 exact each


create or replace function public.mlb_ml_xyear_enrich_pregame_context_v1(p_target_date date)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_games integer := 0;
begin
  -- Offense: strict-prior team batting/statcast/handedness history.
  update public.mlb_ml_xyear_features_v1 f
  set
    home_off_ops_proxy=(
      select (sum(b.hits)+sum(b.walks))::double precision/nullif(sum(b.ab)+sum(b.walks),0)
           + (sum(b.singles)+2*sum(b.doubles)+3*sum(b.triples)+4*sum(b.hr))::double precision/nullif(sum(b.ab),0)
      from public.mlb_ml_xyear_team_batting_game_v1 b
      where b.season=f.season and b.team=f.home_team and b.game_date<f.game_date
    ),
    away_off_ops_proxy=(
      select (sum(b.hits)+sum(b.walks))::double precision/nullif(sum(b.ab)+sum(b.walks),0)
           + (sum(b.singles)+2*sum(b.doubles)+3*sum(b.triples)+4*sum(b.hr))::double precision/nullif(sum(b.ab),0)
      from public.mlb_ml_xyear_team_batting_game_v1 b
      where b.season=f.season and b.team=f.away_team and b.game_date<f.game_date
    ),
    home_off_k_pct=(
      select sum(b.strikeouts)::double precision/nullif(sum(b.pa),0)
      from public.mlb_ml_xyear_team_batting_game_v1 b
      where b.season=f.season and b.team=f.home_team and b.game_date<f.game_date
    ),
    away_off_k_pct=(
      select sum(b.strikeouts)::double precision/nullif(sum(b.pa),0)
      from public.mlb_ml_xyear_team_batting_game_v1 b
      where b.season=f.season and b.team=f.away_team and b.game_date<f.game_date
    ),
    home_sc_off_hard_hit_pct=(
      select sum(s.hard_hits)::double precision/nullif(sum(s.batted_balls),0)
      from public.mlb_ml_xyear_team_statcast_game_v1 s
      where s.season=f.season and s.team=f.home_team and s.game_date<f.game_date
    ),
    away_sc_off_hard_hit_pct=(
      select sum(s.hard_hits)::double precision/nullif(sum(s.batted_balls),0)
      from public.mlb_ml_xyear_team_statcast_game_v1 s
      where s.season=f.season and s.team=f.away_team and s.game_date<f.game_date
    ),
    home_sc_off_barrel_pct=(
      select sum(s.barrels)::double precision/nullif(sum(s.batted_balls),0)
      from public.mlb_ml_xyear_team_statcast_game_v1 s
      where s.season=f.season and s.team=f.home_team and s.game_date<f.game_date
    ),
    away_sc_off_barrel_pct=(
      select sum(s.barrels)::double precision/nullif(sum(s.batted_balls),0)
      from public.mlb_ml_xyear_team_statcast_game_v1 s
      where s.season=f.season and s.team=f.away_team and s.game_date<f.game_date
    ),
    home_vs_sp_hand_k_rate=(
      select sum(h.strikeouts)::double precision/nullif(sum(h.pa),0)
      from public.mlb_ml_xyear_team_hand_game_v1 h
      where h.season=f.season and h.team=f.home_team and h.game_date<f.game_date
        and h.pitcher_hand=f.away_sp_hand
    ),
    away_vs_sp_hand_k_rate=(
      select sum(h.strikeouts)::double precision/nullif(sum(h.pa),0)
      from public.mlb_ml_xyear_team_hand_game_v1 h
      where h.season=f.season and h.team=f.away_team and h.game_date<f.game_date
        and h.pitcher_hand=f.home_sp_hand
    ),
    home_vs_sp_hand_hard_hit_pct=(
      select sum(h.hard_hits)::double precision/nullif(sum(h.batted_balls),0)
      from public.mlb_ml_xyear_team_hand_game_v1 h
      where h.season=f.season and h.team=f.home_team and h.game_date<f.game_date
        and h.pitcher_hand=f.away_sp_hand
    ),
    away_vs_sp_hand_hard_hit_pct=(
      select sum(h.hard_hits)::double precision/nullif(sum(h.batted_balls),0)
      from public.mlb_ml_xyear_team_hand_game_v1 h
      where h.season=f.season and h.team=f.away_team and h.game_date<f.game_date
        and h.pitcher_hand=f.home_sp_hand
    )
  where f.season=2026 and f.game_date=p_target_date;

  -- Bullpen: strict-prior non-starter appearances only.
  update public.mlb_ml_xyear_features_v1 f
  set
    home_bullpen_prior_apps=(
      select count(*)::int from public.mlb_ml_xyear_pitcher_game_v1 p
      where p.season=f.season and p.team=f.home_team and p.game_date<f.game_date and not p.starter
    ),
    away_bullpen_prior_apps=(
      select count(*)::int from public.mlb_ml_xyear_pitcher_game_v1 p
      where p.season=f.season and p.team=f.away_team and p.game_date<f.game_date and not p.starter
    ),
    home_bullpen_ra9=(
      select sum(p.runs)::double precision*27/nullif(sum(p.outs),0)
      from public.mlb_ml_xyear_pitcher_game_v1 p
      where p.season=f.season and p.team=f.home_team and p.game_date<f.game_date and not p.starter
    ),
    away_bullpen_ra9=(
      select sum(p.runs)::double precision*27/nullif(sum(p.outs),0)
      from public.mlb_ml_xyear_pitcher_game_v1 p
      where p.season=f.season and p.team=f.away_team and p.game_date<f.game_date and not p.starter
    ),
    home_bullpen_whip=(
      select (sum(p.hits)+sum(p.walks))::double precision/(nullif(sum(p.outs),0)/3.0)
      from public.mlb_ml_xyear_pitcher_game_v1 p
      where p.season=f.season and p.team=f.home_team and p.game_date<f.game_date and not p.starter
    ),
    away_bullpen_whip=(
      select (sum(p.hits)+sum(p.walks))::double precision/(nullif(sum(p.outs),0)/3.0)
      from public.mlb_ml_xyear_pitcher_game_v1 p
      where p.season=f.season and p.team=f.away_team and p.game_date<f.game_date and not p.starter
    ),
    home_bullpen_k_pct=(
      select sum(p.strikeouts)::double precision/nullif(sum(p.batters_faced),0)
      from public.mlb_ml_xyear_pitcher_game_v1 p
      where p.season=f.season and p.team=f.home_team and p.game_date<f.game_date and not p.starter
    ),
    away_bullpen_k_pct=(
      select sum(p.strikeouts)::double precision/nullif(sum(p.batters_faced),0)
      from public.mlb_ml_xyear_pitcher_game_v1 p
      where p.season=f.season and p.team=f.away_team and p.game_date<f.game_date and not p.starter
    ),
    home_bullpen_bb_pct=(
      select sum(p.walks)::double precision/nullif(sum(p.batters_faced),0)
      from public.mlb_ml_xyear_pitcher_game_v1 p
      where p.season=f.season and p.team=f.home_team and p.game_date<f.game_date and not p.starter
    ),
    away_bullpen_bb_pct=(
      select sum(p.walks)::double precision/nullif(sum(p.batters_faced),0)
      from public.mlb_ml_xyear_pitcher_game_v1 p
      where p.season=f.season and p.team=f.away_team and p.game_date<f.game_date and not p.starter
    ),
    home_bullpen_l7_ra9=(
      select sum(p.runs)::double precision*27/nullif(sum(p.outs),0)
      from public.mlb_ml_xyear_pitcher_game_v1 p
      where p.season=f.season and p.team=f.home_team and p.game_date<f.game_date
        and p.game_date>=f.game_date-7 and not p.starter
    ),
    away_bullpen_l7_ra9=(
      select sum(p.runs)::double precision*27/nullif(sum(p.outs),0)
      from public.mlb_ml_xyear_pitcher_game_v1 p
      where p.season=f.season and p.team=f.away_team and p.game_date<f.game_date
        and p.game_date>=f.game_date-7 and not p.starter
    ),
    home_bullpen_pitches_last_2d=(
      select coalesce(sum(p.pitch_count),0)::int
      from public.mlb_ml_xyear_pitcher_game_v1 p
      where p.season=f.season and p.team=f.home_team and p.game_date<f.game_date
        and p.game_date>=f.game_date-2 and not p.starter
    ),
    away_bullpen_pitches_last_2d=(
      select coalesce(sum(p.pitch_count),0)::int
      from public.mlb_ml_xyear_pitcher_game_v1 p
      where p.season=f.season and p.team=f.away_team and p.game_date<f.game_date
        and p.game_date>=f.game_date-2 and not p.starter
    )
  where f.season=2026 and f.game_date=p_target_date;

  -- Home/Away splits: designated home team's prior home games and designated away team's prior road games.
  update public.mlb_ml_xyear_features_v1 f
  set
    home_home_games_prior=(
      select count(*)::int from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date and g.is_home
    ),
    away_away_games_prior=(
      select count(*)::int from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date and not g.is_home
    ),
    home_home_win_pct=(
      select avg(g.win::double precision) from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date and g.is_home
    ),
    home_home_runs_scored_pg=(
      select avg(g.runs_for::double precision) from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date and g.is_home
    ),
    home_home_runs_allowed_pg=(
      select avg(g.runs_against::double precision) from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date and g.is_home
    ),
    away_away_win_pct=(
      select avg(g.win::double precision) from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date and not g.is_home
    ),
    away_away_runs_scored_pg=(
      select avg(g.runs_for::double precision) from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date and not g.is_home
    ),
    away_away_runs_allowed_pg=(
      select avg(g.runs_against::double precision) from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date and not g.is_home
    )
  where f.season=2026 and f.game_date=p_target_date;

  -- Defense/context: prior errors plus venue historical home win rate.
  update public.mlb_ml_xyear_features_v1 f
  set
    home_errors_pg=(
      select avg(e.errors::double precision) from public.mlb_ml_xyear_errors_game_v1 e
      where e.season=f.season and e.team=f.home_team and e.game_date<f.game_date
    ),
    away_errors_pg=(
      select avg(e.errors::double precision) from public.mlb_ml_xyear_errors_game_v1 e
      where e.season=f.season and e.team=f.away_team and e.game_date<f.game_date
    ),
    park_games_prior=(
      select count(*)::int from public.mlb_ml_xyear_game_v1 g
      where g.season=f.season and g.venue=f.venue and g.game_date<f.game_date
    ),
    park_home_win_pct_prior=(
      select avg((g.actual_winner=g.home_team)::int::double precision)
      from public.mlb_ml_xyear_game_v1 g
      where g.season=f.season and g.venue=f.venue and g.game_date<f.game_date
    )
  where f.season=2026 and f.game_date=p_target_date;

  -- Fatigue/travel: strict-prior calendar history. Same-day Game 1 is excluded from Game 2.
  update public.mlb_ml_xyear_features_v1 f
  set
    home_rest_days=(
      select greatest((f.game_date-g.game_date)-1,0)::int
      from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date
      order by g.game_date desc,g.game_pk desc limit 1
    ),
    away_rest_days=(
      select greatest((f.game_date-g.game_date)-1,0)::int
      from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date
      order by g.game_date desc,g.game_pk desc limit 1
    ),
    home_games_last_7d=(
      select count(*)::int from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date
        and g.game_date>=f.game_date-7
    ),
    away_games_last_7d=(
      select count(*)::int from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date
        and g.game_date>=f.game_date-7
    ),
    home_road_trip_game_number=0,
    away_road_trip_game_number=1+(
      select count(*)::int
      from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date and not g.is_home
        and g.game_date>coalesce((
          select max(h.game_date) from public.mlb_ml_xyear_team_game_v1 h
          where h.season=f.season and h.team=f.away_team and h.game_date<f.game_date and h.is_home
        ),date '1900-01-01')
    ),
    home_travel_miles_48h=(
      select case when pg.game_date<f.game_date-2 then null
                  else 3958.761*2*asin(sqrt(
                    power(sin(radians(cv.lat-pv.lat)/2),2)
                    +cos(radians(pv.lat))*cos(radians(cv.lat))
                     *power(sin(radians(cv.lon-pv.lon)/2),2)
                  )) end
      from (
        select g.game_date,g.venue
        from public.mlb_ml_xyear_team_game_v1 g
        where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date
        order by g.game_date desc,g.game_pk desc limit 1
      ) pg
      join public.mlb_ml_venue_geo_2025_v3 pv on pv.venue=pg.venue
      join public.mlb_ml_venue_geo_2025_v3 cv on cv.venue=f.venue
    ),
    away_travel_miles_48h=(
      select case when pg.game_date<f.game_date-2 then null
                  else 3958.761*2*asin(sqrt(
                    power(sin(radians(cv.lat-pv.lat)/2),2)
                    +cos(radians(pv.lat))*cos(radians(cv.lat))
                     *power(sin(radians(cv.lon-pv.lon)/2),2)
                  )) end
      from (
        select g.game_date,g.venue
        from public.mlb_ml_xyear_team_game_v1 g
        where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date
        order by g.game_date desc,g.game_pk desc limit 1
      ) pg
      join public.mlb_ml_venue_geo_2025_v3 pv on pv.venue=pg.venue
      join public.mlb_ml_venue_geo_2025_v3 cv on cv.venue=f.venue
    ),
    home_timezone_changes_48h=(
      select case when pg.game_date<f.game_date-2 then null else abs(cv.utc_offset_hours-pv.utc_offset_hours)::int end
      from (
        select g.game_date,g.venue
        from public.mlb_ml_xyear_team_game_v1 g
        where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date
        order by g.game_date desc,g.game_pk desc limit 1
      ) pg
      join public.mlb_ml_venue_geo_2025_v3 pv on pv.venue=pg.venue
      join public.mlb_ml_venue_geo_2025_v3 cv on cv.venue=f.venue
    ),
    away_timezone_changes_48h=(
      select case when pg.game_date<f.game_date-2 then null else abs(cv.utc_offset_hours-pv.utc_offset_hours)::int end
      from (
        select g.game_date,g.venue
        from public.mlb_ml_xyear_team_game_v1 g
        where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date
        order by g.game_date desc,g.game_pk desc limit 1
      ) pg
      join public.mlb_ml_venue_geo_2025_v3 pv on pv.venue=pg.venue
      join public.mlb_ml_venue_geo_2025_v3 cv on cv.venue=f.venue
    )
  where f.season=2026 and f.game_date=p_target_date;

  get diagnostics v_games = row_count;

  return jsonb_build_object(
    'targetDate',p_target_date,
    'featureGamesEnriched',v_games,
    'components',jsonb_build_array('offense','bullpen','home_away','defense_context','fatigue_travel'),
    'sourceRule','source_game_date < target_game_date',
    'sameDayGameOneExcluded',true,
    'lineupReconstructed',false,
    'officialPicksModified',false,
    'apostarActivated',false
  );
end
$$;

revoke all on function public.mlb_ml_xyear_enrich_pregame_context_v1(date) from public,anon,authenticated;
grant execute on function public.mlb_ml_xyear_enrich_pregame_context_v1(date) to service_role;


CREATE OR REPLACE FUNCTION public.mlb_ml_xyear_materialize_pregame_v3(p_target_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_games integer;
  v_feature_rows integer;
  v_component_rows integer;
  v_both_starters integer;
begin
  perform public.mlb_ml_capture_pregame_starter_evidence_v1(p_target_date);

  select count(*)::int into v_games
  from public.mlb_ml_xyear_game_v1
  where season=2026 and game_date=p_target_date;

  if v_games=0 then
    raise exception 'MLB_ML_XYEAR_V3:NO_TARGET_GAMES:%',p_target_date;
  end if;

  insert into public.mlb_ml_xyear_features_v1(
    canonical_game_id,game_pk,source_game_id,game_date,season,game_number,
    away_team,home_team,venue,start_time_local,day_night,doubleheader_flag,
    feature_cutoff_date,feature_version,current_inputs_reconstructed,
    has_statcast,has_lineup,has_starters,has_weather,has_umpire,has_odds,
    pregame_integrity_tier,actual_winner,
    home_sp_mlbam_id,home_sp_name,home_sp_hand,
    away_sp_mlbam_id,away_sp_name,away_sp_hand
  )
  select
    'xyear:'||g.season::text||':'||g.game_pk::text,
    g.game_pk,g.game_pk::text,g.game_date,g.season,g.game_number,
    g.away_team,g.home_team,g.venue,g.scheduled_at::text,g.day_night,g.doubleheader_flag,
    g.game_date-1,'xyear_daily_sync_v3_leakage_safe',true,
    true,false,
    (he.pitcher_mlbam_id is not null and ae.pitcher_mlbam_id is not null),
    false,false,false,
    case when he.pitcher_mlbam_id is not null and ae.pitcher_mlbam_id is not null
         then 'B_LEAKAGE_SAFE_NO_LINEUP'
         else 'C_LEAKAGE_SAFE_PARTIAL_STARTER' end,
    g.actual_winner,
    he.pitcher_mlbam_id,he.pitcher_name,
    (select p.p_throws from public.mlb_ml_xyear_pitcher_game_v1 p
     where p.season=2026 and p.pitcher=he.pitcher_mlbam_id and p.game_date<g.game_date
     order by p.game_date desc,p.game_pk desc limit 1),
    ae.pitcher_mlbam_id,ae.pitcher_name,
    (select p.p_throws from public.mlb_ml_xyear_pitcher_game_v1 p
     where p.season=2026 and p.pitcher=ae.pitcher_mlbam_id and p.game_date<g.game_date
     order by p.game_date desc,p.game_pk desc limit 1)
  from public.mlb_ml_xyear_game_v1 g
  left join public.mlb_ml_pregame_starter_evidence_v1 he
    on he.game_pk=g.game_pk and he.side='HOME'
  left join public.mlb_ml_pregame_starter_evidence_v1 ae
    on ae.game_pk=g.game_pk and ae.side='AWAY'
  where g.season=2026 and g.game_date=p_target_date
  on conflict (season,game_pk) do update
  set feature_cutoff_date=excluded.feature_cutoff_date,
      feature_version=excluded.feature_version,
      current_inputs_reconstructed=excluded.current_inputs_reconstructed,
      has_statcast=excluded.has_statcast,
      has_lineup=excluded.has_lineup,
      has_starters=excluded.has_starters,
      has_weather=excluded.has_weather,
      has_umpire=excluded.has_umpire,
      has_odds=excluded.has_odds,
      pregame_integrity_tier=excluded.pregame_integrity_tier,
      actual_winner=excluded.actual_winner,
      home_sp_mlbam_id=excluded.home_sp_mlbam_id,
      home_sp_name=excluded.home_sp_name,
      home_sp_hand=excluded.home_sp_hand,
      away_sp_mlbam_id=excluded.away_sp_mlbam_id,
      away_sp_name=excluded.away_sp_name,
      away_sp_hand=excluded.away_sp_hand;

  update public.mlb_ml_xyear_features_v1 f
  set
    home_games_prior=(select count(*) from public.mlb_ml_xyear_team_game_v1 g
                      where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date),
    away_games_prior=(select count(*) from public.mlb_ml_xyear_team_game_v1 g
                      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date),
    home_wins_prior=(select coalesce(sum(g.win),0)::int from public.mlb_ml_xyear_team_game_v1 g
                     where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date),
    away_wins_prior=(select coalesce(sum(g.win),0)::int from public.mlb_ml_xyear_team_game_v1 g
                     where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date),
    home_losses_prior=(select count(*)-coalesce(sum(g.win),0)::int from public.mlb_ml_xyear_team_game_v1 g
                       where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date),
    away_losses_prior=(select count(*)-coalesce(sum(g.win),0)::int from public.mlb_ml_xyear_team_game_v1 g
                       where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date),
    home_win_pct=(select avg(g.win::double precision) from public.mlb_ml_xyear_team_game_v1 g
                  where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date),
    away_win_pct=(select avg(g.win::double precision) from public.mlb_ml_xyear_team_game_v1 g
                  where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date),
    home_run_diff_pg=(select avg((g.runs_for-g.runs_against)::double precision) from public.mlb_ml_xyear_team_game_v1 g
                      where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date),
    away_run_diff_pg=(select avg((g.runs_for-g.runs_against)::double precision) from public.mlb_ml_xyear_team_game_v1 g
                      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date),
    home_pyth_win_pct=(select power(sum(g.runs_for)::double precision,1.83)/
                       nullif(power(sum(g.runs_for)::double precision,1.83)+power(sum(g.runs_against)::double precision,1.83),0)
                       from public.mlb_ml_xyear_team_game_v1 g
                       where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date),
    away_pyth_win_pct=(select power(sum(g.runs_for)::double precision,1.83)/
                       nullif(power(sum(g.runs_for)::double precision,1.83)+power(sum(g.runs_against)::double precision,1.83),0)
                       from public.mlb_ml_xyear_team_game_v1 g
                       where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date),

    home_l5_games=(select count(*) from (
      select 1 from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date
      order by g.game_date desc,g.game_pk desc limit 5) q),
    away_l5_games=(select count(*) from (
      select 1 from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date
      order by g.game_date desc,g.game_pk desc limit 5) q),
    home_l5_win_pct=(select avg(q.win::double precision) from (
      select g.win from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date
      order by g.game_date desc,g.game_pk desc limit 5) q),
    away_l5_win_pct=(select avg(q.win::double precision) from (
      select g.win from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date
      order by g.game_date desc,g.game_pk desc limit 5) q),
    home_l5_run_diff_pg=(select avg((q.runs_for-q.runs_against)::double precision) from (
      select g.runs_for,g.runs_against from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date
      order by g.game_date desc,g.game_pk desc limit 5) q),
    away_l5_run_diff_pg=(select avg((q.runs_for-q.runs_against)::double precision) from (
      select g.runs_for,g.runs_against from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date
      order by g.game_date desc,g.game_pk desc limit 5) q),
    home_l10_games=(select count(*) from (
      select 1 from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date
      order by g.game_date desc,g.game_pk desc limit 10) q),
    away_l10_games=(select count(*) from (
      select 1 from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date
      order by g.game_date desc,g.game_pk desc limit 10) q),
    home_l10_win_pct=(select avg(q.win::double precision) from (
      select g.win from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date
      order by g.game_date desc,g.game_pk desc limit 10) q),
    away_l10_win_pct=(select avg(q.win::double precision) from (
      select g.win from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date
      order by g.game_date desc,g.game_pk desc limit 10) q),
    home_l10_run_diff_pg=(select avg((q.runs_for-q.runs_against)::double precision) from (
      select g.runs_for,g.runs_against from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date
      order by g.game_date desc,g.game_pk desc limit 10) q),
    away_l10_run_diff_pg=(select avg((q.runs_for-q.runs_against)::double precision) from (
      select g.runs_for,g.runs_against from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date
      order by g.game_date desc,g.game_pk desc limit 10) q),

    home_sp_prior_starts=(select count(*) from public.mlb_ml_xyear_pitcher_game_v1 p
                          where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date and p.starter),
    away_sp_prior_starts=(select count(*) from public.mlb_ml_xyear_pitcher_game_v1 p
                          where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date and p.starter),
    home_sp_starts_prior=(select count(*) from public.mlb_ml_xyear_pitcher_game_v1 p
                          where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date and p.starter),
    away_sp_starts_prior=(select count(*) from public.mlb_ml_xyear_pitcher_game_v1 p
                          where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date and p.starter),
    home_sp_ra9=(select sum(p.runs)::double precision*27/nullif(sum(p.outs),0) from public.mlb_ml_xyear_pitcher_game_v1 p
                 where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date and p.starter),
    away_sp_ra9=(select sum(p.runs)::double precision*27/nullif(sum(p.outs),0) from public.mlb_ml_xyear_pitcher_game_v1 p
                 where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date and p.starter),
    home_sp_whip=(select (sum(p.hits)+sum(p.walks))::double precision/(nullif(sum(p.outs),0)/3.0) from public.mlb_ml_xyear_pitcher_game_v1 p
                  where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date and p.starter),
    away_sp_whip=(select (sum(p.hits)+sum(p.walks))::double precision/(nullif(sum(p.outs),0)/3.0) from public.mlb_ml_xyear_pitcher_game_v1 p
                  where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date and p.starter),
    home_sp_k_pct=(select sum(p.strikeouts)::double precision/nullif(sum(p.batters_faced),0) from public.mlb_ml_xyear_pitcher_game_v1 p
                   where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date and p.starter),
    away_sp_k_pct=(select sum(p.strikeouts)::double precision/nullif(sum(p.batters_faced),0) from public.mlb_ml_xyear_pitcher_game_v1 p
                   where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date and p.starter),
    home_sp_bb_pct=(select sum(p.walks)::double precision/nullif(sum(p.batters_faced),0) from public.mlb_ml_xyear_pitcher_game_v1 p
                    where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date and p.starter),
    away_sp_bb_pct=(select sum(p.walks)::double precision/nullif(sum(p.batters_faced),0) from public.mlb_ml_xyear_pitcher_game_v1 p
                    where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date and p.starter),
    home_sp_hard_hit_pct=(select sum(p.hard_hits)::double precision/nullif(sum(p.batted_balls),0) from public.mlb_ml_xyear_pitcher_game_v1 p
                          where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date and p.starter),
    away_sp_hard_hit_pct=(select sum(p.hard_hits)::double precision/nullif(sum(p.batted_balls),0) from public.mlb_ml_xyear_pitcher_game_v1 p
                          where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date and p.starter),
    home_sp_whiff_rate=(select sum(p.whiffs)::double precision/nullif(sum(p.swings),0) from public.mlb_ml_xyear_pitcher_game_v1 p
                        where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date and p.starter),
    away_sp_whiff_rate=(select sum(p.whiffs)::double precision/nullif(sum(p.swings),0) from public.mlb_ml_xyear_pitcher_game_v1 p
                        where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date and p.starter),
    home_sp_l5_ra9=(select sum(q.runs)::double precision*27/nullif(sum(q.outs),0) from (
      select p.runs,p.outs from public.mlb_ml_xyear_pitcher_game_v1 p
      where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date and p.starter
      order by p.game_date desc,p.game_pk desc limit 5) q),
    away_sp_l5_ra9=(select sum(q.runs)::double precision*27/nullif(sum(q.outs),0) from (
      select p.runs,p.outs from public.mlb_ml_xyear_pitcher_game_v1 p
      where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date and p.starter
      order by p.game_date desc,p.game_pk desc limit 5) q),
    home_sp_l5_whip=(select (sum(q.hits)+sum(q.walks))::double precision/(nullif(sum(q.outs),0)/3.0) from (
      select p.hits,p.walks,p.outs from public.mlb_ml_xyear_pitcher_game_v1 p
      where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date and p.starter
      order by p.game_date desc,p.game_pk desc limit 5) q),
    away_sp_l5_whip=(select (sum(q.hits)+sum(q.walks))::double precision/(nullif(sum(q.outs),0)/3.0) from (
      select p.hits,p.walks,p.outs from public.mlb_ml_xyear_pitcher_game_v1 p
      where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date and p.starter
      order by p.game_date desc,p.game_pk desc limit 5) q),

    h2h_games_prior=(select count(*) from public.mlb_ml_xyear_team_game_v1 g
                     where g.season=f.season and g.team=f.home_team and g.opponent=f.away_team and g.game_date<f.game_date),
    home_h2h_wins_prior=(select coalesce(sum(g.win),0)::int from public.mlb_ml_xyear_team_game_v1 g
                         where g.season=f.season and g.team=f.home_team and g.opponent=f.away_team and g.game_date<f.game_date),
    away_h2h_wins_prior=(select coalesce(sum(g.win),0)::int from public.mlb_ml_xyear_team_game_v1 g
                         where g.season=f.season and g.team=f.away_team and g.opponent=f.home_team and g.game_date<f.game_date),
    home_h2h_win_pct_prior=(select avg(g.win::double precision) from public.mlb_ml_xyear_team_game_v1 g
                            where g.season=f.season and g.team=f.home_team and g.opponent=f.away_team and g.game_date<f.game_date),
    common_opponents_count=(with co as (
      select distinct g.opponent from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date
      intersect
      select distinct g.opponent from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date
    ) select count(*) from co),
    home_common_games=(with co as (
      select distinct g.opponent from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date
      intersect
      select distinct g.opponent from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date
    ) select count(*) from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date and g.opponent in(select opponent from co)),
    away_common_games=(with co as (
      select distinct g.opponent from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date
      intersect
      select distinct g.opponent from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date
    ) select count(*) from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date and g.opponent in(select opponent from co)),
    home_common_win_pct=(with co as (
      select distinct g.opponent from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date
      intersect
      select distinct g.opponent from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date
    ) select avg(g.win::double precision) from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date and g.opponent in(select opponent from co)),
    away_common_win_pct=(with co as (
      select distinct g.opponent from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date
      intersect
      select distinct g.opponent from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date
    ) select avg(g.win::double precision) from public.mlb_ml_xyear_team_game_v1 g
      where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date and g.opponent in(select opponent from co)),
    home_sp_vs_opp_k_pct=(select sum(p.strikeouts)::double precision/nullif(sum(p.batters_faced),0)
                          from public.mlb_ml_xyear_pitcher_game_v1 p
                          where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.opponent=f.away_team and p.game_date<f.game_date),
    home_sp_vs_opp_bb_pct=(select sum(p.walks)::double precision/nullif(sum(p.batters_faced),0)
                           from public.mlb_ml_xyear_pitcher_game_v1 p
                           where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.opponent=f.away_team and p.game_date<f.game_date),
    away_sp_vs_opp_k_pct=(select sum(p.strikeouts)::double precision/nullif(sum(p.batters_faced),0)
                          from public.mlb_ml_xyear_pitcher_game_v1 p
                          where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.opponent=f.home_team and p.game_date<f.game_date),
    away_sp_vs_opp_bb_pct=(select sum(p.walks)::double precision/nullif(sum(p.batters_faced),0)
                           from public.mlb_ml_xyear_pitcher_game_v1 p
                           where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.opponent=f.home_team and p.game_date<f.game_date)
  where f.season=2026 and f.game_date=p_target_date;

  perform public.mlb_ml_xyear_enrich_pregame_context_v1(p_target_date);

  insert into public.mlb_ml_prior_scores_2026_v1(
    game_pk,game_date,team_prior_adv,starter_prior_adv,home_prior_starts,away_prior_starts
  )
  select
    f.game_pk,f.game_date,
    coalesce(ht.team_prior_score,0)-coalesce(at.team_prior_score,0),
    coalesce(hp.pitcher_prior_score,0)-coalesce(ap.pitcher_prior_score,0),
    hp.starts,ap.starts
  from public.mlb_ml_xyear_features_v1 f
  left join public.mlb_ml_prior2025_team_v1 ht on ht.team=f.home_team
  left join public.mlb_ml_prior2025_team_v1 at on at.team=f.away_team
  left join public.mlb_ml_prior2025_pitcher_v1 hp on hp.pitcher=f.home_sp_mlbam_id
  left join public.mlb_ml_prior2025_pitcher_v1 ap on ap.pitcher=f.away_sp_mlbam_id
  where f.season=2026 and f.game_date=p_target_date
  on conflict (game_pk) do update
  set game_date=excluded.game_date,
      team_prior_adv=excluded.team_prior_adv,
      starter_prior_adv=excluded.starter_prior_adv,
      home_prior_starts=excluded.home_prior_starts,
      away_prior_starts=excluded.away_prior_starts;

  insert into public.mlb_ml_xyear_feature_values_v1(
    branch,season,game_pk,game_date,home_team,away_team,day_night,doubleheader_flag,
    home_sp_hand,away_sp_hand,actual_winner,component,feature_name,direction,value
  )
  select
    'PREGAME',f.season,f.game_pk,f.game_date,f.home_team,f.away_team,f.day_night,f.doubleheader_flag,
    f.home_sp_hand,f.away_sp_hand,f.actual_winner,m.component,m.feature_name,m.direction,
    case
      when jsonb_typeof(to_jsonb(f)->m.feature_name)='number'
      then (to_jsonb(f)->>m.feature_name)::double precision
      else null
    end
  from public.mlb_ml_xyear_features_v1 f
  join public.mlb_ml_component_map_v2 m
    on m.branch='PREGAME' and m.source_kind='pregame'
  where f.season=2026 and f.game_date=p_target_date
  on conflict (branch,season,game_pk,feature_name) do update
  set game_date=excluded.game_date,
      home_team=excluded.home_team,
      away_team=excluded.away_team,
      day_night=excluded.day_night,
      doubleheader_flag=excluded.doubleheader_flag,
      home_sp_hand=excluded.home_sp_hand,
      away_sp_hand=excluded.away_sp_hand,
      actual_winner=excluded.actual_winner,
      component=excluded.component,
      direction=excluded.direction,
      value=excluded.value;

  get diagnostics v_feature_rows = row_count;

  insert into public.mlb_ml_xyear_component_scores_v1(
    branch,season,game_pk,game_date,home_team,away_team,day_night,doubleheader_flag,
    home_sp_hand,away_sp_hand,actual_winner,component,score,feature_count,populated_feature_count
  )
  select
    'PREGAME',v.season,v.game_pk,min(v.game_date),min(v.home_team),min(v.away_team),min(v.day_night),
    bool_or(v.doubleheader_flag),min(v.home_sp_hand),min(v.away_sp_hand),min(v.actual_winner),v.component,
    case
      when v.component='starter' and not bool_and(f.has_starters) then null
      when v.component='lineup_matchup' and not bool_and(f.has_lineup) then null
      when count(v.value)=0 then null
      else sum(
        case when v.value is not null and s.sd_value is not null and s.sd_value<>0
             then v.direction*((v.value-s.mean_value)/s.sd_value)
             else 0 end
      )/count(*)::double precision
    end,
    count(*)::int,
    count(v.value)::int
  from public.mlb_ml_xyear_feature_values_v1 v
  join public.mlb_ml_xyear_features_v1 f
    on f.season=v.season and f.game_pk=v.game_pk
  join public.mlb_ml_xyear_feature_stats_v1 s
    on s.branch='PREGAME' and s.feature_name=v.feature_name
  where v.branch='PREGAME' and v.season=2026 and v.game_date=p_target_date
  group by v.season,v.game_pk,v.component
  on conflict (branch,season,game_pk,component) do update
  set game_date=excluded.game_date,
      home_team=excluded.home_team,
      away_team=excluded.away_team,
      day_night=excluded.day_night,
      doubleheader_flag=excluded.doubleheader_flag,
      home_sp_hand=excluded.home_sp_hand,
      away_sp_hand=excluded.away_sp_hand,
      actual_winner=excluded.actual_winner,
      score=excluded.score,
      feature_count=excluded.feature_count,
      populated_feature_count=excluded.populated_feature_count;

  get diagnostics v_component_rows = row_count;

  insert into public.mlb_ml_xyear_game_components_v1(
    branch,season,game_pk,game_date,home_team,away_team,day_night,doubleheader_flag,
    home_sp_hand,away_sp_hand,actual_winner,
    team_strength,recent_form,offense,starter,bullpen,lineup_matchup,home_away,history,
    fatigue_travel,defense_context,actual_offense,actual_contact,actual_starter,actual_bullpen,actual_defense
  )
  select
    branch,season,game_pk,min(game_date),min(home_team),min(away_team),min(day_night),
    bool_or(doubleheader_flag),min(home_sp_hand),min(away_sp_hand),min(actual_winner),
    max(score) filter(where component='team_strength'),
    max(score) filter(where component='recent_form'),
    max(score) filter(where component='offense'),
    max(score) filter(where component='starter'),
    max(score) filter(where component='bullpen'),
    max(score) filter(where component='lineup_matchup'),
    max(score) filter(where component='home_away'),
    max(score) filter(where component='history'),
    max(score) filter(where component='fatigue_travel'),
    max(score) filter(where component='defense_context'),
    max(score) filter(where component='actual_offense'),
    max(score) filter(where component='actual_contact'),
    max(score) filter(where component='actual_starter'),
    max(score) filter(where component='actual_bullpen'),
    max(score) filter(where component='actual_defense')
  from public.mlb_ml_xyear_component_scores_v1
  where branch='PREGAME' and season=2026 and game_date=p_target_date
  group by branch,season,game_pk
  on conflict (branch,season,game_pk) do update
  set game_date=excluded.game_date,home_team=excluded.home_team,away_team=excluded.away_team,
      day_night=excluded.day_night,doubleheader_flag=excluded.doubleheader_flag,
      home_sp_hand=excluded.home_sp_hand,away_sp_hand=excluded.away_sp_hand,
      actual_winner=excluded.actual_winner,team_strength=excluded.team_strength,
      recent_form=excluded.recent_form,offense=excluded.offense,starter=excluded.starter,
      bullpen=excluded.bullpen,lineup_matchup=excluded.lineup_matchup,home_away=excluded.home_away,
      history=excluded.history,fatigue_travel=excluded.fatigue_travel,defense_context=excluded.defense_context,
      actual_offense=excluded.actual_offense,actual_contact=excluded.actual_contact,
      actual_starter=excluded.actual_starter,actual_bullpen=excluded.actual_bullpen,
      actual_defense=excluded.actual_defense;

  insert into public.mlb_ml_xyear_game_components_z_v1(
    branch,season,game_pk,game_date,home_team,away_team,day_night,doubleheader_flag,
    home_sp_hand,away_sp_hand,actual_winner,
    team_strength,recent_form,offense,starter,bullpen,lineup_matchup,home_away,history,
    fatigue_travel,defense_context,actual_offense,actual_contact,actual_starter,actual_bullpen,actual_defense,y_home
  )
  with z as (
    select c.branch,c.season,c.game_pk,c.game_date,c.home_team,c.away_team,c.day_night,c.doubleheader_flag,
           c.home_sp_hand,c.away_sp_hand,c.actual_winner,c.component,
           case when c.score is null then null
                else (c.score-s.mean_score)/nullif(s.sd_score,0) end as z
    from public.mlb_ml_xyear_component_scores_v1 c
    join public.mlb_ml_xyear_component_stats_v1 s using(branch,component)
    where c.branch='PREGAME' and c.season=2026 and c.game_date=p_target_date
  )
  select
    branch,season,game_pk,min(game_date),min(home_team),min(away_team),min(day_night),
    bool_or(doubleheader_flag),min(home_sp_hand),min(away_sp_hand),min(actual_winner),
    max(z) filter(where component='team_strength'),
    max(z) filter(where component='recent_form'),
    max(z) filter(where component='offense'),
    max(z) filter(where component='starter'),
    max(z) filter(where component='bullpen'),
    max(z) filter(where component='lineup_matchup'),
    max(z) filter(where component='home_away'),
    max(z) filter(where component='history'),
    max(z) filter(where component='fatigue_travel'),
    max(z) filter(where component='defense_context'),
    max(z) filter(where component='actual_offense'),
    max(z) filter(where component='actual_contact'),
    max(z) filter(where component='actual_starter'),
    max(z) filter(where component='actual_bullpen'),
    max(z) filter(where component='actual_defense'),
    (min(actual_winner)=min(home_team))::int
  from z
  group by branch,season,game_pk
  on conflict (branch,season,game_pk) do update
  set game_date=excluded.game_date,home_team=excluded.home_team,away_team=excluded.away_team,
      day_night=excluded.day_night,doubleheader_flag=excluded.doubleheader_flag,
      home_sp_hand=excluded.home_sp_hand,away_sp_hand=excluded.away_sp_hand,
      actual_winner=excluded.actual_winner,team_strength=excluded.team_strength,
      recent_form=excluded.recent_form,offense=excluded.offense,starter=excluded.starter,
      bullpen=excluded.bullpen,lineup_matchup=excluded.lineup_matchup,home_away=excluded.home_away,
      history=excluded.history,fatigue_travel=excluded.fatigue_travel,defense_context=excluded.defense_context,
      actual_offense=excluded.actual_offense,actual_contact=excluded.actual_contact,
      actual_starter=excluded.actual_starter,actual_bullpen=excluded.actual_bullpen,
      actual_defense=excluded.actual_defense,y_home=excluded.y_home;

  select count(*)::int into v_both_starters
  from public.mlb_ml_xyear_features_v1
  where season=2026 and game_date=p_target_date and has_starters;

  update public.mlb_ml_daily_ingestion_ledger_v1
  set features_games_refreshed=v_games,
      status=case
        when v_both_starters=v_games and
             not exists (
               select 1 from public.mlb_ml_xyear_features_v1 f
               where f.season=2026 and f.game_date=p_target_date and not f.has_lineup
             )
        then 'COMPLETE'
        else 'PARTIAL'
      end,
      notes=concat_ws(' ',
        notes,
        '[xyear_daily_sync_v3] Leakage-safe PREGAME materialization complete for all base games.',
        'Starter/Recent/History formulas parity-certified against 2026-09-14.',
        'Starter component is NULL unless both starter identities have pregame evidence.',
        'Lineup/Matchup is NULL unless pregame lineup evidence exists; no postgame lineup reconstruction is permitted.',
        'Frozen forward tracker rows and Official Picks were not modified.'
      ),
      updated_at=now()
  where game_date=p_target_date;

  return jsonb_build_object(
    'targetDate',p_target_date,
    'games',v_games,
    'featureValueWrites',v_feature_rows,
    'componentWrites',v_component_rows,
    'gamesWithBothStarterEvidence',v_both_starters,
    'gamesWithPregameLineupEvidence',(
      select count(*) from public.mlb_ml_xyear_features_v1
      where season=2026 and game_date=p_target_date and has_lineup
    ),
    'featureVersion','xyear_daily_sync_v3_leakage_safe',
    'officialPicksModified',false,
    'apostarActivated',false,
    'retroactiveForwardPicks',false
  );
end
$function$
;

revoke all on function public.mlb_ml_xyear_materialize_pregame_v3(date) from public,anon,authenticated;
grant execute on function public.mlb_ml_xyear_materialize_pregame_v3(date) to service_role;

comment on function public.mlb_ml_xyear_enrich_pregame_context_v1(date) is
'Parity-certified strict-prior PREGAME enrichment for Offense, Bullpen, Home/Away, Defense Context and Fatigue/Travel. Lineup is intentionally excluded.';

comment on function public.mlb_ml_xyear_materialize_pregame_v3(date) is
'Leakage-safe MLB Moneyline PREGAME materializer. Starter uses strict-prior starts only; context components use strict-prior history; missing pregame starter/lineup evidence remains NULL fail-closed.';
