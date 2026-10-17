import fs from 'node:fs';
import crypto from 'node:crypto';
import {parsePendingOfficialEvidence,pendingPropBlocker,standardRunlineOutcome} from '../../src/lib/mlb-pending-outcome.ts';
const dir='research/mlb-open-repair-20261017';
const rows=JSON.parse(fs.readFileSync(`${dir}/pending-before.json`));
const baseline=JSON.parse(fs.readFileSync(`${dir}/baseline.json`));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const calls=fs.readFileSync(`${dir}/provider-calls.jsonl`,'utf8').trim().split('\n').map(JSON.parse);
const evidence=[];
for(const gamePk of [...new Set(rows.map(r=>r.game_pk))].sort((a,b)=>a-b)){
  const read=kind=>{
    const bytes=fs.readFileSync(`${dir}/raw/${gamePk}-${kind}.json`);
    const recorded=calls.find(r=>r.gamePk===gamePk&&r.kind===kind&&r.sha256);
    if(!recorded || recorded.sha256!==sha(bytes)) throw Error('RAW_HASH_MISMATCH');
    return {bytes,recorded};
  };
  const s=read('schedule'),b=read('boxscore');
  evidence.push(parsePendingOfficialEvidence(gamePk,JSON.parse(s.bytes),JSON.parse(b.bytes),{
    capturedAt:[s.recorded.capturedAt,b.recorded.capturedAt].sort().at(-1),scheduleSha256:sha(s.bytes),boxscoreSha256:sha(b.bytes)}));
}
const byGame=new Map(evidence.map(e=>[e.gamePk,e]));
const decisions=rows.map(r=>{
  const e=byGame.get(r.game_pk);
  if(r.market==='run_line'){
    if(r.game_pk!==849811 || r.selection!=='MIL' || Number(r.line)!==1.5 || r.direction!=='DOG_PLUS_1P5')throw Error('UNEXPECTED_RUNLINE');
    const outcome=standardRunlineOutcome(e,{gamePk:r.game_pk,targetDate:r.target_date,homeTeam:'LAD',awayTeam:'MIL',dogSide:'AWAY'});
    if(!outcome)throw Error('UNRESOLVED_RUNLINE');
    return {...r,outcome};
  }
  return {...r,blocker:pendingPropBlocker(e,r.player_mlbam_id,r.target_date),pendingEvidence:{gamePk:e.gamePk,capturedAt:e.capturedAt,
    officialDate:e.officialDate,statusCode:e.statusCode,detailedState:e.detailedState,scheduleSha256:e.scheduleSha256,boxscoreSha256:e.boxscoreSha256,
    player:e.players[String(r.player_mlbam_id)]??null,contractRuleCertified:false}};
});
fs.writeFileSync(`${dir}/evidence.json`,JSON.stringify(evidence,null,2)+'\n');
fs.writeFileSync(`${dir}/decisions.json`,JSON.stringify(decisions,null,2)+'\n');
const q=s=>"'"+String(s).replaceAll("'","''")+"'";
const j=v=>q(JSON.stringify(v))+'::jsonb';
const statements=['begin;','select pg_advisory_xact_lock(20261017,751);',`do $repair$ begin
if (select count(*) from public.mlb_2026_forward_master_ledger_v1 where result is null) <> 75 then raise exception 'OPEN_COHORT_CHANGED'; end if;
if (select md5(string_agg((to_jsonb(m)-array['result','actual_value','actual_label','settled_at','metadata','updated_at'])::text,'|' order by id)) from public.mlb_2026_forward_master_ledger_v1 m) <> ${q(baseline.masterFrozen)} then raise exception 'FROZEN_COHORT_CHANGED'; end if;
if (select md5(string_agg(to_jsonb(m)::text,'|' order by id)) from public.mlb_2026_forward_master_ledger_v1 m where result is not null) <> ${q(baseline.masterSettled)} then raise exception 'SETTLED_COHORT_CHANGED'; end if;
end $repair$;`];
for(const e of evidence){
  const d=sha(`mlb_pending_outcome_evidence_v1:${e.gamePk}:${e.capturedAt.slice(0,10)}`).slice(0,32);
  const id=`${d.slice(0,8)}-${d.slice(8,12)}-${d.slice(12,16)}-${d.slice(16,20)}-${d.slice(20)}`;
  statements.push(`insert into public.sports_sync_jobs(id,job_type,sport_key,league_key,provider,season,status,started_at,completed_at,records_fetched,metadata,updated_at) values (${q(id)},'mlb_pending_outcome_evidence_v1','baseball_mlb','mlb','mlb_official','2026','completed',${q(e.capturedAt)},${q(e.capturedAt)},1,${j({gamePk:e.gamePk,evidence:e,providerCalls:2,paidCredits:0,requestBudget:2,researchOnly:true,officialPicksModified:false})},now()) on conflict(id) do nothing;`);
}
for(const d of decisions){
 if(d.blocker){
  statements.push(`update public.mlb_approved_prop_settlement_v1 set actual_value=null,actual_label=null,settled_at=null,blocker=${q(d.blocker)},outcome_source_identity=outcome_source_identity||${j({pendingEvidence:d.pendingEvidence})},updated_at=now() where approved_prop_daily_id=${q(d.source_row_id)} and game_pk=${d.game_pk} and player_mlbam_id=${d.player_mlbam_id} and result is null;`);
  statements.push(`update public.mlb_2026_forward_master_ledger_v1 m set actual_value=null,actual_label=null,settled_at=null,metadata=jsonb_set(m.metadata,'{settlement}',to_jsonb(s)),updated_at=now() from public.mlb_approved_prop_settlement_v1 s where m.id=${q(d.id)} and m.result is null and s.approved_prop_daily_id=m.source_row_id and s.result is null;`);
 }else{
  const o=d.outcome,e=byGame.get(d.game_pk);
  statements.push(`update public.mlb_2026_forward_master_ledger_v1 set result=${q(o.result)},actual_value=${o.actualValue},actual_label=${q(o.actualLabel)},settled_at=${q(o.settledAt)},metadata=jsonb_set(metadata,'{settlement}',${j({blocker:null,outcomeSource:'MLB_PENDING_OUTCOME_EVIDENCE_V1',evidence:e})}),updated_at=now() where id=${q(d.id)} and game_pk=${d.game_pk} and result is null and source_row_id=${q(d.source_row_id)} and freeze_timestamp='2026-10-14T14:46:18.742Z';`);
 }
}
statements.push(`do $verify$ begin
if (select count(*) from public.mlb_2026_forward_master_ledger_v1 where result is null) <> 73 then raise exception 'UNEXPECTED_OPEN_COUNT'; end if;
if (select md5(string_agg(to_jsonb(o)::text,'|' order by id)) from public.pick2_mlb_official_picks o) <> ${q(baseline.official)} then raise exception 'OFFICIAL_HISTORY_CHANGED'; end if;
if (select md5(string_agg(to_jsonb(d)::text,'|' order by id)) from public.mlb_approved_prop_daily_v1 d) <> ${q(baseline.dailyFrozen)} then raise exception 'PROP_PREDICTIONS_CHANGED'; end if;
end $verify$;`,'commit;');
fs.writeFileSync(`${dir}/repair.sql`,statements.join('\n')+'\n');
console.log(JSON.stringify({games:evidence.length,observations:decisions.length,counts:decisions.reduce((m,d)=>{const k=d.blocker??d.outcome.result;m[k]=(m[k]??0)+1;return m},{}),providerCalls:calls.filter(c=>!c.reused).length}));
