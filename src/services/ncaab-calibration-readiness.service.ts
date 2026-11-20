import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {
 evaluateNcaabFrozenCalibration
} from '@/lib/ncaab-prospective-calibration-evaluation.mjs';
import {NCAAB_CALIBRATION_VERSION} from '@/lib/ncaab-prospective-calibration-core.mjs';

export async function getNcaabCalibrationReadiness(){
 const r=await db.from('ncaab_calibration_shadow_v1')
  .select('*').order('frozen_at',{ascending:false}).limit(250);
 if(r.error?.code==='42P01'||r.error?.code==='PGRST205')
  return {status:'SCHEMA_PENDING',readOnly:true,version:NCAAB_CALIBRATION_VERSION};
 if(r.error)throw Error('NCAAB_SHADOW_LEDGER_UNAVAILABLE');
 if((r.data??[]).length>=250)
  return {status:'SHADOW_SCAN_CAPPED',readOnly:true,version:NCAAB_CALIBRATION_VERSION};
 const rows=r.data??[],eventIds=rows.map(x=>x.event_id);
 if(!eventIds.length)return {status:'AWAITING_FIRST_NEW_NCAAB_FREEZE',
  version:NCAAB_CALIBRATION_VERSION,readOnly:true,providerCalls:0,databaseWrites:0,
  frozen:0,settled:0,modelPromotionAllowed:false};
 const o=await db.from('ncaab_daily_outcomes_v1')
  .select('id,event_id,body,observed_at').in('event_id',eventIds).limit(500);
 if(o.error||(o.data??[]).length>=500)throw Error('NCAAB_SHADOW_OUTCOME_SCAN_UNAVAILABLE');
 const result=evaluateNcaabFrozenCalibration({frozenRows:rows,finalRows:o.data??[]});
 return {status:result.status,version:NCAAB_CALIBRATION_VERSION,
  readOnly:true,providerCalls:0,databaseWrites:0,...result};
}
