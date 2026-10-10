-- MLB_DAILY_MARKET_COVERAGE_BOARD_V1
-- READ ONLY. Exact market + line + side compatibility only.
with q as (
 select distinct
   market,line::numeric line,lower(outcome) side,sportsbook,
   metadata->>'canonicalGamePk' game_pk,
   coalesce(metadata->>'playerMlbamId',metadata->>'batterMlbamId',metadata->>'pitcherMlbamId') player_id
 from public.sports_odds_snapshots
 where (snapshot_time at time zone 'America/Puerto_Rico')::date=current_date
   and provider in ('the-odds-api','balldontlie')
   and metadata->>'source' in ('MLB_APPROVED_PROP_MARKET_CAPTURE_V1','MLB_APPROVED_PROP_MARKET_CAPTURE_BDL_FALLBACK_V1')
   and coalesce(metadata->>'canonicalGamePk','')<>''
),
contracts(market,line,side,label) as (
 values
 ('batter_doubles',0.5::numeric,'under','Batter Doubles U0.5'),
 ('batter_hits',1.5,'under','Batter Hits U1.5'),
 ('batter_hits_runs_rbis',2.5,'under','HRRBI U2.5'),
 ('batter_rbis',0.5,'under','RBI U0.5'),
 ('batter_singles',1.5,'under','Batter Singles U1.5'),
 ('batter_strikeouts',1.5,'under','Batter K U1.5'),
 ('batter_total_bases',2.5,'under','Total Bases U2.5'),
 ('batter_triples',0.5,'under','Batter Triples U0.5'),
 ('batter_walks',0.5,'under','Batter Walks U0.5'),
 ('pitcher_earned_runs',1.5,'over','Pitcher ER O1.5'),
 ('pitcher_earned_runs',3.5,'under','Pitcher ER U3.5 candidate'),
 ('pitcher_outs',14.5,'over','Pitcher Outs O14.5'),
 ('pitcher_strikeouts',3.5,'over','Pitcher K O3.5'),
 ('pitcher_strikeouts',6.5,'under','Pitcher K U6.5'),
 ('pitcher_walks',0.5,'over','Pitcher Walks O0.5'),
 ('pitcher_walks',2.5,'under','Pitcher Walks U2.5'),
 ('pitcher_walks',3.5,'under','Pitcher Walks U3.5')
),
classified as (
 select q.*,c.label,(c.label is not null)::int exact_match
 from q left join contracts c using(market,line,side)
)
select
  count(*) total_unique_market_player_book_rows,
  sum(exact_match) exact_contract_rows,
  round(100.0*sum(exact_match)/nullif(count(*),0),2) pct_rows_covered,
  count(distinct (market,line,side)) total_surfaces,
  count(distinct (market,line,side)) filter(where exact_match=1) covered_surfaces,
  count(distinct game_pk) games_with_quotes,
  count(distinct game_pk) filter(where exact_match=1) games_with_any_exact_contract
from classified;
