
-- Research-only canonical daily materializer for the frozen MLB Moneyline experiment.
-- No model/threshold changes. Missing pregame evidence stays NULL/fail-closed.

create table if not exists public.mlb_ml_pregame_starter_evidence_v1 (
  game_pk bigint not null,
  game_date date not null,
  side text not null check (side in ('HOME','AWAY')),
  pitcher_mlbam_id bigint not null,
  pitcher_name text,
  captured_at timestamptz not null,
  scheduled_start timestamptz not null,
  source text not null,
  source_ref text,
  provenance jsonb not null default '{}'::jsonb,
  research_only boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (game_pk,side),
  constraint mlb_ml_pregame_starter_capture_before_start_ck
    check (captured_at < scheduled_start),
  constraint mlb_ml_pregame_starter_research_only_ck
    check (research_only=true)
);

create index if not exists mlb_ml_pregame_starter_evidence_date_idx
  on public.mlb_ml_pregame_starter_evidence_v1(game_date,game_pk);

alter table public.mlb_ml_pregame_starter_evidence_v1 enable row level security;
revoke all on table public.mlb_ml_pregame_starter_evidence_v1 from anon,authenticated;
grant select on table public.mlb_ml_pregame_starter_evidence_v1 to service_role;

create table if not exists public.mlb_ml_daily_materialization_audit_v1 (
  game_date date primary key,
  source_games integer not null,
  feature_rows integer not null,
  feature_value_rows integer not null,
  component_rows integer not null,
  starter_evidence_complete_games integer not null,
  starter_component_games integer not null,
  recent_form_component_games integer not null,
  history_component_games integer not null,
  lineup_matchup_component_games integer not null,
  zero_populated_nonnull_score_rows integer not null,
  integrity_status text not null,
  notes text,
  materialized_at timestamptz not null default now()
);

alter table public.mlb_ml_daily_materialization_audit_v1 enable row level security;
revoke all on table public.mlb_ml_daily_materialization_audit_v1 from anon,authenticated;
grant select on table public.mlb_ml_daily_materialization_audit_v1 to service_role;

create or replace function public.mlb_ml_capture_pregame_starters_v1(p_game_date date)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_inserted integer := 0;
  v_updated integer := 0;
begin
  with candidates as (
    select
      g.game_pk,
      g.game_date,
      'HOME'::text side,
      nullif(g.metadata->'homeProbablePitcher'->>'id','')::bigint pitcher_mlbam_id,
      g.metadata->'homeProbablePitcher'->>'fullName' pitcher_name,
      now() captured_at,
      g.scheduled_at scheduled_start,
      'PICK2_MLB_GAMES_PROBABLE'::text source,
      'pick2_mlb_games:'||g.game_pk::text source_ref,
      jsonb_build_object(
        'row_created_at',g.created_at,
        'row_updated_at',g.updated_at,
        'source','mlb_official',
        'rule','captured while now() < scheduled_at'
      ) provenance
    from public.pick2_mlb_games g
    where g.game_date=p_game_date
      and g.scheduled_at is not null
      and now()<g.scheduled_at
      and nullif(g.metadata->'homeProbablePitcher'->>'id','') is not null
    union all
    select
      g.game_pk,g.game_date,'AWAY',
      nullif(g.metadata->'awayProbablePitcher'->>'id','')::bigint,
      g.metadata->'awayProbablePitcher'->>'fullName',
      now(),g.scheduled_at,
      'PICK2_MLB_GAMES_PROBABLE',
      'pick2_mlb_games:'||g.game_pk::text,
      jsonb_build_object(
        'row_created_at',g.created_at,
        'row_updated_at',g.updated_at,
        'source','mlb_official',
        'rule','captured while now() < scheduled_at'
      )
    from public.pick2_mlb_games g
    where g.game_date=p_game_date
      and g.scheduled_at is not null
      and now()<g.scheduled_at
      and nullif(g.metadata->'awayProbablePitcher'->>'id','') is not null
  ),
  upserted as (
    insert into public.mlb_ml_pregame_starter_evidence_v1(
      game_pk,game_date,side,pitcher_mlbam_id,pitcher_name,captured_at,
      scheduled_start,source,source_ref,provenance
    )
    select game_pk,game_date,side,pitcher_mlbam_id,pitcher_name,captured_at,
           scheduled_start,source,source_ref,provenance
    from candidates
    on conflict (game_pk,side) do update
      set pitcher_mlbam_id=excluded.pitcher_mlbam_id,
          pitcher_name=excluded.pitcher_name,
          captured_at=excluded.captured_at,
          scheduled_start=excluded.scheduled_start,
          source=excluded.source,
          source_ref=excluded.source_ref,
          provenance=excluded.provenance,
          updated_at=now()
      where excluded.captured_at > public.mlb_ml_pregame_starter_evidence_v1.captured_at
        and excluded.captured_at < excluded.scheduled_start
    returning (xmax=0) inserted
  )
  select count(*) filter(where inserted),count(*) filter(where not inserted)
    into v_inserted,v_updated
  from upserted;

  return jsonb_build_object(
    'status','PASS',
    'gameDate',p_game_date,
    'inserted',v_inserted,
    'updated',v_updated,
    'capturedSides',(
      select count(*) from public.mlb_ml_pregame_starter_evidence_v1
      where game_date=p_game_date
    ),
    'completeGames',(
      select count(*) from (
        select game_pk
        from public.mlb_ml_pregame_starter_evidence_v1
        where game_date=p_game_date
        group by game_pk
        having count(distinct side)=2
      ) x
    )
  );
