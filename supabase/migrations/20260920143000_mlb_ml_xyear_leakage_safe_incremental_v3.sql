
create table if not exists public.mlb_ml_pregame_starter_evidence_v1 (
  game_date date not null,
  game_pk bigint not null,
  side text not null check (side in ('HOME','AWAY')),
  pitcher_mlbam_id bigint not null,
  pitcher_name text,
  evidence_source text not null,
  evidence_timestamp timestamptz not null,
  first_pitch timestamptz not null,
  source_job_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (game_pk, side),
  constraint mlb_ml_pregame_starter_evidence_v1_pregame_ck
    check (evidence_timestamp < first_pitch)
);

create index if not exists mlb_ml_pregame_starter_evidence_v1_date_idx
  on public.mlb_ml_pregame_starter_evidence_v1(game_date,game_pk);

alter table public.mlb_ml_pregame_starter_evidence_v1 enable row level security;
revoke all on table public.mlb_ml_pregame_starter_evidence_v1 from anon,authenticated,service_role;
grant select on table public.mlb_ml_pregame_starter_evidence_v1 to service_role;

create or replace function public.mlb_ml_capture_pregame_starter_evidence_v1(p_target_date date)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_rows integer := 0;
  v_rows_second integer := 0;
begin
  insert into public.mlb_ml_pregame_starter_evidence_v1(
    game_date,game_pk,side,pitcher_mlbam_id,pitcher_name,
    evidence_source,evidence_timestamp,first_pitch,metadata
  )
  select
    f.feature_date,
    f.target_game_pk,
    s.side,
    s.pitcher_id,
    case when s.side='HOME'
         then g.metadata->'homeProbablePitcher'->>'fullName'
         else g.metadata->'awayProbablePitcher'->>'fullName' end,
    'PICK2_MLB_FIRST_INNING_DAILY_FEATURES',
    f.as_of_timestamp,
    g.scheduled_at,
    jsonb_build_object(
      'feature_snapshot_id',f.feature_snapshot_id,
      'feature_version',f.feature_version,
      'as_of_date',f.as_of_date,
      'source_rule','source_game_date < target_game_date'
    )
  from public.pick2_mlb_first_inning_daily_features f
  join public.pick2_mlb_games g on g.game_pk=f.target_game_pk
  cross join lateral (
    values
      ('HOME'::text,f.home_starter_mlbam_pitcher_id),
      ('AWAY'::text,f.away_starter_mlbam_pitcher_id)
  ) s(side,pitcher_id)
  where f.feature_date=p_target_date
    and s.pitcher_id is not null
    and f.as_of_date < p_target_date
    and f.as_of_timestamp < g.scheduled_at
  on conflict (game_pk,side) do update
  set pitcher_mlbam_id=excluded.pitcher_mlbam_id,
      pitcher_name=coalesce(excluded.pitcher_name,public.mlb_ml_pregame_starter_evidence_v1.pitcher_name),
      evidence_source=excluded.evidence_source,
      evidence_timestamp=excluded.evidence_timestamp,
      first_pitch=excluded.first_pitch,
      metadata=excluded.metadata
  where excluded.evidence_timestamp > public.mlb_ml_pregame_starter_evidence_v1.evidence_timestamp
    and excluded.evidence_timestamp < excluded.first_pitch;

  get diagnostics v_rows = row_count;

  insert into public.mlb_ml_pregame_starter_evidence_v1(
    game_date,game_pk,side,pitcher_mlbam_id,pitcher_name,
    evidence_source,evidence_timestamp,first_pitch,metadata
  )
  select
    g.game_date,
    g.game_pk,
    s.side,
    s.pitcher_id,
    s.pitcher_name,
    'PICK2_MLB_GAMES_PROBABLE_PITCHER',
    g.updated_at,
    g.scheduled_at,
    jsonb_build_object(
      'source',g.source,
      'source_payload_digest',g.source_payload_digest,
      'phase',g.metadata->>'phase',
      'official_date',g.metadata->>'officialDate'
    )
  from public.pick2_mlb_games g
  cross join lateral (
    values
      ('HOME'::text,
       nullif(g.metadata->'homeProbablePitcher'->>'id','')::bigint,
       g.metadata->'homeProbablePitcher'->>'fullName'),
      ('AWAY'::text,
       nullif(g.metadata->'awayProbablePitcher'->>'id','')::bigint,
       g.metadata->'awayProbablePitcher'->>'fullName')
  ) s(side,pitcher_id,pitcher_name)
  where g.game_date=p_target_date
    and s.pitcher_id is not null
    and g.updated_at < g.scheduled_at
  on conflict (game_pk,side) do update
  set pitcher_mlbam_id=excluded.pitcher_mlbam_id,
      pitcher_name=coalesce(excluded.pitcher_name,public.mlb_ml_pregame_starter_evidence_v1.pitcher_name),
      evidence_source=excluded.evidence_source,
      evidence_timestamp=excluded.evidence_timestamp,
      first_pitch=excluded.first_pitch,
      metadata=excluded.metadata
  where excluded.evidence_timestamp > public.mlb_ml_pregame_starter_evidence_v1.evidence_timestamp
    and excluded.evidence_timestamp < excluded.first_pitch;

  get diagnostics v_rows_second = row_count;
  v_rows := v_rows + v_rows_second;

  return jsonb_build_object(
    'targetDate',p_target_date,
    'writeOperations',v_rows,
    'evidenceSides',(
      select count(*) from public.mlb_ml_pregame_starter_evidence_v1 where game_date=p_target_date
    ),
    'gamesWithBothStarters',(
      select count(*) from (
        select game_pk from public.mlb_ml_pregame_starter_evidence_v1
        where game_date=p_target_date
        group by game_pk having count(distinct side)=2
      ) q
    )
  );
