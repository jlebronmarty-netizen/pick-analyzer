import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {extractNhlFrozenFinalScores} from '@/lib/nhl-challenger-poisson-core.mjs';
import {gradeNhlFrozenSnapshots,NHL_FREEZE_LEDGER_VERSION} from '@/lib/nhl-challenger-freeze-core.mjs';
const MAX_ROWS=1800;
export async function getNhlFrozenShadowAudit(){
 const at=new Date().toISOString();
 const [frozenR,runsR]=await Promise.all([
  db.from('nhl_challenger_shadow_v1')
    .select('id,event_id,model_version,scheduled_at,frozen_at,source_completed_at,home_team_id,away_team_id,market_proxies,projection,official_pick,production_eligible')
    .order('frozen_at',{ascending:false}).limit(300),
  db.from('nhl_free_runs_v1')
    .select('completed_at,games:detail->games').in('status',['PASS','PARTIAL'])
    .gte('started_at',new Date(Date.now()-35*86400000).toISOString())
    .not('completed_at','is',null).order('completed_at',{ascending:true}).limit(MAX_ROWS)
 ]);
 if(frozenR.error?.code==='42P01')
  return {status:'SCHEMA_PENDING',version:NHL_FREEZE_LEDGER_VERSION,readOnly:true,providerCalls:0,databaseWrites:0};
 if(frozenR.error||runsR.error)throw Error('NHL_FROZEN_LEDGER_READ_UNAVAILABLE');
 const rows=frozenR.data??[],runs=runsR.data??[];
 const finals=extractNhlFrozenFinalScores(runs,at);
 if(runs.length>=MAX_ROWS)return {status:'SOURCE_SCAN_CAP_REACHED',readOnly:true,providerCalls:0,databaseWrites:0};
 const graded=gradeNhlFrozenSnapshots({frozenRows:rows,finalScores:finals.games});
 return {
  status:graded.invalid?'REVIEW_INVALID_FROZEN_RECORDS':graded.settled<30?'PROSPECTIVE_SAMPLE_PENDING':'RESEARCH_STILL_UNVALIDATED',
  version:NHL_FREEZE_LEDGER_VERSION,readOnly:true,providerCalls:0,databaseWrites:0,
  source:{completedRunSnapshots:runs.length,verifiedFinalScores:finals.games.length,
   conflictingFinalScores:finals.conflicts},
  ledger:{rowsScanned:rows.length,scanCapped:rows.length>=300,latestFrozenAt:rows[0]?.frozen_at??null,
   earliestFrozenAt:rows.at(-1)?.frozen_at??null,freezeWindowMinutes:60,
   notOfficialPicks:true,calibrated:false},
  grading:graded,
  nextSteps:['Restore Supabase Data API health','Apply append-only ledger migration',
   'Enable freeze flag only after database and contract audit','Accumulate prospective outcomes and holdout'],
  policy:{autoPromotion:false,modelChanged:false,officialPicksModified:false,
   fanDuelMarketsCertified:false,prospectiveEvidenceOnly:true},
  warning:'Statistical research on fixed proxy lines, not sportsbook settlement, validated probabilities or certified ROI.'
 };
}
