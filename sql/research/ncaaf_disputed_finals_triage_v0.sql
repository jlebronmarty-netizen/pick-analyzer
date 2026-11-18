-- NCAAF DISPUTE triage: research-only, no outcome writes or eligibility promotion.
-- Repeated captures from one provider do not constitute independent-provider verification.
WITH disputed AS (
 SELECT f.event_id,f.id,f.scheduled_at,f.emitted_at,f.payload->'input' frozen
 FROM public.edge_lab_multi_forecasts_v1 f
 JOIN public.edge_lab_multi_outcomes_v1 o ON o.forecast_id=f.id
 WHERE f.sport='NCAAF' AND f.market='MONEYLINE' AND o.status='DISPUTE'
), finals AS (
 SELECT d.event_id,d.scheduled_at,d.emitted_at,d.frozen,
  s.captured_at source_captured_at,e observed
 FROM disputed d
 JOIN public.edge_lab_multi_sources_v1 s ON s.sport='NCAAF'
 CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.payload->'events','[]'::jsonb)) e
 WHERE e->>'event_id'=d.event_id AND e->>'status'='FINAL'
), evidence AS (
 SELECT event_id,MIN(scheduled_at) frozen_start,MIN(emitted_at) frozen_emitted,
 COUNT(*) final_captures,COUNT(DISTINCT source_captured_at) distinct_receipts,
 COUNT(DISTINCT observed->>'scheduled_at') final_time_variants,
 COUNT(DISTINCT ((observed->>'home_score')||':'||(observed->>'away_score'))) score_variants,
 COUNT(DISTINCT ((observed->>'home_id')||':'||(observed->>'away_id'))) team_variants,
 COUNT(DISTINCT observed->>'neutral_site') venue_variants,
 COUNT(*) FILTER (WHERE observed->>'outcome_validation'='PASS'
  AND observed->>'home_id'=frozen->>'home_id'
  AND observed->>'away_id'=frozen->>'away_id'
  AND observed->>'neutral_site'=frozen->>'neutral_site'
  AND (observed->>'season')::int=(frozen->>'season')::int
  AND source_captured_at>emitted_at
  AND source_captured_at>(observed->>'scheduled_at')::timestamptz) accepted,
 MIN((observed->>'scheduled_at')::timestamptz) final_start
 FROM finals GROUP BY event_id
)
SELECT event_id,final_captures,distinct_receipts,
 ROUND((ABS(EXTRACT(EPOCH FROM(final_start-frozen_start)))/60.0)::numeric,1) drift_minutes,
 CASE WHEN final_captures>=2 AND distinct_receipts>=2
  AND final_time_variants=1 AND score_variants=1
  AND team_variants=1 AND venue_variants=1 AND accepted=final_captures
  AND frozen_emitted<frozen_start
  AND ABS(EXTRACT(EPOCH FROM(final_start-frozen_start)))<=7200
 THEN 'REVIEW_CANDIDATE' ELSE 'MANUAL_REVIEW' END research_status
FROM evidence ORDER BY event_id;