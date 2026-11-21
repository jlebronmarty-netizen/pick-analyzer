WITH panel AS (
  SELECT provider_game_id,player_id,team_id,game_datetime,source_captured_at,materialized_at,minutes_played,ast
  FROM public.nba_goat_player_game_research_v1
  WHERE season=2026 AND player_id IN(1028038426,73,490,406,115,17896075,3547254,473)
    AND materialized_at<='2026-11-21T01:57:07.443Z'
), history AS (
  SELECT t.*,w.n,w.ontime FROM panel t CROSS JOIN LATERAL (
    SELECT count(*) n,count(*) FILTER (WHERE p.materialized_at<=t.game_datetime-interval '1 hour'
      AND p.source_captured_at<=p.materialized_at AND p.ast IS NOT NULL) ontime
    FROM (SELECT p.* FROM panel p WHERE p.player_id=t.player_id AND p.game_datetime<t.game_datetime
      AND p.minutes_played>=10 ORDER BY p.game_datetime DESC,p.provider_game_id DESC LIMIT 10) p
  ) w WHERE t.minutes_played>0 AND t.ast IS NOT NULL
) SELECT count(*) AS played_player_rows,count(DISTINCT provider_game_id) AS played_games,
  count(*) FILTER(WHERE n=10) AS rows_with_ten_in_latest_materialization,
  count(*) FILTER(WHERE n=10 AND ontime=10) AS rows_with_ten_in_time,
  count(DISTINCT provider_game_id) FILTER(WHERE n=10 AND ontime=10) AS games_with_ten_in_time
FROM history
