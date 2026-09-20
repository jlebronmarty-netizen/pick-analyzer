-- Canonical source reconciliation for the MLB Moneyline xyear daily pipeline.
-- Production repair authority: STARTER_POPULATION_AUTHORITY = PRIOR_STARTS_ONLY.
-- The deployed V3 function below is the post-repair definition validated against the
-- 2026-09-14 gold standard. This migration does not retune any model or threshold.

CREATE OR REPLACE FUNCTION public.mlb_ml_xyear_refresh_base_v2(p_target_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_raw_rows integer;
  v_games integer;
  v_team_rows integer;
  v_batting_rows integer;
  v_pitcher_rows integer;
begin
  select count(*)::int into v_raw_rows
  from public.pick2_raw_mlb_statcast_pitches
  where game_year=2026 and game_type='R' and game_date=p_target_date;

  if v_raw_rows=0 then
    raise exception 'MLB_ML_XYEAR_BASE_V2:NO_RAW_STATCAST:%',p_target_date;
  end if;

  insert into public.mlb_ml_xyear_game_v1(
    season,game_pk,game_date,home_team,away_team,venue,day_night,doubleheader_flag,
    game_number,scheduled_at,innings,home_score,away_score,actual_winner
  )
  with rg as (
    select
      2026::int season,
      p.game_pk,
      min(p.game_date) game_date,
      min(p.source_home_team) home_team,
      min(p.source_away_team) away_team,
      max(p.post_home_score) home_score,
      max(p.post_away_score) away_score,
      max(p.inning) innings
    from public.pick2_raw_mlb_statcast_pitches p
    where p.game_year=2026 and p.game_type='R' and p.game_date=p_target_date
    group by p.game_pk
  )
  select
    rg.season,rg.game_pk,rg.game_date,rg.home_team,rg.away_team,
    tv.venue,
    case
      when pg.scheduled_at is null then null
      when extract(hour from (pg.scheduled_at + make_interval(hours=>coalesce(tv.utc_offset_hours,0)::int))) < 17 then 'day'
      else 'night'
    end,
    case when coalesce(pg.doubleheader,'N')<>'N' then true else false end,
    coalesce(pg.game_number,1),
    pg.scheduled_at,
    rg.innings,rg.home_score,rg.away_score,
    case when rg.home_score>rg.away_score then rg.home_team else rg.away_team end
  from rg
  left join public.pick2_mlb_games pg on pg.game_pk=rg.game_pk
  left join public.mlb_ml_team_venue_map_v1 tv on tv.team=rg.home_team
  on conflict (season,game_pk) do update
  set game_date=excluded.game_date,
      home_team=excluded.home_team,
      away_team=excluded.away_team,
      venue=coalesce(excluded.venue,public.mlb_ml_xyear_game_v1.venue),
      day_night=coalesce(excluded.day_night,public.mlb_ml_xyear_game_v1.day_night),
      doubleheader_flag=excluded.doubleheader_flag,
      game_number=excluded.game_number,
      scheduled_at=coalesce(excluded.scheduled_at,public.mlb_ml_xyear_game_v1.scheduled_at),
      innings=excluded.innings,
      home_score=excluded.home_score,
      away_score=excluded.away_score,
      actual_winner=excluded.actual_winner;

  delete from public.mlb_ml_xyear_team_game_v1 where season=2026 and game_date=p_target_date;
  insert into public.mlb_ml_xyear_team_game_v1(
    season,game_pk,game_date,team,opponent,is_home,venue,runs_for,runs_against,win,innings
  )
  select season,game_pk,game_date,home_team,away_team,true,venue,home_score,away_score,(home_score>away_score)::int,innings
  from public.mlb_ml_xyear_game_v1 where season=2026 and game_date=p_target_date
  union all
  select season,game_pk,game_date,away_team,home_team,false,venue,away_score,home_score,(away_score>home_score)::int,innings
  from public.mlb_ml_xyear_game_v1 where season=2026 and game_date=p_target_date;

  delete from public.mlb_ml_xyear_team_batting_game_v1 where season=2026 and game_date=p_target_date;
  insert into public.mlb_ml_xyear_team_batting_game_v1(
    season,game_pk,game_date,team,pa,ab,hits,singles,doubles,triples,hr,walks,strikeouts
  )
  select
    p.game_year,p.game_pk,p.game_date,
    case when p.inning_topbot='Top' then p.source_away_team else p.source_home_team end,
    count(*) filter(where p.events is not null)::int,
    count(*) filter(where p.events is not null and p.events not in ('walk','intent_walk','hit_by_pitch','sac_fly','sac_bunt','catcher_interf','truncated_pa'))::int,
    count(*) filter(where p.events in ('single','double','triple','home_run'))::int,
    count(*) filter(where p.events='single')::int,
    count(*) filter(where p.events='double')::int,
    count(*) filter(where p.events='triple')::int,
    count(*) filter(where p.events='home_run')::int,
    count(*) filter(where p.events in ('walk','intent_walk'))::int,
    count(*) filter(where p.events in ('strikeout','strikeout_double_play'))::int
  from public.pick2_raw_mlb_statcast_pitches p
  where p.game_year=2026 and p.game_type='R' and p.game_date=p_target_date
  group by p.game_year,p.game_pk,p.game_date,
           case when p.inning_topbot='Top' then p.source_away_team else p.source_home_team end;

  delete from public.mlb_ml_xyear_team_statcast_game_v1 where season=2026 and game_date=p_target_date;
  insert into public.mlb_ml_xyear_team_statcast_game_v1(
    season,game_pk,game_date,team,pitches_seen,pa,strikeouts,walks,hits,hr,swings,whiffs,
    outside_zone_pitches,chases,batted_balls,hard_hits,barrels,ev_sum,ev_n
  )
  select
    p.game_year,p.game_pk,p.game_date,
    case when p.inning_topbot='Top' then p.source_away_team else p.source_home_team end,
    count(*)::int,
    count(*) filter(where p.events is not null)::int,
    count(*) filter(where p.events in ('strikeout','strikeout_double_play'))::int,
    count(*) filter(where p.events in ('walk','intent_walk'))::int,
    count(*) filter(where p.events in ('single','double','triple','home_run'))::int,
    count(*) filter(where p.events='home_run')::int,
    count(*) filter(where p.description in ('swinging_strike','swinging_strike_blocked','foul','foul_tip','hit_into_play','missed_bunt','foul_bunt','bunt_foul_tip'))::int,
    count(*) filter(where p.description in ('swinging_strike','swinging_strike_blocked','missed_bunt'))::int,
    count(*) filter(where p.zone is not null and p.zone not between 1 and 9)::int,
    count(*) filter(where p.zone is not null and p.zone not between 1 and 9 and p.description in ('swinging_strike','swinging_strike_blocked','foul','foul_tip','hit_into_play','missed_bunt','foul_bunt','bunt_foul_tip'))::int,
    count(*) filter(where p.launch_speed is not null)::int,
    count(*) filter(where p.launch_speed>=95)::int,
    count(*) filter(where p.launch_speed_angle=6)::int,
    sum(p.launch_speed) filter(where p.launch_speed is not null)::double precision,
    count(p.launch_speed)::int
  from public.pick2_raw_mlb_statcast_pitches p
  where p.game_year=2026 and p.game_type='R' and p.game_date=p_target_date
  group by p.game_year,p.game_pk,p.game_date,
           case when p.inning_topbot='Top' then p.source_away_team else p.source_home_team end;

  delete from public.mlb_ml_xyear_pitcher_game_v1 where season=2026 and game_date=p_target_date;
  insert into public.mlb_ml_xyear_pitcher_game_v1(
    season,game_pk,game_date,pitcher,team,opponent,starter,outs,batters_faced,hits,walks,
    strikeouts,runs,pitch_count,hr,swings,whiffs,outside_zone_pitches,chases,called_strikes,
    batted_balls,hard_hits,barrels,avg_exit_velocity,p_throws
  )
  with r as (
    select p.*,
           case when p.inning_topbot='Top' then p.source_home_team else p.source_away_team end pitching_team,
           case when p.inning_topbot='Top' then p.source_away_team else p.source_home_team end opponent_team,
           coalesce(p.mlbam_pitcher_id,p.source_pitcher_id) pitcher_id,
           row_number() over(
             partition by p.game_year,p.game_pk,
               case when p.inning_topbot='Top' then p.source_home_team else p.source_away_team end
             order by p.inning,p.at_bat_number,p.pitch_number
           ) team_pitch_ord
    from public.pick2_raw_mlb_statcast_pitches p
    where p.game_year=2026 and p.game_type='R' and p.game_date=p_target_date
  )
  select
    game_year,game_pk,game_date,pitcher_id,pitching_team,opponent_team,
    (min(team_pitch_ord)=1),
    sum(case when events in ('field_out','strikeout','force_out','sac_fly','sac_bunt','fielders_choice','fielders_choice_out') then 1
             when events in ('grounded_into_double_play','double_play','strikeout_double_play','sac_fly_double_play') then 2
             when events='triple_play' then 3 else 0 end)::int,
    count(*) filter(where events is not null)::int,
    count(*) filter(where events in ('single','double','triple','home_run'))::int,
    count(*) filter(where events in ('walk','intent_walk'))::int,
    count(*) filter(where events in ('strikeout','strikeout_double_play'))::int,
    coalesce(sum(greatest(coalesce(post_bat_score,0)-coalesce(bat_score,0),0)) filter(where events is not null),0)::int,
    count(*)::int,
    count(*) filter(where events='home_run')::int,
    count(*) filter(where description in ('swinging_strike','swinging_strike_blocked','foul','foul_tip','hit_into_play','missed_bunt','foul_bunt','bunt_foul_tip'))::int,
    count(*) filter(where description in ('swinging_strike','swinging_strike_blocked','missed_bunt'))::int,
    count(*) filter(where zone is not null and zone not between 1 and 9)::int,
    count(*) filter(where zone is not null and zone not between 1 and 9 and description in ('swinging_strike','swinging_strike_blocked','foul','foul_tip','hit_into_play','missed_bunt','foul_bunt','bunt_foul_tip'))::int,
    count(*) filter(where description='called_strike')::int,
    count(*) filter(where launch_speed is not null)::int,
    count(*) filter(where launch_speed>=95)::int,
    count(*) filter(where launch_speed_angle=6)::int,
    avg(launch_speed) filter(where launch_speed is not null)::double precision,
    max(p_throws)
  from r
  group by game_year,game_pk,game_date,pitcher_id,pitching_team,opponent_team;

  delete from public.mlb_ml_xyear_team_hand_game_v1 where season=2026 and game_date=p_target_date;
  insert into public.mlb_ml_xyear_team_hand_game_v1(
    season,game_pk,game_date,team,pitcher_hand,pa,strikeouts,batted_balls,hard_hits
  )
  select
    p.game_year,p.game_pk,p.game_date,
    case when p.inning_topbot='Top' then p.source_away_team else p.source_home_team end,
    p.p_throws,
    count(*) filter(where p.events is not null)::int,
    count(*) filter(where p.events in ('strikeout','strikeout_double_play'))::int,
    count(*) filter(where p.launch_speed is not null)::int,
    count(*) filter(where p.launch_speed>=95)::int
  from public.pick2_raw_mlb_statcast_pitches p
  where p.game_year=2026 and p.game_type='R' and p.game_date=p_target_date
  group by p.game_year,p.game_pk,p.game_date,
           case when p.inning_topbot='Top' then p.source_away_team else p.source_home_team end,
           p.p_throws;

  delete from public.mlb_ml_xyear_pitcher_pitchtype_game_v1 where season=2026 and game_date=p_target_date;
  insert into public.mlb_ml_xyear_pitcher_pitchtype_game_v1(
    season,game_pk,game_date,pitcher,pitch_name,pitches,swings,whiffs,release_speed_sum,release_speed_n
  )
  select
    p.game_year,p.game_pk,p.game_date,coalesce(p.mlbam_pitcher_id,p.source_pitcher_id),p.pitch_name,
    count(*)::int,
    count(*) filter(where p.description in ('swinging_strike','swinging_strike_blocked','foul','foul_tip','hit_into_play','missed_bunt','foul_bunt','bunt_foul_tip'))::int,
    count(*) filter(where p.description in ('swinging_strike','swinging_strike_blocked','missed_bunt'))::int,
    sum(p.release_speed) filter(where p.release_speed is not null)::double precision,
    count(p.release_speed)::int
  from public.pick2_raw_mlb_statcast_pitches p
  where p.game_year=2026 and p.game_type='R' and p.game_date=p_target_date and p.pitch_name is not null
  group by p.game_year,p.game_pk,p.game_date,coalesce(p.mlbam_pitcher_id,p.source_pitcher_id),p.pitch_name;

  delete from public.mlb_ml_xyear_team_pitchtype_game_v1 where season=2026 and game_date=p_target_date;
  insert into public.mlb_ml_xyear_team_pitchtype_game_v1(
    season,game_pk,game_date,team,pitcher_hand,pitch_name,pitches,swings,whiffs,batted_balls,hard_hits
  )
  select
    p.game_year,p.game_pk,p.game_date,
    case when p.inning_topbot='Top' then p.source_away_team else p.source_home_team end,
    p.p_throws,p.pitch_name,count(*)::int,
    count(*) filter(where p.description in ('swinging_strike','swinging_strike_blocked','foul','foul_tip','hit_into_play','missed_bunt','foul_bunt','bunt_foul_tip'))::int,
    count(*) filter(where p.description in ('swinging_strike','swinging_strike_blocked','missed_bunt'))::int,
    count(*) filter(where p.launch_speed is not null)::int,
    count(*) filter(where p.launch_speed>=95)::int
  from public.pick2_raw_mlb_statcast_pitches p
  where p.game_year=2026 and p.game_type='R' and p.game_date=p_target_date and p.pitch_name is not null
  group by p.game_year,p.game_pk,p.game_date,
           case when p.inning_topbot='Top' then p.source_away_team else p.source_home_team end,
           p.p_throws,p.pitch_name;

  delete from public.mlb_ml_xyear_batter_game_v1 where season=2026 and game_date=p_target_date;
  insert into public.mlb_ml_xyear_batter_game_v1(
    season,game_pk,game_date,batter,team,pa,ab,hits,singles,doubles,triples,hr,walks,strikeouts,
    batted_balls,hard_hits,barrels,ev_sum,ev_n
  )
  select
    p.game_year,p.game_pk,p.game_date,coalesce(p.mlbam_batter_id,p.source_batter_id),
    case when p.inning_topbot='Top' then p.source_away_team else p.source_home_team end,
    count(*) filter(where p.events is not null)::int,
    count(*) filter(where p.events is not null and p.events not in ('walk','intent_walk','hit_by_pitch','sac_fly','sac_bunt','catcher_interf','truncated_pa'))::int,
    count(*) filter(where p.events in ('single','double','triple','home_run'))::int,
    count(*) filter(where p.events='single')::int,
    count(*) filter(where p.events='double')::int,
    count(*) filter(where p.events='triple')::int,
    count(*) filter(where p.events='home_run')::int,
    count(*) filter(where p.events in ('walk','intent_walk'))::int,
    count(*) filter(where p.events in ('strikeout','strikeout_double_play'))::int,
    count(*) filter(where p.launch_speed is not null)::int,
    count(*) filter(where p.launch_speed>=95)::int,
    count(*) filter(where p.launch_speed_angle=6)::int,
    sum(p.launch_speed) filter(where p.launch_speed is not null)::double precision,
    count(p.launch_speed)::int
  from public.pick2_raw_mlb_statcast_pitches p
  where p.game_year=2026 and p.game_type='R' and p.game_date=p_target_date
  group by p.game_year,p.game_pk,p.game_date,coalesce(p.mlbam_batter_id,p.source_batter_id),
           case when p.inning_topbot='Top' then p.source_away_team else p.source_home_team end;

  delete from public.mlb_ml_xyear_lineup_v1 where season=2026 and game_date=p_target_date;
  insert into public.mlb_ml_xyear_lineup_v1(season,game_pk,game_date,team,batter,batting_order)
  with first_pa as (
    select
      p.game_year season,p.game_pk,p.game_date,
      case when p.inning_topbot='Top' then p.source_away_team else p.source_home_team end team,
      coalesce(p.mlbam_batter_id,p.source_batter_id) batter,
      min(p.at_bat_number) first_ab
    from public.pick2_raw_mlb_statcast_pitches p
    where p.game_year=2026 and p.game_type='R' and p.game_date=p_target_date
    group by p.game_year,p.game_pk,p.game_date,
             case when p.inning_topbot='Top' then p.source_away_team else p.source_home_team end,
             coalesce(p.mlbam_batter_id,p.source_batter_id)
  ), ranked as (
    select *,row_number() over(partition by season,game_pk,team order by first_ab,batter) batting_order
    from first_pa
  )
  select season,game_pk,game_date,team,batter,batting_order::int
  from ranked where batting_order<=9;

  delete from public.mlb_ml_xyear_errors_game_v1 where season=2026 and game_date=p_target_date;
  insert into public.mlb_ml_xyear_errors_game_v1(season,game_pk,game_date,team,errors)
  select
    p.game_year,p.game_pk,p.game_date,
    case when p.inning_topbot='Top' then p.source_home_team else p.source_away_team end,
    count(*) filter(where p.events='field_error')::int
  from public.pick2_raw_mlb_statcast_pitches p
  where p.game_year=2026 and p.game_type='R' and p.game_date=p_target_date
  group by p.game_year,p.game_pk,p.game_date,
           case when p.inning_topbot='Top' then p.source_home_team else p.source_away_team end;

  delete from public.mlb_ml_xyear_fullgame_v1 where season=2026 and game_date=p_target_date;
  insert into public.mlb_ml_xyear_fullgame_v1
  select
    g.season,g.game_pk,g.game_date,g.home_team,g.away_team,
    hb.hits,ab.hits,hb.hr,ab.hr,hb.walks,ab.walks,hb.strikeouts,ab.strikeouts,
    hs.hard_hits::double precision/nullif(hs.batted_balls,0),
    asx.hard_hits::double precision/nullif(asx.batted_balls,0),
    hs.barrels::double precision/nullif(hs.batted_balls,0),
    asx.barrels::double precision/nullif(asx.batted_balls,0),
    hs.ev_sum/nullif(hs.ev_n,0),asx.ev_sum/nullif(asx.ev_n,0),
    hs.whiffs::double precision/nullif(hs.swings,0),
    asx.whiffs::double precision/nullif(asx.swings,0),
    hs.chases::double precision/nullif(hs.outside_zone_pitches,0),
    asx.chases::double precision/nullif(asx.outside_zone_pitches,0),
    hp.outs,ap.outs,hp.hits,ap.hits,hp.walks,ap.walks,hp.strikeouts,ap.strikeouts,
    hp.pitch_count,ap.pitch_count,
    hbp.outs,abp.outs,hbp.hits,abp.hits,hbp.walks,abp.walks,hbp.strikeouts,abp.strikeouts,
    he.errors,ae.errors,g.actual_winner
  from public.mlb_ml_xyear_game_v1 g
  left join public.mlb_ml_xyear_team_batting_game_v1 hb on hb.season=g.season and hb.game_pk=g.game_pk and hb.team=g.home_team
  left join public.mlb_ml_xyear_team_batting_game_v1 ab on ab.season=g.season and ab.game_pk=g.game_pk and ab.team=g.away_team
  left join public.mlb_ml_xyear_team_statcast_game_v1 hs on hs.season=g.season and hs.game_pk=g.game_pk and hs.team=g.home_team
  left join public.mlb_ml_xyear_team_statcast_game_v1 asx on asx.season=g.season and asx.game_pk=g.game_pk and asx.team=g.away_team
  left join public.mlb_ml_xyear_pitcher_game_v1 hp on hp.season=g.season and hp.game_pk=g.game_pk and hp.team=g.home_team and hp.starter
  left join public.mlb_ml_xyear_pitcher_game_v1 ap on ap.season=g.season and ap.game_pk=g.game_pk and ap.team=g.away_team and ap.starter
  left join lateral (
    select sum(outs)::int outs,sum(hits)::int hits,sum(walks)::int walks,sum(strikeouts)::int strikeouts
    from public.mlb_ml_xyear_pitcher_game_v1 p
    where p.season=g.season and p.game_pk=g.game_pk and p.team=g.home_team and not p.starter
  ) hbp on true
  left join lateral (
    select sum(outs)::int outs,sum(hits)::int hits,sum(walks)::int walks,sum(strikeouts)::int strikeouts
    from public.mlb_ml_xyear_pitcher_game_v1 p
    where p.season=g.season and p.game_pk=g.game_pk and p.team=g.away_team and not p.starter
  ) abp on true
  left join public.mlb_ml_xyear_errors_game_v1 he on he.season=g.season and he.game_pk=g.game_pk and he.team=g.home_team
  left join public.mlb_ml_xyear_errors_game_v1 ae on ae.season=g.season and ae.game_pk=g.game_pk and ae.team=g.away_team
  where g.season=2026 and g.game_date=p_target_date;

  select count(*)::int into v_games from public.mlb_ml_xyear_game_v1 where season=2026 and game_date=p_target_date;
  select count(*)::int into v_team_rows from public.mlb_ml_xyear_team_game_v1 where season=2026 and game_date=p_target_date;
  select count(*)::int into v_batting_rows from public.mlb_ml_xyear_team_batting_game_v1 where season=2026 and game_date=p_target_date;
  select count(*)::int into v_pitcher_rows from public.mlb_ml_xyear_pitcher_game_v1 where season=2026 and game_date=p_target_date;

  insert into public.mlb_ml_daily_ingestion_ledger_v1(
    game_date,expected_games,completed_games,statcast_games_loaded,team_game_rows_loaded,
    pitcher_game_rows_loaded,batting_game_rows_loaded,features_games_refreshed,status,
    source_cutoff_ts,notes,updated_at
  )
  values(
    p_target_date,v_games,v_games,v_games,v_team_rows,v_pitcher_rows,v_batting_rows,0,
    'BASE_READY',now(),
    '[xyear_base_v2] Canonical postgame base/history layer refreshed transactionally from final Statcast. Target-date rows are history-only and are never used as same-game pregame inputs.',
    now()
  )
  on conflict (game_date) do update
  set expected_games=coalesce(public.mlb_ml_daily_ingestion_ledger_v1.expected_games,excluded.expected_games),
      completed_games=excluded.completed_games,
      statcast_games_loaded=excluded.statcast_games_loaded,
      team_game_rows_loaded=excluded.team_game_rows_loaded,
      pitcher_game_rows_loaded=excluded.pitcher_game_rows_loaded,
      batting_game_rows_loaded=excluded.batting_game_rows_loaded,
      status='BASE_READY',
      source_cutoff_ts=excluded.source_cutoff_ts,
      notes='[xyear_base_v2] Canonical postgame base/history layer refreshed transactionally from final Statcast. Target-date rows are history-only and are never used as same-game pregame inputs.',
      updated_at=now();

  return jsonb_build_object(
    'targetDate',p_target_date,
    'rawRows',v_raw_rows,
    'games',v_games,
    'teamGameRows',v_team_rows,
    'battingRows',v_batting_rows,
    'pitcherRows',v_pitcher_rows,
    'status','BASE_READY',
    'sameGamePregameUse',false,
    'officialPicksModified',false,
    'apostarActivated',false
  );
end
$function$
;

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

revoke all on function public.mlb_ml_xyear_refresh_base_v2(date) from public, anon, authenticated;
revoke all on function public.mlb_ml_xyear_materialize_pregame_v3(date) from public, anon, authenticated;
grant execute on function public.mlb_ml_xyear_refresh_base_v2(date) to service_role;
grant execute on function public.mlb_ml_xyear_materialize_pregame_v3(date) to service_role;

comment on function public.mlb_ml_xyear_refresh_base_v2(date) is
'Idempotent research base/history refresh from completed final Statcast rows. Target-date rows are stored for future history and are not same-game pregame inputs.';

comment on function public.mlb_ml_xyear_materialize_pregame_v3(date) is
'Leakage-safe MLB Moneyline PREGAME materializer. Starter accumulated and L5 metrics use strict-prior starts only; missing pregame starter/lineup evidence remains NULL fail-closed.';
