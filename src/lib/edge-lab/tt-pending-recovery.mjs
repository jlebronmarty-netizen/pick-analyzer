import {ttOutcome} from './multisport.mjs';
import {playerKey} from './engines.mjs';
const supported=name=>typeof name==='string'&&name===name.trim()&&name.length>=3&&name.length<=100&&/[\p{L}]/u.test(name)&&/^[-\p{L}\p{M} .,'’()]+$/u.test(name);
export function providerPlayerName(name,finals){
 const key=playerKey(name);const candidates=finals.flatMap(r=>[r.playerA,r.playerB]).filter(n=>supported(n)&&playerKey(n)===key);
 return candidates[0]??name;
}
// One lookup per cycle, grouped by original event, never chosen using the outcome.
// Cursor is persisted in the existing run ledger; original forecasts are not mutated.
export function planTtRecovery(forecasts,outcomes,finals,runs,now=new Date()){
 const done=new Set(outcomes.map(o=>o.forecast_id)),events=new Map(),skipped=[];
 for(const f of forecasts){
  if(f.sport!=='TT'||!['FORECAST','PROJECTION'].includes(f.status)||done.has(f.id)||!Number.isFinite(Date.parse(f.scheduled_at))||Date.parse(f.scheduled_at)>now.getTime()-3600000)continue;
  if(ttOutcome(f,finals).status!=='PENDING')continue;
  const existing=events.get(f.event_id);if(existing&&(existing.participant_a!==f.participant_a||existing.participant_b!==f.participant_b||Date.parse(existing.scheduled_at)!==Date.parse(f.scheduled_at)))throw Error('RECOVERY_CONTRACT_CONFLICT');
  if(!existing)events.set(f.event_id,f);
 }
 const attempts=runs.filter(r=>r.sport==='TT').flatMap(r=>{
  const list=Array.isArray(r.summary?.recoveries)?r.summary.recoveries:r.summary?.recovery?[r.summary.recovery]:[];
  return list.filter(x=>x?.event_id).map(recovery=>({started_at:r.started_at,summary:{recovery}}));
 }).sort((a,b)=>b.started_at.localeCompare(a.started_at));
 const candidates=[];for(const [event_id,f] of events){
  const latest=attempts.find(r=>r.summary.recovery.event_id===event_id),previous=latest?.summary.recovery;
  let side=previous?.next_side==='B'?'B':'A',page=Number.isInteger(previous?.next_page)&&previous.next_page>=1&&previous.next_page<=100?previous.next_page:1;
  let participant=side==='A'?f.participant_a:f.participant_b,team=providerPlayerName(participant,finals);
  if(!supported(team)){side=side==='A'?'B':'A';participant=side==='A'?f.participant_a:f.participant_b;team=providerPlayerName(participant,finals);page=1;}
  if(!supported(team)){skipped.push({event_id,reason:'RECOVERY_NAME_UNSUPPORTED'});continue;}
  candidates.push({event_id,team,participant_name:participant,page,side,scheduled_at:f.scheduled_at,previous_attempt_at:latest?.started_at??null});
 }
 candidates.sort((a,b)=>(a.previous_attempt_at??'').localeCompare(b.previous_attempt_at??'')||a.scheduled_at.localeCompare(b.scheduled_at)||a.event_id.localeCompare(b.event_id));
 return {target:candidates[0]??null,targets:candidates.slice(0,2),backlog_events:events.size,skipped};
}
export function recoveryCursor(target,coverage){
 const advance=coverage?.verified===true&&coverage.hasNextPage===true&&target.page<100;
 return {next_page:advance?target.page+1:1,next_side:advance?target.side:target.side==='A'?'B':'A',page_ceiling_reached:coverage?.hasNextPage===true&&target.page===100,search_exhausted:coverage?.verified===true&&coverage.hasNextPage===false};
}
