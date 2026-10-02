-- MLB_BATTER_WALKS_FEATURE_DRYRUN_V1
-- READ ONLY. No DML.
with params as (
  select (now() at time zone 'America/Puerto_Rico')::date target_date
),
quoted as (
  select distinct
    (s.metadata->>'canonicalGamePk')::bigint game_pk,
    (s.metadata->>'playerMlbamId')::bigint batter_id,
    coalesce(s.metadata->>'canonicalPlayerName',s.metadata->>'providerPlayerName') player_name
  from public.sports_odds_snapshots s
  cross join params p
  where s.provider in ('the-odds-api','balldontlie')
    and s.market='batter_walks'
    and s.line::numeric=0.5
    and lower(s.outcome)='under'
    and (s.snapshot_time at time zone 'America/Puerto_Rico')::date=p.target_date
    and s.metadata->>'playerMlbamId' is not null
    and s.metadata->>'source' in (
      'MLB_APPROVED_PROP_MARKET_CAPTURE_V1',
      'MLB_APPROVED_PROP_MARKET_CAPTURE_BDL_FALLBACK_V1'
    )
),
existing as (
  select target_game_pk,mlbam_batter_id,as_of_date,source_window,feature_version
  from public.pick2_mlb_batter_daily_features
  cross join params p
  where feature_date=p.target_date
    and feature_version='MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
)
select
  q.game_pk,
  q.batter_id,
  q.player_name,
  e.as_of_date,
  e.source_window,
  case
    when e.mlbam_batter_id is null then 'MISSING_TARGET_FEATURE'
    when e.as_of_date >= (select target_date from params) then 'BLOCK_NON_STRICT_ASOF'
    when e.source_window->>'rule' <> 'source_game_date < target_game_date' then 'BLOCK_SOURCE_WINDOW'
    else 'REUSE_NO_OP'
  end dryrun_state
from quoted q
left join existing e
  on e.target_game_pk=q.game_pk
 and e.mlbam_batter_id=q.batter_id
order by q.game_pk,q.player_name;
