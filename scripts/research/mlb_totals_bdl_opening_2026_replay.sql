-- Frozen 2026 replay for PR #245 architectures.
-- Source: exact BALLDONTLIE opening BetMGM + BetRivers from
-- public.mlb_bdl_opening_runline_total_2026_v1.
-- All thresholds and normalization constants are frozen from the 2025 May-Jul audit.
-- No 2026 retuning or sign reversal is permitted.

with vendor_market as (
  select
    xyear_canonical_game_id,
    game_pk,
    game_date,
    home_team,
    away_team,
    vendor,
    max(line) filter(where outcome='over') as total_line,
    max(price) filter(where outcome='over') as over_price,
    max(price) filter(where outcome='under') as under_price
  from public.mlb_bdl_opening_runline_total_2026_v1
  where market='total'
    and vendor in ('betmgm','betrivers')
  group by 1,2,3,4,5,6
),
normalized as (
  select *,
    (case when over_price<0 then abs(over_price)::float/(abs(over_price)+100.0)
          else 100.0/(over_price+100.0) end) /
    ((case when over_price<0 then abs(over_price)::float/(abs(over_price)+100.0)
           else 100.0/(over_price+100.0) end) +
     (case when under_price<0 then abs(under_price)::float/(abs(under_price)+100.0)
           else 100.0/(under_price+100.0) end)) as over_no_vig
  from vendor_market
  where total_line is not null and over_price is not null and under_price is not null
),
paired as (
  select
    xyear_canonical_game_id,
    game_pk,
    game_date,
    home_team,
    away_team,
    max(total_line) filter(where vendor='betmgm') as mgm_line,
    max(total_line) filter(where vendor='betrivers') as br_line,
    max(over_no_vig) filter(where vendor='betmgm') as mgm_over_nv,
    max(over_no_vig) filter(where vendor='betrivers') as br_over_nv
  from normalized
  group by 1,2,3,4,5
),
targets as (
  select
    p.*,
    (p.mgm_over_nv+p.br_over_nv)/2.0 as over_consensus,
    g.home_score+g.away_score as actual_total,
    f.home_sp_ra9,f.away_sp_ra9,
    f.home_bullpen_ra9,f.away_bullpen_ra9,
    f.home_sc_off_hard_hit_pct,f.away_sc_off_hard_hit_pct,
    f.home_sc_off_barrel_pct,f.away_sc_off_barrel_pct,
    f.home_sp_hard_hit_pct,f.away_sp_hard_hit_pct,
    f.home_sp_whiff_rate,f.away_sp_whiff_rate
  from paired p
  join public.mlb_ml_xyear_game_v1 g on g.game_pk=p.game_pk
  join public.mlb_ml_xyear_features_v1 f on f.game_pk=p.game_pk and f.season=2026
  where p.mgm_line is not null
    and p.br_line is not null
    and p.mgm_line=p.br_line
    and g.home_score is not null
    and g.away_score is not null
),
priors as (
  select
    t.*,
    hs.rs as season_home_rs,hs.ra as season_home_ra,
    aws.rs as season_away_rs,aws.ra as season_away_ra,
    hl5.rs as l5_home_rs,hl5.ra as l5_home_ra,
    al5.rs as l5_away_rs,al5.ra as l5_away_ra
  from targets t
  left join lateral (
    select avg(runs_for)::float rs,avg(runs_against)::float ra
    from public.mlb_ml_xyear_team_game_v1 h
    where h.season=2026 and h.team=t.home_team and h.game_date<t.game_date
  ) hs on true
  left join lateral (
    select avg(runs_for)::float rs,avg(runs_against)::float ra
    from public.mlb_ml_xyear_team_game_v1 h
    where h.season=2026 and h.team=t.away_team and h.game_date<t.game_date
  ) aws on true
  left join lateral (
    select avg(runs_for)::float rs,avg(runs_against)::float ra
    from (
      select runs_for,runs_against
      from public.mlb_ml_xyear_team_game_v1 h
      where h.season=2026 and h.team=t.home_team and h.game_date<t.game_date
      order by h.game_date desc,h.game_pk desc
      limit 5
    ) x
  ) hl5 on true
  left join lateral (
    select avg(runs_for)::float rs,avg(runs_against)::float ra
    from (
      select runs_for,runs_against
      from public.mlb_ml_xyear_team_game_v1 h
      where h.season=2026 and h.team=t.away_team and h.game_date<t.game_date
      order by h.game_date desc,h.game_pk desc
      limit 5
    ) x
  ) al5 on true
),
features as (
  select *,
    0.5*(season_home_rs+season_away_ra)+0.5*(season_away_rs+season_home_ra) as season_proj,
    0.5*(l5_home_rs+l5_away_ra)+0.5*(l5_away_rs+l5_home_ra) as recent_proj,
    0.5*(home_sp_ra9+home_bullpen_ra9)+0.5*(away_sp_ra9+away_bullpen_ra9) as pitching_proj,

    (home_sc_off_hard_hit_pct+away_sc_off_hard_hit_pct)/2.0 as off_hh,
    (home_sc_off_barrel_pct+away_sc_off_barrel_pct)/2.0 as off_barrel,
    (home_sp_hard_hit_pct+away_sp_hard_hit_pct)/2.0 as sp_hh,
    (home_sp_whiff_rate+away_sp_whiff_rate)/2.0 as sp_whiff
  from priors
),
scored as (
  select *,
    season_proj-mgm_line as season_resid,
    recent_proj-mgm_line as recent_resid,
    ((season_proj+recent_proj+pitching_proj)/3.0)-mgm_line as composite_resid,

    ((off_hh-0.255466463436146)/0.0114337439694208 +
     (off_barrel-0.0459414861558386)/0.00509002539665044 +
     (sp_hh-0.259248070383735)/0.0328308069435659 -
     (sp_whiff-0.219822032234143)/0.0332901515907615)/2.0 as env_score,

    ((off_hh-0.255466463436146)/0.0114337439694208 +
     (off_barrel-0.0459414861558386)/0.00509002539665044 +
     (sp_hh-0.259248070383735)/0.0328308069435659 -
     (sp_whiff-0.219822032234143)/0.0332901515907615)/2.0
      - (mgm_line-8.5703592814371257)/0.87072417582349284641 as env_market_resid
  from features
),
long as (
  select game_date,actual_total,mgm_line,architecture,pick_side,pass
  from scored
  cross join lateral (values
    ('TOT_A_SEASON_Q75',
      case when season_resid>=0 then 'OVER' else 'UNDER' end,
      abs(season_resid)>=0.991581133919843),
    ('TOT_B_RECENT_Q75',
      case when recent_resid>=0 then 'OVER' else 'UNDER' end,
      abs(recent_resid)>=2.1),
    ('TOT_C_COMPOSITE_Q75',
      case when composite_resid>=0 then 'OVER' else 'UNDER' end,
      abs(composite_resid)>=1.20590885779599),
    ('TOT_D_COMPOSITE_MARKET_CONFIRM',
      case when composite_resid>=0 then 'OVER' else 'UNDER' end,
      abs(composite_resid)>=1.20590885779599 and
      ((composite_resid>=0 and over_consensus>=0.5) or
       (composite_resid<0 and over_consensus<0.5))),
    ('TOT_E_ENV_EXTREMES',
      case when env_score>=0.87069411751228 then 'OVER'
           when env_score<=-0.799486697217092 then 'UNDER' end,
      env_score>=0.87069411751228 or env_score<=-0.799486697217092),
    ('TOT_F_ENV_MARKET_RESIDUAL',
      case when env_market_resid>=0.832120315086954 then 'OVER'
           when env_market_resid<=-0.716249372048999 then 'UNDER' end,
      env_market_resid>=0.832120315086954 or env_market_resid<=-0.716249372048999),
    ('TOT_G_RESIDUAL_MARKET_CONFIRM',
      case when env_market_resid>=0.832120315086954 then 'OVER'
           when env_market_resid<=-0.716249372048999 then 'UNDER' end,
      (env_market_resid>=0.832120315086954 and over_consensus>=0.5) or
      (env_market_resid<=-0.716249372048999 and over_consensus<0.5))
  ) rules(architecture,pick_side,pass)
),
settled as (
  select *,
    case
      when actual_total=mgm_line then 'PUSH'
      when pick_side='OVER' and actual_total>mgm_line then 'WIN'
      when pick_side='UNDER' and actual_total<mgm_line then 'WIN'
      else 'LOSS'
    end as result
  from long
),
monthly as (
  select architecture,date_trunc('month',game_date)::date as month_start,
         count(*) filter(where result<>'PUSH') as n,
         count(*) filter(where result='WIN') as wins
  from settled
  where pass
  group by 1,2
),
summary as (
  select architecture,
         count(*) filter(where pass) as selected_n,
         count(*) filter(where pass and result='PUSH') as pushes,
         count(*) filter(where pass and result<>'PUSH') as eval_n,
         count(*) filter(where pass and result='WIN') as wins
  from settled
  group by 1
),
worst as (
  select architecture,min(wins::float/nullif(n,0)) as worst_month_accuracy
  from monthly
  group by 1
)
select
  s.architecture,
  s.selected_n,
  s.pushes,
  s.eval_n,
  s.wins,
  round(100.0*s.wins/nullif(s.eval_n,0),2) as accuracy_pct,
  round((100.0*w.worst_month_accuracy)::numeric,2) as worst_month_accuracy_pct
from summary s
left join worst w using(architecture)
order by s.architecture;
