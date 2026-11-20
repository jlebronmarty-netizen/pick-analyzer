-- Todas las consultas son de lectura. Corte explícito en las métricas prospectivas.
BEGIN TRANSACTION READ ONLY;

-- sourceChain
with checks as (
select 'NHL' lane,p.id::text id,p.event_id event,p.created_at decision,p.scheduled_at tip,s.id::text source,s.captured_at receipt from nhl_free_predictions_v1 p left join nhl_free_source_v1 s on s.id=p.source_id
union all select 'NCAAB',p.id::text,p.event_id,p.created_at,p.scheduled_at,s.id::text,s.captured_at from ncaab_daily_predictions_v1 p left join ncaab_daily_source_v1 s on s.id=p.source_id
union all select 'UFC current',p.id::text,p.bout_id,p.captured_at,p.scheduled_at,s.id::text,s.captured_at from ufc_free_predictions_v1 p left join ufc_free_sources_v1 s on s.id=p.source_id
union all select 'UFC history',p.id::text,p.bout_id,p.captured_at,p.scheduled_at,s.id::text,s.captured_at from ufc_free_predictions_v1 p left join ufc_free_sources_v1 s on s.id=p.history_source_id
union all select p.sport,p.id::text,p.event_id,p.emitted_at,p.scheduled_at,s.id::text,s.captured_at from edge_lab_multi_forecasts_v1 p left join edge_lab_multi_sources_v1 s on s.id=p.source_id
union all select 'NFL',p.event_id,p.event_id,p.issued_at,p.start_at,s.id::text,s.observed_at from free_sports_forecasts_v1 p left join free_sports_runs_v1 s on s.id=p.run_id where p.league='NFL')
select lane,count(*) records,count(distinct event) events,count(*) filter(where source is null) missing_source,count(*) filter(where receipt>decision) later_receipt,count(*) filter(where decision>=tip) non_pregame,count(*) filter(where receipt>=tip) non_pregame_source,max(extract(epoch from(receipt-decision))) max_receipt_minus_issue_seconds from checks group by 1 order by 1;

-- outcomeProvenance
with checks as(
select 'NHL' lane,o.id::text id,o.observed_at decision,s.id::text source,s.captured_at receipt from nhl_free_outcomes_v1 o left join nhl_free_source_v1 s on s.id=o.source_id
union all select 'NCAAB',o.id::text,o.observed_at,s.id::text,s.captured_at from ncaab_daily_outcomes_v1 o left join ncaab_daily_source_v1 s on s.id=o.source_id
union all select 'UFC',o.id::text,o.captured_at,s.id::text,s.captured_at from ufc_free_results_v1 o left join ufc_free_sources_v1 s on s.id=o.source_id
union all select 'NFL',o.event_id,o.observed_at,s.id::text,s.observed_at from free_sports_results_v1 o left join free_sports_runs_v1 s on s.id=o.run_id where o.league='NFL'
) select lane,count(*) records,count(*) filter(where source is null) missing_source,count(*) filter(where receipt>decision) later_receipt from checks group by 1;

-- ncaabImport
select s.source_url,s.captured_at,min(p.created_at) first_issued,max(p.created_at) last_issued,count(*) rows,jsonb_object_keys(s.body) evidence_key from ncaab_daily_predictions_v1 p join ncaab_daily_source_v1 s on s.id=p.source_id where s.captured_at>p.created_at group by 1,2,s.body;

