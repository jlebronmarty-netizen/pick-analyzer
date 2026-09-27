-- Frozen 2026 replay for PR #244 architectures.
-- Source: exact BALLDONTLIE opening BetMGM + BetRivers from
-- public.mlb_bdl_opening_runline_total_2026_v1.
-- Constants below are reconstructed exactly from the frozen 2025 May-Jul audit.
-- No 2026 threshold selection or retuning is permitted.

with vendor_market as (
  select
    xyear_canonical_game_id,
    game_pk,
    game_date,
    home_team,
    away_team,
    vendor,
    max(line) filter (where outcome='home') as home_line,
    max(price) filter (where outcome='home') as home_price,
    max(line) filter (where outcome='away') as away_line,
    max(price) filter (where outcome='away') as away_price
  from public.mlb_bdl_opening_runline_total_2026_v1
  where market='run_line'
    and vendor in ('betmgm','betrivers')
  group by 1,2,3,4,5,6
),
normalized as (
  select *,
    case
      when home_line=1.5 and away_line=-1.5 then 'HOME'
      when away_line=1.5 and home_line=-1.5 then 'AWAY'
    end as dog_side,
    (case when home_price<0 then abs(home_price)::float/(abs(home_price)+100.0)
          else 100.0/(home_price+100.0) end) /
    ((case when home_price<0 then abs(home_price)::float/(abs(home_price)+100.0)
           else 100.0/(home_price+100.0) end) +
     (case when away_price<0 then abs(away_price)::float/(abs(away_price)+100.0)
           else 100.0/(away_price+100.0) end)) as home_no_vig
  from vendor_market
  where abs(home_line)=1.5 and abs(away_line)=1.5
),
paired as (
  select
    xyear_canonical_game_id,
    game_pk,
    game_date,
    home_team,
    away_team,
    max(dog_side) filter(where vendor='betmgm') as mgm_dog,
    max(dog_side) filter(where vendor='betrivers') as br_dog,
    max(case when dog_side='HOME' then home_no_vig else 1-home_no_vig end)
      filter(where vendor='betmgm') as mgm_dog_nv,
    max(case when dog_side='HOME' then home_no_vig else 1-home_no_vig end)
      filter(where vendor='betrivers') as br_dog_nv
  from normalized
  group by 1,2,3,4,5
),
base as (
  select
    p.*,
    (p.mgm_dog_nv+p.br_dog_nv)/2.0 as dog_prob,
    g.home_score,
    g.away_score,
    f.home_win_pct,f.away_win_pct,
    f.home_run_diff_pg,f.away_run_diff_pg,
    f.home_pyth_win_pct,f.away_pyth_win_pct,
    f.home_l5_win_pct,f.away_l5_win_pct,
    f.home_sp_ra9,f.away_sp_ra9,
    f.home_bullpen_ra9,f.away_bullpen_ra9,
    f.home_common_win_pct,f.away_common_win_pct,
    f.home_home_win_pct,f.away_away_win_pct,
    c.team_strength,c.recent_form,c.starter,c.history,c.fatigue_travel
  from paired p
  join public.mlb_ml_xyear_game_v1 g on g.game_pk=p.game_pk
  join public.mlb_ml_xyear_features_v1 f on f.game_pk=p.game_pk and f.season=2026
  join public.mlb_ml_xyear_game_components_z_v1 c
    on c.game_pk=p.game_pk and c.season=2026 and c.branch='PREGAME'
  where p.mgm_dog is not null
    and p.br_dog is not null
    and p.mgm_dog=p.br_dog
    and g.home_score is not null
    and g.away_score is not null
),
features as (
  select *,
    case when mgm_dog='HOME'
      then (home_score+1.5>away_score)
      else (away_score+1.5>home_score)
    end as dog_cover,

    case when mgm_dog='HOME' then
      ((home_win_pct>away_win_pct)::int +
       (home_run_diff_pg>away_run_diff_pg)::int +
       (home_pyth_win_pct>away_pyth_win_pct)::int +
       (home_l5_win_pct>away_l5_win_pct)::int +
       (home_sp_ra9<away_sp_ra9)::int +
       (home_bullpen_ra9<away_bullpen_ra9)::int)
    else
      ((away_win_pct>home_win_pct)::int +
       (away_run_diff_pg>home_run_diff_pg)::int +
       (away_pyth_win_pct>home_pyth_win_pct)::int +
       (away_l5_win_pct>home_l5_win_pct)::int +
       (away_sp_ra9<home_sp_ra9)::int +
       (away_bullpen_ra9<home_bullpen_ra9)::int)
    end as dog_fund_score,

    case when mgm_dog='HOME'
      then away_bullpen_ra9-home_bullpen_ra9
      else home_bullpen_ra9-away_bullpen_ra9
    end as bp_edge,
    case when mgm_dog='HOME'
      then home_common_win_pct-away_common_win_pct
      else away_common_win_pct-home_common_win_pct
    end as common_edge,
    case when mgm_dog='HOME'
      then home_home_win_pct-away_away_win_pct
      else away_away_win_pct-home_home_win_pct
    end as venue_edge,
    case when mgm_dog='HOME'
      then away_sp_ra9-home_sp_ra9
      else home_sp_ra9-away_sp_ra9
    end as starter_edge,

    (case when mgm_dog='HOME' then recent_form else -recent_form end +
     case when mgm_dog='HOME' then fatigue_travel else -fatigue_travel end)/sqrt(2.0) as rf,
    (case when mgm_dog='HOME' then history else -history end +
     case when mgm_dog='HOME' then fatigue_travel else -fatigue_travel end)/sqrt(2.0) as hf,
    (case when mgm_dog='HOME' then team_strength else -team_strength end +
     case when mgm_dog='HOME' then starter else -starter end +
     case when mgm_dog='HOME' then history else -history end)/sqrt(3.0) as tsh,
    (case when mgm_dog='HOME' then team_strength else -team_strength end +
     case when mgm_dog='HOME' then recent_form else -recent_form end +
     case when mgm_dog='HOME' then starter else -starter end +
     case when mgm_dog='HOME' then history else -history end +
     case when mgm_dog='HOME' then fatigue_travel else -fatigue_travel end)/sqrt(5.0) as broad
  from base
),
long as (
  select game_date,dog_cover,architecture,pass
  from features
  cross join lateral (values
    ('RL_A_MARKET_Q75',
      dog_prob >= 0.614472548213551),
    ('RL_B_MARKET_PLUS_FUND3',
      dog_prob >= 0.614472548213551 and dog_fund_score>=3),
    ('RL_C_MARKET_PLUS_CONTEXT2',
      dog_prob >= 0.614472548213551 and
      ((bp_edge>=-1.17824129403095)::int +
       (common_edge>=-0.142857142857143)::int +
       (venue_edge>=-0.166545893719807)::int +
       (starter_edge>=-1.79331674422257)::int) >= 2),
    ('RL_D_BOTH',
      dog_prob >= 0.614472548213551 and dog_fund_score>=3 and
      ((bp_edge>=-1.17824129403095)::int +
       (common_edge>=-0.142857142857143)::int +
       (venue_edge>=-0.166545893719807)::int +
       (starter_edge>=-1.79331674422257)::int) >= 2),
    ('RL_E_MARKET_RF_Q75',
      dog_prob >= 0.609468425467735 and rf>=0.45453945443248),
    ('RL_F_MARKET_HF_Q75',
      dog_prob >= 0.609468425467735 and hf>=0.293168157231692),
    ('RL_G_MARKET_TSH_Q75',
      dog_prob >= 0.609468425467735 and tsh>=-0.123011660831321),
    ('RL_H_MARKET_BROAD_Q75',
      dog_prob >= 0.609468425467735 and broad>=0.0446135668369827)
  ) as rules(architecture,pass)
),
monthly as (
  select architecture,date_trunc('month',game_date)::date as month_start,
         count(*) as n,count(*) filter(where dog_cover) as wins
  from long
  where pass
  group by 1,2
),
summary as (
  select architecture,
         count(*) filter(where pass) as n,
         count(*) filter(where pass and dog_cover) as wins
  from long
  group by 1
),
worst as (
  select architecture,min(wins::float/nullif(n,0)) as worst_month_accuracy
  from monthly
  group by 1
)
select
  s.architecture,
  s.n,
  s.wins,
  round(100.0*s.wins/nullif(s.n,0),2) as accuracy_pct,
  round(100.0*w.worst_month_accuracy,2) as worst_month_accuracy_pct
from summary s
left join worst w using(architecture)
order by s.architecture;
