-- MLB_BATTER_DOUBLES_U0P5_FORWARD_SHADOW_V1
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
    and s.market='batter_doubles'
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
hist as (
  select
    b.*,g.game_date,g.doubles,g.plate_appearances,
    row_number() over(partition by b.game_pk,b.player_id order by g.game_date desc,g.game_pk desc) rn
  from best b
  join public.mlb_statcast_batter_sdt_game_mv g
    on g.season=2026
   and g.batter=b.player_id
   and g.game_date < (select target_date from params)
   and g.plate_appearances>0
),
agg as (
  select
    game_pk,player_id,max(player_name) player_name,
    max(sportsbook) sportsbook,max(price) price,
    count(*) prior_games,
    sum(plate_appearances)::float8 prior_pa,
    sum(doubles)::float8 prior_doubles,
    sum(plate_appearances) filter(where rn<=10)::float8 recent_pa,
    max(game_date) latest_prior_date
  from hist
  group by game_pk,player_id
),
scored as (
  select *,
    case when prior_games>=10 and prior_pa>0 and recent_pa>0
      then greatest(
        0,
        0.126877618354346
        + 0.210234641434428*((recent_pa/10.0)*(prior_doubles/prior_pa))
      )
      else null end projection
  from agg
)
select
  (select target_date from params) tracking_date,
  game_pk,player_id,player_name,sportsbook,price,
  0.5::numeric exact_line,'UNDER'::text side,
  round(projection::numeric,3) projection,
  0.16::numeric threshold,
  prior_games,latest_prior_date,
  case
    when projection is null then 'MARKET_AVAILABLE_NOT_EVALUABLE'
    when projection<=0.16 then 'SHADOW_CANDIDATE'
    else 'MARKET_AVAILABLE_NOT_QUALIFIED'
  end state
from scored
order by state desc,projection asc,player_name;
