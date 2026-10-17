-- Evidence jobs must be imported first from the archived verified responses.
-- One atomic data repair, guarded against a changed cohort. No frozen fields updated.
begin;
select pg_advisory_xact_lock(20261017,751);
do $guard$ begin
  if (select count(*) from public.mlb_2026_forward_master_ledger_v1 where result is null) <> 75 then raise exception 'OPEN_COHORT_CHANGED'; end if;
  if (select md5(string_agg((to_jsonb(m)-array['result','actual_value','actual_label','settled_at','metadata','updated_at'])::text,'|' order by id)) from public.mlb_2026_forward_master_ledger_v1 m) <> 'dbfa3ea318bcf303da153dc3697d2c49' then raise exception 'FROZEN_COHORT_CHANGED'; end if;
  if (select md5(string_agg(to_jsonb(m)::text,'|' order by id)) from public.mlb_2026_forward_master_ledger_v1 m where result is not null) <> '2b32ad0f0796d1ed6076a2911d61cc84' then raise exception 'SETTLED_COHORT_CHANGED'; end if;
end $guard$;

with proof as (
 select distinct on ((metadata->'evidence'->>'gamePk')::bigint)
   (metadata->'evidence'->>'gamePk')::bigint game_pk,metadata->'evidence' e
 from public.sports_sync_jobs where job_type='mlb_pending_outcome_evidence_v1' and status='completed'
   and metadata->'evidence'->>'version'='MLB_PENDING_OUTCOME_EVIDENCE_V1'
 order by (metadata->'evidence'->>'gamePk')::bigint, metadata->'evidence'->>'capturedAt' desc
), diagnostics as (
 select s.id,e,
   case
    when e->>'statusCode' like 'D%' or e->>'detailedState' ~* 'postponed|cancelled' then 'POSTPONED_CONTRACT_REVIEW'
    when e->>'officialDate' <> s.tracking_date::text then 'OFFICIAL_DATE_MISMATCH_REVIEW'
    when e->>'final' <> 'true' then 'WAITING_FOR_OFFICIAL_FINAL'
    when not (e->'players' ? s.player_mlbam_id::text) then 'PLAYER_NOT_IN_FINAL_BOXSCORE_CONTRACT_REVIEW'
    when e->'players'->s.player_mlbam_id::text->>'plateAppearances'='0' then 'ZERO_PA_CONTRACT_REVIEW'
    when e->'players'->s.player_mlbam_id::text->>'plateAppearances' is null then 'NO_BATTING_PARTICIPATION_CONTRACT_REVIEW'
    else 'EXACT_OUTCOME_NOT_AVAILABLE'
   end blocker
 from public.mlb_approved_prop_settlement_v1 s join proof p using(game_pk)
 join public.mlb_2026_forward_master_ledger_v1 m on m.source_row_id=s.approved_prop_daily_id
   and m.source_relation='mlb_approved_prop_daily_v1' and m.result is null
 where s.result is null and s.tracking_date=m.target_date and s.player_mlbam_id=m.player_mlbam_id
)
update public.mlb_approved_prop_settlement_v1 s set actual_value=null,actual_label=null,settled_at=null,
 blocker=d.blocker,outcome_source_identity=s.outcome_source_identity||jsonb_build_object('pendingEvidence',
 jsonb_build_object('gamePk',d.e->'gamePk','capturedAt',d.e->'capturedAt','officialDate',d.e->'officialDate',
 'statusCode',d.e->'statusCode','detailedState',d.e->'detailedState','scheduleSha256',d.e->'scheduleSha256',
 'boxscoreSha256',d.e->'boxscoreSha256','player',d.e->'players'->s.player_mlbam_id::text,'contractRuleCertified',false)),updated_at=now()
from diagnostics d where s.id=d.id and s.result is null;

update public.mlb_2026_forward_master_ledger_v1 m set actual_value=null,actual_label=null,settled_at=null,
 metadata=jsonb_set(m.metadata,'{settlement}',to_jsonb(s)),updated_at=now()
from public.mlb_approved_prop_settlement_v1 s where m.source_row_id=s.approved_prop_daily_id
 and m.source_relation='mlb_approved_prop_daily_v1' and m.result is null and s.result is null;

with proof as (
 select metadata->'evidence' e from public.sports_sync_jobs where job_type='mlb_pending_outcome_evidence_v1'
 and status='completed' and metadata->'evidence'->>'gamePk'='849811'
 order by metadata->'evidence'->>'capturedAt' desc limit 1
)
update public.mlb_2026_forward_master_ledger_v1 m set result='WIN',actual_value=4,
 actual_label='AWAY +4; final MIL 6–2 LAD',settled_at=(p.e->>'capturedAt')::timestamptz,
 metadata=jsonb_set(m.metadata,'{settlement}',jsonb_build_object('blocker',null,'outcomeSource','MLB_PENDING_OUTCOME_EVIDENCE_V1','evidence',p.e)),updated_at=now()
from proof p where m.id in ('mlb26fwd_0cc4f4a9442b715f9a93dc3d80b01b1650b9e919','mlb26fwd_90815942da6420591fae949db9c51ba831baabeb')
 and m.result is null and m.game_pk=849811 and m.direction='DOG_PLUS_1P5' and m.line=1.5 and m.selection='MIL'
 and m.freeze_timestamp='2026-10-14T14:46:18.742Z' and m.target_date='2026-10-14'
 and p.e->>'final'='true' and p.e->>'officialDate'='2026-10-14'
 and p.e->>'homeTeam'='LAD' and p.e->>'awayTeam'='MIL' and p.e->>'homeScore'='2' and p.e->>'awayScore'='6';

do $verify$ begin
 if (select count(*) from public.mlb_2026_forward_master_ledger_v1 where result is null) <> 73 then raise exception 'UNEXPECTED_OPEN_COUNT'; end if;
 if (select count(*) from public.mlb_approved_prop_settlement_v1 where result is null and blocker in ('NO_BATTING_PARTICIPATION_CONTRACT_REVIEW','ZERO_PA_CONTRACT_REVIEW','POSTPONED_CONTRACT_REVIEW')) <> 73 then raise exception 'UNEXPECTED_DIAGNOSTIC_COUNT'; end if;
 if (select md5(string_agg(to_jsonb(o)::text,'|' order by id)) from public.pick2_mlb_official_picks o) <> '0e404e3b9e1b8975c7829bcd7f6193bc' then raise exception 'OFFICIAL_HISTORY_CHANGED'; end if;
 if (select md5(string_agg(to_jsonb(d)::text,'|' order by id)) from public.mlb_approved_prop_daily_v1 d) <> '4a3665d7accb79016749a64243ac20d4' then raise exception 'PROP_PREDICTIONS_CHANGED'; end if;
 if (select md5(string_agg(to_jsonb(s)::text,'|' order by id)) from public.mlb_approved_prop_settlement_v1 s where result is not null) <> '1d8a40b9792944f0c955714d766094b2' then raise exception 'PROP_SETTLEMENTS_CHANGED'; end if;
end $verify$;
commit;
