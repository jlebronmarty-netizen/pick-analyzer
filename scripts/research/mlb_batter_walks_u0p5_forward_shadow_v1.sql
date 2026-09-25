-- MLB_BATTER_WALKS_U0P5_FORWARD_SHADOW_V1
-- READ ONLY. Exact U0.5 only.
with params as (
  select (now() at time zone 'America/Puerto_Rico')::date target_date
),
quotes as (
  select
    (s.metadata->>'canonicalGamePk')::bigint game_pk,
    (s.metadata->>'playerMlbamId')::bigint player_id,
    coalesce(s.metadata->>'canonicalPlayerName',s.metadata->>'providerPlayerName') player_name,
    s.sportsbook,
    s.price::numeric price,
    s.snapshot_time,
    (s.metadata->>'targetStart')::timestamptz target_start
  from public.sports_odds_snapshots s
  cross join params p
  where s.provider in ('the-odds-api','balldontlie')
    and s.market='batter_walks'
    and s.line::numeric=0.5
    and lower(s.outcome)='under'
    and (s.snapshot_time at time zone 'America/Puerto_Rico')::date=p.target_date
    and s.metadata->>'source' in (
      'MLB_APPROVED_PROP_MARKET_CAPTURE_V1',
      'MLB_APPROVED_PROP_MARKET_CAPTURE_BDL_FALLBACK_V1'
    )
    and s.metadata->>'playerMlbamId' is not null
    and s.snapshot_time < (s.metadata->>'targetStart')::timestamptz
),
best as (
  select distinct on (game_pk,player_id) *
  from quotes
  order by game_pk,player_id,price desc,snapshot_time desc
),
features as (
  select target_game_pk,mlbam_batter_id
  from public.pick2_mlb_batter_daily_features
  cross join params p
  where feature_date=p.target_date
    and feature_version='MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
    and as_of_date < feature_date
    and source_window->>'rule'='source_game_date < target_game_date'
),
hist as (
  select
    b.*,g.game_date,g.walks,g.plate_appearances,
    row_number() over(partition by b.game_pk,b.player_id order by g.game_date desc,g.game_pk desc) rn
  from best b
  join public.mlb_statcast_batter_game_logs g
    on g.season=2026
   and g.batter=b.player_id
   and g.game_date < (select target_date from params)
   and g.plate_appearances>=1
),
agg as (
  select
    game_pk,player_id,max(player_name) player_name,
    max(sportsbook) sportsbook,max(price) price,
    count(*) prior_games,
    sum(plate_appearances)::float8 prior_pa,
    sum(walks)::float8 prior_walks,
    sum(plate_appearances) filter(where rn<=10)::float8 recent_pa,
    max(game_date) latest_prior_date
  from hist
  group by game_pk,player_id
),
scored as (
  select a.*,
    case when prior_games>=10 and prior_pa>0 and recent_pa>0
      then greatest(0,0.117815177785939 + 0.593708345578887*((recent_pa/10.0)*(prior_walks/prior_pa)))
      else null end projection,
    (f.mlbam_batter_id is not null) strict_target_feature
  from agg a
  left join features f
    on f.target_game_pk=a.game_pk and f.mlbam_batter_id=a.player_id
)
select
  (select target_date from params) tracking_date,
  game_pk,player_id,player_name,sportsbook,price,
  0.5::numeric exact_line,'UNDER'::text side,
  round(projection::numeric,3) projection,
  0.20::numeric threshold,
  prior_games,latest_prior_date,strict_target_feature,
  case
    when projection is null then 'MARKET_AVAILABLE_NOT_EVALUABLE'
    when not strict_target_feature then
      case when projection<=0.20 then 'MATHEMATICAL_CROSSING_BLOCKED_TARGET_FEATURE'
           else 'MARKET_AVAILABLE_NOT_QUALIFIED_BLOCKED_TARGET_FEATURE' end
    when projection<=0.20 then 'SHADOW_CANDIDATE'
    else 'MARKET_AVAILABLE_NOT_QUALIFIED'
  end state
from scored
order by state desc,projection asc,player_name;
