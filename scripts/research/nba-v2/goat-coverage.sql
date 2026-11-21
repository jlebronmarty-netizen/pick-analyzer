-- Group the actual contracts and independent games, including unsupported or disputed types.
SELECT market,period,contract,count(*) AS quotes,count(DISTINCT provider_game_id) AS games,
       min(source_received_at) AS first_receipt,max(source_received_at) AS last_receipt
FROM public.nba_market_quotes_v1
WHERE market='props' AND source_received_at<='2026-11-21T01:57:07.443Z'
GROUP BY market,period,contract ORDER BY quotes DESC,period,contract
