import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {extractNhlFrozenFinalScores} from '@/lib/nhl-challenger-poisson-core.mjs';
import {gradeNhlFrozenSnapshots,NHL_FREEZE_LEDGER_VERSION} from '@/lib/nhl-challenger-freeze-core.mjs';
const MAX_ROWS=2000,PAGE_SIZE=500;
export async function getNhlFrozenShadowAudit(){
 const at=new Date().toISOString();
 const frozenR=await db.from('nhl_challenger_shadow_v1')
   .select('id,event_id,model_version,scheduled_at,frozen_at,source_completed_at,home_team_id,away_team_id,market_proxies,projection,features,official_pick,production_eligible')
   .order('frozen_at',{ascending:false}).limit(300);
 if(frozenR.error?.code==='42P01')
  return {status:'SCHEMA_PENDING',version:NHL_FREEZE_LEDGER_VERSION,readOnly:true,providerCalls:0,databaseWrites:0};
 if(frozenR.error)throw Error('NHL_FROZEN_LEDGER_READ_UNAVAILABLE');
 const rows=frozenR.data??[],runs:any[]=[];
 // Fetch bounded pages to prevent the Supabase default response-row limit truncating evidence.
 const from=new Date(Date.now()-35*86400000).toISOString();
 for(let offset=0;offset<MAX_ROWS;offset+=PAGE_SIZE){
  const page=await db.from('nhl_free_runs_v1')
   .select('completed_at,games:detail->games').in('status',['PASS','PARTIAL'])
   .gte('started_at',from).not('completed_at','is',null)
   .order('completed_at',{ascending:true}).range(offset,offset+PAGE_SIZE-1);
  if(page.error)throw Error('NHL_FROZEN_LEDGER_SOURCE_READ_UNAVAILABLE');
  runs.push(...(page.data??[]));
  if((page.data??[]).length<PAGE_SIZE)break;
 }
 if(runs.length>=MAX_ROWS)return {status:'SOURCE_SCAN_CAP_REACHED',readOnly:true,providerCalls:0,databaseWrites:0};
 const finals=extractNhlFrozenFinalScores(runs,at);
 const graded=gradeNhlFrozenSnapshots({frozenRows:rows,finalScores:finals.games});
 const contextV2=rows.filter((r:any)=>r.features?.pregameContextV2?.status==='RESEARCH_CONTEXT_ONLY');
 const withGoalieEvidence=contextV2.filter((r:any)=>r.features?.pregameContextV2?.coverage?.historicalGoalieTeams===2);
 const withRestEvidence=contextV2.filter((r:any)=>r.features?.pregameContextV2?.coverage?.restEvidenceTeams===2);
 const specialTeamsV3=rows.filter((r:any)=>r.features?.specialTeamsV3?.status==='ASOF_SPECIAL_TEAMS_EVIDENCE');
 const probableV5=rows.filter((r:any)=>r.features?.goalieProbablesV5?.status==='PREGAME_PROBABLE_SOURCE_ONLY');
 return {
  status:graded.invalid?'REVIEW_INVALID_FROZEN_RECORDS':graded.settled<30?'PROSPECTIVE_SAMPLE_PENDING':'RESEARCH_STILL_UNVALIDATED',
  version:NHL_FREEZE_LEDGER_VERSION,readOnly:true,providerCalls:0,databaseWrites:0,
  source:{completedRunSnapshots:runs.length,verifiedFinalScores:finals.games.length,
   conflictingFinalScores:finals.conflicts},
  ledger:{rowsScanned:rows.length,scanCapped:rows.length>=300,latestFrozenAt:rows[0]?.frozen_at??null,
   earliestFrozenAt:rows.at(-1)?.frozen_at??null,freezeWindowMinutes:60,
   notOfficialPicks:true,calibrated:false},
  grading:graded,
  pregameContextV2:{recordsWithAsOfEvidence:contextV2.length,
   gamesWithHistoricalGoalieEvidenceForBothTeams:withGoalieEvidence.length,
   gamesWithPriorRestEvidenceForBothTeams:withRestEvidence.length,
   confirmedStartingGoaliePredictions:0,modelFormulaAdjusted:false,
   historicalGoalieIsNotNextGameStarter:true},
  specialTeamsV3:{recordsWithVerifiedPregamePPPK:specialTeamsV3.length,
   source:'OFFICIAL_NHL_TEAM_SUMMARY',modelScoringAdjusted:false,sourceMustPredateFreeze:true},
  goalieProbablesV5:{recordsWithPregameEspnProbableEvidence:probableV5.length,
   confirmedStartingGoaliesFromEspn:0,source:'ESPN_PUBLIC_SCOREBOARD',
   modelScoringAdjusted:false,sourceMustPredateFreeze:true},
  nextSteps:['Restore Supabase Data API health','Apply append-only ledger migration',
   'Enable freeze flag only after database and contract audit','Accumulate prospective outcomes and holdout'],
  policy:{autoPromotion:false,modelChanged:false,officialPicksModified:false,
   fanDuelMarketsCertified:false,prospectiveEvidenceOnly:true},
  warning:'Statistical research on fixed proxy lines, not sportsbook settlement, validated probabilities or certified ROI.'
 };
}
