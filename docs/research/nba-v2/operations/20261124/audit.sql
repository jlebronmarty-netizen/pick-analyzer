-- Run each SELECT separately using a read-only connection. Cutoff is cycle 11 on 24-nov-2026.
select count(*) observations,count(*) filter(where s.snapshot_id is not null and s.source_received_at<=c.captured_at and s.recorded_at<=c.captured_at and s.source_received_at::timestamptz>(f.record->>'gameStartAt')::timestamptz and g->>'status_state'='final' and (g->>'id')::bigint=f.game_id and actual=(j.record->>'actual')::numeric and j.record->>'result'=case when actual=(f.record->>'line')::numeric then 'push' when actual>(f.record->>'line')::numeric then 'win' else 'loss' end) reconciled from nba_v2_shadow.judgments j join nba_v2_shadow.forecasts f on f.id=j.forecast_id join nba_v2_shadow.cycles c on c.id=j.cycle_id left join public.nba_market_schedules_v1 s on s.snapshot_id=j.record->>'snapshotId' left join lateral jsonb_array_elements(s.payload->'data'->'games') g on (g->>'id')::bigint=f.game_id left join lateral(select case f.record->>'period' when 'h1' then (g->>'home_q1')::numeric+(g->>'visitor_q1')::numeric+(g->>'home_q2')::numeric+(g->>'visitor_q2')::numeric when 'q1' then (g->>'home_q1')::numeric+(g->>'visitor_q1')::numeric when 'q2' then (g->>'home_q2')::numeric+(g->>'visitor_q2')::numeric when 'q3' then (g->>'home_q3')::numeric+(g->>'visitor_q3')::numeric when 'q4' then (g->>'home_q4')::numeric+(g->>'visitor_q4')::numeric end actual) a on true where j.cycle_id<=11;

-- The exact original seed fingerprints. Hash each JSONB row array, then hash the ordered concatenation.
SELECT 'forecasts' kind, count(*) n,
 encode(sha256(convert_to(string_agg(encode(sha256(convert_to(jsonb_build_array(f.id,f.record,f.benchmark)::text,'UTF8')),'hex'),'' ORDER BY f.id),'UTF8')),'hex') fingerprint
FROM nba_v2_shadow.forecasts f JOIN nba_v2_shadow.cycles c ON c.id=f.cycle_id WHERE c.diagnostics ? 'seedFile'
UNION ALL
SELECT 'outcomes',count(*),
 encode(sha256(convert_to(string_agg(encode(sha256(convert_to(jsonb_build_array(j.forecast_id,j.record)::text,'UTF8')),'hex'),'' ORDER BY j.forecast_id),'UTF8')),'hex')
FROM nba_v2_shadow.judgments j JOIN nba_v2_shadow.cycles c ON c.id=j.cycle_id WHERE c.diagnostics ? 'seedFile';

-- Local evaluator inputs, using the same model and immutable cycle cutoff.
SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) forecasts FROM (
 SELECT f.id,f.record,f.benchmark FROM nba_v2_shadow.forecasts f JOIN nba_v2_shadow.cycles c ON c.id=f.cycle_id
 WHERE c.id<=11 AND c.model_hash='1ec8aff30c264bec1f87917f326db5affb85f508457dc5031b16f80016101329'
) x;
SELECT jsonb_agg(to_jsonb(x) ORDER BY x.cycle_id,x.forecast_id) judgments FROM (
 SELECT j.cycle_id,j.forecast_id,j.record,c.captured_at,c.model_hash
 FROM nba_v2_shadow.judgments j JOIN nba_v2_shadow.cycles c ON c.id=j.cycle_id
 WHERE c.id<=11 AND c.model_hash='1ec8aff30c264bec1f87917f326db5affb85f508457dc5031b16f80016101329'
) x;
SELECT report FROM nba_v2_shadow.reports WHERE cycle_id=11;
