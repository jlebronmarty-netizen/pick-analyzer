-- NHL archive audit. Read-only; no provider requests. Change this fixed cutoff only
-- for a NEW report. Mutable diagnostics/contexts are not a historical snapshot API.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

WITH c AS (
 SELECT * FROM public.nhl_game_context_v2
 WHERE boxscore_captured_at <= timestamptz '2026-11-23T15:52:27.459Z'
), teams AS (
 SELECT event_id, boxscore->>'gameDate' AS game_date, side,
        boxscore->side AS team, boxscore->'playerByGameStats'->side AS players
 FROM c CROSS JOIN (VALUES ('homeTeam'),('awayTeam')) sides(side)
), skaters AS (
 SELECT event_id,team->>'id' AS team_id,p
 FROM teams CROSS JOIN LATERAL jsonb_array_elements(
   coalesce(players->'forwards','[]'::jsonb)||coalesce(players->'defense','[]'::jsonb)) p
), goalies AS (
 SELECT event_id,team->>'id' AS team_id,p
 FROM teams CROSS JOIN LATERAL jsonb_array_elements(coalesce(players->'goalies','[]'::jsonb)) p
)
SELECT (SELECT count(*) FROM c) AS games,
 (SELECT min(boxscore->>'gameDate') FROM c) AS first_game_date,
 (SELECT max(boxscore->>'gameDate') FROM c) AS last_game_date,
 (SELECT count(*) FROM c WHERE play_by_play IS NOT NULL) AS with_pbp,
 (SELECT count(DISTINCT team->>'id') FROM teams) AS teams,
 (SELECT count(*) FROM skaters) AS skater_game_rows,
 (SELECT count(DISTINCT p->>'playerId') FROM skaters) AS skaters,
 (SELECT count(*) FROM goalies) AS goalie_game_rows,
 (SELECT count(*) FROM goalies WHERE p->>'toi' <> '00:00') AS goalie_appearances;

WITH q AS (
 SELECT o FROM public.nhl_free_runs_v1 r
 CROSS JOIN LATERAL jsonb_array_elements(coalesce(r.detail->'marketQuoteObservations','[]'::jsonb)) o
 WHERE r.completed_at <= timestamptz '2026-11-23T15:52:27.459Z'
)
SELECT o->>'market' AS market,count(*) AS captures,count(DISTINCT o->>'eventId') AS games,
 count(*) FILTER(WHERE o->>'marketRulesCertified'='true') AS rules_certified,
 count(*) FILTER(WHERE o->>'sourceUpdatedAt' IS NOT NULL) AS source_published_at_present
FROM q GROUP BY 1 ORDER BY 1;

SELECT count(*) AS moneyline_captures,count(DISTINCT event_id) AS games,
 min(captured_at) AS first_capture,max(captured_at) AS last_capture
FROM public.nhl_free_quote_observations_v1
WHERE captured_at <= timestamptz '2026-11-23T15:52:27.459Z';

WITH teams AS (
 SELECT event_id,boxscore->>'gameDate' AS game_date,boxscore->side AS team
 FROM public.nhl_game_context_v2
 CROSS JOIN (VALUES ('homeTeam'),('awayTeam')) sides(side)
 WHERE boxscore_captured_at <= timestamptz '2026-11-23T15:52:27.459Z'
)
SELECT team->>'id' AS team_id,team->>'abbrev' AS team,count(*) AS games,
 min(game_date) AS first_game_date,max(game_date) AS last_game_date
FROM teams GROUP BY 1,2 ORDER BY 1;

-- Specific source-accounting exceptions; do not UPDATE these originals.
WITH teams AS (
 SELECT event_id,boxscore->side AS team,boxscore->'playerByGameStats'->side AS players
 FROM public.nhl_game_context_v2
 CROSS JOIN (VALUES ('homeTeam'),('awayTeam')) sides(side)
 WHERE boxscore_captured_at <= timestamptz '2026-11-23T15:52:27.459Z'
)
SELECT event_id,team->>'abbrev' AS team,p->>'playerId' AS player_id,p->'name'->>'default' AS player,
 p->>'shotsAgainst' AS shots_against,p->>'goalsAgainst' AS goals_against,p->>'saves' AS saves
FROM teams CROSS JOIN LATERAL jsonb_array_elements(coalesce(players->'goalies','[]'::jsonb)) p
WHERE jsonb_typeof(p->'saves')='number'
 AND (p->>'shotsAgainst')::int <> (p->>'goalsAgainst')::int+(p->>'saves')::int;

SELECT 'predictions' AS source,count(*) AS rows,
 md5(string_agg(id||':'||md5(body::text),',' ORDER BY id)) AS immutable_digest
FROM public.nhl_free_predictions_v1 WHERE created_at <= timestamptz '2026-11-23T15:52:27.459Z'
UNION ALL SELECT 'outcomes',count(*),md5(string_agg(id||':'||md5(body::text),',' ORDER BY id))
FROM public.nhl_free_outcomes_v1 WHERE observed_at <= timestamptz '2026-11-23T15:52:27.459Z'
UNION ALL SELECT 'early',count(*),md5(string_agg(id||':'||md5(to_jsonb(x)::text),',' ORDER BY id))
FROM public.nhl_challenger_shadow_v1 x WHERE created_at <= timestamptz '2026-11-23T15:52:27.459Z'
UNION ALL SELECT 'late',count(*),md5(string_agg(id||':'||md5(to_jsonb(x)::text),',' ORDER BY id))
FROM public.nhl_late_shadow_v6 x WHERE created_at <= timestamptz '2026-11-23T15:52:27.459Z';

COMMIT;
