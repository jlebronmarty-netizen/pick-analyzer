-- NCAAB research-only, home-favorite-only calibration sensitivity V1.
-- Retrospective formula selected after reviewing V0 results: NOT an independent holdout.
-- Prior labels must be observed before each forecast's created_at.
-- Never rewrites an official Pick selection, prediction, or probability.
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
 SELECT *, CASE WHEN ph>=0.5 THEN GREATEST(0.500001,adjusted) ELSE ph END AS home_only
 FROM rolling WHERE n_prior>=50
)
SELECT COUNT(*) n,
 ROUND(AVG(POWER(ph-y,2))::numeric,5) baseline_brier,
 ROUND(AVG(POWER(home_only-y,2))::numeric,5) home_only_brier,
 ROUND(AVG(-(y*LN(ph)+(1-y)*LN(1-ph)))::numeric,5) baseline_logloss,
 ROUND(AVG(-(y*LN(home_only)+(1-y)*LN(1-home_only)))::numeric,5) home_only_logloss,
 SUM(((ph>=0.5)::int=y)::int) baseline_hits,
 SUM(((home_only>=0.5)::int=y)::int) home_only_hits,
 ROUND(AVG(POWER(ph-y,2)-POWER(home_only-y,2))::numeric,5) mean_brier_gain,
 ROUND((AVG(POWER(ph-y,2)-POWER(home_only-y,2))-1.96*STDDEV_SAMP(POWER(ph-y,2)-POWER(home_only-y,2))/SQRT(COUNT(*)))::numeric,5) naive_ci_low,
 ROUND((AVG(POWER(ph-y,2)-POWER(home_only-y,2))+1.96*STDDEV_SAMP(POWER(ph-y,2)-POWER(home_only-y,2))/SQRT(COUNT(*)))::numeric,5) naive_ci_high
FROM scored;
