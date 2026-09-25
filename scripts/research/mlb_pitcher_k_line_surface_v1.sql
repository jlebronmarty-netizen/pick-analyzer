-- MLB_PITCHER_K_LINE_SURFACE_V1
-- Research-only replay. No writes. Source: public.mlb_ml_xyear_pitcher_game_v1.
--
-- Projection parity control:
-- 0.60*(prior_K_per_BF*L5_BF_per_start)+0.40*L5_K_per_start
-- minimum prior starts = 5
--
-- Development: 2025 only.
-- Threshold grid: 1.50..10.00 step 0.25.
-- Exact lines: 3.5..8.5.
-- Base gates: accuracy>=.75, n>=60, months>=5, worst_month>=.65.
-- Signal gate: base gates + lift>=.05.
-- Champion policy: max n, then lift, accuracy, lower threshold.

with base as (
  select
    season, game_pk, game_date, pitcher, strikeouts, batters_faced,
    count(*) over (
      partition by season,pitcher
      order by game_date,game_pk
      rows between unbounded preceding and 1 preceding
    ) as prior_starts,
    sum(strikeouts) over (
      partition by season,pitcher
      order by game_date,game_pk
      rows between unbounded preceding and 1 preceding
    ) as prior_k,
    sum(batters_faced) over (
      partition by season,pitcher
      order by game_date,game_pk
      rows between unbounded preceding and 1 preceding
    ) as prior_bf,
    avg(strikeouts::double precision) over (
      partition by season,pitcher
      order by game_date,game_pk
      rows between 5 preceding and 1 preceding
    ) as l5_k,
    avg(batters_faced::double precision) over (
      partition by season,pitcher
      order by game_date,game_pk
      rows between 5 preceding and 1 preceding
    ) as l5_bf
  from public.mlb_ml_xyear_pitcher_game_v1
  where starter=true
    and season=2025
), pred as (
  select *,
    greatest(
      0,
      0.60 * (
        (prior_k::double precision / nullif(prior_bf::double precision,0))
        * l5_bf
      )
      + 0.40*l5_k
    ) as projection,
    to_char(game_date,'YYYY-MM') as month_key
  from base
  where prior_starts>=5
    and prior_bf>0
    and l5_k is not null
    and l5_bf is not null
), lines as (
  select generate_series(3.5,8.5,1.0)::numeric as line
), thresholds as (
  select generate_series(1.5,10.0,0.25)::numeric as threshold
), sides as (
  select unnest(array['UNDER','OVER']) as side
), selected as (
  select
    l.line,s.side,t.threshold,p.*,
    case
      when s.side='UNDER' then p.projection<=t.threshold
      else p.projection>=t.threshold
    end as selected,
    case
      when s.side='UNDER' then p.strikeouts<l.line
      else p.strikeouts>l.line
    end as won
  from lines l
  cross join sides s
  cross join thresholds t
  cross join pred p
), aggregate_metrics as (
  select
    line,side,threshold,
    count(*) filter(where selected) as n,
    count(*) filter(where selected and won) as wins,
    avg(won::int::numeric) filter(where selected) as accuracy,
    avg(won::int::numeric) as baseline,
    avg(selected::int::numeric) as coverage
  from selected
  group by line,side,threshold
), monthly as (
  select
    line,side,threshold,month_key,
    count(*) filter(where selected) as month_n,
    avg(won::int::numeric) filter(where selected) as month_accuracy
  from selected
  group by line,side,threshold,month_key
), stability as (
  select
    line,side,threshold,
    count(*) filter(where month_n>0) as months,
    min(month_accuracy) filter(where month_n>0) as worst_month,
    min(month_n) filter(where month_n>0) as min_month_n
  from monthly
  group by line,side,threshold
), candidates as (
  select
    a.*, s.months, s.worst_month, s.min_month_n,
    a.accuracy-a.baseline as lift,
    (
      a.accuracy>=.75 and a.n>=60 and s.months>=5 and s.worst_month>=.65
    ) as gate_pass,
    (
      a.accuracy>=.75 and a.n>=60 and s.months>=5 and s.worst_month>=.65
      and a.accuracy-a.baseline>=.05
    ) as signal_gate
  from aggregate_metrics a
  join stability s using(line,side,threshold)
), ranked as (
  select *,
    row_number() over (
      partition by line,side
      order by signal_gate desc,n desc,lift desc,accuracy desc,threshold asc
    ) as rn
  from candidates
)
select
  line,side,threshold,n,wins,n-wins as losses,
  accuracy,baseline,lift,coverage,months,worst_month,min_month_n,
  gate_pass,signal_gate
from ranked
where rn=1
order by line,side;

-- Certified parity control must independently return:
-- n=1367, wins=1189, accuracy=0.869788...
--
-- 2026 evaluation is intentionally separate and uses only the frozen development
-- candidates persisted in artifacts/research/mlb_pitcher_k_line_surface_v1.json.
