-- MLB pitcher strikeout probability calibration v1
-- Train-only empirical calibration for certified half-run K lines 2.5-5.5.

create materialized view if not exists public.mlb_pitcher_k_probability_calibration_v1_mv as
with train as (
  select
    target_strikeouts::int as actual_k,
    1.224497
      + 0.578900 * ((pitcher_prior_plate_appearances::double precision / nullif(pitcher_prior_appearances,0)) * pitcher_k_rate::double precision)
      + 0.184751 * ((pitcher_prior_plate_appearances::double precision / nullif(pitcher_prior_appearances,0)) * opponent_recent_k_rate::double precision) as probability_point_projection
  from public.mlb_pitcher_prop_backtest_2025_v1_enriched
  where fixed_split='TRAIN'
    and pitcher_prior_appearances >= 3
    and pitcher_prior_plate_appearances > 0
    and pitcher_k_rate is not null
    and opponent_recent_k_rate is not null
), lines(line) as (
  values (2.5::double precision),(3.5::double precision),(4.5::double precision),(5.5::double precision)
)
select
  floor(t.probability_point_projection / 0.5)::int as prediction_bin,
  0.5::double precision as bin_width,
  l.line,
  count(*)::int as sample_size,
  sum((t.actual_k > l.line)::int)::int as over_count,
  ((sum((t.actual_k > l.line)::int) + 1.0) / (count(*) + 2.0))::double precision as over_probability,
  now() as materialized_at
from train t
cross join lines l
group by floor(t.probability_point_projection / 0.5)::int,l.line
with data;

create unique index if not exists mlb_pitcher_k_probability_calibration_v1_uidx
  on public.mlb_pitcher_k_probability_calibration_v1_mv(prediction_bin,line);
revoke all on public.mlb_pitcher_k_probability_calibration_v1_mv from public, anon, authenticated;
grant select on public.mlb_pitcher_k_probability_calibration_v1_mv to service_role;
