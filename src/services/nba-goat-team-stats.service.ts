import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {normalizeTeamSeasonAverages,teamStatsFresh} from '@/lib/nba/goat-team-stats-core.mjs';
const SPORT='basketball_nba',PROVIDER='balldontlie',JOB='nba_goat_team_stats_v1',FRESH_MS=6*3600000;
function seasonYear(now=new Date()){return now.getUTCMonth()>=9?now.getUTCFullYear():now.getUTCFullYear()-1;}
async function currentRows(year:number){const r=await db.from('team_stats').select('team_name,updated_at,raw_data').eq('sport_key',SPORT).eq('season',String(year));if(r.error)throw Error('NBA_GOAT_TEAM_STATS_READ_FAILED');return r.data??[];}
async function fetchAverages(year:number){
 const key=process.env.BALLDONTLIE_API_KEY?.trim();if(!key)throw Error('BALLDONTLIE_API_KEY_UNAVAILABLE');
 const u=new URL('https://api.balldontlie.io/nba/v1/team_season_averages/general');u.searchParams.set('season',String(year));u.searchParams.set('season_type','regular');u.searchParams.set('type','base');u.searchParams.set('per_page','100');
 const r=await fetch(u,{headers:{Authorization:key,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok||!(r.headers.get('content-type')??'').includes('application/json'))throw Error('NBA_GOAT_TEAM_STATS_PROVIDER_FAILED');
 return r.json();
}
export async function getNbaGoatTeamStatsStatus(){const year=seasonYear(),rows=await currentRows(year);return {provider:PROVIDER,season:year,rows:rows.length,fresh:teamStatsFresh(rows,new Date(),FRESH_MS),provider_calls:0,database_writes:0,max_age_hours:FRESH_MS/3600000};}
export async function syncNbaGoatTeamStatsIfStale({force=false}:{force?:boolean}={}){
 const started=Date.now(),year=seasonYear(),before=await currentRows(year);
 if(!force&&teamStatsFresh(before,new Date(),FRESH_MS))return {status:'FRESH_NO_OP',provider:PROVIDER,season:year,rows:before.length,provider_calls:0,database_writes:0};
 const receivedAt=new Date().toISOString();
 const job=await db.from('sports_sync_jobs').insert({job_type:JOB,sport_key:SPORT,league_key:'nba',provider:PROVIDER,season:String(year),status:'running',metadata:{version:'NBA_GOAT_TEAM_STATS_V1',force}}).select('id').single();if(job.error)throw Error('NBA_GOAT_TEAM_STATS_JOB_START_FAILED');
 try{
  const payload=await fetchAverages(year),normalized=normalizeTeamSeasonAverages(payload,{season:year,receivedAt});
  const write=await db.from('team_stats').upsert(normalized,{onConflict:'team_name,sport_key,season'}).select('team_name');if(write.error||write.data?.length!==30)throw Error('NBA_GOAT_TEAM_STATS_WRITE_FAILED');
  const done=await db.from('sports_sync_jobs').update({status:'completed',completed_at:new Date().toISOString(),records_fetched:normalized.length,records_inserted:normalized.length,duration_ms:Date.now()-started,metadata:{version:'NBA_GOAT_TEAM_STATS_V1',providerCalls:1,rows:normalized.length,season:year}}).eq('id',job.data.id);if(done.error)throw Error('NBA_GOAT_TEAM_STATS_JOB_FINALIZE_FAILED');
  return {status:'UPDATED',provider:PROVIDER,season:year,rows:normalized.length,provider_calls:1,database_writes:normalized.length};
 }catch(e){await db.from('sports_sync_jobs').update({status:'failed',completed_at:new Date().toISOString(),error_count:1,last_error:e instanceof Error?e.message:'NBA_GOAT_TEAM_STATS_FAILED',duration_ms:Date.now()-started}).eq('id',job.data.id);throw e;}
}
