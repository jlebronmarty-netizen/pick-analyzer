import 'server-only';
import {createHash} from 'node:crypto';
import {supabaseAdmin as db} from '@/lib/supabase-admin';

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
  db.from('nba_market_schedules_v1').select('snapshot_id,source_received_at,payload').order('source_received_at',{ascending:false}).limit(1),
 ]);
 if(latestR.error||scheduleR.error)throw Error('NBA_PREGAME_CONTEXT_READ_FAILED');
 const latest=latestR.data?.[0]??null;
 if(latest&&now-Date.parse(latest.captured_at)<FRESH_MS)return {status:'FRESH_NO_OP',provider_calls:0,written:0,snapshot_id:latest.snapshot_id,coverage:latest.coverage};
 const schedule=scheduleR.data?.[0],games=Array.isArray(schedule?.payload?.data?.games)?schedule.payload.data.games:[];
 const upcoming=games.filter((g:any)=>Number.isSafeInteger(g?.id)&&Number.isFinite(Date.parse(g?.datetime??''))&&Date.parse(g.datetime)>now&&Date.parse(g.datetime)<=now+WINDOW_MS&&String(g?.status_state??'').toLowerCase()==='scheduled');
 if(!upcoming.length)return {status:'NO_UPCOMING_GAMES',provider_calls:0,written:0};
 const gameIds=[...new Set(upcoming.map((g:any)=>Number(g.id)))],teamIds=[...new Set(upcoming.flatMap((g:any)=>[Number(g?.home_team?.id),Number(g?.visitor_team?.id)]).filter(Number.isSafeInteger))];
 let calls=0;const failures:string[]=[];let projected:any={data:[],meta:{}},injuries:any={data:[],meta:{}};
 try{const u=new URL('https://api.balldontlie.io/nba/v1/projected_lineups');for(const id of gameIds)u.searchParams.append('game_ids[]',String(id));u.searchParams.set('per_page','100');calls++;projected=await fetchJson(u,key);}catch{failures.push('PROJECTED_LINEUPS_FAILED');}
 try{const u=new URL('https://api.balldontlie.io/v1/player_injuries');for(const id of teamIds)u.searchParams.append('team_ids[]',String(id));u.searchParams.set('per_page','100');calls++;injuries=await fetchJson(u,key);}catch{failures.push('PLAYER_INJURIES_FAILED');}
 const capturedAt=new Date().toISOString(),identity={version:VERSION,capturedAt,scheduleSnapshotId:schedule?.snapshot_id??null,gameIds,teamIds};
 const snapshotId=hash(JSON.stringify(identity));
 const coverage={
  upcomingGames:gameIds.length,teams:teamIds.length,
  projectedLineupRows:Array.isArray(projected?.data)?projected.data.length:0,
  injuryRows:Array.isArray(injuries?.data)?injuries.data.length:0,
  projectedLineupsComplete:!projected?.meta?.next_cursor,
  injuriesComplete:!injuries?.meta?.next_cursor,
  failures,
  usedAsScoringInput:false,
 };
 const w=await db.from('nba_pregame_context_v1').insert({
  snapshot_id:snapshotId,captured_at:capturedAt,schedule_snapshot_id:schedule?.snapshot_id??null,
  game_ids:gameIds,team_ids:teamIds,projected_lineups:projected,injuries,coverage,provider:'balldontlie',source_version:VERSION,
 }).select('snapshot_id');
 if(w.error)throw Error('NBA_PREGAME_CONTEXT_WRITE_FAILED');
 return {status:failures.length?'PARTIAL':'CAPTURED',provider_calls:calls,written:w.data?.length??0,snapshot_id:snapshotId,coverage};
}
