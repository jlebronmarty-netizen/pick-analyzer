begin;
select pg_advisory_xact_lock(20261017,731);
do $guard$ begin
 if (select count(*) from public.mlb_2026_forward_master_ledger_v1 where result is null)<>73 then raise exception 'OPEN_COHORT_CHANGED'; end if;
 if (select md5(string_agg((to_jsonb(m)-array['result','actual_value','actual_label','settled_at','metadata','updated_at'])::text,'|' order by id)) from public.mlb_2026_forward_master_ledger_v1 m)<>'dbfa3ea318bcf303da153dc3697d2c49' then raise exception 'FROZEN_COHORT_CHANGED'; end if;
 if (select md5(string_agg(to_jsonb(m)::text,'|' order by id)) from public.mlb_2026_forward_master_ledger_v1 m where result is not null)<>'507e791d92c1617c706c2c59ffe485f1' then raise exception 'PRIOR_SETTLEMENT_CHANGED'; end if;
 if (select sum(jsonb_array_length(metadata->'decisions')) from public.sports_sync_jobs where job_type='mlb_reviewed_no_action_v1' and metadata->>'policy'='MLB_REVIEWED_NO_ACTION_RESEARCH_V1')<>73 then raise exception 'REVIEW_INCOMPLETE'; end if;
end $guard$;
with reviewed as (
 select d,job.metadata->'sourceReferences' refs from public.sports_sync_jobs job cross join lateral jsonb_array_elements(job.metadata->'decisions') d
 where job.job_type='mlb_reviewed_no_action_v1' and job.status='completed' and job.metadata->>'policy'='MLB_REVIEWED_NO_ACTION_RESEARCH_V1'
)
update public.mlb_approved_prop_settlement_v1 s set result='VOID',actual_value=null,
 actual_label=case r.d->>'reason' when 'DID_NOT_START' then 'VOID condicional research: no inició.' when 'STARTED_ZERO_PA' then 'VOID condicional research: cero apariciones al plato.' else 'VOID condicional research: aplazado antes del inicio.' end || ' Regla pública US-MA; contrato original sin certificar.',
 settled_at=now(),blocker=null,outcome_source='MLB_REVIEWED_NO_ACTION_RESEARCH_V1',
 outcome_source_identity=s.outcome_source_identity||jsonb_build_object('reviewedNoAction',jsonb_build_object(
 'policy','MLB_REVIEWED_NO_ACTION_RESEARCH_V1','scope','CONDITIONAL_RESEARCH_ACCOUNTING_ONLY',
 'originalQuoteJurisdictionCertified',false,'actualBookSettlementCertified',false,
 'reason',r.d->'reason','proof',r.d->'proof','ruleReferences',r.refs,'blockerBeforeReview',s.blocker,'reviewedAt',now())),updated_at=now()
from reviewed r join public.mlb_2026_forward_master_ledger_v1 m on m.id=r.d->>'id'
where s.approved_prop_daily_id=r.d->>'source_row_id' and s.result is null and m.result is null
 and m.source_row_id=s.approved_prop_daily_id and m.source_relation='mlb_approved_prop_daily_v1'
 and m.game_pk=(r.d->>'game_pk')::bigint and m.player_mlbam_id=(r.d->>'player_mlbam_id')::bigint
 and s.game_pk=m.game_pk and s.player_mlbam_id=m.player_mlbam_id and m.sportsbook=r.d->>'sportsbook'
 and m.line=0.5 and m.direction='UNDER' and m.market in ('batter_doubles','batter_walks')
 and m.research_only=true and m.official_picks_eligible=false and m.apostar_enabled=false;

update public.mlb_2026_forward_master_ledger_v1 m set result='VOID',actual_value=null,
 actual_label=s.actual_label,settled_at=s.settled_at,metadata=jsonb_set(m.metadata,'{settlement}',to_jsonb(s)),updated_at=now()
from public.mlb_approved_prop_settlement_v1 s where m.result is null and m.source_relation='mlb_approved_prop_daily_v1'
 and m.source_row_id=s.approved_prop_daily_id and s.result='VOID' and s.outcome_source='MLB_REVIEWED_NO_ACTION_RESEARCH_V1';
do $verify$ begin
 if (select count(*) from public.mlb_2026_forward_master_ledger_v1 where result is null)<>0 then raise exception 'OPEN_REMAINS'; end if;
 if (select count(*) from public.mlb_approved_prop_settlement_v1 where outcome_source='MLB_REVIEWED_NO_ACTION_RESEARCH_V1' and result='VOID')<>73 then raise exception 'WRONG_DISPOSITION_COUNT'; end if;
 if (select md5(string_agg(to_jsonb(m)::text,'|' order by id)) from public.mlb_2026_forward_master_ledger_v1 m where result is not null and not coalesce(m.metadata->'settlement'->>'outcome_source'='MLB_REVIEWED_NO_ACTION_RESEARCH_V1',false))<>'507e791d92c1617c706c2c59ffe485f1' then raise exception 'PRIOR_MASTER_CHANGED'; end if;
 if (select md5(string_agg(to_jsonb(s)::text,'|' order by id)) from public.mlb_approved_prop_settlement_v1 s where result is not null and outcome_source<>'MLB_REVIEWED_NO_ACTION_RESEARCH_V1')<>'1d8a40b9792944f0c955714d766094b2' then raise exception 'PRIOR_PROP_SETTLEMENT_CHANGED'; end if;
 if (select md5(string_agg(to_jsonb(o)::text,'|' order by id)) from public.pick2_mlb_official_picks o)<>'0e404e3b9e1b8975c7829bcd7f6193bc' then raise exception 'OFFICIAL_CHANGED'; end if;
 if (select md5(string_agg(to_jsonb(d)::text,'|' order by id)) from public.mlb_approved_prop_daily_v1 d)<>'4a3665d7accb79016749a64243ac20d4' then raise exception 'PREDICTIONS_CHANGED'; end if;
end $verify$;
commit;
