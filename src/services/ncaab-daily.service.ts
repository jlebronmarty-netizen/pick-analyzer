import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {predictNcaab,reconcileNcaab,ncaabMetrics,type LiveObservation,type Schedule,type Final,NCAAB_MODEL} from '@/lib/ncaab-live';
import {getNcaabCheckpoint} from './ncaab-checkpoint-read.service';
import type {NcaabReport} from '@/lib/ncaab-checkpoint';
import profile from '@/data/ncaab-profile-2027.json' with {type:'json'};
const BASE='https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard';
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
async function db(){return (await import('@/lib/supabase-admin')).supabaseAdmin;}
async function readAll(table:string){const client=await db();const rows:Record<string,unknown>[]=[];let after='';for(;;){let q=client.from(table).select('*').order('id').limit(500).abortSignal(AbortSignal.timeout(20000));if(after)q=q.gt('id',after);const {data,error}=await q;if(error||!data)throw Error('NCAAB_DATABASE_READ_FAILED');rows.push(...data);if(data.length<500)break;after=String(data.at(-1)!.id);}return rows;}
// Existing immutable checkpoint remains independently available; live failure is explicit.
export async function getNcaabDailyReport():Promise<NcaabReport>{
 try{
  const client=await db();const [ps,os,latest]=await Promise.all([readAll('ncaab_daily_predictions_v1'),readAll('ncaab_daily_outcomes_v1'),client.from('ncaab_daily_runs_v1').select('status,completed_at,provider_calls,detail').neq('id','SEED_ORIGINAL_73').order('started_at',{ascending:false}).limit(1)]);
  if(latest.error)throw Error('NCAAB_RUN_READ_FAILED');
  if(!ps.length)return {status:'UNAVAILABLE',warning:'NCAAB: historial diario todavía no inicializado.'};
  const outcomes=new Map<string,Final[]>();for(const o of os){const a=outcomes.get(String(o.event_id))??[];a.push(o.body as Final);outcomes.set(String(o.event_id),a);}
  const rows=ps.map(p=>reconcileNcaab(p.body as LiveObservation,outcomes.get(String(p.event_id))??[]));const metrics=ncaabMetrics(rows);const checkpoint=getNcaabCheckpoint();if(checkpoint.status!=='AVAILABLE')throw Error('NCAAB_CHECKPOINT_INVALID');
  const last=latest.data?.[0];const detail=last?.detail as {abstentions?:LiveObservation[]}|undefined;
  const seen=new Set(rows.map(x=>x.event_id));const abstentions=(detail?.abstentions??[]).filter(x=>!seen.has(x.event_id));
  const lastCompleted=last?.completed_at as string|null;const stale=!lastCompleted||Date.now()-Date.parse(lastCompleted)>26*3600000;
  return {status:'AVAILABLE',data:{...checkpoint.data,connection:'DAILY_FREE_PIPELINE',continuousSync:true,hostedPipelineReady:true,generatedAt:lastCompleted??checkpoint.data.generatedAt,observations:[...rows,...abstentions].sort((a,b)=>Date.parse(a.scheduled_at)-Date.parse(b.scheduled_at)||a.event_id.localeCompare(b.event_id)),models:[{...metrics,abstentions:abstentions.length},{id:'NCAAB_FREE_SCORE_V1_1',forecasts:0,abstentions:0,settled:0,wins:0,losses:0,winnerDenominator:0,accuracy:null}],lastRun:{status:last?.status??'NOT_RUN',completedAt:lastCompleted??null,providerCalls:Number(last?.provider_calls??0)},warning:stale?'Proceso diario sin ejecución completada reciente; revisar estado.':last?.status!=='PASS'?'Última ejecución incompleta; historial preservado.':undefined}};
 }catch{return {status:'UNAVAILABLE',warning:'NCAAB: no se pudo leer el historial diario. No se sustituyen métricas por ceros.'};}
}
type EspnTeam={id:string;homeAway:string;score?:string;team:{displayName?:string}};
type EspnEvent={id:string;date:string;season?:{year:number;type:number};status:{type:{name:string;state:string;completed:boolean}};competitions:{date:string;timeValid?:boolean;neutralSite?:boolean;competitors:EspnTeam[];status?:EspnEvent['status']}[]};
export function normalizeNcaab(e:EspnEvent,capturedAt:string):{schedule:Schedule;final:Final|null}{
 const c=e.competitions?.[0];if(!c||!/^[0-9]+$/.test(e.id)||c.competitors.length!==2)throw Error('NCAAB_INVALID_SOURCE_IDENTITY');
 const h=c.competitors.find(t=>t.homeAway==='home'),a=c.competitors.find(t=>t.homeAway==='away');if(!h||!a||h.id===a.id)throw Error('NCAAB_INVALID_SOURCE_SIDES');
 const status=c.status??e.status,tip=c.date??e.date;
 const schedule:Schedule={event_id:'espn:'+e.id,home_id:h.id,away_id:a.id,home_name:h.team.displayName??null,away_name:a.team.displayName??null,scheduled_at:tip,season_ending_year:e.season?.year??0,phase:e.season?.type===2?'REGULAR':'OTHER',time_verified:c.timeValid===true,neutral_site:typeof c.neutralSite==='boolean'?c.neutralSite:null,status:status.type.state==='pre'&&status.type.name==='STATUS_SCHEDULED'?'SCHEDULED':status.type.name,captured_at:capturedAt};
 const final=status.type.completed&&status.type.name==='STATUS_FINAL'&&/^\d+$/.test(h.score??'')&&/^\d+$/.test(a.score??'')?{event_id:schedule.event_id,home_id:h.id,away_id:a.id,scheduled_at:tip,home_score:Number(h.score),away_score:Number(a.score),captured_at:capturedAt,status:'FINAL'}:null;
 return {schedule,final};
}
export async function runNcaabDaily(){
 if(hash(profile)!=='0d503f8cb03e6782186b6b32a0d95267ec788214c9f333a9b9aec31f1052bd40')throw Error('NCAAB_FROZEN_PROFILE_MISMATCH');
 const client=await db(),id=randomUUID(),slot='NCAAB:'+Math.floor(Date.now()/900000);
 const {data:claimed,error:claimError}=await client.rpc('ncaab_daily_claim_v1',{run_id:id});if(claimError)throw Error('NCAAB_LOCK_FAILED');if(!claimed)return {status:'BUSY',providerCalls:0};
 let calls=0;const abstentions:LiveObservation[]=[];let forecasts=0,outcomes=0;const started=Date.now();
 try{
  const prior=await client.from('ncaab_daily_runs_v1').select('id').eq('id',slot).maybeSingle();if(prior.error)throw Error('NCAAB_DUPLICATE_GUARD_FAILED');if(prior.data)return {status:'REUSED_SLOT',providerCalls:0};
  const denied=await client.from('ncaab_daily_runs_v1').select('id').eq('status','ACCESS_DENIED').limit(1);if(denied.error)throw Error('NCAAB_DENIAL_GUARD_FAILED');if(denied.data?.length)return {status:'BLOCKED_ACCESS_DENIED_REVIEW',providerCalls:0};
  const begin=await client.from('ncaab_daily_runs_v1').insert({id:slot,status:'RUNNING'});if(begin.error)throw Error('NCAAB_RUN_CREATE_FAILED');
  const original=await readAll('ncaab_daily_predictions_v1');if(!original.length)throw Error('NCAAB_SEED_REQUIRED');
  const known=new Set(original.map(p=>String(p.event_id)));const allOutcomes=await readAll('ncaab_daily_outcomes_v1');
  const settled=new Set(allOutcomes.map(o=>String(o.event_id)));
  const day=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).format(d).replaceAll('-','');
  const dates=new Set([-1,0,1].map(offset=>day(new Date(started+offset*86400000))));
  // Bounded historical reconciliation for unresolved forecasts, never fake backfills.
  for(const p of original.filter(p=>!settled.has(String(p.event_id))).sort((a,b)=>String(a.scheduled_at).localeCompare(String(b.scheduled_at)))){if(dates.size>=10)break;const tip=new Date(String(p.scheduled_at));if(tip.getTime()<started)dates.add(day(tip));}
  for(const date of dates){
   if(calls>=10||Date.now()-started>240000)throw Error('NCAAB_RUN_BUDGET_REACHED');
   if(calls)await new Promise(r=>setTimeout(r,1000));
   const url=BASE+'?dates='+date+'&groups=50&limit=1000';calls++;
   const logged=await client.from('ncaab_daily_runs_v1').update({provider_calls:calls}).eq('id',slot);if(logged.error)throw Error('NCAAB_CALL_LEDGER_FAILED');
   const response=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(25000)});
   if(response.status===401||response.status===403)throw Error('ACCESS_DENIED');if(!response.ok)throw Error('NCAAB_SOURCE_HTTP_'+response.status);
   const text=await response.text();if(text.length>15000000)throw Error('NCAAB_SOURCE_SIZE');const raw=JSON.parse(text);if(!Array.isArray(raw.events)||raw.events.length>=1000)throw Error('NCAAB_SOURCE_SCHEMA_OR_TRUNCATION');
   const capturedAt=new Date().toISOString(),sourceId=hash(text);const saved=await client.from('ncaab_daily_source_v1').upsert({id:sourceId,run_id:slot,captured_at:capturedAt,source_url:url,body:raw},{onConflict:'id',ignoreDuplicates:true});if(saved.error)throw Error('NCAAB_RAW_SAVE_FAILED');
   for(const event of raw.events as EspnEvent[]){
    const {schedule,final}=normalizeNcaab(event,capturedAt);
    if(final&&known.has(schedule.event_id)){
     const {captured_at:ignored,...identity}=final;void ignored;
     const saved=await client.from('ncaab_daily_outcomes_v1').upsert({id:hash(identity),event_id:final.event_id,source_id:sourceId,observed_at:capturedAt,body:final},{onConflict:'id',ignoreDuplicates:true});if(saved.error)throw Error('NCAAB_FINAL_SAVE_FAILED');outcomes++;
    }
    if(known.has(schedule.event_id))continue;
    const f=predictNcaab(schedule,new Date().toISOString());
    if(f.state==='ABSTAIN'){abstentions.push(f);continue;}
    const saved=await client.from('ncaab_daily_predictions_v1').upsert({id:NCAAB_MODEL+':'+f.event_id,event_id:f.event_id,scheduled_at:f.scheduled_at,created_at:f.created_at,source_id:sourceId,body:{...f,model:NCAAB_MODEL,profile_sha256:'4fd07cc48ade1b1accd1ebb0f00c0ea414e93a2991567d70ed4ac890c88fdbf4'}},{onConflict:'id',ignoreDuplicates:true});if(saved.error)throw Error('NCAAB_FORECAST_SAVE_FAILED');known.add(f.event_id);forecasts++;
   }
  }
  const done=await client.from('ncaab_daily_runs_v1').update({status:'PASS',completed_at:new Date().toISOString(),provider_calls:calls,detail:{forecasts,outcomes,abstentions}}).eq('id',slot);if(done.error)throw Error('NCAAB_RUN_CLOSE_FAILED');
  return {status:'PASS',providerCalls:calls,forecasts,outcomes,abstentions:abstentions.length,officialPicksModified:false};
 }catch(error){const message=error instanceof Error?error.message:'NCAAB_RUN_FAILED';await client.from('ncaab_daily_runs_v1').update({status:message==='ACCESS_DENIED'?'ACCESS_DENIED':'FAILED',completed_at:new Date().toISOString(),provider_calls:calls,detail:{error:message,forecasts,outcomes,abstentions}}).eq('id',slot);throw Error(message);
 }finally{await client.from('ncaab_daily_lock_v1').update({expires_at:new Date().toISOString()}).eq('owner',id);}
}
