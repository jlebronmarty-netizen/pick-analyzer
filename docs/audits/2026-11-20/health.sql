-- On-demand checks; run in a read-only transaction. Times denote observations, not game dates.
BEGIN TRANSACTION READ ONLY;

-- Current production alert candidates: source coverage per finished PR day.
WITH slates AS (
  SELECT DISTINCT ON (date_local) date_local, payload
  FROM public.nba_market_schedules_v1
  WHERE date_local BETWEEN (now() AT TIME ZONE 'America/Puerto_Rico')::date-14
                     AND (now() AT TIME ZONE 'America/Puerto_Rico')::date-1
  ORDER BY date_local,source_received_at DESC
), finals AS (
  SELECT date_local,(g->>'id')::bigint id,(g->>'season')::int season
  FROM slates CROSS JOIN LATERAL jsonb_array_elements(payload#>'{data,games}') g
  WHERE g->>'status_state'='final'
), compact AS (
  SELECT season, provider_game_id, count(*) n, count(DISTINCT player_id) players
  FROM public.nba_goat_player_game_research_v1 GROUP BY 1,2
)
SELECT f.date_local,f.id,f.season,a.data_count source_rows,c.n compact_rows,c.players unique_players,
  CASE WHEN a.provider_game_id IS NULL THEN 'SOURCE_UNAVAILABLE'
       WHEN c.n IS DISTINCT FROM c.players THEN 'DUPLICATE_DATA'
       WHEN c.n IS DISTINCT FROM a.data_count THEN 'INCOMPLETE_HISTORY' END AS alert
FROM finals f LEFT JOIN public.nba_goat_season_archive_v1 a
 ON a.season=f.season AND a.provider_game_id=f.id AND a.dataset_key='player_stats'
LEFT JOIN compact c ON c.season=f.season AND c.provider_game_id=f.id
WHERE a.provider_game_id IS NULL OR c.n IS DISTINCT FROM a.data_count OR c.n IS DISTINCT FROM c.players
ORDER BY f.date_local,f.id;

-- Independent operational revisions; show disagreeing fields and their receipt times.
WITH originals AS (
 SELECT c.provider_game_id,c.player_stats_captured_at,p FROM public.nba_game_context_v2 c
 CROSS JOIN LATERAL jsonb_array_elements(c.player_stats->'data') p
 WHERE c.player_stats_captured_at>=now()-interval '30 days'
)
SELECT o.provider_game_id,r.player_id,o.player_stats_captured_at,r.source_captured_at,
       k.field,o.p->>k.field raw_value,to_jsonb(r)->>k.field compact_value
FROM originals o JOIN public.nba_goat_player_game_research_v1 r
 ON r.provider_game_id=o.provider_game_id AND r.player_id=(o.p->'player'->>'id')::bigint
CROSS JOIN (VALUES ('pts'),('ast'),('reb'),('fg3m')) k(field)
WHERE r.minutes_played>=10 AND (o.p->>k.field) IS DISTINCT FROM (to_jsonb(r)->>k.field)
ORDER BY 1,2,5;

-- Latest ledger status, timestamps and age; retain partial runs.
WITH runs AS (
 SELECT 'NBA '||split_part(slot,':',2) lane,status,completed_at finished FROM public.nba_market_sync_runs_v1 WHERE slot LIKE 'research:%'
 UNION ALL SELECT 'NHL',status,completed_at FROM public.nhl_free_runs_v1
 UNION ALL SELECT 'NCAAB',status,completed_at FROM public.ncaab_daily_runs_v1
 UNION ALL SELECT 'UFC',status,completed_at FROM public.ufc_free_runs_v1
 UNION ALL SELECT 'Soccer',status,finished_at FROM public.edge_lab_runs_v1
 UNION ALL SELECT sport,status,finished_at FROM public.edge_lab_multi_runs_v1
 UNION ALL SELECT league,state,coalesce(observed_at,requested_at) FROM public.free_sports_runs_v1
)
SELECT DISTINCT ON(lane) lane,status,finished,now()-finished AS age
FROM runs WHERE finished IS NOT NULL ORDER BY lane,finished DESC;

-- Show scope and prices per game alongside daily volume; weekdays and slate sizes differ.
SELECT date_local,count(DISTINCT provider_game_id) games,count(*) snapshots,sum(quote_count) quote_rows,
       round(sum(quote_count)::numeric/nullif(count(DISTINCT provider_game_id),0),1) quotes_per_game
FROM public.nba_market_snapshots_v1
WHERE date_local>=(now() AT TIME ZONE 'America/Puerto_Rico')::date-7
GROUP BY 1 ORDER BY 1;

-- Exclude ABSTAIN from actionable settlement backlog. Keep disputes separate.
SELECT f.sport,f.status,f.market,count(*) forecast_rows,count(DISTINCT f.event_id) unique_events
FROM public.edge_lab_multi_forecasts_v1 f
LEFT JOIN public.edge_lab_multi_outcomes_v1 o ON o.forecast_id=f.id
WHERE f.scheduled_at<now()-interval '48 hours' AND f.status<>'ABSTAIN' AND o.forecast_id IS NULL
GROUP BY 1,2,3 ORDER BY 1,2,3;

SELECT market,count(*) frozen,count(DISTINCT game_id) independent_games,
       count(*) FILTER(WHERE decision_at>=game_start_at OR quote_captured_at>decision_at) invalid_time,
       count(*) FILTER(WHERE game_start_at<now()-interval '48 hours' AND o.forecast_id IS NULL) aged_unsettled
FROM public.nba_decision_shadow_forecasts_v1 f LEFT JOIN public.nba_decision_shadow_outcomes_v1 o USING(forecast_id)
GROUP BY market;

-- Anomaly relative to the immutable model's own input windows (rounding tolerance).
SELECT f.forecast_id,f.game_id,f.player_id,f.model_version,f.statistic,f.l5,f.l10,f.projection,
       'PROJECTION_WINDOW_MISMATCH' AS alert
FROM public.nba_decision_shadow_forecasts_v1 f
WHERE f.market='props'
  AND f.model_version IN ('NBA_DECISION_BOARD_SHADOW_V1','NBA_DECISION_BOARD_SHADOW_V2_INTEGRITY')
  AND (f.l5 IS NULL OR f.l10 IS NULL OR f.projection IS NULL OR abs(f.projection-
       CASE WHEN f.statistic IN ('assists','rebounds','threes','points') THEN .65*f.l5+.35*f.l10
            ELSE .40*f.l5+.60*f.l10 END)>.016)
ORDER BY f.decision_at DESC;

-- Diagnostic bands for human review. Use completed PR days and normalize by games.
WITH daily AS (
 SELECT date_local, sum(quote_count)::numeric/nullif(count(DISTINCT provider_game_id),0) AS per_game
 FROM public.nba_market_snapshots_v1
 WHERE date_local BETWEEN (now() AT TIME ZONE 'America/Puerto_Rico')::date-21
                      AND (now() AT TIME ZONE 'America/Puerto_Rico')::date-1
 GROUP BY date_local
), comparison AS (
 SELECT d.*, b.days, b.typical FROM daily d CROSS JOIN LATERAL (
  SELECT count(*) AS days,percentile_cont(.5) WITHIN GROUP (ORDER BY p.per_game) AS typical
  FROM daily p WHERE p.date_local<d.date_local AND p.date_local>=d.date_local-7
 ) b
)
SELECT date_local,per_game,typical,days,'QUOTE_VOLUME_REVIEW' AS alert
FROM comparison WHERE days>=5 AND typical>0 AND (per_game<typical/2 OR per_game>typical*2)
ORDER BY date_local;

ROLLBACK;
