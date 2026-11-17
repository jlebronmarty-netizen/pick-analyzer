-- NHL CIRCA rolling bias research V0
-- Read-only. No odds fetching, writes, model promotion, or user picks.
-- Fixed exploratory adjustment chosen *after* looking at historical cohort.
-- It is NOT an untouched holdout or a validated winning strategy.
-- Use earliest valid outcome observed_at and source timestamps; never use later outcomes.
-- One (latest pregame) Circa quote per match; do NOT substitute live/post-game prices.
WITH games AS (
 SELECT p.event_id, p.scheduled_at,
        (p.body->>'homeProbability')::float8 AS dratings_home,
        ((o.body->>'homeScore')::int > (o.body->>'awayScore')::int)::int AS home_won,
        o.observed_at AS outcome_observed_at
 FROM public.nhl_free_predictions_v1 p
 JOIN public.nhl_free_outcomes_v1 o USING (event_id)
 WHERE (p.body->>'capturedAt')::timestamptz < p.scheduled_at
), quotes AS (
 SELECT g.*, q.captured_at AS quote_at,
        (q.body->>'homeOdds')::numeric AS home_american,
        (q.body->>'awayOdds')::numeric AS away_american,
        ROW_NUMBER() OVER (
         PARTITION BY g.event_id ORDER BY q.captured_at DESC, q.id DESC
        ) AS rn
 FROM games g
 JOIN public.nhl_free_quote_observations_v1 q ON q.event_id=g.event_id
 WHERE q.captured_at<g.scheduled_at
   AND q.body->>'sportsbook'='CIRCA'
   AND q.body->>'homeOdds' IS NOT NULL
   AND q.body->>'awayOdds' IS NOT NULL
), paired AS (
 SELECT *,
   (CASE WHEN home_american<0 THEN -home_american/(100-home_american)
         ELSE 100/(100+home_american) END)
   / ((CASE WHEN home_american<0 THEN -home_american/(100-home_american)
            ELSE 100/(100+home_american) END)
    +(CASE WHEN away_american<0 THEN -away_american/(100-away_american)
           ELSE 100/(100+away_american) END)) AS market_home
 FROM quotes WHERE rn=1
), rolling AS (
 SELECT x.*, prior.n_prior,prior.bias,
   GREATEST(0.01, LEAST(0.99,
     x.market_home+COALESCE(prior.bias,0)
       * COALESCE(prior.n_prior,0)/(COALESCE(prior.n_prior,0)+50)
   )) AS corrected_home
 FROM paired x
 LEFT JOIN LATERAL (
   SELECT COUNT(*) AS n_prior,AVG(y.home_won-y.market_home) AS bias
   FROM paired y
   WHERE y.event_id<>x.event_id
     AND y.scheduled_at<x.scheduled_at
     AND y.outcome_observed_at<x.quote_at
 ) prior ON TRUE
)
SELECT COUNT(*) AS evaluated_games,
       ROUND(AVG(POWER(market_home-home_won,2))::numeric,5) AS circa_brier,
       ROUND(AVG(POWER(corrected_home-home_won,2))::numeric,5) AS bias_corrected_brier,
       ROUND(AVG(POWER(dratings_home-home_won,2))::numeric,5) AS dratings_brier,
       ROUND(AVG(-home_won*LN(market_home)-(1-home_won)*LN(1-market_home))::numeric,5) AS circa_logloss,
       ROUND(AVG(-home_won*LN(corrected_home)-(1-home_won)*LN(1-corrected_home))::numeric,5) AS corrected_logloss,
       SUM(((market_home>=0.5)::int=home_won)::int) AS circa_directional_wins,
       SUM(((corrected_home>=0.5)::int=home_won)::int) AS corrected_directional_wins,
       ROUND(AVG(POWER(market_home-home_won,2)-POWER(corrected_home-home_won,2))::numeric,5) AS paired_brier_improvement,
       ROUND((AVG(POWER(market_home-home_won,2)-POWER(corrected_home-home_won,2))
           -1.96*STDDEV_SAMP(POWER(market_home-home_won,2)-POWER(corrected_home-home_won,2))/SQRT(COUNT(*)))::numeric,5) AS iid_normal_ci_low,
       ROUND((AVG(POWER(market_home-home_won,2)-POWER(corrected_home-home_won,2))
           +1.96*STDDEV_SAMP(POWER(market_home-home_won,2)-POWER(corrected_home-home_won,2))/SQRT(COUNT(*)))::numeric,5) AS iid_normal_ci_high
FROM rolling WHERE n_prior>=20;
