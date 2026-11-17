-- Read-only, bounded NHL frozen/rest experiment data.
-- Frozen projections and archived as-of context only; no backfilling later goalie identity.
SELECT s.event_id,s.scheduled_at,s.frozen_at,
       s.features->'pregameContextV2'->>'asOf' AS rest_context_asof,
       (s.projection->>'homeGoals')::float8 AS home_lambda,
       (s.projection->>'awayGoals')::float8 AS away_lambda,
       (s.features->'pregameContextV2'->'home'->>'hoursSincePreviousGame')::float8 AS home_rest_hours,
       (s.features->'pregameContextV2'->'away'->>'hoursSincePreviousGame')::float8 AS away_rest_hours,
       (o.body->>'homeScore')::int AS home_score,
       (o.body->>'awayScore')::int AS away_score,
       o.observed_at AS outcome_observed_at
FROM public.nhl_challenger_shadow_v1 s
JOIN public.nhl_free_outcomes_v1 o USING(event_id)
WHERE s.model_version='NHL_SCORES_POISSON_SHADOW_V1'
  AND s.frozen_at<s.scheduled_at-interval '10 minutes'
  AND (s.features->'pregameContextV2'->>'asOf')::timestamptz<=s.frozen_at
  AND o.observed_at>s.scheduled_at
ORDER BY s.scheduled_at,s.event_id
LIMIT 500;
