-- MLB ER O1.5 starter-feature dry-run V1
-- READ ONLY. No DML.
-- Purpose: prove the exact target-day pitcher feature deficit before any scoped repair.
with slate as (
  select
    game_pk,
    game_date,
    scheduled_at,
    (metadata->'homeProbablePitcher'->>'id')::bigint as home_pitcher_id,
    metadata->'homeProbablePitcher'->>'fullName' as home_pitcher_name,
    (metadata->'awayProbablePitcher'->>'id')::bigint as away_pitcher_id,
    metadata->'awayProbablePitcher'->>'fullName' as away_pitcher_name
  from public.pick2_mlb_games
  where game_date = current_date
),
targets as (
  select game_pk,game_date,scheduled_at,'home'::text side,home_pitcher_id pitcher_id,home_pitcher_name pitcher_name
  from slate
  union all
  select game_pk,game_date,scheduled_at,'away',away_pitcher_id,away_pitcher_name
  from slate
),
existing as (
  select target_game_pk,mlbam_pitcher_id,k_rate,as_of_date,source_window,feature_version
  from public.pick2_mlb_pitcher_daily_features
  where feature_date=current_date
    and feature_version='MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
)
select
  t.*,
  e.k_rate,
  e.as_of_date,
  e.source_window,
  case
    when t.pitcher_id is null then 'BLOCK_PROBABLE_PITCHER_MISSING'
    when e.mlbam_pitcher_id is null then 'INSERT_ELIGIBLE_IF_CANONICAL_PLAN_MATCHES'
    when e.as_of_date >= t.game_date then 'BLOCK_NON_STRICT_ASOF'
    when e.source_window->>'rule' <> 'source_game_date < target_game_date' then 'BLOCK_SOURCE_WINDOW'
    else 'REUSE_NO_OP'
  end as dryrun_state
from targets t
left join existing e
  on e.target_game_pk=t.game_pk
 and e.mlbam_pitcher_id=t.pitcher_id
order by t.scheduled_at,t.game_pk,t.side;
