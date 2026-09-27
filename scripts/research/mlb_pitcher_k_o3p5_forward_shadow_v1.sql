-- MLB_PITCHER_K_O3P5_FORWARD_SHADOW_V1
-- READ ONLY. No writes. Exact line 3.5 OVER only.
with params as (
  select (now() at time zone 'America/Puerto_Rico')::date as target_date
),
quotes as (
  select
    s.event_id,
    (s.metadata->>'canonicalGamePk')::bigint as game_pk,
    coalesce((s.metadata->>'playerMlbamId')::bigint,(s.metadata->>'pitcherMlbamId')::bigint) as pitcher_id,
    coalesce(s.metadata->>'canonicalPlayerName',s.metadata->>'pitcherName',s.metadata->>'providerPlayerName') as pitcher_name,
    s.sportsbook,
    s.price::numeric as price,
    s.snapshot_time,
    (s.metadata->>'targetStart')::timestamptz as target_start
  from public.sports_odds_snapshots s
  cross join params p
  where s.provider in ('the-odds-api','balldontlie')
    and s.market='pitcher_strikeouts'
    and s.line::numeric=3.5
    and lower(s.outcome)='over'
    and (s.snapshot_time at time zone 'America/Puerto_Rico')::date=p.target_date
    and s.metadata->>'source' in (
      'MLB_APPROVED_PROP_MARKET_CAPTURE_V1',
      'MLB_APPROVED_PROP_MARKET_CAPTURE_BDL_FALLBACK_V1'
    )
    and coalesce(s.metadata->>'playerMlbamId',s.metadata->>'pitcherMlbamId') is not null
    and s.snapshot_time < (s.metadata->>'targetStart')::timestamptz
),
best_quote as (
  select distinct on (pitcher_id)
    *
  from quotes
  order by pitcher_id,price desc,snapshot_time desc
),
hist as (
  select
    b.*,
    g.game_date,
    g.game_pk as hist_game_pk,
    g.strikeouts,
    g.batters_faced,
    row_number() over(partition by b.pitcher_id order by g.game_date desc,g.game_pk desc) rn
  from best_quote b
  join public.mlb_ml_xyear_pitcher_game_v1 g
    on g.season=2026
   and g.starter=true
   and g.pitcher=b.pitcher_id
   and g.game_date < (select target_date from params)
),
agg as (
  select
    game_pk,pitcher_id,max(pitcher_name) pitcher_name,
    max(sportsbook) sportsbook,max(price) price,
    max(snapshot_time) snapshot_time,max(target_start) target_start,
    count(*) prior_starts,
    sum(strikeouts)::float8 prior_k,
    sum(batters_faced)::float8 prior_bf,
    avg(strikeouts::float8) filter(where rn<=5) l5_k,
    avg(batters_faced::float8) filter(where rn<=5) l5_bf,
    max(game_date) latest_prior_date
  from hist
  group by game_pk,pitcher_id
),
scored as (
  select *,
    case when prior_starts>=5 and prior_bf>0 and l5_k is not null and l5_bf is not null
      then greatest(0,0.60*((prior_k/prior_bf)*l5_bf)+0.40*l5_k)
      else null end projection
  from agg
)
select
  (select target_date from params) tracking_date,
  game_pk,pitcher_id,pitcher_name,
  sportsbook,price,
  3.5::numeric exact_line,
  'OVER'::text side,
  round(projection::numeric,3) projection,
  4.25::numeric threshold,
  prior_starts,latest_prior_date,snapshot_time,target_start,
  case
    when projection is null then 'MARKET_AVAILABLE_NOT_EVALUABLE'
    when projection>=4.25 then 'SHADOW_CANDIDATE'
    else 'MARKET_AVAILABLE_NOT_QUALIFIED'
  end as state
from scored
order by state desc,projection desc,pitcher_name;
