-- MLB NRFI/YRFI leakage-safe backtest feature surface V1.
-- Same-day earlier games are intentionally excluded from history by using
-- date-level RANGE windows ending one second before the target date timestamp.

create materialized view if not exists public.mlb_nrfi_backtest_rows_v1_mv as
with halves as (
  select season, game_pk, game_date, game_date::timestamp as game_ts,
    'away'::text as half_side,
    away_team as offense_team, home_team as defense_team, home_starter as starter,
    (away_first_inning_runs > 0)::int as offense_scored,
    away_first_inning_runs as runs_scored,
    away_first_inning_pitches as pitches
  from public.mlb_statcast_first_inning_game_mv
  union all
  select season, game_pk, game_date, game_date::timestamp,
    'home', home_team, away_team, away_starter,
    (home_first_inning_runs > 0)::int,
    home_first_inning_runs,
    home_first_inning_pitches
  from public.mlb_statcast_first_inning_game_mv
), hist as (
  select h.*,
    count(*) over (partition by season, offense_team order by game_ts range between unbounded preceding and interval '1 second' preceding) as off_n_all,
    avg(offense_scored) over (partition by season, offense_team order by game_ts range between unbounded preceding and interval '1 second' preceding) as off_score_all,
    avg(offense_scored) over (partition by season, offense_team order by game_ts range between interval '30 days' preceding and interval '1 second' preceding) as off_score_30d,
    avg(pitches) over (partition by season, offense_team order by game_ts range between interval '30 days' preceding and interval '1 second' preceding) as off_pitches_30d,
    count(*) over (partition by season, defense_team order by game_ts range between unbounded preceding and interval '1 second' preceding) as def_n_all,
    avg(offense_scored) over (partition by season, defense_team order by game_ts range between unbounded preceding and interval '1 second' preceding) as def_allow_all,
    avg(offense_scored) over (partition by season, defense_team order by game_ts range between interval '30 days' preceding and interval '1 second' preceding) as def_allow_30d,
    count(*) over (partition by season, starter order by game_ts range between unbounded preceding and interval '1 second' preceding) as starter_n_all,
    avg(offense_scored) over (partition by season, starter order by game_ts range between unbounded preceding and interval '1 second' preceding) as starter_allow_all,
    avg(offense_scored) over (partition by season, starter order by game_ts range between interval '60 days' preceding and interval '1 second' preceding) as starter_allow_60d,
    avg(runs_scored) over (partition by season, starter order by game_ts range between interval '60 days' preceding and interval '1 second' preceding) as starter_runs_60d,
    avg(pitches) over (partition by season, starter order by game_ts range between interval '60 days' preceding and interval '1 second' preceding) as starter_pitches_60d
  from halves h
), league as (
  select g.*,
    count(*) over (partition by season order by game_date::timestamp range between unbounded preceding and interval '1 second' preceding) as league_n_prior,
    avg(nrfi::int) over (partition by season order by game_date::timestamp range between unbounded preceding and interval '1 second' preceding) as league_nrfi_prior
  from public.mlb_statcast_first_inning_game_mv g
), pivoted as (
 select l.season,l.game_pk,l.game_date,l.home_team,l.away_team,l.home_starter,l.away_starter,l.nrfi,l.first_inning_runs,l.league_n_prior,l.league_nrfi_prior,
  max(off_n_all) filter(where half_side='away')::int away_off_n,
  max(off_score_all) filter(where half_side='away')::double precision away_off_score_all,
  max(off_score_30d) filter(where half_side='away')::double precision away_off_score_30d,
  max(off_pitches_30d) filter(where half_side='away')::double precision away_off_pitches_30d,
  max(def_allow_all) filter(where half_side='away')::double precision home_def_allow_all,
  max(def_allow_30d) filter(where half_side='away')::double precision home_def_allow_30d,
  max(starter_n_all) filter(where half_side='away')::int home_starter_n,
  max(starter_allow_all) filter(where half_side='away')::double precision home_starter_allow_all,
  max(starter_allow_60d) filter(where half_side='away')::double precision home_starter_allow_60d,
  max(starter_runs_60d) filter(where half_side='away')::double precision home_starter_runs_60d,
  max(starter_pitches_60d) filter(where half_side='away')::double precision home_starter_pitches_60d,
  max(off_n_all) filter(where half_side='home')::int home_off_n,
  max(off_score_all) filter(where half_side='home')::double precision home_off_score_all,
  max(off_score_30d) filter(where half_side='home')::double precision home_off_score_30d,
  max(off_pitches_30d) filter(where half_side='home')::double precision home_off_pitches_30d,
  max(def_allow_all) filter(where half_side='home')::double precision away_def_allow_all,
  max(def_allow_30d) filter(where half_side='home')::double precision away_def_allow_30d,
  max(starter_n_all) filter(where half_side='home')::int away_starter_n,
  max(starter_allow_all) filter(where half_side='home')::double precision away_starter_allow_all,
  max(starter_allow_60d) filter(where half_side='home')::double precision away_starter_allow_60d,
  max(starter_runs_60d) filter(where half_side='home')::double precision away_starter_runs_60d,
  max(starter_pitches_60d) filter(where half_side='home')::double precision away_starter_pitches_60d
 from league l join hist h using(season,game_pk,game_date)
 group by l.season,l.game_pk,l.game_date,l.home_team,l.away_team,l.home_starter,l.away_starter,l.nrfi,l.first_inning_runs,l.league_n_prior,l.league_nrfi_prior
)
select p.*,
 case
  when season=2026 then 'HOLDOUT'
  when game_date < date '2025-08-01' then 'TRAIN'
  when game_date < date '2025-09-01' then 'VALIDATION'
  else 'TEST'
 end as split,
 (
   away_off_n >= 10 and home_off_n >= 10 and
   home_starter_n >= 2 and away_starter_n >= 2 and
   league_n_prior >= 50 and
   away_off_score_all is not null and away_off_score_30d is not null and
   home_off_score_all is not null and home_off_score_30d is not null and
   home_def_allow_all is not null and home_def_allow_30d is not null and
   away_def_allow_all is not null and away_def_allow_30d is not null and
   home_starter_allow_all is not null and home_starter_allow_60d is not null and
   away_starter_allow_all is not null and away_starter_allow_60d is not null and
   league_nrfi_prior is not null
 ) as modeling_eligible,
 true as strict_prior_date_only
from pivoted p
with data;

create unique index if not exists mlb_nrfi_backtest_rows_v1_mv_uidx
  on public.mlb_nrfi_backtest_rows_v1_mv (season, game_pk);
create index if not exists mlb_nrfi_backtest_rows_v1_mv_split_idx
  on public.mlb_nrfi_backtest_rows_v1_mv (split, modeling_eligible, game_date, game_pk);

revoke all on public.mlb_nrfi_backtest_rows_v1_mv from public, anon, authenticated;
grant select on public.mlb_nrfi_backtest_rows_v1_mv to service_role;

create or replace function public.refresh_mlb_nrfi_research_rollups()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.mlb_statcast_first_inning_game_mv;
  refresh materialized view public.mlb_nrfi_backtest_rows_v1_mv;
end;
$$;

revoke all on function public.refresh_mlb_nrfi_research_rollups() from public, anon, authenticated;
grant execute on function public.refresh_mlb_nrfi_research_rollups() to service_role;
