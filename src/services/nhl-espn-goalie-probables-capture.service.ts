import 'server-only';
import {createHash} from 'node:crypto';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {parseEspnNhlFreeProbables,NHL_ESPN_GOALIE_VERSION} from '@/lib/nhl-espn-free-goalie-probables-v5.mjs';
const JOB='nhl_espn_free_probables_v5';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const uuid=(s:string)=>{const h=hash(s);return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32)};
const sourceDay=(d:Date)=>{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
 const get=(type:string)=>parts.find(x=>x.type===type)?.value??'';
 return get('year')+get('month')+get('day');
};
const sourceUrl=(date:string)=>'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates='+date;

// Strictly opt-in, one FREE scoreboard request at 22:07 UTC per UTC date.
// ESPN probables are not NHL-verified starting goalies; never alter model scores.
export async function captureNhlFreeEspnProbableGoalies(){
 if(process.env.NHL_ESPN_GOALIE_CAPTURE_ENABLED!=='true')
  return {status:'DISABLED',providerCalls:0,written:0,officialPicksChanged:false};
 const now=new Date(),capturedDate=now.toISOString(),timeMs=now.getTime();
 if(now.getUTCHours()!==22||now.getUTCMinutes()>20)
  return {status:'OUTSIDE_ONE_DAILY_SOURCE_WINDOW',providerCalls:0,written:0};
 const today=capturedDate.slice(0,10);
 const [prior,latest]=await Promise.all([
  db.from('sports_sync_jobs').select('id').eq('job_type',JOB)
   .gte('started_at',today+'T00:00:00Z').limit(2),
  db.from('nhl_free_runs_v1').select('completed_at,games:detail->games')
   .in('status',['PASS','PARTIAL']).order('completed_at',{ascending:false}).limit(1).maybeSingle()
 ]);
 if(prior.error||latest.error)return {status:'DATABASE_PREFLIGHT_UNAVAILABLE',providerCalls:0,written:0};
 if((prior.data??[]).length)return {status:'DAILY_ATTEMPT_ALREADY_CLAIMED',providerCalls:0,written:0};
 const schedule=latest.data?.games;
 const scheduleAt=Date.parse(latest.data?.completed_at??'');
 if(!Array.isArray(schedule)||!Number.isFinite(scheduleAt)||
  timeMs-scheduleAt>45*60000||timeMs<scheduleAt)
  return {status:'NO_FRESH_OFFICIAL_NHL_SCHEDULE',providerCalls:0,written:0};
 if(!schedule.some((g:any)=>g?.status==='SCHEDULED'&&
  Date.parse(g.scheduledAt)-timeMs>=60*60000))
  return {status:'NO_PREGAME_NHL_MATCHUPS',providerCalls:0,written:0};
 const date=sourceDay(now);
 if(!/^2026\d{4}$/.test(date))return {status:'INVALID_SOURCE_DATE',providerCalls:0,written:0};
 const id=uuid(JOB+':'+today),src=sourceUrl(date);
 const claim=await db.from('sports_sync_jobs').insert({
  id,job_type:JOB,sport_key:'icehockey_nhl',league_key:'nhl',
  provider:'espn_public',status:'running',started_at:capturedDate,
  metadata:{version:NHL_ESPN_GOALIE_VERSION,source:src,oneCallPerUTCDay:true,
   predictionModelChanges:0,officialPickChanges:0}
 });
 if(claim.error){if(claim.error.code==='23505')
  return {status:'SOURCE_ALREADY_CLAIMED',providerCalls:0,written:0};
  return {status:'SOURCE_CLAIM_FAILED',providerCalls:0,written:0};}
 let providerCalls=0;
 try{
  providerCalls=1;
  const resp=await fetch(src,{redirect:'error',cache:'no-store',
   headers:{Accept:'application/json'},signal:AbortSignal.timeout(14000)});
  if(!resp.ok||!(resp.headers.get('content-type')??'').includes('application/json')||
   Number(resp.headers.get('content-length')??0)>3000000)
   throw Error('ESPN_SOURCE_UNVERIFIED');
  const raw=await resp.text();
  if(Buffer.byteLength(raw,'utf8')>3000000)throw Error('ESPN_SOURCE_OVERSIZE');
  const capturedAt=new Date().toISOString();
  const parsed=parseEspnNhlFreeProbables({payload:JSON.parse(raw),
   officialSchedule:schedule,capturedAt});
  if(parsed.status!=='FREE_PREGAME_PROBABLES_OBSERVED'||!Array.isArray(parsed.games)||
    parsed.games.length<1||parsed.games.length>16)
   throw Error('ESPN_UNVERIFIED_PREGAME_MATCHUP');
  const rowId=hash(JOB+':'+date+':'+hash(raw));
  const saved=await db.from('nhl_espn_goalie_probables_v1').insert({
   id:rowId,sports_date:date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6),
   captured_at:capturedAt,source_url:src,source_version:NHL_ESPN_GOALIE_VERSION,
   raw_sha256:hash(raw),games:parsed.games,game_count:parsed.games.length,
   is_confirmed_starter:false,used_by_official_model:false
  }).select('id');
  if(saved.error&&saved.error.code!=='23505')throw Error('ESPN_GOALIE_SNAPSHOT_WRITE_FAILED');
  const inserted=saved.data?.length??0;
  const log=await db.from('sports_sync_jobs').update({
   status:'completed',completed_at:new Date().toISOString(),records_inserted:inserted,
   metadata:{version:NHL_ESPN_GOALIE_VERSION,providerCalls,
    totalGames:parsed.games.length,pregameProbableOnly:true,confirmedGoalies:0,
    sourceHash:hash(raw),officialPickChanges:0,modelWeightChanges:0}
  }).eq('id',id);
  if(log.error)throw Error('ESPN_GOALIE_AUDIT_WRITE_FAILED');
  return {status:inserted?'PREGAME_PROBABLES_RESEARCH_CAPTURED':'SOURCE_ALREADY_STORED',
   providerCalls,written:inserted,games:parsed.games.length,
   confirmedStarters:0,officialPicksChanged:false,modelAdjusted:false};
 }catch{
  await db.from('sports_sync_jobs').update({
   status:'failed',completed_at:new Date().toISOString(),records_inserted:0,
   last_error:'NHL_ESPN_FREE_PROBABLE_SOURCE_UNVERIFIED'
  }).eq('id',id);
  return {status:'SOURCE_UNVERIFIED_OR_FAILED',providerCalls,written:0,
   confirmedStarters:0,officialPicksChanged:false};
 }
}
