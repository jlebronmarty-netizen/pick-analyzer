-- Read-only NCAAB pending lifecycle classification from archived ESPN receipts.
-- NOT a settlement. Final-score assignment continues to require existing strict reconciler.
WITH unresolved AS (
 SELECT p.event_id,p.scheduled_at,p.body->>'home_name' frozen_home,p.body->>'away_name' frozen_away
 FROM public.ncaab_daily_predictions_v1 p
 LEFT JOIN public.ncaab_daily_outcomes_v1 o USING(event_id)
 WHERE o.event_id IS NULL AND p.scheduled_at < NOW()-INTERVAL '8 hours'
), captures AS (
 SELECT u.*,s.captured_at,
  e->>'id' provider_id,
  COALESCE(e->'competitions'->0->'status'->'type'->>'name',
           e->'status'->'type'->>'name') provider_status,
  COALESCE(e->'competitions'->0->>'date',e->>'date') observed_tip,
  ROW_NUMBER() OVER(PARTITION BY u.event_id ORDER BY s.captured_at DESC) rn
 FROM unresolved u
 JOIN public.ncaab_daily_source_v1 s ON true
 CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.body->'events','[]'::jsonb)) e
 WHERE e->>'id'=split_part(u.event_id,':',2)
)
SELECT event_id,frozen_home,frozen_away,scheduled_at frozen_tip,
       captured_at provider_capture,provider_status,observed_tip,
       CASE WHEN provider_status IN ('STATUS_POSTPONED') THEN 'REVIEW_POSTPONED'
            WHEN provider_status IN ('STATUS_CANCELED','STATUS_CANCELLED') THEN 'REVIEW_CANCELLED'
            WHEN observed_tip IS NOT NULL
             AND ABS(EXTRACT(EPOCH FROM ((observed_tip)::timestamptz-scheduled_at)))>7200 THEN 'REVIEW_RESCHEDULED'
            ELSE 'PENDING_FINAL' END AS research_lifecycle
FROM captures WHERE rn=1 ORDER BY scheduled_at,event_id;