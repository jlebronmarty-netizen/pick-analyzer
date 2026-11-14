import 'server-only';
import {createHash} from 'node:crypto';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {selectNbaPropsHistoryBackfillGame} from '@/lib/nba/goat-props-history-core.mjs';

const VERSION='NBA_PROPS_PLAYER_HISTORY_V1',SPORT='basketball_nba',DAILY_PROVIDER_CALL_CAP=4;
const rows=(r:any)=>{if(r.error)throw Error('NBA_PROPS_HISTORY_READ_FAILED');return r.data??[];};
const hashId=(value:string)=>{const h=createHash('sha256').update(value).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);};

// Disabled by default. Does not generate predictions, odds or recommendations.
// One historical FINAL game per invocation, one provider request, four attempts max per UTC day.
export async function syncNbaPropsPlayerHistory(){
 if(process.env.NBA_PROPS_HISTORY_BACKFILL_ENABLED!=='true')return {status:'DISABLED',providerCalls:0,written:0};
 const key=process.env.BALLDONTLIE_API_KEY?.trim();
 if(!key)return {status:'KEY_UNAVAILABLE',providerCalls:0,written:0};
 const now=new Date(),at=now.toISOString(),dayStart=at.slice(0,10)+'T00:00:00.000Z',season=now.getUTCMonth()>=9?now.getUTCFullYear():now.getUTCFullYear()-1;
 // Schedule at most four six-hour research windows; avoid querying a 30-day archive every half hour.
 if(now.getUTCHours()%6!==0||now.getUTCMinutes()>=30)return {status:'OUTSIDE_BOUNDED_RESEARCH_WINDOW',providerCalls:0,written:0};
 const prior=rows(await db.from('sports_sync_jobs').select('id').eq('job_type','nba_props_player_history_v1').gte('started_at',dayStart).limit(DAILY_PROVIDER_CALL_CAP+1));
 if(prior.length>=DAILY_PROVIDER_CALL_CAP)return {status:'DAILY_PROVIDER_CALL_CAP',providerCalls:0,written:0,callBudgetRemaining:0};
 const contexts=rows(await db.from('nba_game_context_v2').select('provider_game_id,player_stats').limit(500));
 if(contexts.length>=500)return {status:'SCAN_BOUND_REVIEW_REQUIRED',providerCalls:0,written:0};
 const complete=new Set<number>(contexts.filter((c:any)=>Array.isArray(c.player_stats?.data)&&c.player_stats.data.length>0).map((c:any)=>Number(c.provider_game_id)));
 // Inspect only the freshest schedule for each archived local day. One query per day, stop at first missing final.
 // This avoids the unbounded snapshot-row scans caused by half-hourly history accumulation.
 let candidate:ReturnType<typeof selectNbaPropsHistoryBackfillGame>|null=null;
 for(let dayOffset=0;dayOffset<30;dayOffset++){
  const date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-dayOffset)).toISOString().slice(0,10);
  const schedule=rows(await db.from('nba_market_schedules_v1').select('source_received_at,payload')
   .eq('date_local',date).order('source_received_at',{ascending:false}).limit(1));
  if(!schedule.length)continue;
  candidate=selectNbaPropsHistoryBackfillGame(schedule,complete,now.getTime(),season);
  if(candidate)break;
 }
 if(!candidate)return {status:'NO_VERIFIED_FINAL_BACKFILL',providerCalls:0,written:0};
 const gid=candidate.providerGameId,gameId='bdl_nba_'+gid,slot=Math.floor(now.getTime()/1800000);
 const jobId=hashId(VERSION+':'+String(gid)+':'+String(slot));
 const claim=await db.from('sports_sync_jobs').insert({
  id:jobId,job_type:'nba_props_player_history_v1',sport_key:SPORT,league_key:'nba',
  provider:'balldontlie',status:'running',started_at:at,
  metadata:{version:VERSION,providerGameId:gid,callBudgetPerDay:DAILY_PROVIDER_CALL_CAP,reason:'RESEARCH_POSTGAME_HISTORY_ONLY'}
 });
 if(claim.error){if(claim.error.code==='23505')return {status:'ALREADY_CLAIMED',providerCalls:0,written:0};throw Error('NBA_PROPS_HISTORY_BUDGET_CLAIM_FAILED');}
 let providerCalls=0;
 try{
  const url=new URL('https://api.balldontlie.io/v1/stats');
  url.searchParams.append('game_ids[]',String(gid));url.searchParams.set('per_page','100');
  providerCalls=1;
  const r=await fetch(url,{headers:{Authorization:key,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!r.ok||!(r.headers.get('content-type')??'').includes('application/json'))throw Error('NBA_PROPS_HISTORY_PROVIDER_UNAVAILABLE');
  const payload=await r.json();
  if(!Array.isArray(payload?.data)||payload?.meta?.next_cursor!=null)throw Error('NBA_PROPS_HISTORY_INCOMPLETE_PAGE');
  const stats=payload.data;
  if(stats.length<10||stats.some((x:any)=>Number(x?.game?.id)!==gid||String(x?.game?.status_state??'').toLowerCase()!=='final'||!Number.isSafeInteger(Number(x?.player?.id))))throw Error('NBA_PROPS_HISTORY_FINAL_TRUTH_UNVERIFIED');
  const data={player_stats:{data:stats},player_stats_captured_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  const hasContext=contexts.some((c:any)=>Number(c.provider_game_id)===gid);
  const write=hasContext
   ? await db.from('nba_game_context_v2').update(data).eq('game_id',gameId).is('player_stats',null).select('game_id')
   : await db.from('nba_game_context_v2').insert({game_id:gameId,provider_game_id:gid,provider:'balldontlie',source_version:VERSION,...data}).select('game_id');
  if(write.error&&write.error.code!=='23505')throw Error('NBA_PROPS_HISTORY_WRITE_FAILED');
  const written=write.data?.length??0;
  const finish=await db.from('sports_sync_jobs').update({status:'completed',completed_at:new Date().toISOString(),records_inserted:written,metadata:{version:VERSION,providerGameId:gid,providerCalls:1,playerRows:stats.length,sourceScheduleReceivedAt:candidate.sourceScheduleReceivedAt,officialPickDelta:0,modelChanged:false}}).eq('id',jobId);
  if(finish.error)throw Error('NBA_PROPS_HISTORY_AUDIT_WRITE_FAILED');
  return {status:'COMPLETED',providerCalls,written,providerGameId:gid,playerRows:stats.length,officialPicksChanged:false,modelModified:false};
 }catch{
  await db.from('sports_sync_jobs').update({status:'failed',completed_at:new Date().toISOString(),last_error:'NBA_PROPS_PLAYER_HISTORY_FAILED',records_inserted:0}).eq('id',jobId);
  return {status:'FAILED',providerCalls,written:0};
 }
}
