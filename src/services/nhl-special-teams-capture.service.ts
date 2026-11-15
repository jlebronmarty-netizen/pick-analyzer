import 'server-only';
import {createHash} from 'node:crypto';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {readNhlDirectoryCache} from '@/lib/nhl-directory-cache';
import {parseNhlOfficialSpecialTeams,NHL_SPECIAL_TEAMS_VERSION} from '@/lib/nhl-special-teams-asof-core.mjs';

export const NHL_SPECIAL_TEAMS_SOURCE_URL='https://api.nhle.com/stats/rest/en/team/summary?cayenneExp=seasonId%3D20262027%20and%20gameTypeId%3D2&isAggregate=true&isGame=false&limit=40';
const JOB='nhl_special_teams_asof_v3';
const sha=s=>createHash('sha256').update(s).digest('hex');
const uuid=s=>{const h=sha(s);return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);};

// Only one FREE, pregame, season-to-date official summary request daily.
// This is not an automatic model input. Strict opt-in and no retries.
export async function syncNhlSpecialTeamsResearchSnapshot(){
 if(process.env.NHL_SPECIAL_TEAMS_CAPTURE_ENABLED!=='true')
  return {status:'DISABLED',providerCalls:0,written:0};
 const now=new Date(),at=now.toISOString();
 if(now.getUTCHours()!==18||now.getUTCMinutes()>20)
  return {status:'OUTSIDE_DAILY_SOURCE_WINDOW',providerCalls:0,written:0};
 const day=at.slice(0,10);
 const [prior,directoryR]=await Promise.all([
  db.from('sports_sync_jobs').select('id').eq('job_type',JOB)
   .gte('started_at',day+'T00:00:00Z').limit(2),
  db.from('nhl_free_source_v1').select('id,captured_at,body')
   .eq('source_url','https://api.nhle.com/stats/rest/en/team')
   .eq('body->>http_status','200').order('captured_at',{ascending:false}).limit(1).maybeSingle()
 ]);
 if(prior.error||directoryR.error)return {status:'PREFLIGHT_DATABASE_UNAVAILABLE',providerCalls:0,written:0};
 if((prior.data??[]).length)return {status:'ONE_ATTEMPT_PER_DAY_CAP',providerCalls:0,written:0};
 let directory;
 try{directory=readNhlDirectoryCache(directoryR.data as any,now.getTime())?.directory;}
 catch{return {status:'OFFICIAL_DIRECTORY_INVALID',providerCalls:0,written:0};}
 if(!directory)return {status:'NO_FRESH_VERIFIED_DIRECTORY',providerCalls:0,written:0};
 const id=uuid(JOB+':'+day);
 const claim=await db.from('sports_sync_jobs').insert({
  id,job_type:JOB,sport_key:'icehockey_nhl',league_key:'nhl',
  provider:'nhl_stats_rest',status:'running',started_at:at,
  metadata:{version:NHL_SPECIAL_TEAMS_VERSION,sourceUrl:NHL_SPECIAL_TEAMS_SOURCE_URL,
   expectedCalls:1,officialPickDelta:0,modelWeightDelta:0}
 });
 if(claim.error){if(claim.error.code==='23505')return {status:'ALREADY_CLAIMED',providerCalls:0,written:0};
  return {status:'AUDIT_CLAIM_FAILED',providerCalls:0,written:0};}
 const capturedBeforeFetch=new Date();
 let providerCalls=0;
 try{
  providerCalls=1;
  const resp=await fetch(NHL_SPECIAL_TEAMS_SOURCE_URL,{redirect:'error',cache:'no-store',
   headers:{Accept:'application/json'},signal:AbortSignal.timeout(16000)});
  if(!resp.ok||!(resp.headers.get('content-type')??'').includes('application/json')||
    Number(resp.headers.get('content-length')??0)>1000000)
   throw Error('OFFICIAL_TEAM_SOURCE_RESPONSE_UNVERIFIED');
  const raw=await resp.text();
  if(Buffer.byteLength(raw,'utf8')>1000000)throw Error('OFFICIAL_TEAM_SOURCE_OVERSIZE');
  const capturedAt=new Date().toISOString();
  if(Date.parse(capturedAt)-capturedBeforeFetch.getTime()>25000)throw Error('OFFICIAL_TEAM_SOURCE_EXPIRED');
  const normalized=parseNhlOfficialSpecialTeams({payload:JSON.parse(raw),directory,
   capturedAt,seasonId:20262027});
  if(normalized.status!=='VALIDATED_SOURCE_SCHEMA')throw Error('OFFICIAL_TEAM_SOURCE_SCHEMA_UNVERIFIED');
  const rowId=sha(NHL_SPECIAL_TEAMS_VERSION+':'+day+':'+sha(raw));
  const write=await db.from('nhl_special_teams_asof_v1').insert({
   id:rowId,snapshot_day:day,captured_at:capturedAt,source_version:NHL_SPECIAL_TEAMS_VERSION,
   season_id:20262027,source_url:NHL_SPECIAL_TEAMS_SOURCE_URL,source_hash:sha(raw),
   teams:normalized.teams,team_count:normalized.teams.length,used_by_official_model:false
  }).select('id');
  if(write.error&&write.error.code!=='23505')throw Error('SPECIAL_TEAMS_SNAPSHOT_INSERT_FAILED');
  const written=write.data?.length??0;
  const audit=await db.from('sports_sync_jobs').update({
   status:'completed',completed_at:new Date().toISOString(),records_inserted:written,
   metadata:{version:NHL_SPECIAL_TEAMS_VERSION,providerCalls,teamCount:normalized.teams.length,
    sourceSha256:sha(raw),officialPickDelta:0,modelWeightDelta:0,
    researchOnly:true,capturedAt}
  }).eq('id',id);
  if(audit.error)throw Error('SPECIAL_TEAMS_AUDIT_FINALIZATION_FAILED');
  return {status:written?'SOURCE_CAPTURED_RESEARCH_ONLY':'ALREADY_STORED',
   providerCalls,written,teamCount:normalized.teams.length,officialPicksChanged:false,
   modelChanged:false};
 }catch{
  await db.from('sports_sync_jobs').update({
   status:'failed',completed_at:new Date().toISOString(),records_inserted:0,
   last_error:'NHL_SPECIAL_TEAMS_OFFICIAL_SOURCE_UNVERIFIED'
  }).eq('id',id);
  return {status:'UNVERIFIED_OR_FAILED',providerCalls,written:0};
 }
}
