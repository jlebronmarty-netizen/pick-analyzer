import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {
 NCAAB_CALIBRATION_VERSION,ncaabVerifiedHistoricalResult,planNcaabCalibrationShadow
} from '@/lib/ncaab-prospective-calibration-core.mjs';
import {ncaabUniqueEventIndex} from '@/lib/ncaab-calibration-evidence.mjs';
import {readNcaabBoundedArchive} from '@/lib/ncaab-bounded-archive-reader.mjs';

// No vendor calls, no new schedule. Only forecasts added by the just-completed
// NCAAB core cron. Original preseason engine and outcomes remain immutable.
const PAGE=500,MAX_ARCHIVE=2000,MAX_CANDIDATES=200,MAX_WRITES=100;
async function all(table:string,select:string,timeColumn:string,asOf:string){
 return readNcaabBoundedArchive({maxRows:MAX_ARCHIVE,pageSize:PAGE,
  readPage:async({after,limit}:{after:string|null;limit:number})=>{
   let query=db.from(table).select(select).lte(timeColumn,asOf)
    .order('id',{ascending:true}).limit(limit);
   if(after!==null)query=query.gt('id',after);
   return await query;
  }});
}
export async function runNcaabProspectiveCalibrationShadow(core:{
 status?:string;forecasts?:number}){
 if(process.env.NCAAB_CALIBRATION_SHADOW_ENABLED!=='true')
  return {status:'DISABLED',providerCalls:0,written:0};
 if(core?.status!=='PASS'||!Number.isSafeInteger(core?.forecasts)||
  (core.forecasts??0)<=0)
  return {status:'NO_NEW_CORE_FORECASTS',providerCalls:0,written:0};
 const at=new Date(),now=at.toISOString();
 const latest=await db.from('ncaab_daily_predictions_v1')
  .select('id,event_id,scheduled_at,created_at,body')
  .gte('created_at',new Date(at.getTime()-8*60000).toISOString())
  .lte('created_at',now)
  .gte('scheduled_at',new Date(at.getTime()+60*60000).toISOString())
  .order('created_at',{ascending:false}).limit(MAX_CANDIDATES+1);
 if(latest.error)return {status:'NEW_FORECAST_READ_FAILED',providerCalls:0,written:0};
 if((latest.data??[]).length>MAX_CANDIDATES)return {
  status:'NEW_FORECAST_SCAN_CAPPED',providerCalls:0,written:0};
 if(!(latest.data??[]).length)return {status:'NO_FRESH_FROZEN_FORECASTS',providerCalls:0,written:0};
 const preflight=await db.from('ncaab_calibration_shadow_v1')
  .select('id').limit(1);
 if(preflight.error?.code==='42P01'||preflight.error?.code==='PGRST205')
  return {status:'SCHEMA_PENDING',providerCalls:0,written:0};
 if(preflight.error)return {status:'SHADOW_SCHEMA_UNAVAILABLE',providerCalls:0,written:0};
 const [p,o]=await Promise.all([
  all('ncaab_daily_predictions_v1','id,event_id,scheduled_at,created_at,source_id,body','created_at',now),
  all('ncaab_daily_outcomes_v1','id,event_id,observed_at,source_id,body','observed_at',now)
 ]);
 if(p.status!=='OK'||o.status!=='OK')
  return {status:'ARCHIVE_UNAVAILABLE_OR_CAPPED',providerCalls:0,written:0};
 const forecasts=ncaabUniqueEventIndex(p.rows);
 const outcomes=ncaabUniqueEventIndex(o.rows);
 const fresh=ncaabUniqueEventIndex(latest.data??[]);
 const history=[...outcomes.unique.values()].map(v=>ncaabVerifiedHistoricalResult(forecasts.unique.get(v.event_id),v))
  .filter(x=>x.status==='VERIFIED_PAST_FINAL');
 const newRows:any[]=[],reasons:Record<string,number>={};
 for(const recent of latest.data??[]){
  if(forecasts.duplicates.has(recent.event_id)||fresh.duplicates.has(recent.event_id)){
   reasons.DUPLICATE_ORIGINAL_FORECAST_EVENT=(reasons.DUPLICATE_ORIGINAL_FORECAST_EVENT??0)+1;continue;
  }
  const result=planNcaabCalibrationShadow({prediction:recent,decisionAt:now,history,captureFullEvidence:true});
  if(!('record' in result)){const reason='reason' in result?result.reason:'UNKNOWN';
   reasons[reason]=(reasons[reason]??0)+1;continue;}
  newRows.push(result.record);
  if(newRows.length>=MAX_WRITES)break;
 }
 if(!newRows.length)return {
  status:'NO_VALID_ASOF_CALIBRATION_CANDIDATES',providerCalls:0,written:0,
  earlierVerifiedHistory:history.length,reasons};
 const result=await db.from('ncaab_calibration_shadow_v1')
  .upsert(newRows,{onConflict:'id',ignoreDuplicates:true}).select('id');
 if(result.error)return {
  status:'SHADOW_INSERT_UNVERIFIED',providerCalls:0,written:0};
 return {status:'FROZEN_RESEARCH_ONLY',version:NCAAB_CALIBRATION_VERSION,
  providerCalls:0,written:result.data?.length??0,candidateRows:newRows.length,
  earlierVerifiedHistory:history.length,reasons,originalForecastsChanged:false,
  originalSelectionChanged:false,officialPicksChanged:false,
  calibratedAccuracyValidated:false};
}
