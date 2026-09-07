-- TRAIN-only empirical calibration for MLB_PITCHER_BB_V1.
-- Bin width 0.25 was selected using 2025 VALIDATION only.

create materialized view if not exists public.mlb_pitcher_bb_probability_calibration_v1_mv as
with lines(line) as (
  values (0.5::double precision),(1.5),(2.5),(3.5)
), train as (
  select *,
    1.02751690958322 + 0.395408983049705 * expected_bf_x_pitcher_bb_rate as projection
  from public.mlb_pitcher_bb_backtest_rows_v1_mv
  where split='TRAIN' and modeling_eligible
)
select
  floor(t.projection/0.25)::int as prediction_bin,
  0.25::double precision as bin_width,
  l.line,
  count(*)::int as sample_size,
  count(*) filter (where t.actual_bb>l.line)::int as over_count,
  count(*) filter (where t.actual_bb>l.line)::double precision/nullif(count(*),0) as over_probability,
  avg(t.projection) as avg_projection,
  min(t.projection) as min_projection,
  max(t.projection) as max_projection
from train t cross join lines l
group by floor(t.projection/0.25),l.line
with data;

create unique index if not exists mlb_pitcher_bb_probability_calibration_v1_mv_uidx
  on public.mlb_pitcher_bb_probability_calibration_v1_mv(prediction_bin,line);
revoke all on public.mlb_pitcher_bb_probability_calibration_v1_mv from public,anon,authenticated;
grant select on public.mlb_pitcher_bb_probability_calibration_v1_mv to service_role;

create or replace function public.refresh_mlb_pitcher_prop_research_rollups()
returns void language plpgsql security definer set search_path=public as $$
begin
  refresh materialized view public.mlb_pitcher_bb_backtest_rows_v1_mv;
  refresh materialized view public.mlb_pitcher_bb_probability_calibration_v1_mv;
end;
$$;
revoke all on function public.refresh_mlb_pitcher_prop_research_rollups() from public,anon,authenticated;
grant execute on function public.refresh_mlb_pitcher_prop_research_rollups() to service_role;