-- NHL V8 official regulation score reconstruction study, read-only.
-- Official NHL regular-season boxscore only. Does not infer verified bookmaker
-- settlement or pregame confirmed goalie. For ML/total as-of experiments,
-- also require boxscore_captured_at <= frozen_at and past game start+4h < freeze.
with official as (
 select c.event_id,c.boxscore_captured_at,c.boxscore,
 c.boxscore->>'startTimeUTC' scheduled_at,
 (c.boxscore->'homeTeam'->>'id')::int home_id,
 (c.boxscore->'awayTeam'->>'id')::int away_id,
 (c.boxscore->'homeTeam'->>'score')::int home_goals,
 (c.boxscore->'awayTeam'->>'score')::int away_goals,
 c.boxscore->'gameOutcome'->>'lastPeriodType' outcome_kind,
 c.boxscore->'periodDescriptor'->>'periodType' last_period,
 (c.boxscore->'periodDescriptor'->>'number')::int period_number
 from public.nhl_game_context_v2 c where c.boxscore is not null
), reconstructed as (
 select *,
 case when outcome_kind in ('OT','SO') and home_goals>away_goals
 then home_goals-1 else home_goals end as regulation_home,
 case when outcome_kind in ('OT','SO') and away_goals>home_goals
 then away_goals-1 else away_goals end as regulation_away
 from official
 where event_id~'^nhl:202602[0-9]{4}$'
 and boxscore->>'gameState' in ('OFF','FINAL')
 and (boxscore->>'season')::int=20262027
 and (boxscore->>'gameType')::int=2
 and (boxscore->>'regPeriods')::int=3
 and boxscore->>'id'=replace(event_id,'nhl:','')
 and boxscore_captured_at>(scheduled_at)::timestamptz
 and home_id<>away_id and home_goals<>away_goals
 and outcome_kind=last_period
 and ((outcome_kind='REG' and period_number=3)
    or (outcome_kind='OT' and period_number=4 and (boxscore->'gameOutcome'->>'otPeriods')::int=1 and abs(home_goals-away_goals)=1)
    or (outcome_kind='SO' and period_number=5 and abs(home_goals-away_goals)=1))
)
select outcome_kind,count(*) final_games,
count(*) filter(where regulation_home=regulation_away) regulation_ties,
count(*) filter(where regulation_home<>regulation_away) regulation_decisive,
sum(home_goals+away_goals) official_full_game_total_goals,
sum(regulation_home+regulation_away) reconstructed_regulation_goals
from reconstructed
group by outcome_kind order by outcome_kind;
