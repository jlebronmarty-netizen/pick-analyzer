import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {NBA_GOAT_POLICY} from '@/lib/nba/goat-provider-policy.mjs';
import {getNbaGoatRuntimeStatus} from '@/services/nba-goat-runtime.service';
import {getNbaGoatTeamStatsStatus} from '@/services/nba-goat-team-stats.service';
import {getNbaCausalLearningReport} from '@/services/nba-causal-learning.service';
import {archiveStatus} from '@/services/nba-shared-storage.service';

const SPORT='basketball_nba',ORIGIN='CURRENT_ERA_SHADOW';
const resultKey=(v:any)=>String(v??'').toLowerCase();
const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;

export async function getNbaGoatAuditReport(){
 const [runtime,teamStats,archive,learning,pregameR,predR,legacyR]=await Promise.all([
  getNbaGoatRuntimeStatus(),
  getNbaGoatTeamStatsStatus(),
  archiveStatus(),
  getNbaCausalLearningReport(),
  db.from('nba_pregame_context_v1').select('snapshot_id,captured_at,game_ids,team_ids,coverage').order('captured_at',{ascending:false}).limit(1),
  db.from('prediction_history').select('id,game_id,market,result,settled_at,model_probability,feature_snapshot,commence_time,created_at').eq('sport_key',SPORT).eq('prediction_origin',ORIGIN).eq('feature_snapshot->>goatProviderPolicy',NBA_GOAT_POLICY).order('commence_time',{ascending:false}).limit(1000),
  db.from('prediction_history').select('id,game_id,result,settled_at,prediction_origin,feature_snapshot').eq('sport_key',SPORT).or('result.is.null,result.eq.pending,status.eq.pending').limit(5000),
 ]);
 if(pregameR.error||predR.error||legacyR.error)throw Error('NBA_GOAT_AUDIT_READ_FAILED');
 const latestPregame=pregameR.data?.[0]??null;
 const rows=predR.data??[],settled=rows.filter(x=>x.settled_at&&['win','loss','push'].includes(resultKey(x.result))),pending=rows.filter(x=>!x.settled_at&&!['win','loss','push','void'].includes(resultKey(x.result)));
 const byMarket=[...new Set(rows.map(x=>String(x.market??'unknown')))].sort().map(market=>{
  const xs=settled.filter(x=>x.market===market),wins=xs.filter(x=>resultKey(x.result)==='win').length,losses=xs.filter(x=>resultKey(x.result)==='loss').length,pushes=xs.filter(x=>resultKey(x.result)==='push').length;
  const probs=xs.map(x=>Number(x.model_probability)).filter(Number.isFinite);
  return {market,settled:xs.length,wins,losses,pushes,accuracy:wins+losses?wins/(wins+losses):null,averageModelProbability:avg(probs)};
 });
 const legacyPending=(legacyR.data??[]).filter((x:any)=>!(x.prediction_origin===ORIGIN&&x.feature_snapshot?.goatProviderPolicy===NBA_GOAT_POLICY)).length;
 const mlSettled=settled.filter(x=>x.market==='moneyline');const mlProbabilities=[...new Set(mlSettled.map(x=>Number(x.model_probability)).filter(Number.isFinite))];const mlWins=mlSettled.filter(x=>resultKey(x.result)==='win').length;const mlLosses=mlSettled.filter(x=>resultKey(x.result)==='loss').length;const mlObserved=mlWins+mlLosses?mlWins/(mlWins+mlLosses):null;
 const capturedScores=rows.filter((x:any)=>x.feature_snapshot?.pregameFeatureScoresCaptured===true).length;
 const legacyMissingScores=rows.length-capturedScores;
 const latestArchive:any=archive.last_run?.summary??{};
 const issues:string[]=[];
 const warnings:string[]=[];
 if(pending.length)issues.push(pending.length+' GOAT current-era market(s) remain unsettled.');
 if(!teamStats.fresh||teamStats.rows!==30)issues.push('GOAT team stats are incomplete or stale.');
 if(!archive.last_schedule)issues.push('GOAT schedule archive is unavailable.');
 if(!latestPregame)warnings.push('GOAT pregame injuries/projected-lineup archive has not captured its first snapshot yet.');
 if(legacyMissingScores)warnings.push(legacyMissingScores+' historical GOAT rows predate the feature-score persistence fix; their zero quality scores are treated as unavailable, not as true zero-quality inputs.');
 if(learning.sample.settled<30)warnings.push('GOAT settled sample is below 30 markets; accuracy/calibration remain directional.');
 if(mlSettled.length>=5&&mlProbabilities.length===1)warnings.push('GOAT moneyline probability is collapsed to a single value ('+mlProbabilities[0]+'%) across '+mlSettled.length+' settled ML markets; investigate calibration in challenger research before any production formula change.');
 if(latestPregame)warnings.push('Fresh GOAT injuries/projected lineups are archived as pregame evidence but remain excluded from model scoring until separately validated and approved.');else warnings.push('Fresh GOAT player injuries and projected lineups are available from the subscription but are not yet direct scoring inputs; stale legacy injury/lineup rows remain excluded from confidence lift.');
 return {
  status:issues.length?'ATTENTION':'READY_WITH_MONITORING',
  generatedAt:new Date().toISOString(),
  cohort:{policy:NBA_GOAT_POLICY,totalMarkets:rows.length,settledMarkets:settled.length,pendingMarkets:pending.length,uniqueGames:new Set(rows.map(x=>x.game_id)).size,settledUniqueGames:new Set(settled.map(x=>x.game_id)).size,byMarket},
  runtime,
  data:{
   archive:{lastRunStatus:archive.last_run?.status??null,lastRunCompletedAt:archive.last_run?.completed_at??null,lastSchedule:archive.last_schedule??null,lastSnapshot:archive.last_snapshot??null,latestGatewayRequests:Number(latestArchive.gateway_requests??0),latestPlanned:Number(latestArchive.planned??0),latestCompleted:Number(latestArchive.completed??0),latestErrors:Array.isArray(latestArchive.errors)?latestArchive.errors:[]},
   teamStats,
   pregameFeatureScores:{captured:capturedScores,legacyUnavailable:legacyMissingScores,futureFixActive:true},
   pregameContext:{latestSnapshot:latestPregame,freshPlayerInjuriesCaptured:Boolean(latestPregame),freshProjectedLineupsCaptured:Boolean(latestPregame),freshPlayerInjuriesInScoring:false,freshProjectedLineupsInScoring:false,postgameLineupTruthAvailable:learning.evidence.lineupTruthCurrent,postgamePlayerStatsAvailable:learning.evidence.playerGameStatsCurrent,postgameMatchupsAvailable:learning.evidence.matchupTrackingCurrent},
  },
  learning:{sample:learning.sample,evidence:learning.evidence,patterns:learning.patterns.slice(0,20),candidateAutoApply:false,calibrationAudit:{moneylineSettled:mlSettled.length,distinctMoneylineProbabilities:mlProbabilities,observedMoneylineAccuracy:mlObserved,productionFormulaChanged:false}},
  settlement:{goatPending:pending.length,directGameFallback:{enabled:true,maxCallsPerRun:1,minimumAgeHours:6},legacyPendingExcludedFromGoatHealth:legacyPending},
  costControls:{
   archiveGatewayRequestsLatest:Number(latestArchive.gateway_requests??0),
   teamStatsDirectCallsWhenFresh:0,
   teamStatsRefreshMaxCalls:1,
   pbpBackfillMaxCallsPerRun:3,
   v2ContextMaxCallsPerRun:3,
   v3MatchupMaxCallsPerRun:2,
   resultFallbackMaxCallsPerRun:1,
   note:'Backfill calls stop once each game context is stored; audit/report endpoints make zero provider calls.',
  },
  issues,warnings,
  policy:{autoApply:false,autoPromotion:false,officialPicksModified:false,productionModelFormulaChanged:false},
 };
}
