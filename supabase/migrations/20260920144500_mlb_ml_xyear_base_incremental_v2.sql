
create or replace function public.mlb_ml_xyear_refresh_base_v2(p_target_date date)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
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
$$;

revoke all on function public.mlb_ml_xyear_refresh_base_v2(date) from public;
grant execute on function public.mlb_ml_xyear_refresh_base_v2(date) to service_role;

comment on function public.mlb_ml_xyear_refresh_base_v2(date) is
'Idempotent target-date postgame base/history refresh for MLB Moneyline xyear research. Final target-date data becomes eligible only as strict-prior history for later games.';
