-- Read-only NCAAB outcome identity and accuracy audit.
-- Never revise frozen forecasts; exclude identity conflicts and >2h drift.
WITH matched AS (
 SELECT p.event_id,p.scheduled_at,p.body AS forecast,o.body AS result,
 CASE
  WHEN p.body->>'home_id'=o.body->>'home_id'
   AND p.body->>'away_id'=o.body->>'away_id' THEN 'SAME'
  WHEN p.body->>'home_id'=o.body->>'away_id'
   AND p.body->>'away_id'=o.body->>'home_id' THEN 'SWAPPED'
  ELSE 'CONFLICT' END AS identity_status,
 ABS(EXTRACT(EPOCH FROM ((o.body->>'scheduled_at')::timestamptz-p.scheduled_at))) AS time_drift_sec
 FROM public.ncaab_daily_predictions_v1 p
 JOIN public.ncaab_daily_outcomes_v1 o USING(event_id)
),
verified AS (
 SELECT *,
 CASE WHEN identity_status='SAME' THEN (result->>'home_score')::int
      ELSE (result->>'away_score')::int END AS frozen_home_score,
 CASE WHEN identity_status='SAME' THEN (result->>'away_score')::int
      ELSE (result->>'home_score')::int END AS frozen_away_score
 FROM matched
 WHERE identity_status IN ('SAME','SWAPPED') AND time_drift_sec<=7200
),
graded AS (
 SELECT *,
  (forecast->>'home_win_probability')::numeric AS home_probability,
  (forecast->>'projected_margin')::numeric AS projected_margin,
  (forecast->>'projected_total')::numeric AS projected_total,
  CASE WHEN frozen_home_score>frozen_away_score THEN 1 ELSE 0 END AS home_won,
  CASE WHEN frozen_home_score>frozen_away_score
    THEN forecast->>'home_id' ELSE forecast->>'away_id' END AS winning_team_id
 FROM verified
)
SELECT COUNT(*) AS verified_games,
 SUM(((forecast->>'predicted_winner')=winning_team_id)::int) AS directional_wins,
 ROUND(AVG(((forecast->>'predicted_winner')=winning_team_id)::int)*100,3) AS accuracy_pct,
 ROUND(AVG(POWER(home_probability-home_won,2)),4) AS home_brier,
 ROUND(AVG(ABS(projected_margin-(frozen_home_score-frozen_away_score))),3) AS margin_mae,
 ROUND(AVG(ABS(projected_total-(frozen_home_score+frozen_away_score))),3) AS total_mae,
 ROUND(AVG(home_probability),4) AS average_home_probability,
 ROUND(AVG(home_won),4) AS observed_home_win_rate
FROM graded;
