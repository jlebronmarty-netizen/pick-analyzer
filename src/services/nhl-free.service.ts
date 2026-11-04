import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {parseDratingsUpcoming,parseDratingsCirca,DRATINGS_URL} from '@/lib/nhl-free-source';
import {normalizeNhlScore,matchFreeNhl,freezeNhlForecast,finalNhl,reconcileFreeNhl,freeNhlMetrics,nhlSportsDate,verifyFreeNhlForecast,type NhlGame,type NhlFreeForecast,type NhlFreeFinal,type NhlFreeAvailableReport} from '@/lib/nhl-free';
import type {NhlReport} from '@/lib/nhl-external-report';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
async function db(){return (await import('@/lib/supabase-admin')).supabaseAdmin;}
async function rows(table:string){const client=await db(),result:Record<string,unknown>[]=[];let cursor='';for(;;){let q=client.from(table).select('*').order('id').limit(500).abortSignal(AbortSignal.timeout(20000));if(cursor)q=q.gt('id',cursor);const {data,error}=await q;if(error||!data)throw Error('NHL_DATABASE_READ');result.push(...data);if(data.length<500)return result;cursor=String(data.at(-1)!.id);}}
type RunDetail={games:NhlGame[];forecasts:NhlFreeForecast[];issues:string[];calendarCapturedAt?:string;error?:string};
const warning='Nueva cohorte prospectiva gratuita. Historial anterior de Sports Edge Hub pendiente de recuperación y verificación; no incluido en estas métricas. MODEL_ONLY / SHADOW, sin Official Picks ni rentabilidad certificada.';
export async function getNhlFreeReport():Promise<NhlReport>{
 try{
  const client=await db(),[ps,os,runs]=await Promise.all([rows('nhl_free_predictions_v1'),rows('nhl_free_outcomes_v1'),client.from('nhl_free_runs_v1').select('*').neq('status','RUNNING').order('started_at',{ascending:false}).limit(2).abortSignal(AbortSignal.timeout(20000))]);
  if(runs.error)throw Error('NHL_RUN_READ');const last=runs.data?.[0];
  if(!last)return {status:'UNAVAILABLE',readAt:new Date().toISOString(),warning:'NHL: captura gratuita preparada; esperando el primer ciclo automático. '+warning};
  const now=new Date().toISOString(),date=nhlSportsDate(now),detail=last.detail as RunDetail;
  const fs=ps.map(p=>verifyFreeNhlForecast(p.body as NhlFreeForecast)),finals=os.map(p=>p.body as NhlFreeFinal);
  const history=fs.map(f=>reconcileFreeNhl(f,finals.filter(o=>o.eventId===f.eventId))).sort((a,b)=>b.scheduledAt.localeCompare(a.scheduledAt)||a.id.localeCompare(b.id));
  const games=(detail.games??[]).filter(g=>nhlSportsDate(g.scheduledAt)===date).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt));
  const forecasts=(detail.forecasts??[]).map(verifyFreeNhlForecast).filter(f=>nhlSportsDate(f.scheduledAt)===date).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt));
  // First immutable observations remain visible if the latest collection is incomplete.
  for(const f of fs)if(nhlSportsDate(f.scheduledAt)===date&&!forecasts.some(x=>x.eventId===f.eventId)&&games.some(g=>g.eventId===f.eventId&&g.scheduledAt===f.scheduledAt&&g.home===f.home&&g.away===f.away))forecasts.push(f);
  forecasts.sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt));
  const eligible=games.filter(g=>g.status==='SCHEDULED'&&g.scheduledAt>now).length,coverage=forecasts.filter(f=>f.scheduledAt>now).length;
  const issues=[...(detail.issues??[]),...(last.status==='PASS'?[]:['Último ciclo: '+last.status]),...(!last.completed_at||Date.parse(now)-Date.parse(last.completed_at)>45*60000?['Captura desactualizada']:[])];
  if(history.some(p=>p.quality==='REVIEW_CONFLICTING_FINALS'))issues.push('Resultados corregidos en revisión; excluidos del accuracy.');
  const report:NhlFreeAvailableReport={schema:'NHL_FREE_DIRECT_V1',source:'PICK_ANALYZER',sport:'NHL',classification:'MODEL_ONLY',status:'AVAILABLE',readAt:now,date,health:{status:issues.length?'ATTENTION':'PASS',issues,latestRunAt:last.completed_at,runStatus:last.status,coverage,eligible},summary:freeNhlMetrics(history),games,forecasts,history,providerCalls:0,databaseWrites:0,warning};return report;
 }catch{return {status:'UNAVAILABLE',readAt:new Date().toISOString(),warning:'NHL: no se pudo verificar el registro gratuito de Pick. '+warning};}
}
export async function runNhlFree(){
 const client=await db(),owner=randomUUID(),slot='NHL:'+Math.floor(Date.now()/1800000),start=Date.now();
 const {data:claimed,error}=await client.rpc('nhl_free_claim_v1',{run_id:owner});if(error)throw Error('NHL_LOCK');if(!claimed)return {status:'BUSY',providerCalls:0};
 let calls=0,added=0,settled=0;const detail:RunDetail={games:[],forecasts:[],issues:[]};
 try{
  const prior=await client.from('nhl_free_runs_v1').select('id').eq('id',slot).maybeSingle();if(prior.error)throw Error('NHL_DEDUP_GUARD');if(prior.data)return {status:'REUSED_SLOT',providerCalls:0};
  const begin=await client.from('nhl_free_runs_v1').insert({id:slot,status:'RUNNING'});if(begin.error)throw Error('NHL_RUN_CREATE');
  const [ps,os,blocks]=await Promise.all([rows('nhl_free_predictions_v1'),rows('nhl_free_outcomes_v1'),client.from('nhl_free_source_v1').select('source_url,body').eq('body->>access_denied','true')]);if(blocks.error)throw Error('NHL_DENIAL_GUARD');
  const blocked=new Set((blocks.data??[]).map(s=>new URL(s.source_url).hostname));
  const known=new Set(ps.map(p=>String(p.event_id))),finished=new Set(os.map(o=>String(o.event_id)));
  // Fixed hosts/paths, 12 requests maximum, no retries, no redirect or paid fallback.
  async function fetchSource(url:string,maxBytes:number){
   const u=new URL(url);if(u.protocol!=='https:'||!((u.hostname==='api-web.nhle.com'&&/^\/v1\/score\/\d{4}-\d{2}-\d{2}$/.test(u.pathname))||(u.hostname==='www.dratings.com'&&/^\/predictor\/nhl-hockey-predictions\/(?:[a-f0-9-]+)?\/?$/.test(u.pathname))))throw Error('NHL_SOURCE_NOT_ALLOWED');
   if(blocked.has(u.hostname))throw Error('NHL_SOURCE_ACCESS_DENIED_REVIEW');
   if(calls>=12||Date.now()-start>230000)throw Error('NHL_BUDGET');
   calls++;const at=new Date().toISOString(),id=randomUUID();
   const ledger=await client.from('nhl_free_runs_v1').update({provider_calls:calls}).eq('id',slot);if(ledger.error)throw Error('NHL_CALL_LEDGER');
   let status=0,raw='',message:string|null=null;
   try{const response=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(18000)});status=response.status;
    if(Number(response.headers.get('content-length')??0)>maxBytes)throw Error('SOURCE_SIZE');
    const reader=response.body?.getReader();if(!reader)throw Error('SOURCE_BODY');const chunks:Uint8Array[]=[];let size=0;for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw Error('SOURCE_SIZE');}chunks.push(value);}raw=Buffer.concat(chunks).toString('utf8');
    if(!response.ok)message='HTTP_'+status;
   }catch(e){message=e instanceof Error?e.message:'TRANSPORT';}
   const denied=status===401||status===403;if(denied)blocked.add(u.hostname);
   const saved=await client.from('nhl_free_source_v1').insert({id,run_id:slot,captured_at:at,source_url:url,body:{http_status:status,sha256:hash(raw),encoding:'gzip/base64',raw:gzipSync(raw).toString('base64'),access_denied:denied,error:message}});if(saved.error)throw Error('NHL_RAW_SAVE');
   if(message)throw Error('NHL_SOURCE_'+(denied?'ACCESS_DENIED':status||'TRANSPORT'));
   return {raw,id,at};
  }
  const dates=new Set([-1,0,1].map(d=>nhlSportsDate(new Date(start+d*86400000).toISOString())));
  for(const p of ps.filter(p=>!finished.has(String(p.event_id))).sort((a,b)=>String(a.scheduled_at).localeCompare(String(b.scheduled_at)))){if(dates.size>=5)break;if(Date.parse(String(p.scheduled_at))<start)dates.add(nhlSportsDate(String(p.scheduled_at)));}
  const gamesById=new Map<string,NhlGame>();
  for(const date of dates){try{
   const s=await fetchSource('https://api-web.nhle.com/v1/score/'+date,2000000),games=normalizeNhlScore(JSON.parse(s.raw));
   for(const g of games){gamesById.set(g.eventId,g);const final=finalNhl(g,s.at);if(final&&known.has(g.eventId)){
    const {capturedAt:ignored,...identity}=final;void ignored;
    const save=await client.from('nhl_free_outcomes_v1').upsert({id:hash(JSON.stringify(identity)),event_id:g.eventId,source_id:s.id,observed_at:s.at,body:final},{onConflict:'id',ignoreDuplicates:true});if(save.error)throw Error('NHL_OUTCOME_SAVE');settled++;
   }}detail.calendarCapturedAt=s.at;
  }catch(e){detail.issues.push(e instanceof Error?e.message:'NHL_CALENDAR_FAILED');}}
  detail.games=[...gamesById.values()];
  if(!detail.games.length)detail.issues.push('Sin calendario oficial verificado.');
  if(detail.games.some(g=>g.status==='SCHEDULED'&&Date.parse(g.scheduledAt)>Date.now())){
   try{const s=await fetchSource(DRATINGS_URL,2000000),forecasts=parseDratingsUpcoming(s.raw);
    const used=new Set<string>();
    for(const f of forecasts){const g=matchFreeNhl(f,detail.games,new Date().toISOString());if(!g||used.has(g.eventId))continue;used.add(g.eventId);let price=null,priceSource:string|null=null;
     if(calls<12&&!blocked.has('www.dratings.com'))try{const q=await fetchSource(f.detailUrl,2000000);price=parseDratingsCirca(q.raw,f);priceSource=q.id;}catch(e){detail.issues.push(e instanceof Error?e.message:'NHL_PRICE_FAILED');}
     const at=new Date().toISOString(),frozen=freezeNhlForecast(g,f,at,price);if(!frozen)continue;
     detail.forecasts.push(frozen);
     if(known.has(g.eventId))continue;
     const saved=await client.from('nhl_free_predictions_v1').upsert({id:frozen.id,event_id:g.eventId,scheduled_at:g.scheduledAt,created_at:at,source_id:s.id,body:{...frozen,priceSourceId:priceSource}},{onConflict:'id',ignoreDuplicates:true});if(saved.error)throw Error('NHL_FORECAST_SAVE');known.add(g.eventId);added++;
    }
   }catch(e){detail.issues.push(e instanceof Error?e.message:'NHL_FORECAST_FAILED');}
  }
  const future=detail.games.filter(g=>g.status==='SCHEDULED'&&Date.parse(g.scheduledAt)>Date.now());
  if(future.some(g=>!detail.forecasts.some(f=>f.eventId===g.eventId)))detail.issues.push('Cobertura incompleta de probabilidades.');
  detail.issues=[...new Set(detail.issues)];const status=detail.issues.length?'PARTIAL':'PASS';
  const saved=await client.from('nhl_free_runs_v1').update({status,completed_at:new Date().toISOString(),provider_calls:calls,detail}).eq('id',slot);if(saved.error)throw Error('NHL_RUN_CLOSE');
  return {status,providerCalls:calls,forecasts:added,outcomeObservations:settled,officialPicksModified:false};
 }catch(e){detail.error=e instanceof Error?e.message:'NHL_RUN_FAILED';await client.from('nhl_free_runs_v1').update({status:'FAILED',completed_at:new Date().toISOString(),provider_calls:calls,detail}).eq('id',slot);throw Error(detail.error);
 }finally{await client.from('nhl_free_lock_v1').update({expires_at:new Date().toISOString()}).eq('owner',owner);}
}
