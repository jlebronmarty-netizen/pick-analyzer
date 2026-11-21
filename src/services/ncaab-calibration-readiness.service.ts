import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {
 evaluateNcaabFrozenCalibration
} from '@/lib/ncaab-prospective-calibration-evaluation.mjs';
import {NCAAB_CALIBRATION_VERSION} from '@/lib/ncaab-prospective-calibration-core.mjs';
import {readNcaabBoundedArchive} from '@/lib/ncaab-bounded-archive-reader.mjs';

export async function getNcaabCalibrationReadiness(){
 const asOf=new Date().toISOString();let schemaMissing=false;
 const r=await readNcaabBoundedArchive({maxRows:2000,pageSize:250,
  readPage:async({after,limit}:{after:string|null;limit:number})=>{
   let query=db.from('ncaab_calibration_shadow_v1').select('*')
    .lte('frozen_at',asOf).lte('created_at',asOf).order('id',{ascending:true}).limit(limit);
   if(after!==null)query=query.gt('id',after);
   const response=await query;
   if(response.error?.code==='42P01'||response.error?.code==='PGRST205')schemaMissing=true;
   return response;
  }});
 if(schemaMissing)return {status:'SCHEMA_PENDING',readOnly:true,version:NCAAB_CALIBRATION_VERSION};
 if(r.status==='SOURCE_ARCHIVE_CAPPED')
  return {status:'SHADOW_SCAN_CAPPED',readOnly:true,version:NCAAB_CALIBRATION_VERSION};
 if(r.status!=='OK')throw Error('NCAAB_SHADOW_LEDGER_UNAVAILABLE');
 const rows=r.rows,eventIds=[...new Set(rows.map(x=>x.event_id))];
 if(!eventIds.length)return {status:'AWAITING_FIRST_NEW_NCAAB_FREEZE',
  version:NCAAB_CALIBRATION_VERSION,readOnly:true,providerCalls:0,databaseWrites:0,
  frozen:0,settled:0,modelPromotionAllowed:false};
 const outcomes:any[]=[],originals:any[]=[];let readCalls=r.readCalls;
 // Bound request length and fetch all versions for each event so conflicts
 // cannot disappear behind a row limit or an arbitrary last-write-wins Map.
 for(let offset=0;offset<eventIds.length;offset+=100){
  const ids=eventIds.slice(offset,offset+100);
  for(const [table,select,timeColumn,target] of [
   ['ncaab_daily_outcomes_v1','id,event_id,body,observed_at','observed_at',outcomes],
   ['ncaab_daily_predictions_v1','id,event_id,body,created_at,scheduled_at','created_at',originals]
  ] as const){
   const batch=await readNcaabBoundedArchive({maxRows:200,pageSize:200,
    readPage:async({after,limit}:{after:string|null;limit:number})=>{
     let query=db.from(table).select(select).in('event_id',ids)
      .lte(timeColumn,asOf).order('id',{ascending:true}).limit(limit);
     if(after!==null)query=query.gt('id',after);
     return await query;
    }});
   readCalls+=batch.readCalls;
   if(batch.status!=='OK')throw Error('NCAAB_SHADOW_SOURCE_SCAN_UNAVAILABLE');
   target.push(...batch.rows);
  }
 }
 const result=evaluateNcaabFrozenCalibration({frozenRows:rows,finalRows:outcomes,originalRows:originals,asOf});
 return {...result,version:NCAAB_CALIBRATION_VERSION,
  readOnly:true,providerCalls:0,databaseWrites:0,databaseReadCalls:readCalls};
}