end
$$;

revoke all on function public.mlb_ml_capture_pregame_starters_v1(date) from public,anon,authenticated;
grant execute on function public.mlb_ml_capture_pregame_starters_v1(date) to service_role;

create or replace function public.mlb_ml_materialize_active_pregame_v3(p_game_date date)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_source_games integer;
  v_feature_rows integer;
  v_feature_value_rows integer;
  v_component_rows integer;
  v_starter_evidence_complete integer;
  v_starter_components integer;
  v_recent_components integer;
  v_history_components integer;
  v_lineup_components integer;
  v_zero_missing integer;
  v_status text;
begin
  if p_game_date >= (now() at time zone 'America/Puerto_Rico')::date then
    raise exception 'MLB_ML_MATERIALIZER:TARGET_DATE_NOT_COMPLETED';
  end if;

  select count(*)::int into v_source_games
  from public.mlb_ml_xyear_game_v1
  where season=2026 and game_date=p_game_date;

  if v_source_games=0 then
    raise exception 'MLB_ML_MATERIALIZER:NO_SOURCE_GAMES';
  end if;

  insert into public.mlb_ml_xyear_features_v1(
    canonical_game_id,game_pk,source_game_id,game_date,season,game_number,
    away_team,home_team,venue,start_time_local,day_night,doubleheader_flag,
    feature_cutoff_date,feature_version,current_inputs_reconstructed,
    has_statcast,has_lineup,has_starters,has_weather,has_umpire,has_odds,
    data_completeness_pct,pregame_integrity_tier,
    home_sp_mlbam_id,home_sp_name,away_sp_mlbam_id,away_sp_name,
    actual_winner
  )
  select
    'xyear:'||g.season::text||':'||g.game_pk::text,
    g.game_pk,g.game_pk::text,g.game_date,g.season,g.game_number,
    g.away_team,g.home_team,g.venue,g.scheduled_at::text,g.day_night,g.doubleheader_flag,
    g.game_date-1,'xyear_daily_materializer_v3',true,
    true,false,(hs.pitcher_mlbam_id is not null and asx.pitcher_mlbam_id is not null),
    false,false,false,
    null,
    case when hs.pitcher_mlbam_id is not null and asx.pitcher_mlbam_id is not null
         then 'A_ACTIVE_CORE_STARTERS_PREGAME'
         else 'B_ACTIVE_CORE_STARTER_GATED' end,
    hs.pitcher_mlbam_id,hs.pitcher_name,asx.pitcher_mlbam_id,asx.pitcher_name,
    g.actual_winner
  from public.mlb_ml_xyear_game_v1 g
  left join public.mlb_ml_pregame_starter_evidence_v1 hs
    on hs.game_pk=g.game_pk and hs.side='HOME'
  left join public.mlb_ml_pregame_starter_evidence_v1 asx
    on asx.game_pk=g.game_pk and asx.side='AWAY'
  where g.season=2026 and g.game_date=p_game_date
  on conflict (season,game_pk) do update
    set feature_cutoff_date=excluded.feature_cutoff_date,
        feature_version=excluded.feature_version,
        current_inputs_reconstructed=true,
        has_statcast=true,
        has_lineup=false,
        has_starters=excluded.has_starters,
        data_completeness_pct=null,
        pregame_integrity_tier=excluded.pregame_integrity_tier,
        home_sp_mlbam_id=excluded.home_sp_mlbam_id,
        home_sp_name=excluded.home_sp_name,
        away_sp_mlbam_id=excluded.away_sp_mlbam_id,
        away_sp_name=excluded.away_sp_name,
        actual_winner=excluded.actual_winner;

  -- Handedness is allowed only from strict-prior appearances of the already-captured pregame pitcher identity.
  update public.mlb_ml_xyear_features_v1 f
  set home_sp_hand=(
        select p.p_throws from public.mlb_ml_xyear_pitcher_game_v1 p
        where p.season=f.season and p.pitcher=f.home_sp_mlbam_id
          and p.game_date<f.game_date and p.p_throws is not null
        order by p.game_date desc,p.game_pk desc limit 1
      ),
      away_sp_hand=(
        select p.p_throws from public.mlb_ml_xyear_pitcher_game_v1 p
        where p.season=f.season and p.pitcher=f.away_sp_mlbam_id
          and p.game_date<f.game_date and p.p_throws is not null
        order by p.game_date desc,p.game_pk desc limit 1
      )
  where f.season=2026 and f.game_date=p_game_date;

  -- Team strength + recent form use only games strictly before the target date.
  update public.mlb_ml_xyear_features_v1 f
  set home_games_prior=(select count(*) from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date),
      home_wins_prior=(select coalesce(sum(g.win),0)::int from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date),
      home_losses_prior=(select count(*)-coalesce(sum(g.win),0)::int from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date),
      home_win_pct=(select avg(g.win::double precision) from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date),
      home_runs_scored_pg=(select avg(g.runs_for::double precision) from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date),
      home_runs_allowed_pg=(select avg(g.runs_against::double precision) from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date),
      home_run_diff_pg=(select avg((g.runs_for-g.runs_against)::double precision) from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date),
      home_pyth_win_pct=(select power(sum(g.runs_for)::double precision,1.83)/
        nullif(power(sum(g.runs_for)::double precision,1.83)+power(sum(g.runs_against)::double precision,1.83),0)
        from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date),
      away_games_prior=(select count(*) from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date),
      away_wins_prior=(select coalesce(sum(g.win),0)::int from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date),
      away_losses_prior=(select count(*)-coalesce(sum(g.win),0)::int from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date),
      away_win_pct=(select avg(g.win::double precision) from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date),
      away_runs_scored_pg=(select avg(g.runs_for::double precision) from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date),
      away_runs_allowed_pg=(select avg(g.runs_against::double precision) from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date),
      away_run_diff_pg=(select avg((g.runs_for-g.runs_against)::double precision) from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date),
      away_pyth_win_pct=(select power(sum(g.runs_for)::double precision,1.83)/
        nullif(power(sum(g.runs_for)::double precision,1.83)+power(sum(g.runs_against)::double precision,1.83),0)
        from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date),
      home_l5_games=(select count(*) from (select 1 from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date order by g.game_date desc,g.game_pk desc limit 5)x),
      home_l5_win_pct=(select avg(x.win::double precision) from (select g.win from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date order by g.game_date desc,g.game_pk desc limit 5)x),
      home_l5_run_diff_pg=(select avg((x.runs_for-x.runs_against)::double precision) from (select g.runs_for,g.runs_against from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date order by g.game_date desc,g.game_pk desc limit 5)x),
      home_l10_games=(select count(*) from (select 1 from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date order by g.game_date desc,g.game_pk desc limit 10)x),
      home_l10_win_pct=(select avg(x.win::double precision) from (select g.win from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date order by g.game_date desc,g.game_pk desc limit 10)x),
      home_l10_run_diff_pg=(select avg((x.runs_for-x.runs_against)::double precision) from (select g.runs_for,g.runs_against from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date order by g.game_date desc,g.game_pk desc limit 10)x),
      away_l5_games=(select count(*) from (select 1 from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date order by g.game_date desc,g.game_pk desc limit 5)x),
      away_l5_win_pct=(select avg(x.win::double precision) from (select g.win from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date order by g.game_date desc,g.game_pk desc limit 5)x),
      away_l5_run_diff_pg=(select avg((x.runs_for-x.runs_against)::double precision) from (select g.runs_for,g.runs_against from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date order by g.game_date desc,g.game_pk desc limit 5)x),
      away_l10_games=(select count(*) from (select 1 from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date order by g.game_date desc,g.game_pk desc limit 10)x),
      away_l10_win_pct=(select avg(x.win::double precision) from (select g.win from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date order by g.game_date desc,g.game_pk desc limit 10)x),
      away_l10_run_diff_pg=(select avg((x.runs_for-x.runs_against)::double precision) from (select g.runs_for,g.runs_against from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date order by g.game_date desc,g.game_pk desc limit 10)x)
  where f.season=2026 and f.game_date=p_game_date;

  -- Starter cumulative metrics use all strict-prior appearances; L5 uses the last five strict-prior starts.
  update public.mlb_ml_xyear_features_v1 f
  set home_sp_starts_prior=(select count(*) from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.starter and p.game_date<f.game_date),
      home_sp_prior_starts=(select count(*) from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.starter and p.game_date<f.game_date),
      home_sp_ra9=(select sum(p.runs)::double precision*27/nullif(sum(p.outs),0) from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date),
      home_sp_whip=(select (sum(p.hits)+sum(p.walks))::double precision/(nullif(sum(p.outs),0)/3.0) from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date),
      home_sp_k_pct=(select sum(p.strikeouts)::double precision/nullif(sum(p.batters_faced),0) from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date),
      home_sp_bb_pct=(select sum(p.walks)::double precision/nullif(sum(p.batters_faced),0) from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date),
      home_sp_hard_hit_pct=(select sum(p.hard_hits)::double precision/nullif(sum(p.batted_balls),0) from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date),
      home_sp_whiff_rate=(select sum(p.whiffs)::double precision/nullif(sum(p.swings),0) from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date),
      home_sp_l5_ra9=(select sum(x.runs)::double precision*27/nullif(sum(x.outs),0) from (select p.runs,p.outs from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.starter and p.game_date<f.game_date order by p.game_date desc,p.game_pk desc limit 5)x),
      home_sp_l5_whip=(select (sum(x.hits)+sum(x.walks))::double precision/(nullif(sum(x.outs),0)/3.0) from (select p.hits,p.walks,p.outs from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.starter and p.game_date<f.game_date order by p.game_date desc,p.game_pk desc limit 5)x),
      away_sp_starts_prior=(select count(*) from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.starter and p.game_date<f.game_date),
      away_sp_prior_starts=(select count(*) from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.starter and p.game_date<f.game_date),
      away_sp_ra9=(select sum(p.runs)::double precision*27/nullif(sum(p.outs),0) from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date),
      away_sp_whip=(select (sum(p.hits)+sum(p.walks))::double precision/(nullif(sum(p.outs),0)/3.0) from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date),
      away_sp_k_pct=(select sum(p.strikeouts)::double precision/nullif(sum(p.batters_faced),0) from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date),
      away_sp_bb_pct=(select sum(p.walks)::double precision/nullif(sum(p.batters_faced),0) from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date),
      away_sp_hard_hit_pct=(select sum(p.hard_hits)::double precision/nullif(sum(p.batted_balls),0) from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date),
      away_sp_whiff_rate=(select sum(p.whiffs)::double precision/nullif(sum(p.swings),0) from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date),
      away_sp_l5_ra9=(select sum(x.runs)::double precision*27/nullif(sum(x.outs),0) from (select p.runs,p.outs from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.starter and p.game_date<f.game_date order by p.game_date desc,p.game_pk desc limit 5)x),
      away_sp_l5_whip=(select (sum(x.hits)+sum(x.walks))::double precision/(nullif(sum(x.outs),0)/3.0) from (select p.hits,p.walks,p.outs from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.starter and p.game_date<f.game_date order by p.game_date desc,p.game_pk desc limit 5)x)
  where f.season=2026 and f.game_date=p_game_date;

  -- History: all source games are strict-prior.
  update public.mlb_ml_xyear_features_v1 f
  set h2h_games_prior=(select count(*) from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.home_team and g.opponent=f.away_team and g.game_date<f.game_date),
      home_h2h_wins_prior=(select coalesce(sum(g.win),0)::int from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.home_team and g.opponent=f.away_team and g.game_date<f.game_date),
      away_h2h_wins_prior=(select coalesce(sum(g.win),0)::int from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.away_team and g.opponent=f.home_team and g.game_date<f.game_date),
      home_h2h_win_pct_prior=(select avg(g.win::double precision) from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.home_team and g.opponent=f.away_team and g.game_date<f.game_date),
      home_common_win_pct=(
        with co as (
          select distinct g.opponent from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date
          intersect
          select distinct g.opponent from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date
        )
        select avg(g.win::double precision) from public.mlb_ml_xyear_team_game_v1 g
        where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date and g.opponent in(select opponent from co)
      ),
      away_common_win_pct=(
        with co as (
          select distinct g.opponent from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.home_team and g.game_date<f.game_date
          intersect
          select distinct g.opponent from public.mlb_ml_xyear_team_game_v1 g where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date
        )
        select avg(g.win::double precision) from public.mlb_ml_xyear_team_game_v1 g
        where g.season=f.season and g.team=f.away_team and g.game_date<f.game_date and g.opponent in(select opponent from co)
      ),
      home_sp_vs_opp_k_pct=(select sum(p.strikeouts)::double precision/nullif(sum(p.batters_faced),0) from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.opponent=f.away_team and p.game_date<f.game_date),
      home_sp_vs_opp_bb_pct=(select sum(p.walks)::double precision/nullif(sum(p.batters_faced),0) from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.opponent=f.away_team and p.game_date<f.game_date),
      away_sp_vs_opp_k_pct=(select sum(p.strikeouts)::double precision/nullif(sum(p.batters_faced),0) from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.opponent=f.home_team and p.game_date<f.game_date),
      away_sp_vs_opp_bb_pct=(select sum(p.walks)::double precision/nullif(sum(p.batters_faced),0) from public.mlb_ml_xyear_pitcher_game_v1 p where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.opponent=f.home_team and p.game_date<f.game_date)
  where f.season=2026 and f.game_date=p_game_date;

  -- Frozen 2025 prior layer; no outcome-dependent inputs.
  insert into public.mlb_ml_prior_scores_2026_v1(
    game_pk,game_date,team_prior_adv,starter_prior_adv,home_prior_starts,away_prior_starts
  )
  select f.game_pk,f.game_date,
         coalesce(ht.team_prior_score,0)-coalesce(at.team_prior_score,0),
         coalesce(hp.pitcher_prior_score,0)-coalesce(ap.pitcher_prior_score,0),
         hp.starts,ap.starts
  from public.mlb_ml_xyear_features_v1 f
  left join public.mlb_ml_prior2025_team_v1 ht on ht.team=f.home_team
  left join public.mlb_ml_prior2025_team_v1 at on at.team=f.away_team
  left join public.mlb_ml_prior2025_pitcher_v1 hp on hp.pitcher=f.home_sp_mlbam_id
  left join public.mlb_ml_prior2025_pitcher_v1 ap on ap.pitcher=f.away_sp_mlbam_id
  where f.season=2026 and f.game_date=p_game_date
  on conflict (game_pk) do update
    set game_date=excluded.game_date,
        team_prior_adv=excluded.team_prior_adv,
        starter_prior_adv=excluded.starter_prior_adv,
        home_prior_starts=excluded.home_prior_starts,
        away_prior_starts=excluded.away_prior_starts;

  -- Rebuild mapped PREGAME feature values for only this target date.
  insert into public.mlb_ml_xyear_feature_values_v1(
    branch,season,game_pk,game_date,home_team,away_team,day_night,doubleheader_flag,
    home_sp_hand,away_sp_hand,actual_winner,component,feature_name,direction,value
  )
  select 'PREGAME',f.season,f.game_pk,f.game_date,f.home_team,f.away_team,f.day_night,
         f.doubleheader_flag,f.home_sp_hand,f.away_sp_hand,f.actual_winner,
         m.component,m.feature_name,m.direction,
         case
           when jsonb_typeof(to_jsonb(f)->m.feature_name)='number'
             then (to_jsonb(f)->>m.feature_name)::double precision
           else null
         end
  from public.mlb_ml_xyear_features_v1 f
  cross join public.mlb_ml_component_map_v2 m
  where f.season=2026 and f.game_date=p_game_date and m.branch='PREGAME'
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

  -- Score exactly like the frozen research surface, except zero-populated components stay NULL.
  insert into public.mlb_ml_xyear_component_scores_v1(
    branch,season,game_pk,game_date,home_team,away_team,day_night,doubleheader_flag,
    home_sp_hand,away_sp_hand,actual_winner,component,score,feature_count,populated_feature_count
  )
  select
    'PREGAME',v.season,v.game_pk,min(v.game_date),min(v.home_team),min(v.away_team),
    min(v.day_night),bool_or(v.doubleheader_flag),min(v.home_sp_hand),min(v.away_sp_hand),
    min(v.actual_winner),v.component,
    case
      when count(*) filter(where v.value is not null)=0 then null
      when v.component='starter' and not bool_and(f.has_starters) then null
      when v.component='lineup_matchup' and not bool_and(f.has_lineup) then null
      else sum(
        case when v.value is not null and coalesce(s.sd_value,0)<>0
             then v.direction*((v.value-s.mean_value)/s.sd_value)
             else 0 end
      )/count(*)::double precision
    end score,
    count(*)::int,
    count(*) filter(where v.value is not null)::int
  from public.mlb_ml_xyear_feature_values_v1 v
  join public.mlb_ml_xyear_features_v1 f
    on f.season=v.season and f.game_pk=v.game_pk
  left join public.mlb_ml_xyear_feature_stats_v1 s
    on s.branch='PREGAME' and s.feature_name=v.feature_name
  where v.branch='PREGAME' and v.season=2026 and v.game_date=p_game_date
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

  insert into public.mlb_ml_xyear_game_components_v1(
    branch,season,game_pk,game_date,home_team,away_team,day_night,doubleheader_flag,
    home_sp_hand,away_sp_hand,actual_winner,
    team_strength,recent_form,offense,starter,bullpen,lineup_matchup,home_away,history,
    fatigue_travel,defense_context,actual_offense,actual_contact,actual_starter,actual_bullpen,actual_defense
  )
  select branch,season,game_pk,min(game_date),min(home_team),min(away_team),min(day_night),
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
         null,null,null,null,null
  from public.mlb_ml_xyear_component_scores_v1
  where branch='PREGAME' and season=2026 and game_date=p_game_date
  group by branch,season,game_pk
  on conflict (branch,season,game_pk) do update
    set game_date=excluded.game_date,home_team=excluded.home_team,away_team=excluded.away_team,
        day_night=excluded.day_night,doubleheader_flag=excluded.doubleheader_flag,
        home_sp_hand=excluded.home_sp_hand,away_sp_hand=excluded.away_sp_hand,
        actual_winner=excluded.actual_winner,team_strength=excluded.team_strength,
        recent_form=excluded.recent_form,offense=excluded.offense,starter=excluded.starter,
        bullpen=excluded.bullpen,lineup_matchup=excluded.lineup_matchup,
        home_away=excluded.home_away,history=excluded.history,
        fatigue_travel=excluded.fatigue_travel,defense_context=excluded.defense_context;

  insert into public.mlb_ml_xyear_game_components_z_v1(
    branch,season,game_pk,game_date,home_team,away_team,day_night,doubleheader_flag,
    home_sp_hand,away_sp_hand,actual_winner,
    team_strength,recent_form,offense,starter,bullpen,lineup_matchup,home_away,history,
    fatigue_travel,defense_context,actual_offense,actual_contact,actual_starter,actual_bullpen,actual_defense,y_home
  )
  select
    c.branch,c.season,c.game_pk,min(c.game_date),min(c.home_team),min(c.away_team),min(c.day_night),
    bool_or(c.doubleheader_flag),min(c.home_sp_hand),min(c.away_sp_hand),min(c.actual_winner),
    max(case when c.component='team_strength' and c.score is not null then (c.score-s.mean_score)/nullif(s.sd_score,0) end),
    max(case when c.component='recent_form' and c.score is not null then (c.score-s.mean_score)/nullif(s.sd_score,0) end),
    max(case when c.component='offense' and c.score is not null then (c.score-s.mean_score)/nullif(s.sd_score,0) end),
    max(case when c.component='starter' and c.score is not null then (c.score-s.mean_score)/nullif(s.sd_score,0) end),
    max(case when c.component='bullpen' and c.score is not null then (c.score-s.mean_score)/nullif(s.sd_score,0) end),
    max(case when c.component='lineup_matchup' and c.score is not null then (c.score-s.mean_score)/nullif(s.sd_score,0) end),
    max(case when c.component='home_away' and c.score is not null then (c.score-s.mean_score)/nullif(s.sd_score,0) end),
    max(case when c.component='history' and c.score is not null then (c.score-s.mean_score)/nullif(s.sd_score,0) end),
    max(case when c.component='fatigue_travel' and c.score is not null then (c.score-s.mean_score)/nullif(s.sd_score,0) end),
    max(case when c.component='defense_context' and c.score is not null then (c.score-s.mean_score)/nullif(s.sd_score,0) end),
    null,null,null,null,null,
    (min(c.actual_winner)=min(c.home_team))::int
  from public.mlb_ml_xyear_component_scores_v1 c
  join public.mlb_ml_xyear_component_stats_v1 s
    on s.branch=c.branch and s.component=c.component
  where c.branch='PREGAME' and c.season=2026 and c.game_date=p_game_date
  group by c.branch,c.season,c.game_pk
  on conflict (branch,season,game_pk) do update
    set game_date=excluded.game_date,home_team=excluded.home_team,away_team=excluded.away_team,
        day_night=excluded.day_night,doubleheader_flag=excluded.doubleheader_flag,
        home_sp_hand=excluded.home_sp_hand,away_sp_hand=excluded.away_sp_hand,
        actual_winner=excluded.actual_winner,team_strength=excluded.team_strength,
        recent_form=excluded.recent_form,offense=excluded.offense,starter=excluded.starter,
        bullpen=excluded.bullpen,lineup_matchup=excluded.lineup_matchup,
        home_away=excluded.home_away,history=excluded.history,
        fatigue_travel=excluded.fatigue_travel,defense_context=excluded.defense_context,y_home=excluded.y_home;

  insert into public.mlb_ml_xyear_pregame_zfeature_matrix_v1(season,game_pk,game_date,y_home,feature_name,z)
  select v.season,v.game_pk,v.game_date,(v.actual_winner=v.home_team)::int,v.feature_name,
         v.direction*((v.value-s.mean_value)/nullif(s.sd_value,0))
  from public.mlb_ml_xyear_feature_values_v1 v
  join public.mlb_ml_xyear_feature_stats_v1 s
    on s.branch='PREGAME' and s.feature_name=v.feature_name
  where v.branch='PREGAME' and v.season=2026 and v.game_date=p_game_date
    and v.value is not null and coalesce(s.sd_value,0)<>0
  on conflict (season,game_pk,feature_name) do update
    set game_date=excluded.game_date,y_home=excluded.y_home,z=excluded.z;

  select count(*)::int into v_feature_rows
  from public.mlb_ml_xyear_features_v1 where season=2026 and game_date=p_game_date;

  select count(*)::int into v_feature_value_rows
  from public.mlb_ml_xyear_feature_values_v1 where branch='PREGAME' and season=2026 and game_date=p_game_date;

  select count(*)::int into v_component_rows
  from public.mlb_ml_xyear_component_scores_v1 where branch='PREGAME' and season=2026 and game_date=p_game_date;

  select count(*)::int into v_starter_evidence_complete
  from (
    select game_pk from public.mlb_ml_pregame_starter_evidence_v1
    where game_date=p_game_date group by game_pk having count(distinct side)=2
  ) x;

  select count(*)::int into v_starter_components
  from public.mlb_ml_xyear_component_scores_v1
  where branch='PREGAME' and season=2026 and game_date=p_game_date
    and component='starter' and score is not null;

  select count(*)::int into v_recent_components
  from public.mlb_ml_xyear_component_scores_v1
  where branch='PREGAME' and season=2026 and game_date=p_game_date
    and component='recent_form' and score is not null;

  select count(*)::int into v_history_components
  from public.mlb_ml_xyear_component_scores_v1
  where branch='PREGAME' and season=2026 and game_date=p_game_date
    and component='history' and score is not null;

  select count(*)::int into v_lineup_components
  from public.mlb_ml_xyear_component_scores_v1
  where branch='PREGAME' and season=2026 and game_date=p_game_date
    and component='lineup_matchup' and score is not null;

  select count(*)::int into v_zero_missing
  from public.mlb_ml_xyear_component_scores_v1
  where branch='PREGAME' and season=2026 and game_date=p_game_date
    and populated_feature_count=0 and score is not null;

  v_status := case
    when v_feature_rows=v_source_games
     and v_component_rows=v_source_games*10
     and v_recent_components=v_source_games
     and v_zero_missing=0
      then 'READY_CORE_FAIL_CLOSED'
    else 'PARTIAL'
  end;

  insert into public.mlb_ml_daily_materialization_audit_v1(
    game_date,source_games,feature_rows,feature_value_rows,component_rows,
    starter_evidence_complete_games,starter_component_games,recent_form_component_games,
    history_component_games,lineup_matchup_component_games,zero_populated_nonnull_score_rows,
    integrity_status,notes,materialized_at
  )
  values(
    p_game_date,v_source_games,v_feature_rows,v_feature_value_rows,v_component_rows,
    v_starter_evidence_complete,v_starter_components,v_recent_components,
    v_history_components,v_lineup_components,v_zero_missing,v_status,
    'Frozen active Moneyline inputs materialized with strict source_game_date < target_game_date. Missing starter/lineup evidence remains NULL and disables dependent routes.',
    now()
  )
  on conflict (game_date) do update
    set source_games=excluded.source_games,feature_rows=excluded.feature_rows,
        feature_value_rows=excluded.feature_value_rows,component_rows=excluded.component_rows,
        starter_evidence_complete_games=excluded.starter_evidence_complete_games,
        starter_component_games=excluded.starter_component_games,
        recent_form_component_games=excluded.recent_form_component_games,
        history_component_games=excluded.history_component_games,
        lineup_matchup_component_games=excluded.lineup_matchup_component_games,
        zero_populated_nonnull_score_rows=excluded.zero_populated_nonnull_score_rows,
        integrity_status=excluded.integrity_status,notes=excluded.notes,materialized_at=excluded.materialized_at;

  update public.mlb_ml_daily_ingestion_ledger_v1 l
  set features_games_refreshed=v_feature_rows,
      status=case when v_status='READY_CORE_FAIL_CLOSED' then 'COMPLETE' else 'PARTIAL' end,
      source_cutoff_ts=now(),
      notes=coalesce(l.notes,'') ||
        format(' Canonical active Moneyline materializer v3: feature rows %s/%s; starter complete %s; recent %s; history %s; lineup %s; zero-populated encoded as non-null=%s; integrity=%s. Missing pregame starter/lineup evidence is route-gated, never reconstructed from target-game outcomes.',
          v_feature_rows,v_source_games,v_starter_evidence_complete,v_recent_components,
          v_history_components,v_lineup_components,v_zero_missing,v_status),
      updated_at=now()
  where l.game_date=p_game_date;

  return jsonb_build_object(
    'status',v_status,
    'gameDate',p_game_date,
    'sourceGames',v_source_games,
    'featureRows',v_feature_rows,
    'featureValueRows',v_feature_value_rows,
    'componentRows',v_component_rows,
    'starterEvidenceCompleteGames',v_starter_evidence_complete,
    'starterComponentGames',v_starter_components,
    'recentFormComponentGames',v_recent_components,
    'historyComponentGames',v_history_components,
    'lineupMatchupComponentGames',v_lineup_components,
    'zeroPopulatedNonnullScoreRows',v_zero_missing,
    'leakageRule','all model inputs source_game_date < target_game_date; starter identities require timestamped pregame evidence',
    'officialPicksModified',false,
    'apostarActivated',false,
    'modelRetuned',false
  );
