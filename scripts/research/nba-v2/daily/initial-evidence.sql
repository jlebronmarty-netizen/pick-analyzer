-- All five outputs are JSON arrays. Run SELECTs separately or in a read-only transaction.
-- v2-schedule.json
SELECT jsonb_agg(to_jsonb(s) ORDER BY s.source_received_at DESC,s.snapshot_id) FROM (
 SELECT snapshot_id,source_received_at,recorded_at,payload FROM public.nba_market_schedules_v1
 WHERE date_local='2026-11-20' AND recorded_at<='2026-11-21T20:00:30Z' AND source_received_at<='2026-11-21T20:00:30Z'
 ORDER BY source_received_at DESC,snapshot_id LIMIT 2
) s;
-- v2-ops.json
SELECT jsonb_agg(to_jsonb(s)) FROM (
 SELECT provider_game_id,player_stats_captured_at,player_stats->'data'->0->'game' AS g
 FROM public.nba_game_context_v2 WHERE provider_game_id IN(21718153,21718154,21718155)
 AND player_stats_captured_at<='2026-11-21T20:00:30Z'
) s;
-- v2-versions.json
SELECT jsonb_agg(to_jsonb(s)) FROM (
 SELECT g->>'id' id,count(*) final_receipts,min(source_received_at) first_final,
 count(DISTINCT jsonb_build_array(g->'home_q1',g->'visitor_q1',g->'home_q2',g->'visitor_q2',
 g->'home_q3',g->'visitor_q3',g->'home_q4',g->'visitor_q4',g->'home_team_score',g->'visitor_team_score')) versions
 FROM public.nba_market_schedules_v1 CROSS JOIN LATERAL jsonb_array_elements(payload->'data'->'games') g
 WHERE date_local='2026-11-20' AND recorded_at<='2026-11-21T20:00:30Z' AND source_received_at<='2026-11-21T20:00:30Z'
 AND g->>'status_state'='final' AND g->>'id' IN ('21718153','21718154','21718155') GROUP BY 1
) s;
-- v2-hoops-games.json
SELECT normalized->'games' FROM public.nba_hoopsapi_captures_v1 WHERE capture_id='94997ae2-c844-4c16-9e0e-6984d1b91880';
-- v2-pairs.json. Selection by provider ID, with the exact frozen quote checked again by verify-initial.mjs.
WITH quotes AS (
 SELECT capture_id,archived_at,q FROM public.nba_hoopsapi_captures_v1 CROSS JOIN LATERAL jsonb_array_elements(normalized->'quotes') q
 WHERE capture_id='94997ae2-c844-4c16-9e0e-6984d1b91880' AND archived_at<='2026-11-21T01:57:07.443Z'
) SELECT jsonb_agg(jsonb_build_object('capture_id',m.capture_id,'archived_at',m.archived_at,'offered',m.q,'opposite',u.q))
 FROM quotes m LEFT JOIN quotes u ON u.q->>'provider_game_id'=m.q->>'provider_game_id' AND u.q->>'period'=m.q->>'period'
 AND u.q->>'market'=m.q->>'market' AND u.q->'line'=m.q->'line' AND u.q->>'side'='under' AND u.q->>'sportsbook'=m.q->>'sportsbook'
 WHERE m.q->>'side'='over' AND m.q->>'market'='total' AND m.q->>'period' IN ('q1','q2','q3','q4','h1');
