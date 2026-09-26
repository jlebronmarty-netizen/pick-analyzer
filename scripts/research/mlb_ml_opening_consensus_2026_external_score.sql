-- MLB_ML_OPENING_CONSENSUS_FUNDAMENTALS_V1
-- UNTOUCHED 2026 EXTERNAL SCORE
-- Frozen before external acquisition is executed.
with ml_pairs as (
  select
    xyear_canonical_game_id,
    game_date,
    home_team,
    away_team,
    game_number,
    vendor,
    max(price) filter(where outcome='home') home_price,
    max(price) filter(where outcome='away') away_price
  from public.mlb_bdl_opening_ml_2026_external_v1
  where vendor in ('betmgm','betrivers')
  group by xyear_canonical_game_id,game_date,home_team,away_team,game_number,vendor
),
vendor_probs as (
  select *,
    case when home_price<0
      then (-home_price)::float8/((-home_price)+100)
      else 100.0/(home_price+100)
    end home_imp,
    case when away_price<0
      then (-away_price)::float8/((-away_price)+100)
      else 100.0/(away_price+100)
    end away_imp
  from ml_pairs
  where home_price is not null and away_price is not null
),
game_market as (
  select
    xyear_canonical_game_id,
    game_date,
    home_team,
    away_team,
    game_number,
    count(*) books,
    avg(home_imp/(home_imp+away_imp)) consensus_home_prob
  from vendor_probs
  group by xyear_canonical_game_id,game_date,home_team,away_team,game_number
  having count(*)=2
),
scored as (
  select
    m.*,
    f.actual_winner,
    case when m.consensus_home_prob>=0.5 then f.home_team else f.away_team end pick,
    case when m.consensus_home_prob>=0.5 then 'HOME' else 'AWAY' end pick_side,
    greatest(m.consensus_home_prob,1-m.consensus_home_prob) favorite_prob,
    case when m.consensus_home_prob>=0.5 then
      (
        (f.home_win_pct>f.away_win_pct)::int+
        (f.home_run_diff_pg>f.away_run_diff_pg)::int+
        (f.home_pyth_win_pct>f.away_pyth_win_pct)::int+
        (f.home_l5_win_pct>f.away_l5_win_pct)::int+
        (f.home_sp_ra9<f.away_sp_ra9)::int+
        (f.home_bullpen_ra9<f.away_bullpen_ra9)::int
      )
    else
      (
        (f.away_win_pct>f.home_win_pct)::int+
        (f.away_run_diff_pg>f.home_run_diff_pg)::int+
        (f.away_pyth_win_pct>f.home_pyth_win_pct)::int+
        (f.away_l5_win_pct>f.home_l5_win_pct)::int+
        (f.away_sp_ra9<f.home_sp_ra9)::int+
        (f.away_bullpen_ra9<f.home_bullpen_ra9)::int
      )
    end aligned_votes,
    to_char(m.game_date,'YYYY-MM') month_key
  from game_market m
  join public.mlb_ml_xyear_features_v1 f
    on f.season=2026
   and f.canonical_game_id=m.xyear_canonical_game_id
  where f.actual_winner is not null
    and f.home_win_pct is not null and f.away_win_pct is not null
    and f.home_run_diff_pg is not null and f.away_run_diff_pg is not null
    and f.home_pyth_win_pct is not null and f.away_pyth_win_pct is not null
    and f.home_l5_win_pct is not null and f.away_l5_win_pct is not null
    and f.home_sp_ra9 is not null and f.away_sp_ra9 is not null
    and f.home_bullpen_ra9 is not null and f.away_bullpen_ra9 is not null
),
selected as (
  select *,
         (pick=actual_winner) correct
  from scored
  where favorite_prob>=0.65
    and aligned_votes=6
)
select
  'OVERALL' scope,
  count(*) n,
  count(*) filter(where correct) wins,
  count(*) filter(where not correct) losses,
  avg(correct::int::float8) accuracy,
  avg(favorite_prob) avg_market_probability,
  sum(correct::int)-sum(favorite_prob) wins_minus_market_expectation,
  min(game_date) min_date,
  max(game_date) max_date,
  null::text group_key
from selected
union all
select
  'MONTH',count(*),count(*) filter(where correct),count(*) filter(where not correct),
  avg(correct::int::float8),avg(favorite_prob),sum(correct::int)-sum(favorite_prob),
  min(game_date),max(game_date),month_key
from selected
group by month_key
union all
select
  'SIDE',count(*),count(*) filter(where correct),count(*) filter(where not correct),
  avg(correct::int::float8),avg(favorite_prob),sum(correct::int)-sum(favorite_prob),
  min(game_date),max(game_date),pick_side
from selected
group by pick_side
order by scope,group_key nulls first;
