-- NCAAB calibration candidate V0: read-only, strictly before-forecast outcomes.
-- The parameters n>=50 and pseudo-count=100 were selected after exploratory
-- inspection; these 538 games are NOT an untouched holdout.
-- Never use this for Official Picks, probability rewrites, or settlements.
WITH paired AS (
 SELECT p.event_id,p.scheduled_at,p.created_at,o.observed_at,
        p.body AS pb,o.body AS ob,
  CASE WHEN p.body->>'home_id'=o.body->>'home_id'
             AND p.body->>'away_id'=o.body->>'away_id' THEN 1
       WHEN p.body->>'home_id'=o.body->>'away_id'
             AND p.body->>'away_id'=o.body->>'home_id' THEN -1 ELSE 0 END orientation,
  ABS(EXTRACT(EPOCH FROM ((o.body->>'scheduled_at')::timestamptz-p.scheduled_at))) drift_seconds
 FROM public.ncaab_daily_predictions_v1 p
 JOIN public.ncaab_daily_outcomes_v1 o USING(event_id)
), clean AS (
 SELECT event_id,scheduled_at,created_at,observed_at,
  (pb->>'home_win_probability')::float8 AS ph,
  CASE WHEN
    (CASE WHEN orientation=1 THEN (ob->>'home_score')::int ELSE (ob->>'away_score')::int END)
     > (CASE WHEN orientation=1 THEN (ob->>'away_score')::int ELSE (ob->>'home_score')::int END)
    THEN 1.0 ELSE 0.0 END AS y
 FROM paired
 WHERE orientation<>0 AND drift_seconds<=7200
   AND created_at<scheduled_at AND observed_at>=scheduled_at
   AND ob->>'status'='FINAL'
), rolling AS (
 SELECT x.*,p.n_prior,p.bias,
   GREATEST(0.01,LEAST(0.99,x.ph+
     COALESCE(p.bias,0)*COALESCE(p.n_prior,0)/(COALESCE(p.n_prior,0)+100)
   )) AS adjusted
 FROM clean x LEFT JOIN LATERAL(
  SELECT COUNT(*) AS n_prior,AVG(y.y-y.ph) AS bias
  FROM clean y
  WHERE y.event_id<>x.event_id
    AND y.observed_at<x.created_at AND y.scheduled_at<x.scheduled_at
 ) p ON TRUE
), scored AS (
 SELECT *,POWER(ph-y,2) base_brier,POWER(adjusted-y,2) adjusted_brier,
   -(y*LN(ph)+(1-y)*LN(1-ph)) base_logloss,
   -(y*LN(adjusted)+(1-y)*LN(1-adjusted)) adjusted_logloss,
   POWER(ph-y,2)-POWER(adjusted-y,2) delta
 FROM rolling WHERE n_prior>=50
)
SELECT COUNT(*) n,
 ROUND(AVG(base_brier)::numeric,5) base_brier,
 ROUND(AVG(adjusted_brier)::numeric,5) adjusted_brier,
 ROUND(AVG(base_logloss)::numeric,5) base_logloss,
 ROUND(AVG(adjusted_logloss)::numeric,5) adjusted_logloss,
 SUM(((ph>=0.5)::int=y)::int) base_hits,
 SUM(((adjusted>=0.5)::int=y)::int) adjusted_hits,
 ROUND(AVG(delta)::numeric,5) mean_brier_gain,
 ROUND((AVG(delta)-1.96*STDDEV_SAMP(delta)/SQRT(COUNT(*)))::numeric,5) naive_ci_low,
 ROUND((AVG(delta)+1.96*STDDEV_SAMP(delta)/SQRT(COUNT(*)))::numeric,5) naive_ci_high,
 ROUND(AVG(adjusted-ph)::numeric,5) mean_probability_shift
FROM scored;