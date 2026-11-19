-- Read-only: NHL Poisson V1 frozen-as-of matched Circa exact puck/total lines.
-- A market quote is eligible only when observed <= original freeze time and
-- at least 60 min before the verified NHL scheduled start.
-- The result was observed AFTER puck drop; returned scores are for evaluation
-- only, never input features. Does not certify book's source update time or rules.
WITH quote AS (
 SELECT x->>'eventId' event_id,x->>'market' market,
   x->>'book' book,x->>'scheduledAt' scheduled_at,
   (x->>'capturedAt')::timestamptz quote_at,x->>'home' home_name,
   x->>'away' away_name,(x->>'homeId')::bigint home_id,
   (x->>'awayId')::bigint away_id,x->'quote' quote_payload
 FROM public.nhl_free_runs_v1 r
 CROSS JOIN LATERAL jsonb_array_elements(
  coalesce(r.detail->'marketQuoteObservations','[]'::jsonb)) x
 WHERE r.status IN ('PASS','PARTIAL')
), matched AS (
 SELECT sh.event_id,sh.scheduled_at,sh.frozen_at,sh.projection,
        o.body final_body,q.market,q.quote_payload,q.quote_at,
  ROW_NUMBER() OVER(PARTITION BY sh.event_id,q.market
   ORDER BY q.quote_at DESC) rn
 FROM public.nhl_challenger_shadow_v1 sh
 JOIN quote q ON q.event_id=sh.event_id
   AND (q.scheduled_at)::timestamptz=sh.scheduled_at
   AND q.home_id=sh.home_team_id AND q.away_id=sh.away_team_id
   AND q.home_name=sh.home_team AND q.away_name=sh.away_team
 JOIN public.nhl_free_outcomes_v1 o ON o.event_id=sh.event_id
 WHERE sh.frozen_at<=sh.scheduled_at-interval '60 minutes'
   AND o.observed_at>sh.scheduled_at
   AND (o.body->>'scheduledAt')::timestamptz=sh.scheduled_at
   AND (o.body->>'homeId')::bigint=sh.home_team_id
   AND (o.body->>'awayId')::bigint=sh.away_team_id
   AND q.book='CIRCA' AND q.market IN ('spread','total')
   AND q.quote_at<=sh.frozen_at
   AND q.quote_at>=sh.frozen_at-interval '60 minutes'
)
SELECT event_id,market,scheduled_at,quote_at,
 (projection->>'homeGoals')::numeric home_lambda,
 (projection->>'awayGoals')::numeric away_lambda,
 (quote_payload->'home'->>'line')::numeric home_line,
 (quote_payload->'home'->>'price')::int home_price,
 (quote_payload->'away'->>'price')::int away_price,
 (quote_payload->'over'->>'line')::numeric total_line,
 (quote_payload->'over'->>'price')::int over_price,
 (quote_payload->'under'->>'price')::int under_price,
 (final_body->>'homeScore')::int home_score,
 (final_body->>'awayScore')::int away_score
FROM matched WHERE rn=1 ORDER BY event_id,market;
