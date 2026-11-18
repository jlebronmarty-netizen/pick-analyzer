import 'server-only';
import {createHash} from 'node:crypto';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {upcomingNbaScheduleGames} from '@/lib/nba/goat-schedule-core.mjs';
import {collectCursorPages} from '@/lib/nba/goat-research-capture-core.mjs';

const VERSION='NBA_GOAT_PREGAME_CONTEXT_V1',FRESH_MS=90*60000,WINDOW_MS=18*3600000;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
async function fetchJson(url:URL,key:string){
 const r=await fetch(url,{headers:{Authorization:key,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok||!(r.headers.get('content-type')??'').includes('application/json'))throw Error('NBA_PREGAME_CONTEXT_PROVIDER_FAILED');
 const payload=await r.json();if(!Array.isArray(payload?.data))throw Error('NBA_PREGAME_CONTEXT_PAYLOAD_INVALID');return payload;
}
export async function getNbaGoatPregameContextStatus(){
 const r=await db.from('nba_pregame_context_v1').select('snapshot_id,captured_at,schedule_snapshot_id,game_ids,team_ids,coverage').order('captured_at',{ascending:false}).limit(1);
 if(r.error)throw Error('NBA_PREGAME_CONTEXT_STATUS_FAILED');const row=r.data?.[0]??null;
 return {status:row?'AVAILABLE':'EMPTY',latest:row,provider_calls:0};
}
export async function syncNbaGoatPregameContext(){
 const key=process.env.BALLDONTLIE_API_KEY?.trim();if(!key)return {status:'KEY_UNAVAILABLE',provider_calls:0,written:0};
 const now=Date.now();
 const [latestR,scheduleR]=await Promise.all([
  db.from('nba_pregame_context_v1').select('snapshot_id,captured_at,game_ids,team_ids,coverage').order('captured_at',{ascending:false}).limit(1),
  db.from('nba_market_schedules_v1').select('snapshot_id,source_received_at,payload').order('source_received_at',{ascending:false}).limit(6),
 ]);
 if(latestR.error||scheduleR.error)throw Error('NBA_PREGAME_CONTEXT_READ_FAILED');
 const latest=latestR.data?.[0]??null;
 if(latest&&now-Date.parse(latest.captured_at)<FRESH_MS&&latest.coverage?.projectedLineupsComplete===true&&latest.coverage?.injuriesComplete===true&&!latest.coverage?.failures?.length)return {status:'FRESH_NO_OP',provider_calls:0,written:0,snapshot_id:latest.snapshot_id,coverage:latest.coverage};
 const upcoming=upcomingNbaScheduleGames(scheduleR.data??[],now,WINDOW_MS);
 if(!upcoming.length)return {status:'NO_UPCOMING_GAMES',provider_calls:0,written:0};
 const games=upcoming.map((s:any)=>s.game);
 const sourceScheduleSnapshotIds=[...new Set(upcoming.map((s:any)=>s.snapshotId).filter(Boolean))];
 const scheduleSnapshotId=sourceScheduleSnapshotIds[0]??null;
 const gameIds=[...new Set(games.map((g:any)=>Number(g.id)))],teamIds=[...new Set(games.flatMap((g:any)=>[Number(g?.home_team?.id),Number(g?.visitor_team?.id)]).filter(Number.isSafeInteger))];
 const h=hash(VERSION+':paged:'+String(Math.floor(now/1800000))),jobId=h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);
 const claim=await db.from('sports_sync_jobs').insert({id:jobId,job_type:'nba_goat_pregame_context_v1',sport_key:'basketball_nba',league_key:'nba',provider:'balldontlie',status:'running',metadata:{version:VERSION,pagination:true,requestCap:8,gameIds}});
 if(claim.error){if(claim.error.code==='23505')return {status:'ALREADY_CLAIMED',provider_calls:0,written:0};throw Error('NBA_PREGAME_CONTEXT_CLAIM_FAILED');}
 let calls=0;const failures:string[]=[];
 const paged=async(url:URL,label:string)=>{
  const retained:any[]=[];let complete=false,nextCursor:any=null;
  try{
   const result=await collectCursorPages(async(cursor:any)=>{
    if(calls>=8)throw Error('PREGAME_CALL_CAP');const u=new URL(url);if(cursor!==null)u.searchParams.set('cursor',String(cursor));
    calls++;const reserved=await db.from('sports_sync_jobs').update({metadata:{version:VERSION,pagination:true,requestCap:8,providerCalls:calls,gameIds}}).eq('id',jobId);if(reserved.error)throw Error('PREGAME_CALL_RESERVATION_FAILED');
    return fetchJson(u,key);
   },{maxPages:4,onPage:async(page:any)=>{retained.push(page);}});
   complete=result.complete;nextCursor=result.next_cursor;if(!complete)failures.push(label+'_PAGE_LIMIT');
  }catch{failures.push(label+'_FAILED');}
  return {data:retained.flatMap(p=>p.data),meta:{next_cursor:nextCursor,complete,pages:retained.length},raw_pages:retained};
 };
 const projectedUrl=new URL('https://api.balldontlie.io/nba/v1/projected_lineups');for(const id of gameIds)projectedUrl.searchParams.append('game_ids[]',String(id));projectedUrl.searchParams.set('per_page','100');
 const injuryUrl=new URL('https://api.balldontlie.io/v1/player_injuries');for(const id of teamIds)injuryUrl.searchParams.append('team_ids[]',String(id));injuryUrl.searchParams.set('per_page','100');
 const projected=await paged(projectedUrl,'PROJECTED_LINEUPS'),injuries=await paged(injuryUrl,'PLAYER_INJURIES');
 const capturedAt=new Date().toISOString(),identity={version:VERSION,capturedAt,scheduleSnapshotId,sourceScheduleSnapshotIds,gameIds,teamIds};
 const snapshotId=hash(JSON.stringify(identity));
 const coverage={
  upcomingGames:gameIds.length,teams:teamIds.length,sourceScheduleSnapshotIds,
  projectedLineupRows:Array.isArray(projected?.data)?projected.data.length:0,
  injuryRows:Array.isArray(injuries?.data)?injuries.data.length:0,
  projectedLineupsComplete:projected.meta.complete&&games.every((g:any)=>[g.home_team.id,g.visitor_team.id].every((teamId:number)=>projected.data.some((r:any)=>Number(r.game_id)===g.id&&Number(r.team_id)===teamId&&Array.isArray(r.lineup)&&r.lineup.length===5))),
  injuriesComplete:injuries.meta.complete,
  projectedLineupPages:projected.meta.pages,injuryPages:injuries.meta.pages,providerCalls:calls,requestCap:8,
  failures,
  usedAsScoringInput:false,
 };
 if(!coverage.projectedLineupsComplete&&!failures.some(x=>x.startsWith('PROJECTED_LINEUPS')))failures.push('PROJECTED_LINEUPS_INCOMPLETE');
 const w=await db.from('nba_pregame_context_v1').insert({
  snapshot_id:snapshotId,captured_at:capturedAt,schedule_snapshot_id:scheduleSnapshotId,
  game_ids:gameIds,team_ids:teamIds,projected_lineups:projected,injuries,coverage,provider:'balldontlie',source_version:VERSION,
 }).select('snapshot_id');
 if(w.error){await db.from('sports_sync_jobs').update({status:'failed',completed_at:new Date().toISOString(),last_error:'NBA_PREGAME_CONTEXT_WRITE_FAILED',metadata:{version:VERSION,providerCalls:calls,coverage}}).eq('id',jobId);throw Error('NBA_PREGAME_CONTEXT_WRITE_FAILED');}
 const finished=await db.from('sports_sync_jobs').update({status:failures.length?'partial':'completed',completed_at:new Date().toISOString(),records_inserted:w.data?.length??0,metadata:{version:VERSION,providerCalls:calls,coverage,snapshotId}}).eq('id',jobId);if(finished.error)throw Error('NBA_PREGAME_CONTEXT_AUDIT_FAILED');
 return {status:failures.length?'PARTIAL':'CAPTURED',provider_calls:calls,written:w.data?.length??0,snapshot_id:snapshotId,coverage};
}