end
$$;

revoke all on function public.mlb_ml_materialize_active_pregame_v3(date) from public,anon,authenticated;
grant execute on function public.mlb_ml_materialize_active_pregame_v3(date) to service_role;

-- Historical pregame starter evidence recovery. The identities themselves were frozen before first pitch.
with j as (
  select
    id,
    (metadata->>'predictionTimestamp')::timestamptz captured_at,
    metadata->'result'->'forward'->'predictions' predictions
  from public.sports_sync_jobs
  where id='415b36ba-6137-4803-ba27-8eca5965f54e'
),
p as (
  select
    j.id job_id,j.captured_at,
    (x->>'gamePk')::bigint game_pk,
    (x->>'pitcherId')::bigint pitcher_id,
    x->>'pitcherName' pitcher_name,
    (x->>'targetStart')::timestamptz scheduled_start
  from j cross join lateral jsonb_array_elements(j.predictions) x
),
resolved as (
  select p.*,g.game_date,
         case when pg.team=g.home_team then 'HOME'
              when pg.team=g.away_team then 'AWAY' end side
  from p
  join public.mlb_ml_xyear_game_v1 g on g.season=2026 and g.game_pk=p.game_pk
  join public.mlb_ml_xyear_pitcher_game_v1 pg
    on pg.season=2026 and pg.game_pk=p.game_pk and pg.pitcher=p.pitcher_id and pg.starter
  where p.captured_at<p.scheduled_start
)
insert into public.mlb_ml_pregame_starter_evidence_v1(
  game_pk,game_date,side,pitcher_mlbam_id,pitcher_name,captured_at,scheduled_start,
  source,source_ref,provenance
)
select game_pk,game_date,side,pitcher_id,pitcher_name,captured_at,scheduled_start,
       'PA12_ER_FORWARD_SHADOW_V2_AUDIT',job_id::text,
       jsonb_build_object(
         'identity_frozen_pregame',true,
         'side_resolution','validated against canonical target-game starter/team after freeze; target-game performance never used as a model input'
       )
