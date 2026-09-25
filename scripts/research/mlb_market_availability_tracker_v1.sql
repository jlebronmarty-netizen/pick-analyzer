-- MLB market availability tracker V1
-- Read-only. Uses only already persisted current/pregame snapshots.
with q as (
  select
    (snapshot_time at time zone 'America/Puerto_Rico')::date as tracking_date,
    provider,
    market,
    line::numeric as line,
    lower(outcome) as side,
    sportsbook,
    metadata->>'canonicalGamePk' as game_pk,
    coalesce(metadata->>'playerMlbamId', metadata->>'pitcherMlbamId') as player_id
  from public.sports_odds_snapshots
  where snapshot_time >= now() - interval '30 days'
    and provider in ('the-odds-api','balldontlie')
    and metadata->>'source' in (
      'MLB_APPROVED_PROP_MARKET_CAPTURE_V1',
      'MLB_APPROVED_PROP_MARKET_CAPTURE_BDL_FALLBACK_V1'
    )
)
select
  market,
  line,
  side,
  count(*) as quote_rows,
  count(distinct tracking_date) as days_seen,
  count(distinct game_pk) as games_seen,
  count(distinct player_id) as players_seen,
  count(distinct sportsbook) as books_seen,
  string_agg(distinct sportsbook, ', ' order by sportsbook) as books
from q
group by market,line,side
order by days_seen desc,games_seen desc,market,line,side;
