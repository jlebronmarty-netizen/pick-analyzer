-- Export the result rows as a JSON array. Bind the UTC window endpoints in psql.
select 'NCAAB' as league, id::text as forecast_id, event_id, scheduled_at,
       created_at as frozen_at, body->>'home_name' as home, body->>'away_name' as away,
       body->>'model' as model, (body->>'projected_margin')::double precision as margin,
       (body->>'projected_total')::double precision as total
from ncaab_daily_predictions_v1
where scheduled_at >= :'start_at' and scheduled_at < :'end_at'
  and body->>'state' = 'FORECAST' and body->>'review_required' = 'false'
union all
select sport, id::text, event_id, scheduled_at, emitted_at,
       payload#>>'{input,home_name}', payload#>>'{input,away_name}', model_version,
       (payload#>>'{projection,projected_margin}')::double precision,
       (payload#>>'{projection,projected_total}')::double precision
from edge_lab_multi_forecasts_v1
where scheduled_at >= :'start_at' and scheduled_at < :'end_at'
  and sport = 'NCAAF' and cohort = 'NCAAF_PPG_PICK_20261105'
  and period = 'FULL_GAME_INCLUDING_OVERTIME' and market = 'POINT_MARGIN'
  and status = 'PROJECTION' and payload#>>'{input,time_verified}' = 'true';
