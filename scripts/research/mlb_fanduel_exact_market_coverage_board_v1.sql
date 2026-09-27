-- MLB_FANDUEL_EXACT_MARKET_COVERAGE_BOARD_V1
-- READ ONLY / RESEARCH ONLY.
-- Compares frozen exact-line contracts with today's FanDuel captured surfaces.
-- Does not score a market when the exact side is missing.

with contracts as (
  select * from (values
    ('pitcher_strikeouts','Pitcher K O3.5','OVER',3.5::numeric,'CROSS_YEAR_STABLE_75_PLUS'),
    ('pitcher_strikeouts','Pitcher K U6.5','UNDER',6.5::numeric,'CERTIFIED_CONTROL'),
    ('pitcher_walks','Pitcher BB O0.5','OVER',0.5::numeric,'CROSS_YEAR_STABLE_75_PLUS'),
    ('pitcher_walks','Pitcher BB U2.5','UNDER',2.5::numeric,'CROSS_YEAR_STABLE_75_PLUS'),
    ('pitcher_walks','Pitcher BB U3.5','UNDER',3.5::numeric,'CROSS_YEAR_STABLE_75_PLUS'),
    ('pitcher_earned_runs','Pitcher ER O1.5','OVER',1.5::numeric,'TARGET_MET_75_PLUS'),
    ('pitcher_earned_runs','Pitcher ER U3.5','UNDER',3.5::numeric,'CROSS_SPLIT_STABLE_75_PLUS'),
    ('pitcher_outs','Pitcher Outs O14.5','OVER',14.5::numeric,'FORWARD_VALIDATION_REQUIRED'),
    ('pitcher_outs','Pitcher Outs U18.5 V2','UNDER',18.5::numeric,'RESEARCH_FORWARD_VALIDATION_REQUIRED'),
    ('pitcher_hits_allowed','Pitcher Hits Allowed U6.5','UNDER',6.5::numeric,'TARGET_MET_75_PLUS'),
    ('batter_hits','Batter Hits U1.5','UNDER',1.5::numeric,'TARGET_MET_75_PLUS'),
    ('batter_total_bases','Batter TB U1.5','UNDER',1.5::numeric,'CROSS_YEAR_STABLE_75_PLUS'),
    ('batter_total_bases','Batter TB U2.5','UNDER',2.5::numeric,'TARGET_MET_75_PLUS'),
    ('batter_home_runs','Batter HR U0.5','UNDER',0.5::numeric,'TARGET_MET_75_PLUS'),
    ('batter_strikeouts','Batter K U1.5','UNDER',1.5::numeric,'TARGET_MET_75_PLUS'),
    ('batter_walks','Batter Walks U0.5','UNDER',0.5::numeric,'TARGET_MET_75_PLUS'),
    ('batter_singles','Batter Singles U1.5','UNDER',1.5::numeric,'TARGET_MET_75_PLUS'),
    ('batter_doubles','Batter Doubles U0.5','UNDER',0.5::numeric,'TARGET_MET_75_PLUS'),
    ('batter_rbis','Batter RBI U0.5','UNDER',0.5::numeric,'TARGET_MET_75_PLUS'),
    ('batter_hits_runs_rbis','Batter HRRBI U0.5','UNDER',0.5::numeric,'FORWARD_ONLY'),
    ('batter_hits_runs_rbis','Batter HRRBI U1.5','UNDER',1.5::numeric,'FORWARD_ONLY'),
    ('batter_hits_runs_rbis','Batter HRRBI U2.5','UNDER',2.5::numeric,'TARGET_MET_75_PLUS')
  ) v(market,label,side,line,evidence_state)
),
fd as (
  select market,line::numeric line,
         case when lower(outcome) in ('yes','over') then 'OVER'
              when lower(outcome) in ('no','under') then 'UNDER' end side,
         count(*) rows,
         count(distinct nullif(metadata->>'canonicalGamePk','')) games,
         count(distinct coalesce(metadata->>'playerMlbamId',metadata->>'pitcherMlbamId')) players,
         min(price) min_price,max(price) max_price
  from public.sports_odds_snapshots
  where (snapshot_time at time zone 'America/Puerto_Rico')::date=(now() at time zone 'America/Puerto_Rico')::date
    and lower(sportsbook)='fanduel'
  group by market,line::numeric,
           case when lower(outcome) in ('yes','over') then 'OVER'
                when lower(outcome) in ('no','under') then 'UNDER' end
),
market_any as (
  select market,count(*) rows,count(distinct line) lines
  from public.sports_odds_snapshots
  where (snapshot_time at time zone 'America/Puerto_Rico')::date=(now() at time zone 'America/Puerto_Rico')::date
    and lower(sportsbook)='fanduel'
  group by market
)
select c.label,c.market,c.side,c.line,c.evidence_state,
       coalesce(e.rows,0) exact_side_rows,
       coalesce(e.games,0) exact_side_games,
       coalesce(e.players,0) exact_side_players,
       e.min_price,e.max_price,
       coalesce(o.rows,0) opposite_side_rows,
       coalesce(m.rows,0) market_rows,
       case
         when coalesce(e.rows,0)>0 then 'EXACT_SIDE_AVAILABLE'
         when coalesce(o.rows,0)>0 then 'OPPOSITE_SIDE_ONLY'
         when coalesce(m.rows,0)>0 then 'MARKET_OTHER_LINES_ONLY'
         else 'MARKET_NOT_CAPTURED'
       end availability_state
from contracts c
left join fd e on e.market=c.market and e.line=c.line and e.side=c.side
left join fd o on o.market=c.market and o.line=c.line and o.side<>c.side
left join market_any m on m.market=c.market
order by availability_state,c.market,c.line;
