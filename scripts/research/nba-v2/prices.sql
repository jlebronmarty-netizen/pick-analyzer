SELECT jsonb_build_array(p.game_id,p.market,p.selection,p.home_team,p.away_team,p.line,p.odds,
       extract(epoch FROM p.odds_timestamp)::bigint,extract(epoch FROM p.cutoff_at)::bigint,
       p.certification_metadata->'nba02b3Evaluation'->>'settlementOutcome') AS r
FROM public.prediction_history p
WHERE p.sport_key='basketball_nba' AND p.prediction_origin='HISTORICAL_REPLAY_SHADOW'
  AND p.certification_metadata->>'priceEvidenceMode'='PRICE_AWARE_BOUND'
  AND p.certification_status='CERTIFIED' AND p.sportsbook='fanduel'
  AND p.market IN ('moneyline','spread','total')
ORDER BY p.commence_time,p.game_id,p.market,p.id
