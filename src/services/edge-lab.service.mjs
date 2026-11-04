import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {COHORT,SOCCER_MODEL,statisticalOutcome,metric} from '../lib/edge-lab/engines.mjs';
import {loadSoccer,forecastRows,sha} from '../lib/edge-lab/sources.mjs';
const PROJECT='ynuocvexviorgdjrfthw';
function client(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||new URL(url).hostname!==PROJECT+'.supabase.co'||!key)throw Error('DESTINATION_NOT_CONFIGURED');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
const safe=e=>typeof e?.message==='string'&&/^[A-Z0-9_]+$/.test(e.message)?e.message:'EDGE_LAB_OPERATION_FAILED';
const checked=r=>{if(r.error)throw Error('EDGE_LAB_DATABASE_ERROR');return r.data;};
async function all(db,table){const out=[];for(let i=0;i<10000;i+=500){const rows=checked(await db.from(table).select('*').order('id').range(i,i+499));out.push(...rows);if(rows.length<500)return out;}throw Error('EDGE_LAB_READ_LIMIT');}
export function privateRequest(request){const h=process.env.VERCEL_URL;return process.env.VERCEL_ENV==='production'&&process.env.VERCEL==='1'&&typeof h==='string'&&/^[a-z0-9-]+\.vercel\.app$/.test(h)&&new URL(request.url).hostname===h&&request.headers.get('host')===h;}
export async function previewSoccer(){const loaded=await loadSoccer(new Date());const now=new Date(),preview=loaded.errors.length?{rows:[],skipped:[]}:forecastRows(loaded.events,loaded.history,now,loaded.source);return {status:loaded.errors.length?'SOURCE_PARTIAL':'PREVIEW_ONLY',persisted:false,history_rows:loaded.history.length,events:loaded.events.length,coverage:loaded.source.coverage_dates,errors:loaded.errors,forecasts:preview.rows.map(r=>({event_id:r.event_id,home:r.home_name,away:r.away_name,market:r.market,status:r.status,scheduled_at:r.scheduled_at,selection:r.selection,probability:r.probability})),skipped:preview.skipped};}
export async function runEdgeSoccer(){
 if(process.env.VERCEL_ENV!=='production')throw Error('PRODUCTION_ONLY');const db=client(),runId=randomUUID();
 const claimed=checked(await db.rpc('edge_lab_claim_soccer_v1',{p_run:runId}));if(!claimed)return {status:'SKIPPED_LOCKED'};
 const summary={cohort:COHORT,model:SOCCER_MODEL,scope:'LaLiga only; research projections; no sportsbook settlement',history_rows:0,events:0,inserted:0,reused:0,settled:0,abstentions:0,errors:[],nhl_touched:false};let status='FAILED';
 try{
  const existing=(await all(db,'edge_lab_forecasts_v1')).filter(r=>r.cohort===COHORT&&r.sport==='SOCCER');
  const outcomes=await all(db,'edge_lab_outcomes_v1'),done=new Set(outcomes.map(r=>r.forecast_id));
  const extra=existing.filter(r=>r.status==='FORECAST'&&!done.has(r.id)&&Date.parse(r.scheduled_at)<Date.now()).map(r=>r.scheduled_at.slice(0,10));
  const loaded=await loadSoccer(new Date(),extra);summary.history_rows=loaded.history.length;summary.events=loaded.events.length;summary.coverage=loaded.source.coverage_dates;summary.errors.push(...loaded.errors);
  if(loaded.errors.length){status='PARTIAL';return {status,...summary};}
  const capture=new Date(),inputDigest=sha(loaded.history),source={...loaded.source,input_digest:inputDigest};
  checked(await db.from('edge_lab_sources_v1').upsert({id:inputDigest,source_url:source.history_url,raw_digest:source.history_digest,captured_at:capture.toISOString(),payload:loaded.history},{onConflict:'id',ignoreDuplicates:true}));
  const batch=forecastRows(loaded.events,loaded.history,capture,source);summary.unresolved_teams=batch.skipped;summary.abstentions=batch.rows.filter(r=>r.status==='ABSTAIN').length;
  const toStore=batch.rows.map(r=>({id:r.id,cohort:r.cohort,sport:r.sport,competition:r.competition,season:r.season,model_version:r.model_version,event_id:r.event_id,home_name:r.home_name,away_name:r.away_name,scheduled_at:r.scheduled_at,emitted_at:r.emitted_at,market:r.market,line:r.line,selection:r.selection,probability:r.probability,status:r.status,input_digest:inputDigest,payload:r}));
  if(toStore.length){const added=checked(await db.from('edge_lab_forecasts_v1').upsert(toStore,{onConflict:'id',ignoreDuplicates:true}).select('id'));summary.inserted=added.length;summary.reused=toStore.length-added.length;}
  const map=new Map(loaded.events.map(e=>[e.id,e]));
  for(const f of existing){if(done.has(f.id)||f.status!=='FORECAST'||Date.parse(f.scheduled_at)>capture.getTime())continue;const final=map.get(f.event_id);if(!final)continue;
   const result=statisticalOutcome(f,final);if(result.status==='PENDING')continue;
   const added=checked(await db.from('edge_lab_outcomes_v1').upsert({id:f.id,forecast_id:f.id,status:result.status,checked_at:capture.toISOString(),payload:{...result,final,source:'ESPN',source_pages:source.schedule_sources,statistical_only:true,sportsbook_settlement:false}},{onConflict:'forecast_id',ignoreDuplicates:true}).select('id'));summary.settled+=added.length;
  }
  status=batch.skipped.length?'PARTIAL':'SUCCESS';return {status,...summary};
 }catch(e){summary.errors.push({error:safe(e)});throw Error(safe(e));}
 finally{try{checked(await db.from('edge_lab_runs_v1').update({status,finished_at:new Date().toISOString(),summary}).eq('id',runId));}finally{checked(await db.from('edge_lab_lock_v1').update({lease_until:new Date().toISOString()}).eq('singleton',true).eq('run_id',runId));}}
}
export async function readEdgeLab(){
 const db=client(),forecasts=(await all(db,'edge_lab_forecasts_v1')).filter(r=>r.cohort===COHORT),outcomes=await all(db,'edge_lab_outcomes_v1');
 const runs=checked(await db.from('edge_lab_runs_v1').select('*').order('started_at',{ascending:false}).limit(5));
 const byId=new Map(outcomes.map(r=>[r.forecast_id,r])),rows=forecasts.map(r=>({...r,outcome:byId.get(r.id)??null})).sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at)||a.market.localeCompare(b.market));
 const metrics=['1X2','TOTAL_2_5'].map(m=>{const eligible=rows.filter(r=>r.market===m&&r.status==='FORECAST');return {market:m,...metric(eligible.flatMap(r=>r.outcome?[r.outcome]:[])),pending:eligible.filter(r=>!r.outcome).length,disputes:eligible.filter(r=>r.outcome?.status==='DISPUTE').length,not_verifiable:eligible.filter(r=>r.outcome?.status==='NOT_VERIFIABLE').length,abstentions:rows.filter(r=>r.market===m&&r.status==='ABSTAIN').length};});
 const dates=[...new Set(rows.map(r=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico'}).format(new Date(r.emitted_at))))];
 const daily=dates.flatMap(date=>['1X2','TOTAL_2_5'].map(m=>{const subset=rows.filter(r=>r.market===m&&r.status==='FORECAST'&&new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico'}).format(new Date(r.emitted_at))===date);return {date,market:m,...metric(subset.flatMap(r=>r.outcome?[r.outcome]:[])),pending:subset.filter(r=>!r.outcome).length};}));
 return {status:runs[0]?.status??'NOT_RUN',checked_at:new Date().toISOString(),cohort:COHORT,phase:'NEW_PROSPECTIVE_RESEARCH',model:SOCCER_MODEL,runs,metrics,daily,rows,table_tennis:{status:'ENGINE_TESTED_SOURCE_NOT_CONNECTED',forecasts:0,accuracy:null,reason:'No se inventan resultados para reconstruir los ratings.'},mlb_edge:{status:'ENGINE_TESTED_INPUT_SERVING_PENDING',reason:'Pesos conservados; no se alteraron gates, picks ni workers MLB existentes.'},nhl:{status:'EXCLUDED_OTHER_CHAT'},nba:{status:'EXISTING_MARKET_DATA_MODULE',href:'/nba-market-data'},ncaab:{status:'EXISTING_SEPARATE_PIPELINE',href:'/ncaab'},ncaaf:{status:'HOSTED_INTEGRATION_PENDING'}};
}