-- soccerRecheck
select f.market,count(*) observed,count(*) filter(where f.payload#>>'{evidence,history_latest}' is null) missing_last_history,count(*) filter(where (f.payload#>>'{evidence,history_latest}')::date>= (f.scheduled_at at time zone 'Europe/Madrid')::date) nonprior_history,count(o.id) settled,count(*) filter(where o.id is not null and (o.payload#>>'{final,id}' is distinct from f.event_id or o.payload#>>'{final,home_id}' is distinct from f.payload->>'home_id' or o.payload#>>'{final,away_id}' is distinct from f.payload->>'away_id')) identity_disagreements,count(*) filter(where o.id is not null and o.checked_at<=f.scheduled_at) early_results from edge_lab_forecasts_v1 f left join edge_lab_outcomes_v1 o on o.forecast_id=f.id group by 1;

-- ncaafDisputeCause
select f.sport,o.status,o.payload->>'reason' reason,count(*) outcome_rows,count(distinct f.event_id) events from edge_lab_multi_outcomes_v1 o join edge_lab_multi_forecasts_v1 f on f.id=o.forecast_id where o.status='DISPUTE' group by 1,2,3;

-- soccerGrading
with scores as(select f.market,f.selection,o.status,(o.payload#>>'{final,home_score}')::int h,(o.payload#>>'{final,away_score}')::int a from edge_lab_forecasts_v1 f join edge_lab_outcomes_v1 o on o.forecast_id=f.id), graded as(select *,case when h is null or a is null then null when market='1X2' then case when h>a then 'HOME' when h<a then 'AWAY' else 'DRAW' end when market='TOTAL_2_5' then case when h+a>2.5 then 'OVER' else 'UNDER' end end actual from scores) select market,count(*) as receipts,count(*) filter(where actual is null or status is distinct from case when selection=actual then 'W' else 'L' end) as grade_disagreements from graded group by 1;

-- collegeGrading
with scores as(select f.event_id,f.selection,f.market,f.projection,o.status,o.actual,o.absolute_error,(o.payload#>>'{final,home_score}')::numeric h,(o.payload#>>'{final,away_score}')::numeric a from edge_lab_multi_forecasts_v1 f join edge_lab_multi_outcomes_v1 o on o.forecast_id=f.id where f.sport='NCAAF' and o.status<>'DISPUTE'),actuals as(select *,case market when 'POINT_MARGIN' then h-a when 'TOTAL_POINTS' then h+a end score,case when h>a then 'HOME' when h<a then 'AWAY' end winner from scores) select market,count(*) receipts,count(distinct event_id) games,count(*) filter(where h is null or a is null or case when market='MONEYLINE' then winner is null or status is distinct from case when winner=selection then 'W' else 'L' end else actual is distinct from score or absolute_error is null or abs(abs(score-projection)-absolute_error)>.001 end) grade_disagreements from actuals group by 1;

-- ttShape
with f as(select distinct on(f.event_id) f.event_id,o.payload->'final' box from edge_lab_multi_forecasts_v1 f join edge_lab_multi_outcomes_v1 o on o.forecast_id=f.id where f.sport='TT' order by f.event_id) select box->>'source' source, jsonb_typeof(box->'setPoints') sets_type,count(*) n,min(event_id) example,min(jsonb_array_length(box->'setPoints')) min_sets,max(jsonb_array_length(box->'setPoints')) max_sets,min(jsonb_object_keys::text) keys from f cross join lateral (select array_agg(k order by k) jsonb_object_keys from jsonb_object_keys(f.box)k) keys group by 1,2;

-- ttDetailedRegrade
with scores as (select f.event_id,f.market,f.selection,f.projection,o.actual,o.status,o.absolute_error,o.payload->>'actual_label' label,o.payload->'final' box from edge_lab_multi_forecasts_v1 f join edge_lab_multi_outcomes_v1 o on o.forecast_id=f.id where f.sport='TT'),sets as(select s.*,v.points,v.set_a,v.set_b from scores s cross join lateral (select sum((arr->>0)::int+(arr->>1)::int) points,count(*) filter(where (arr->>0)::int>(arr->>1)::int) set_a,count(*) filter(where (arr->>1)::int>(arr->>0)::int) set_b from jsonb_array_elements(s.box->'setPoints') arr)v) select market,count(*) receipts,count(distinct event_id) games,count(*) filter(where points is null) no_set_breakdown,count(*) filter(where points is not null and (points is distinct from (box->>'totalPoints')::int or set_a is distinct from (box->>'setsA')::int or set_b is distinct from (box->>'setsB')::int)) box_disagreements,count(*) filter(where points is not null and case when market='TOTAL_POINTS' then actual is distinct from points or absolute_error is null or abs(abs(points-projection)-absolute_error)>.001 when market='SETS_ODD_EVEN' then label is distinct from case when (set_a+set_b)%2=1 then 'ODD' else 'EVEN' end or status is distinct from case when selection=label then 'W' else 'L' end else status is distinct from case when selection=label then 'W' else 'L' end end) grade_disagreements from sets group by 1;

-- ttManual
with samples as(select f.market,f.selection,f.projection,o.status,o.actual,o.absolute_error,o.payload->>'actual_label' label,(o.payload#>>'{final,totalPoints}')::int points,(o.payload#>>'{final,setsA}')::int a,(o.payload#>>'{final,setsB}')::int b from edge_lab_multi_forecasts_v1 f join edge_lab_multi_outcomes_v1 o on o.forecast_id=f.id where f.sport='TT' and o.payload#>>'{final,source}'='public_web_manual_reconciliation') select market,count(*) receipts,count(*) filter(where case when market='TOTAL_POINTS' then points is null or actual is distinct from points or abs(abs(points-projection)-absolute_error)>.001 when market='SETS_ODD_EVEN' then label is distinct from case when(a+b)%2=1 then 'ODD' else 'EVEN' end or status is distinct from case when selection=label then 'W' else 'L' end else label is distinct from case when a>b then 'A' else 'B' end or status is distinct from case when selection=label then 'W' else 'L' end end) summary_disagreements from samples group by 1;

-- prospectiveMetrics
with identified as (
 select 'NHL DRatings' as model,p.event_id,p.created_at issued,p.id::text id,(p.body->>'homeProbability')::numeric probability,
 ((o.body->>'homeScore')::int>(o.body->>'awayScore')::int)::int actual,
 case when (p.body->>'homeProbability')::numeric>.5 then p.body->>'homeId' when (p.body->>'homeProbability')::numeric<.5 then p.body->>'awayId' end pick,
 case when (o.body->>'homeScore')::int>(o.body->>'awayScore')::int then o.body->>'homeId' else o.body->>'awayId' end winner
 from nhl_free_predictions_v1 p join nhl_free_outcomes_v1 o using(event_id)
 where p.created_at<p.scheduled_at and o.observed_at>p.scheduled_at and o.observed_at<='2026-11-20 23:15Z'
 and p.body->>'homeId'=o.body->>'homeId' and p.body->>'awayId'=o.body->>'awayId' and (o.body->>'homeScore')::int<>(o.body->>'awayScore')::int
 union all
 select 'UFC Elo earliest',p.bout_id,p.captured_at,p.id::text,(p.body->>'probabilityA')::numeric,(p.body#>>'{bout,aId}'=r.body->>'winnerId')::int,p.body->>'selectedId',r.body->>'winnerId'
 from ufc_free_predictions_v1 p join ufc_free_results_v1 r using(bout_id) where p.captured_at<p.scheduled_at and r.captured_at>p.scheduled_at and r.captured_at<='2026-11-20 23:15Z'
 and r.body->>'winnerId' in(p.body#>>'{bout,aId}',p.body#>>'{bout,bId}') and r.body->>'status'='FINAL'
 union all
 select 'NFL free',p.event_id,p.issued_at,p.event_id,(p.forecast->>'probabilityA')::numeric,(p.forecast#>>'{event,a,id}'=r.outcome)::int,p.forecast->>'selectedId',r.outcome
 from free_sports_forecasts_v1 p join free_sports_results_v1 r using(league,event_id) where p.league='NFL' and p.issued_at<p.start_at and r.observed_at>p.start_at and r.observed_at<='2026-11-20 23:15Z'
 and r.outcome in (p.forecast#>>'{event,a,id}',p.forecast#>>'{event,b,id}')
 union all
 select 'NCAAB preseason',p.event_id,p.created_at,p.id::text,(p.body->>'home_win_probability')::numeric,(w.winner=p.body->>'home_id')::int,p.body->>'predicted_winner',w.winner
 from ncaab_daily_predictions_v1 p join ncaab_daily_outcomes_v1 o using(event_id)
 cross join lateral (select case when (o.body->>'home_score')::int>(o.body->>'away_score')::int then o.body->>'home_id' else o.body->>'away_id' end winner) w
 where p.created_at<least(p.scheduled_at,(o.body->>'scheduled_at')::timestamptz) and o.observed_at>(o.body->>'scheduled_at')::timestamptz and o.observed_at<='2026-11-20 23:15Z'
 and abs(extract(epoch from(p.scheduled_at-(o.body->>'scheduled_at')::timestamptz)))<=7200 and o.body->>'status'='FINAL' and (o.body->>'home_score')::int<>(o.body->>'away_score')::int
 and array[p.body->>'home_id',p.body->>'away_id'] @> array[o.body->>'home_id',o.body->>'away_id'] and p.body->>'state'='FORECAST'
), first_emission as (select distinct on(model,event_id) * from identified where probability between 0 and 1 and pick is not null order by model,event_id,issued,id)
select model,count(*) independent_events,count(*) filter(where pick=winner) correct,round(avg((pick=winner)::int),4) hit_rate,round(avg(power(probability-actual,2)),4) brier,round(avg(probability),4) mean_side_probability,round(avg(actual),4) observed_side_frequency from first_emission group by 1 order by 1;

-- reliabilityBins
with identified as (
 select 'NHL DRatings' as model,p.event_id,p.created_at issued,p.id::text id,(p.body->>'homeProbability')::numeric probability,
 ((o.body->>'homeScore')::int>(o.body->>'awayScore')::int)::int actual,
 case when (p.body->>'homeProbability')::numeric>.5 then p.body->>'homeId' when (p.body->>'homeProbability')::numeric<.5 then p.body->>'awayId' end pick,
 case when (o.body->>'homeScore')::int>(o.body->>'awayScore')::int then o.body->>'homeId' else o.body->>'awayId' end winner
 from nhl_free_predictions_v1 p join nhl_free_outcomes_v1 o using(event_id)
 where p.created_at<p.scheduled_at and o.observed_at>p.scheduled_at and o.observed_at<='2026-11-20 23:15Z'
 and p.body->>'homeId'=o.body->>'homeId' and p.body->>'awayId'=o.body->>'awayId' and (o.body->>'homeScore')::int<>(o.body->>'awayScore')::int
 union all
 select 'UFC Elo earliest',p.bout_id,p.captured_at,p.id::text,(p.body->>'probabilityA')::numeric,(p.body#>>'{bout,aId}'=r.body->>'winnerId')::int,p.body->>'selectedId',r.body->>'winnerId'
 from ufc_free_predictions_v1 p join ufc_free_results_v1 r using(bout_id) where p.captured_at<p.scheduled_at and r.captured_at>p.scheduled_at and r.captured_at<='2026-11-20 23:15Z'
 and r.body->>'winnerId' in(p.body#>>'{bout,aId}',p.body#>>'{bout,bId}') and r.body->>'status'='FINAL'
 union all
 select 'NFL free',p.event_id,p.issued_at,p.event_id,(p.forecast->>'probabilityA')::numeric,(p.forecast#>>'{event,a,id}'=r.outcome)::int,p.forecast->>'selectedId',r.outcome
 from free_sports_forecasts_v1 p join free_sports_results_v1 r using(league,event_id) where p.league='NFL' and p.issued_at<p.start_at and r.observed_at>p.start_at and r.observed_at<='2026-11-20 23:15Z'
 and r.outcome in (p.forecast#>>'{event,a,id}',p.forecast#>>'{event,b,id}')
 union all
 select 'NCAAB preseason',p.event_id,p.created_at,p.id::text,(p.body->>'home_win_probability')::numeric,(w.winner=p.body->>'home_id')::int,p.body->>'predicted_winner',w.winner
 from ncaab_daily_predictions_v1 p join ncaab_daily_outcomes_v1 o using(event_id)
 cross join lateral (select case when (o.body->>'home_score')::int>(o.body->>'away_score')::int then o.body->>'home_id' else o.body->>'away_id' end winner) w
 where p.created_at<least(p.scheduled_at,(o.body->>'scheduled_at')::timestamptz) and o.observed_at>(o.body->>'scheduled_at')::timestamptz and o.observed_at<='2026-11-20 23:15Z'
 and abs(extract(epoch from(p.scheduled_at-(o.body->>'scheduled_at')::timestamptz)))<=7200 and o.body->>'status'='FINAL' and (o.body->>'home_score')::int<>(o.body->>'away_score')::int
 and array[p.body->>'home_id',p.body->>'away_id'] @> array[o.body->>'home_id',o.body->>'away_id'] and p.body->>'state'='FORECAST'
), first_emission as (select distinct on(model,event_id) * from identified where probability between 0 and 1 and pick is not null order by model,event_id,issued,id)
select model,least(4,floor(probability*5))::int bin_0_to_4,count(*) independent_events,round(avg(probability),3) mean_probability,round(avg(actual),3) observed_frequency from first_emission group by 1,2 order by 1,2;

-- marketMae
select f.sport,f.market,count(distinct f.event_id) events,count(o.absolute_error) observations,round(avg(o.absolute_error)::numeric,3) mae from edge_lab_multi_forecasts_v1 f join edge_lab_multi_outcomes_v1 o on o.forecast_id=f.id where o.status='NUMERIC' and o.checked_at<='2026-11-20 23:15Z' and f.emitted_at<f.scheduled_at group by 1,2 order by 1,2;

-- Original Git por evento: comparar el JSON en páginas de diez con el objeto Git indicado en el informe.
select p.event_id,p.body from ncaab_daily_predictions_v1 p join ncaab_daily_source_v1 s on s.id=p.source_id where s.captured_at>p.created_at order by p.event_id;

-- Control de la orientación de jugadores en los recibos con desglose de sets.
select f.event_id,f.participant_a as a,f.participant_b as b,(o.payload#>>'{final,playerA}') as source_a,(o.payload#>>'{final,playerB}') as source_b,(o.payload#>>'{final,setsA}')::int as sets_a,(o.payload#>>'{final,setsB}')::int as sets_b,o.payload->>'actual_label' label from edge_lab_multi_forecasts_v1 f join edge_lab_multi_outcomes_v1 o on o.forecast_id=f.id where f.sport='TT' and f.market='MONEYLINE' and o.payload#>>'{final,source}'='pulsescore:tipsport' order by f.event_id;

ROLLBACK;