end
$$;

create or replace function public.mlb_ml_xyear_materialize_pregame_v3(p_target_date date)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
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
                 where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date),
    away_sp_ra9=(select sum(p.runs)::double precision*27/nullif(sum(p.outs),0) from public.mlb_ml_xyear_pitcher_game_v1 p
                 where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date),
    home_sp_whip=(select (sum(p.hits)+sum(p.walks))::double precision/(nullif(sum(p.outs),0)/3.0) from public.mlb_ml_xyear_pitcher_game_v1 p
                  where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date),
    away_sp_whip=(select (sum(p.hits)+sum(p.walks))::double precision/(nullif(sum(p.outs),0)/3.0) from public.mlb_ml_xyear_pitcher_game_v1 p
                  where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date),
    home_sp_k_pct=(select sum(p.strikeouts)::double precision/nullif(sum(p.batters_faced),0) from public.mlb_ml_xyear_pitcher_game_v1 p
                   where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date),
    away_sp_k_pct=(select sum(p.strikeouts)::double precision/nullif(sum(p.batters_faced),0) from public.mlb_ml_xyear_pitcher_game_v1 p
                   where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date),
    home_sp_bb_pct=(select sum(p.walks)::double precision/nullif(sum(p.batters_faced),0) from public.mlb_ml_xyear_pitcher_game_v1 p
                    where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date),
    away_sp_bb_pct=(select sum(p.walks)::double precision/nullif(sum(p.batters_faced),0) from public.mlb_ml_xyear_pitcher_game_v1 p
                    where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date),
    home_sp_hard_hit_pct=(select sum(p.hard_hits)::double precision/nullif(sum(p.batted_balls),0) from public.mlb_ml_xyear_pitcher_game_v1 p
                          where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date),
    away_sp_hard_hit_pct=(select sum(p.hard_hits)::double precision/nullif(sum(p.batted_balls),0) from public.mlb_ml_xyear_pitcher_game_v1 p
                          where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date),
    home_sp_whiff_rate=(select sum(p.whiffs)::double precision/nullif(sum(p.swings),0) from public.mlb_ml_xyear_pitcher_game_v1 p
                        where p.season=f.season and p.pitcher=f.home_sp_mlbam_id and p.game_date<f.game_date),
    away_sp_whiff_rate=(select sum(p.whiffs)::double precision/nullif(sum(p.swings),0) from public.mlb_ml_xyear_pitcher_game_v1 p
                        where p.season=f.season and p.pitcher=f.away_sp_mlbam_id and p.game_date<f.game_date),
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
$$;

revoke all on function public.mlb_ml_capture_pregame_starter_evidence_v1(date) from public;
revoke all on function public.mlb_ml_xyear_materialize_pregame_v3(date) from public;
grant execute on function public.mlb_ml_capture_pregame_starter_evidence_v1(date) to service_role;
grant execute on function public.mlb_ml_xyear_materialize_pregame_v3(date) to service_role;

comment on table public.mlb_ml_pregame_starter_evidence_v1 is
'Leakage-safe pregame starter identity evidence for MLB Moneyline xyear daily materialization. Evidence timestamp must precede first pitch.';

comment on function public.mlb_ml_xyear_materialize_pregame_v3(date) is
'Idempotent research warehouse materializer. Rebuilds PREGAME xyear feature/component layers from strict-prior history and preserved pregame starter evidence; never reconstructs missing lineups from postgame data.';
