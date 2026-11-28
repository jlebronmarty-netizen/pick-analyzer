-- Read-only. Supply the Puerto Rico sports date and archival cutoff.
with bounds as (
 select '2026-11-27'::date as day_local,'2026-11-27 23:00Z'::timestamptz as as_of
), offers as (
 select q.event_id,q.scheduled_at,q.captured_at,q.created_at persisted_at,
 q.body->>'sportsbook' book,'ml' market,v.side,null::numeric as line,v.price,q.body receipt
 from nhl_free_quote_observations_v1 q,bounds b,
 lateral(values ('away',q.body->'awayOdds'),('home',q.body->'homeOdds')) v(side,price)
 where (q.scheduled_at at time zone 'America/Puerto_Rico')::date=b.day_local and q.created_at<=b.as_of
 union all
 select m->>'eventId',(m->>'scheduledAt')::timestamptz,(m->>'capturedAt')::timestamptz,
 r.completed_at,m->>'book',m->>'market',v.key,(v.value->>'line')::numeric,v.value->'price',m
 from nhl_free_runs_v1 r cross join bounds b
 cross join lateral jsonb_array_elements(r.detail->'marketQuoteObservations') m
 cross join lateral jsonb_each(m->'quote') v
 where m->>'market' in ('spread','total') and v.key in ('home','away','over','under')
 and ((m->>'scheduledAt')::timestamptz at time zone 'America/Puerto_Rico')::date=b.day_local
 and r.completed_at<=b.as_of
)
select event_id,book,market,side,line,price,captured_at,persisted_at,scheduled_at,
 receipt->>'jurisdiction' jurisdiction,receipt->>'period' period,receipt->>'overtime' overtime,
 receipt->>'shootout' shootout,receipt->>'pushRule' push_rule,receipt->>'voidRule' void_rule,
 receipt->'quote'->'fullGameContractCertified' source_certification
from offers where captured_at<=persisted_at and persisted_at<scheduled_at
order by event_id,market,captured_at,side;
