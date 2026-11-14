import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {
 NHL_CHALLENGER_VERSION,extractNhlFrozenFinalScores,forecastNhlChallenger,
 walkForwardNhlChallenger,pairedNhlChallengerBenchmark
} from '@/lib/nhl-challenger-poisson-core.mjs';

// Read-only standalone model research endpoint. No provider calls, writes,
// schedule changes, odds assumptions, or official-pick integration.
export async function getNhlPoissonChallengerAudit(){
 const now=new Date(),at=now.toISOString();
 const pageSize=500,maxRows=3000,runs:any[]=[];
 for(let offset=0;offset<maxRows;offset+=pageSize){
  const r=await db.from('nhl_free_runs_v1')
   .select('completed_at,games:detail->games').in('status',['PASS','PARTIAL'])
   .not('completed_at','is',null)
   .order('completed_at',{ascending:true}).range(offset,offset+pageSize-1);
  if(r.error)throw Error('NHL_CHALLENGER_RUN_ARCHIVE_UNAVAILABLE');
  runs.push(...(r.data??[]));
  if((r.data??[]).length<pageSize)break;
 }
 const capped=runs.length>=maxRows;
 const [predR,contextR]=await Promise.all([
  db.from('nhl_free_predictions_v1').select('id,body').limit(500),
  db.from('nhl_game_context_v2').select('event_id').limit(500)
 ]);
 if(predR.error||contextR.error)throw Error('NHL_CHALLENGER_SOURCE_READ_FAILED');
 const extraction=extractNhlFrozenFinalScores(runs,at),finalScores=extraction.games;
 const walk=walkForwardNhlChallenger(finalScores);
 const paired=pairedNhlChallengerBenchmark(finalScores,predR.data??[]);
 const last=runs.at(-1);
 const upcoming=(Array.isArray(last?.games)?last.games:[])
  .filter((g:any)=>g?.status==='SCHEDULED'&&Number.isFinite(Date.parse(g.scheduledAt))&&
    Date.parse(g.scheduledAt)>now.getTime()+10*60000);
 const candidates=upcoming.map((g:any)=>{
  const result=forecastNhlChallenger({homeId:g.homeId,awayId:g.awayId,scheduledAt:g.scheduledAt,
   asOf:at,finalScores});
  return {
   eventId:g.eventId,scheduledAt:g.scheduledAt,status:result.status,
   reason:'reason' in result?String(result.reason):null,
   projection:result.status==='UNVALIDATED_SHADOW_CHALLENGER'&&'projection' in result?result.projection:null,
   researchProbabilities:result.status==='UNVALIDATED_SHADOW_CHALLENGER'&&'markets' in result?result.markets:null,
   officialPick:false,productionEligible:false,calibrated:false,
   warning:'Descriptive, uncalibrated model research; market lines are generic testing lines, not FanDuel quotes.'
  };
 });
 const ready=candidates.filter((x:any)=>x.status==='UNVALIDATED_SHADOW_CHALLENGER').length;
 return {
  status:capped?'ARCHIVE_SCAN_CAPPED':walk.evaluatedGames<30?'RESEARCH_NEEDS_FORWARD_SAMPLE':'RESEARCH_UNVALIDATED',
  version:NHL_CHALLENGER_VERSION,generatedAt:at,mode:'READ_ONLY_SHADOW_CHALLENGER',
  historicalEvidence:{completedRunRowsRead:runs.length,archiveScanCapped:capped,
   verifiedScoreFinals:finalScores.length,conflictingScoreRecords:extraction.conflicts,
   postgameContextGames:contextR.data?.length??0,scoreOnlyGamesMissingBoxscore:
    finalScores.filter(x=>!(contextR.data??[]).some((c:any)=>c.event_id===x.eventId)).length},
  walkForward:walk,pairedComparison:paired,
  future:{slateGames:upcoming.length,eligibleResearchForecasts:ready,
   blockedResearchForecasts:candidates.length-ready,provisional:candidates.slice(0,20)},
  modelScope:{
   source:'NHL_OFFICIAL_FINAL_SCORES_FIRST_OBSERVED_IN_CRON_ARCHIVE',
   formulas:'INDEPENDENT_POISSON_SHRUNK_ROLLING_FIVE_V0',
   assumptions:['NO_OT_SO_TIE_MODEL','TEAM_GOAL_COUNTS_NOT_XG','VENUE_PRIOR_ESTIMATED_ONLY_FROM_EARLIER_FINALS'],
   dataMissing:['PREGAME_CONFIRMED_GOALIE','PREGAME_PP_PK','PREGAME_INJURIES',
    'FRESH_FANDUEL_ML_SPREAD_TOTAL_PRICES','VERIFIED_BOOK_MARKET_RULES'],
   sourceCalls:0,databaseWrites:0,oddsProviderCalls:0,
   calibrated:false,holdoutPassed:false,provenImprovementOverDratings:false,
   officialPicksModified:false,productionModelFormulaChanged:false,canAutoPromote:false
  },
  warning:'Unvalidated score-distribution experiment; not a betting signal or certified sportsbook market probability.'
 };
}
