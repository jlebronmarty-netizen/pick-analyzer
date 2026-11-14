import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {planNhlFrozenSlate} from '@/lib/nhl-challenger-freeze-core.mjs';
const SLOT_HOURS=new Set([11,15,18,20,22]),MAX_RUN_ARCHIVE=1800;

// Flag is absent in production by default. No additional vendor calls.
// An unhealthy database or unapplied migration causes no writes or retries.
export async function runNhlChallengerShadowFreeze(){
 if(process.env.NHL_CHALLENGER_FREEZE_ENABLED!=='true')
  return {status:'DISABLED',sourceCalls:0,written:0,officialPicksChanged:false};
 const now=new Date(),at=now.toISOString();
 if(!SLOT_HOURS.has(now.getUTCHours())||now.getUTCMinutes()>20)
  return {status:'OUTSIDE_BOUNDED_FREEZE_WINDOW',sourceCalls:0,written:0};
 const from=new Date(now.getTime()-35*86400000).toISOString();
 const [runsR,frozenR]=await Promise.all([
  db.from('nhl_free_runs_v1').select('completed_at,games:detail->games')
   .in('status',['PASS','PARTIAL']).gte('started_at',from)
   .not('completed_at','is',null).order('completed_at',{ascending:true}).limit(MAX_RUN_ARCHIVE),
  db.from('nhl_challenger_shadow_v1').select('id')
   .gte('scheduled_at',new Date(now.getTime()-2*86400000).toISOString()).limit(300)
 ]);
 if(frozenR.error?.code==='42P01')return {status:'SCHEMA_PENDING',sourceCalls:0,written:0};
 if(runsR.error||frozenR.error)return {status:'DATABASE_UNAVAILABLE',sourceCalls:0,written:0};
 const runs=runsR.data??[];
 if(runs.length>=MAX_RUN_ARCHIVE)return {status:'SOURCE_SCAN_CAP_REACHED',sourceCalls:0,written:0};
 const plan=planNhlFrozenSlate({runs,alreadyFrozen:(frozenR.data??[]).map(x=>x.id),decisionAt:at,maxWrites:3});
 if(plan.status!=='READY_TO_FREEZE')
  return {status:plan.status,sourceCalls:0,written:0,blocked:plan.blocked?.length??0};
 const w=await db.from('nhl_challenger_shadow_v1')
  .upsert(plan.planned,{onConflict:'id',ignoreDuplicates:true})
  .select('id');
 if(w.error)return {status:'WRITE_NOT_VERIFIED',sourceCalls:0,written:0};
 return {status:'FROZEN_SHADOW_ONLY',sourceCalls:0,written:w.data?.length??0,
  candidateGames:plan.planned.length,officialPicksChanged:false,modelModified:false,
  markets:['ML_PROXY','HOME_-1.5_PROXY','TOTAL_O/U_5.5_PROXY'],
  validationPassed:false,bookContractsCertified:false};
}
