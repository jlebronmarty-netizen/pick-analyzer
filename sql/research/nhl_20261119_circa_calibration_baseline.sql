-- NHL calibration baseline; READ ONLY. Strict original immutable game/side/time.
-- Latest Circa quote >=10m before puck drop; quote may be newer than
-- frozen DRatings probability, so this is a reference comparison, NOT EV/CLV.
with scored as (
 select p.event_id,p.scheduled_at,p.created_at,p.body,
 o.observed_at,
 case when (o.body->>'homeScore')::int>(o.body->>'awayScore')::int then 1.0 else 0.0 end y,
 (p.body->>'homeProbability')::numeric pd
 from public.nhl_free_predictions_v1 p
 join public.nhl_free_outcomes_v1 o using(event_id)
 where p.created_at<p.scheduled_at and o.observed_at>p.scheduled_at
 and p.scheduled_at=(o.body->>'scheduledAt')::timestamptz
 and (p.body->>'homeId')::bigint=(o.body->>'homeId')::bigint
 and (p.body->>'awayId')::bigint=(o.body->>'awayId')::bigint
), quotes as (
 select g.*,q.captured_at quote_at,
 (q.body->>'homeOdds')::numeric ho,(q.body->>'awayOdds')::numeric ao,
 row_number() over(partition by g.event_id order by q.captured_at desc,q.id desc) rn
 from scored g join public.nhl_free_quote_observations_v1 q
 on q.event_id=g.event_id and q.scheduled_at=g.scheduled_at
 where q.captured_at<g.scheduled_at-interval '10 minutes'
 and q.body->>'sportsbook'='CIRCA'
 and (q.body->>'homeId')::bigint=(g.body->>'homeId')::bigint
 and (q.body->>'awayId')::bigint=(g.body->>'awayId')::bigint
 and q.body->>'homeOdds' is not null and q.body->>'awayOdds' is not null
), paired as (
 select *,
  (case when ho<0 then -ho/(100-ho) else 100/(100+ho) end) /
  ((case when ho<0 then -ho/(100-ho) else 100/(100+ho) end)+
   (case when ao<0 then -ao/(100-ao) else 100/(100+ao) end)) pm
 from quotes where rn=1
)
select count(*) n,
round(avg(power(pd-y,2)),5) dratings_brier,
round(avg(power(pm-y,2)),5) circa_novig_brier,
round(avg(-y*ln(pd)-(1-y)*ln(1-pd)),5) dratings_logloss,
round(avg(-y*ln(pm)-(1-y)*ln(1-pm)),5) circa_logloss,
sum(((pd>=.5)=(y=1))::int) dratings_hits,
sum(((pm>=.5)=(y=1))::int) circa_hits,
round(avg(y),4) actual_home_win_rate
from paired;
