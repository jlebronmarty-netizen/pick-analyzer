-- NBA Decision Board V2: bounded unsettled queue and grouped prospective challenger metrics.
-- Read-only helpers; all original SHADOW forecast/outcome rows remain immutable.
BEGIN;
CREATE OR REPLACE FUNCTION public.read_nba_decision_unsettled_v1(
 p_after timestamptz, p_before timestamptz,
 p_order text DEFAULT 'oldest', p_limit integer DEFAULT 350
)
RETURNS SETOF public.nba_decision_shadow_forecasts_v1
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$
 SELECT f.*
 FROM public.nba_decision_shadow_forecasts_v1 AS f
 WHERE f.game_start_at>=p_after AND f.game_start_at<=p_before
   AND p_after<=p_before AND p_order IN ('oldest','newest')
   AND p_limit BETWEEN 1 AND 400
   AND NOT EXISTS(SELECT 1 FROM public.nba_decision_shadow_outcomes_v1 o
                  WHERE o.forecast_id=f.forecast_id)
 ORDER BY
  CASE WHEN p_order='oldest' THEN f.game_start_at END ASC NULLS LAST,
  CASE WHEN p_order='newest' THEN f.game_start_at END DESC NULLS LAST,
  f.forecast_id ASC
 LIMIT LEAST(GREATEST(p_limit,1),400)
$$;
REVOKE EXECUTE ON FUNCTION public.read_nba_decision_unsettled_v1(timestamptz,timestamptz,text,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_nba_decision_unsettled_v1(timestamptz,timestamptz,text,integer)
 TO service_role;

CREATE OR REPLACE FUNCTION public.read_nba_decision_learning_metrics_v1(p_since timestamptz)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$
WITH score AS (
 SELECT f.forecast_id,f.model_version,f.market,f.period,
        coalesce(f.statistic,'') AS statistic,f.game_id,f.evidence,
        o.actual,o.absolute_error,o.statistical_result
 FROM public.nba_decision_shadow_forecasts_v1 f
 JOIN public.nba_decision_shadow_outcomes_v1 o USING(forecast_id)
 WHERE f.decision_at>=p_since
),
b AS (
 SELECT model_version,market,period,statistic,
        count(*) AS contracts,count(DISTINCT game_id) AS games,
        count(*) FILTER(WHERE statistical_result='win') AS wins,
        count(*) FILTER(WHERE statistical_result='loss') AS losses,
        count(*) FILTER(WHERE statistical_result='push') AS pushes,
        round(avg(absolute_error),3) AS mae
 FROM score GROUP BY 1,2,3,4
),
cand_game AS (
 SELECT s.model_version,s.market,s.period,s.statistic,
        c.value->>'id' AS candidate_id,s.game_id,
        avg(s.absolute_error)::numeric AS baseline_mae,
        avg(abs((c.value->>'projection')::numeric-s.actual))::numeric AS candidate_mae,
        avg(abs((c.value->>'projection')::numeric-s.actual)-s.absolute_error)::numeric AS delta_mae
 FROM score s
 CROSS JOIN LATERAL jsonb_array_elements(CASE
    WHEN jsonb_typeof(s.evidence->'challenger_projections')='array'
    THEN s.evidence->'challenger_projections' ELSE '[]'::jsonb END) AS c(value)
 WHERE c.value ? 'id'
   AND jsonb_typeof(c.value->'projection')='number'
 GROUP BY 1,2,3,4,5,6
),
cand AS (
 SELECT model_version,market,period,statistic,candidate_id,
        count(*) AS independent_games,
        round(avg(baseline_mae),3) AS baseline_mae,
        round(avg(candidate_mae),3) AS candidate_mae,
        round(avg(delta_mae),3) AS delta_mae,
        round((avg(delta_mae)-1.96*coalesce(stddev_samp(delta_mae),0)/sqrt(count(*)))::numeric,3) AS lower95,
        round((avg(delta_mae)+1.96*coalesce(stddev_samp(delta_mae),0)/sqrt(count(*)))::numeric,3) AS upper95
 FROM cand_game GROUP BY 1,2,3,4,5
)
SELECT jsonb_build_object(
 'status','EXPLORATORY_PROSPECTIVE_SHADOW',
 'period_since',p_since,
 'frozen_rows',(SELECT count(*) FROM public.nba_decision_shadow_forecasts_v1 WHERE decision_at>=p_since),
 'outcomes_rows',(SELECT count(*) FROM score),
 'last_frozen_at',(SELECT max(decision_at) FROM public.nba_decision_shadow_forecasts_v1 WHERE decision_at>=p_since),
 'last_settled_at',(SELECT max(o.settled_at) FROM public.nba_decision_shadow_outcomes_v1 o JOIN public.nba_decision_shadow_forecasts_v1 f USING(forecast_id) WHERE f.decision_at>=p_since),
 'baseline',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'modelVersion',model_version,'market',market,'period',period,'statistic',statistic,
    'scoredContracts',contracts,'uniqueGames',games,'wins',wins,'losses',losses,'pushes',pushes,
    'mae',mae,'hitRate',CASE WHEN wins+losses>=30 THEN round((100.0*wins/(wins+losses))::numeric,2) ELSE NULL END,
    'status',CASE WHEN games>=100 THEN 'HOLDOUT_REVIEW_REQUIRED' ELSE 'INSUFFICIENT_INDEPENDENT_GAMES' END
  ) ORDER BY market,period,statistic) FROM b),'[]'::jsonb),
 'challengers',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'modelVersion',model_version,'market',market,'period',period,'statistic',statistic,
    'candidateVersion',candidate_id,'independentGames',independent_games,
    'baselineMae',baseline_mae,'candidateMae',candidate_mae,'deltaMae',delta_mae,
    'ci95',jsonb_build_array(lower95,upper95),
    'status',CASE WHEN independent_games>=100 AND upper95<0
      THEN 'PROSPECTIVE_REVIEW_CANDIDATE_HOLDOUT_REQUIRED'
      ELSE 'INSUFFICIENT_EVIDENCE_DO_NOT_PROMOTE' END
  ) ORDER BY market,period,statistic,candidate_id) FROM cand),'[]'::jsonb),
 'method','GAME_CLUSTERED_EXPLORATORY_NORMAL_95_CI_NOT_CONFIRMATORY',
 'promotions_performed',0
)
$$;
REVOKE EXECUTE ON FUNCTION public.read_nba_decision_learning_metrics_v1(timestamptz)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_nba_decision_learning_metrics_v1(timestamptz)
 TO service_role;
COMMIT;
