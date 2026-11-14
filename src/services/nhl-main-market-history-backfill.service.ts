import 'server-only';
import {createHash} from 'node:crypto';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {selectNhlMainMarketHistoryTarget,nhlOfficialHistoryResponseValid} from '@/lib/nhl-main-market-history-core.mjs';
const VERSION='NHL_MAIN_MARKET_HISTORY_BACKFILL_V1',JOB='nhl_main_market_history_v1';
const DAILY_ATTEMPT_CAP=4,PRIOR_RUN_SCAN_CAP=900;
function jobId(value:string){
 const h=createHash('sha256').update(value).digest('hex');
 return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);
}
async function officialJson(gameId:number,part:'boxscore'|'play-by-play'){
 const url='https://api-web.nhle.com/v1/gamecenter/'+gameId+'/'+part;
 const response=await fetch(url,{headers:{Accept:'application/json'},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok||!(response.headers.get('content-type')??'').includes('application/json'))throw Error('NHL_RESEARCH_HISTORY_OFFICIAL_SOURCE_UNAVAILABLE');
 const length=Number(response.headers.get('content-length')??0);
 if(length>2000000)throw Error('NHL_RESEARCH_HISTORY_RESPONSE_TOO_LARGE');
 return response.json();
}
// Additive, opt-in and isolated. Main NHL source, settlement and causal paths execute first.
// Max one official final per 6-hour UTC slot => at most two free NHL HTTP requests per slot.
export async function syncNhlMainMarketHistory(){
 if(process.env.NHL_MAIN_MARKET_HISTORY_ENABLED!=='true')return {status:'DISABLED',providerCalls:0,written:0};
 const now=new Date(),at=now.toISOString();
 if(now.getUTCHours()%6!==0||now.getUTCMinutes()>=30)return {status:'OUTSIDE_RESEARCH_WINDOW',providerCalls:0,written:0};
 const today=at.slice(0,10)+'T00:00:00Z',slot=Math.floor(now.getTime()/(6*3600000));
 const prior=await db.from('sports_sync_jobs').select('id').eq('job_type',JOB).gte('started_at',today).limit(DAILY_ATTEMPT_CAP+1);
 if(prior.error)throw Error('NHL_RESEARCH_BUDGET_READ_FAILED');
 if((prior.data??[]).length>=DAILY_ATTEMPT_CAP)return {status:'DAILY_ATTEMPT_CAP',providerCalls:0,written:0};
 const [runsR,existingR]=await Promise.all([
  db.from('nhl_free_runs_v1').select('completed_at,detail').in('status',['PASS','PARTIAL'])
   .order('started_at',{ascending:false}).limit(PRIOR_RUN_SCAN_CAP),
  db.from('nhl_game_context_v2').select('event_id').limit(1000)
 ]);
 if(runsR.error||existingR.error)throw Error('NHL_RESEARCH_HISTORY_READ_FAILED');
 const runs=runsR.data??[],contexts=existingR.data??[];
 if(runs.length>=PRIOR_RUN_SCAN_CAP||contexts.length>=1000)return {status:'SCAN_LIMIT_REVIEW_REQUIRED',providerCalls:0,written:0};
 const existing=new Set(contexts.map(x=>x.event_id));
 const candidate=selectNhlMainMarketHistoryTarget({runDetails:runs,knownEventIds:existing,nowMs:now.getTime()});
 if(!candidate)return {status:'NO_VERIFIED_FINAL_MISSING',providerCalls:0,written:0};
 const id=jobId(VERSION+':'+String(slot)),claim=await db.from('sports_sync_jobs').insert({
  id,job_type:JOB,sport_key:'icehockey_nhl',league_key:'nhl',provider:'nhl_web_api',
  status:'running',started_at:at,metadata:{version:VERSION,slot,gameId:candidate.gameId,providerCallLimit:2,dayAttemptLimit:DAILY_ATTEMPT_CAP}
 });
 if(claim.error){if(claim.error.code==='23505')return {status:'ALREADY_CLAIMED',providerCalls:0,written:0};throw Error('NHL_RESEARCH_HISTORY_CLAIM_FAILED');}
 let providerCalls=0;
 try{
  providerCalls=2;
  const [boxscore,pbp]=await Promise.all([
   officialJson(candidate.gameId,'boxscore'),officialJson(candidate.gameId,'play-by-play')
  ]);
  if(!nhlOfficialHistoryResponseValid({candidate,boxscore,pbp}))throw Error('NHL_RESEARCH_HISTORY_FINAL_IDENTITY_UNVERIFIED');
  const captured=new Date().toISOString();
  const saved=await db.from('nhl_game_context_v2').insert({
   event_id:candidate.eventId,provider_game_id:candidate.gameId,
   boxscore,play_by_play:pbp,boxscore_captured_at:captured,pbp_captured_at:captured,
   provider:'nhl_web_api',source_version:VERSION,updated_at:captured
  }).select('event_id');
  if(saved.error&&saved.error.code!=='23505')throw Error('NHL_RESEARCH_HISTORY_WRITE_FAILED');
  const written=saved.data?.length??0;
  const audit=await db.from('sports_sync_jobs').update({
   status:'completed',completed_at:new Date().toISOString(),records_inserted:written,
   metadata:{version:VERSION,gameId:candidate.gameId,providerCalls,archivedFinalAt:candidate.archivedAt,
    historicalContextOnly:true,modelDelta:0,officialPickDelta:0}
  }).eq('id',id);
  if(audit.error)throw Error('NHL_RESEARCH_HISTORY_AUDIT_FAILED');
  return {status:written?'COMPLETED':'ALREADY_STORED',providerCalls,written,eventId:candidate.eventId,
   historicalContextOnly:true,modelModified:false,officialPicksModified:false};
 }catch{
  await db.from('sports_sync_jobs').update({status:'failed',completed_at:new Date().toISOString(),
   last_error:'NHL_RESEARCH_HISTORY_FAILED',records_inserted:0}).eq('id',id);
  return {status:'FAILED',providerCalls,written:0};
 }
}
