SELECT jsonb_build_array(s.event_id,e.home_team,e.away_team,
       extract(epoch FROM (s.metadata->'nba01b'->>'commenceTime')::timestamptz)::bigint,
       extract(epoch FROM s.provider_timestamp)::bigint,s.market,
       jsonb_agg(jsonb_build_array(s.outcome,s.line,s.price) ORDER BY s.outcome,s.id)) AS r
FROM public.sports_odds_snapshots s
JOIN public.sport_events e ON e.id=s.event_id
WHERE s.sport_key='basketball_nba' AND s.sportsbook='fanduel'
  AND s.metadata->'nba01b'->>'source'='nba01b_r_historical_odds_persistence_recovery'
  AND s.market IN ('moneyline','spread','total')
GROUP BY s.event_id,e.home_team,e.away_team,s.metadata->'nba01b'->>'commenceTime',s.provider_timestamp,s.market
ORDER BY s.event_id,s.provider_timestamp,s.market
