import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {NBA_GOAT_POLICY,NBA_GOAT_CONTINUOUS_DAILY_ROW_CAP} from '@/lib/nba/goat-provider-policy.mjs';
import {nbaGoatLearningReadiness} from '@/lib/nba/goat-calibration-core.mjs';
import {buildNbaVersionReport,nbaVersionAuditEvidence,type NbaVersionRow} from '@/lib/nba/model-version-evidence';
import {getNbaGoatRuntimeStatus} from '@/services/nba-goat-runtime.service';
import {getNbaGoatTeamStatsStatus} from '@/services/nba-goat-team-stats.service';
import {getNbaCausalLearningReport} from '@/services/nba-causal-learning.service';
import {archiveStatus} from '@/services/nba-shared-storage.service';

const SPORT='basketball_nba',ORIGIN='CURRENT_ERA_SHADOW';
const resultKey=(v:any)=>String(v??'').toLowerCase();
type AuditRow=NbaVersionRow & {feature_snapshot:Record<string,unknown>|null};

export async function getNbaGoatAuditReport(){
 const [runtime,teamStats,archive,learning,pregameR,propR,predR,legacyR]=await Promise.all([
  getNbaGoatRuntimeStatus(),
  getNbaGoatTeamStatsStatus(),
  archiveStatus(),
  getNbaCausalLearningReport(),
  db.from('nba_pregame_context_v1').select('snapshot_id,captured_at,game_ids,team_ids,coverage').order('captured_at',{ascending:false}).limit(1),
  db.from('nba_market_quotes_v1').select('quote_id,provider_game_id',{count:'exact'}).eq('market','props').limit(1),
  db.from('prediction_history').select('id,game_id,model_version,market,result,settled_at,model_probability,feature_snapshot,commence_time,generated_at,created_at,recommended_pick,production_eligible').eq('sport_key',SPORT).eq('prediction_origin',ORIGIN).eq('feature_snapshot->>goatProviderPolicy',NBA_GOAT_POLICY).order('commence_time',{ascending:false}).limit(500),
  db.from('prediction_history').select('id,game_id,result,settled_at,prediction_origin,feature_snapshot').eq('sport_key',SPORT).or('result.is.null,result.eq.pending,status.eq.pending').limit(5000),
 ]);
 if(pregameR.error||propR.error||predR.error||legacyR.error)throw Error('NBA_GOAT_AUDIT_READ_FAILED');
 const latestPregame=pregameR.data?.[0]??null;
 const allRows=(predR.data??[]) as AuditRow[];
 if(allRows.length>=500)throw Error('NBA_GOAT_AUDIT_SCAN_LIMIT');
 const versionReport=buildNbaVersionReport(allRows),byVersion=nbaVersionAuditEvidence(allRows);
 const current=byVersion.find(version=>version.modelVersion===versionReport.selectedModelVersion);
 const rows=versionReport.rows,settled=rows.filter(x=>x.settled_at&&['win','loss','push'].includes(resultKey(x.result))),pending=allRows.filter(x=>!x.settled_at&&!['win','loss','push','void'].includes(resultKey(x.result)));
 const byMarket=current?.byMarket??[];
 const legacyPending=(legacyR.data??[]).filter((x:any)=>!(x.prediction_origin===ORIGIN&&x.feature_snapshot?.goatProviderPolicy===NBA_GOAT_POLICY)).length;
 const mlSettled=current?.calibrationAudit.moneylineSettled??0,mlProbabilities=current?.calibrationAudit.distinctMoneylineProbabilities??[];
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
 if(mlSettled<100)warnings.push('This model version has fewer than 100 independent settled moneyline games. No prospective holdout is verified; accuracy/calibration do not validate an advantage.');
 if(versionReport.models>1)warnings.push('Versions are reported separately. Unversioned causal-learning pattern aggregates are withheld until their reader is version-scoped.');
 if(mlSettled>=5&&mlProbabilities.length===1)warnings.push('GOAT moneyline probability is collapsed to a single value ('+mlProbabilities[0]+'%) across '+mlSettled+' independent settled ML games in '+versionReport.selectedModelVersion+'; investigate calibration in challenger research before any production formula change.');
 if(latestPregame)warnings.push('Fresh GOAT injuries/projected lineups are archived as pregame evidence but remain excluded from model scoring until separately validated and approved.');else warnings.push('Fresh GOAT player injuries and projected lineups are available from the subscription but are not yet direct scoring inputs; stale legacy injury/lineup rows remain excluded from confidence lift.');
 return {
  status:issues.length?'ATTENTION':'READY_WITH_MONITORING',
  generatedAt:new Date().toISOString(),
  cohort:{policy:NBA_GOAT_POLICY,modelVersion:versionReport.selectedModelVersion,modelVersions:versionReport.modelVersions,models:versionReport.models,aggregationScope:versionReport.aggregationScope,totalMarkets:rows.length,settledMarkets:settled.length,pendingMarkets:versionReport.total.pending,uniqueGames:new Set(rows.map(x=>x.game_id)).size,settledUniqueGames:new Set(settled.map(x=>x.game_id)).size,byMarket,byVersion,allVersionsTotal:versionReport.allVersionsTotal},
  runtime,
  data:{
   archive:{lastRunStatus:archive.last_run?.status??null,lastRunCompletedAt:archive.last_run?.completed_at??null,lastSchedule:archive.last_schedule??null,lastSnapshot:archive.last_snapshot??null,latestGatewayRequests:Number(latestArchive.gateway_requests??0),latestPlanned:Number(latestArchive.planned??0),latestCompleted:Number(latestArchive.completed??0),latestErrors:Array.isArray(latestArchive.errors)?latestArchive.errors:[]},
   teamStats,
   pregameFeatureScores:{captured:capturedScores,legacyUnavailable:legacyMissingScores,futureFixActive:true},
   props:{archivedQuotes:propR.count??0,certifiedPredictionCohort:false,accuracyAvailable:false,researchAuditEndpoint:'/api/nba/goat/props-research',note:'Archived props now have a bounded statistical-only historical grading pilot. No certified prospective prop prediction or settlement cohort exists.'},
   pregameContext:{latestSnapshot:latestPregame,freshPlayerInjuriesCaptured:Boolean(latestPregame),freshProjectedLineupsCaptured:Boolean(latestPregame),freshPlayerInjuriesInScoring:false,freshProjectedLineupsInScoring:false,postgameLineupTruthAvailable:learning.evidence.lineupTruthCurrent,postgamePlayerStatsAvailable:learning.evidence.playerGameStatsCurrent,postgameMatchupsAvailable:learning.evidence.matchupTrackingCurrent},
  },
  learning:{sample:current?.sample??{settled:0,uniqueGames:0,wins:0,losses:0,accuracy:null,brier:null,markets:[]},evidence:learning.evidence,evidenceScope:'ARCHIVE_COVERAGE_NOT_VERSION_VALIDATION',patterns:versionReport.models<=1?learning.patterns.slice(0,20):[],patternsScope:versionReport.models<=1?'SINGLE_VERSION_DESCRIPTIVE':'WITHHELD_MIXED_VERSION_AGGREGATE',candidateAutoApply:false,readiness:nbaGoatLearningReadiness({settledMarkets:settled.length,settledMoneyline:mlSettled,distinctMoneylineProbabilities:mlProbabilities,featureScoresCaptured:capturedScores}),calibrationAudit:current?.calibrationAudit??null,formulaAudit:{injuryImpactSign:{status:'HISTORICAL_PATTERN_SEPARATE_SHADOW_COHORT',finding:'The historical NBA cohort passed a negative penalty into a subtraction. Corrected inputs are tracked in a separate SHADOW version; the historical forecast is retained.',productionFormulaChanged:false,hypothesisKey:'nba_injury_penalty_sign_v1'}}},
  settlement:{goatPending:pending.length,directGameFallback:{enabled:true,maxCallsPerRun:1,minimumAgeHours:6},legacyPendingExcludedFromGoatHealth:legacyPending},
  costControls:{
   archiveGatewayRequestsLatest:Number(latestArchive.gateway_requests??0),
   teamStatsDirectCallsWhenFresh:0,
   teamStatsRefreshMaxCalls:1,
   pbpBackfillMaxCallsPerRun:3,
   v2ContextMaxCallsPerRun:3,
   v3MatchupMaxCallsPerRun:2,
   resultFallbackMaxCallsPerRun:1,
   dailyShadowOnlyRowCap:NBA_GOAT_CONTINUOUS_DAILY_ROW_CAP,
   note:'Backfill calls stop once each game context is stored; audit/report endpoints make zero provider calls.',
  },
  issues,warnings,
  policy:{autoApply:false,autoPromotion:false,officialPicksModified:false,productionModelFormulaChanged:false},
 };
}
