SELECT jsonb_build_array(s.event_id,s.player_id,s.team_id,s.minutes,s.assists) AS r
FROM public.sport_player_stats s
JOIN public.sport_events e ON e.id=s.event_id
WHERE e.id LIKE 'nba_bdl_%' AND e.season IN ('2022-23','2023-24','2024-25')
  AND s.provider='balldontlie' AND s.points IS NOT NULL
  AND s.player_name IN ('Jamal Shead','Jalen Brunson','Trae Young','Domantas Sabonis',
                        'Stephen Curry','Cade Cunningham','Tyrese Maxey','Derrick White')
ORDER BY e.start_time,e.id,s.player_id,s.id