from resolved
where side is not null
on conflict (game_pk,side) do nothing;

-- Sep19 rows remained pregame in pick2_mlb_games; preserve them as starter evidence.
insert into public.mlb_ml_pregame_starter_evidence_v1(
  game_pk,game_date,side,pitcher_mlbam_id,pitcher_name,captured_at,scheduled_start,
  source,source_ref,provenance
)
select g.game_pk,g.game_date,'HOME',
       (g.metadata->'homeProbablePitcher'->>'id')::bigint,
       g.metadata->'homeProbablePitcher'->>'fullName',
       g.updated_at,g.scheduled_at,'PICK2_MLB_GAMES_PREVIOUSLY_PRESERVED',
       'pick2_mlb_games:'||g.game_pk::text,
       jsonb_build_object('row_updated_at',g.updated_at,'verified_pregame',true)
from public.pick2_mlb_games g
where g.game_date=date '2026-09-19'
  and g.updated_at<g.scheduled_at
  and nullif(g.metadata->'homeProbablePitcher'->>'id','') is not null
on conflict (game_pk,side) do nothing;

insert into public.mlb_ml_pregame_starter_evidence_v1(
  game_pk,game_date,side,pitcher_mlbam_id,pitcher_name,captured_at,scheduled_start,
  source,source_ref,provenance
)
select g.game_pk,g.game_date,'AWAY',
       (g.metadata->'awayProbablePitcher'->>'id')::bigint,
       g.metadata->'awayProbablePitcher'->>'fullName',
       g.updated_at,g.scheduled_at,'PICK2_MLB_GAMES_PREVIOUSLY_PRESERVED',
       'pick2_mlb_games:'||g.game_pk::text,
       jsonb_build_object('row_updated_at',g.updated_at,'verified_pregame',true)
from public.pick2_mlb_games g
where g.game_date=date '2026-09-19'
  and g.updated_at<g.scheduled_at
  and nullif(g.metadata->'awayProbablePitcher'->>'id','') is not null
on conflict (game_pk,side) do nothing;

comment on table public.mlb_ml_pregame_starter_evidence_v1 is
'Research-only timestamped pregame starter identity evidence for leakage-safe Moneyline materialization. Never populate from a target game after first pitch.';

comment on function public.mlb_ml_materialize_active_pregame_v3(date) is
'Canonical idempotent postgame research materializer for frozen Moneyline inputs. Uses strict-prior history and timestamped pregame starter evidence. Missing evidence remains NULL/fail-closed; no retuning.';
