SELECT jsonb_build_array(id, season, extract(epoch FROM start_time)::bigint,
       home_team_id, away_team_id, home_score, away_score, period_scores->'home', period_scores->'away') AS r
FROM public.sport_events
WHERE id LIKE 'nba_bdl_%' AND sport_key='basketball_nba'
  AND season IN ('2022-23','2023-24','2024-25')
ORDER BY start_time,id
