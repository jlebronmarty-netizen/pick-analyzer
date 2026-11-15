// NHL forward-only SHADOW freeze and statistical evaluation. No bookmaker odds or official picks.
import {createHash} from 'node:crypto';
import {NHL_CHALLENGER_VERSION,extractNhlFrozenFinalScores,forecastNhlChallenger} from './nhl-challenger-poisson-core.mjs';
import {buildNhlAsOfPregameContext} from './nhl-asof-goalie-rest-core.mjs';
export const NHL_FREEZE_LEDGER_VERSION='NHL_CHALLENGER_FROZEN_V1';
const ms=v=>{const t=Date.parse(String(v??''));return Number.isFinite(t)?t:null;};
const block=(reason,meta={})=>({status:'NOT_READY',reason,...meta});
const round=(n,d=4)=>Number(n.toFixed(d));
const brier=(p,y)=>(p-y)**2;
export function buildNhlFreezeCandidate({game,runCompletedAt,decisionAt,finalScores,boxscoreRows=[]}){
 const now=ms(decisionAt),start=ms(game?.scheduledAt),source=ms(runCompletedAt);
 if(now===null||start===null||source===null||source>now||now-source>90*60000)
  return block('SOURCE_FRESHNESS_UNVERIFIED');
 if(start-now<60*60000||start-now>36*3600000)return block('PREGAME_FREEZE_WINDOW_UNAVAILABLE');
 if(game?.status!=='SCHEDULED'||!/^nhl:202602\d{4}$/.test(String(game.eventId??'')))
  return block('NHL_REGULAR_SEASON_EVENT_UNVERIFIED');
 const homeId=game?.homeId,awayId=game?.awayId;
 if(!Number.isSafeInteger(homeId)||!Number.isSafeInteger(awayId)||homeId===awayId)
  return block('TEAM_IDENTITY_UNVERIFIED');
 if(typeof game.home!=='string'||typeof game.away!=='string'||!game.home.trim()||!game.away.trim())
  return block('TEAM_NAMES_UNVERIFIED');
 const prediction=forecastNhlChallenger({homeId,awayId,scheduledAt:game.scheduledAt,asOf:decisionAt,finalScores});
 if(prediction.status!=='UNVALIDATED_SHADOW_CHALLENGER')
  return block('MODEL_FEATURE_GATE_FAILED',{modelReason:prediction.reason??'NOT_READY'});
 const earlier=(Array.isArray(finalScores)?finalScores:[])
  .filter(g=>ms(g.scheduledAt)!==null&&ms(g.capturedAt)!==null&&
   ms(g.capturedAt)<=now&&ms(g.scheduledAt)+4*3600000<now)
  .sort((a,b)=>a.eventId.localeCompare(b.eventId))
  .map(g=>[g.eventId,g.scheduledAt,g.capturedAt,g.homeId,g.awayId,g.homeGoals,g.awayGoals]);
 const digest=createHash('sha256').update(JSON.stringify(earlier)).digest('hex');
 if(earlier.length<prediction.priorLeagueGames)return block('FEATURE_EVIDENCE_INCONSISTENT');
 const pregameContext=buildNhlAsOfPregameContext({game,asOf:decisionAt,finalScores,boxscoreRows});
 if(pregameContext.status!=='RESEARCH_CONTEXT_ONLY')return block('PREGAME_CONTEXT_EVIDENCE_FAILED');
 const id=NHL_CHALLENGER_VERSION+':'+game.eventId;
 return {status:'FROZEN_RESEARCH_CANDIDATE',record:{
  id,event_id:game.eventId,model_version:NHL_CHALLENGER_VERSION,
  scheduled_at:game.scheduledAt,frozen_at:new Date(now).toISOString(),source_completed_at:new Date(source).toISOString(),
  home_team_id:homeId,away_team_id:awayId,home_team:game.home,away_team:game.away,
  source_hash:digest,source_final_games:earlier.length,
  projection:prediction.projection,market_proxies:prediction.markets,
  features:{...prediction.features,priorHomeGames:prediction.priorHomeGames,
   priorAwayGames:prediction.priorAwayGames,priorLeagueGames:prediction.priorLeagueGames,
   sourceEarliestObservedFinal:true,modelVersion:NHL_CHALLENGER_VERSION,
   referenceMarketLinesAreNotSportsbookPrices:true,
   pregameContextV2:pregameContext},
  status:'FROZEN_RESEARCH',official_pick:false,production_eligible:false
 }};
}
/** @param {{runs:any[],alreadyFrozen?:string[],decisionAt:string,maxWrites?:number,boxscoreRows?:any[]}} input */
export function planNhlFrozenSlate({runs,alreadyFrozen=[],decisionAt,maxWrites=3,boxscoreRows=[]}){
 const now=ms(decisionAt);
 if(now===null||!Number.isInteger(maxWrites)||maxWrites<1||maxWrites>3)
  return {status:'INVALID_PLAN',planned:[],blocked:[]};
 const eligibleRuns=(Array.isArray(runs)?runs:[]).filter(r=>ms(r.completed_at)!==null&&ms(r.completed_at)<=now)
  .sort((a,b)=>ms(b.completed_at)-ms(a.completed_at));
 const latest=eligibleRuns[0];
 if(!latest||now-ms(latest.completed_at)>90*60000)
  return {status:'NO_FRESH_OFFICIAL_SCHEDULE',planned:[],blocked:[]};
 const observed=extractNhlFrozenFinalScores(eligibleRuns,decisionAt);
 if(observed.conflicts)return {status:'CONFLICTING_FINAL_SCORE_ARCHIVE',planned:[],blocked:[]};
 const frozen=new Set(alreadyFrozen),seen=new Set(),planned=[],blocked=[];
 for(const game of Array.isArray(latest.games)?latest.games:[]){
  if(seen.has(game.eventId))continue;seen.add(game.eventId);
  const result=buildNhlFreezeCandidate({game,runCompletedAt:latest.completed_at,decisionAt,finalScores:observed.games,boxscoreRows});
  if(result.status!=='FROZEN_RESEARCH_CANDIDATE'){blocked.push({eventId:game.eventId,reason:result.reason,modelReason:result.modelReason??null});continue;}
  if(frozen.has(result.record.id))continue;
  planned.push(result.record);
  if(planned.length>=maxWrites)break;
 }
 return {status:planned.length?'READY_TO_FREEZE':'NO_ELIGIBLE_MATCHUPS',
  version:NHL_FREEZE_LEDGER_VERSION,planned,blocked,earliestObservedFinals:observed.games.length,
  noProviderCalls:true,officialPicksModified:false};
}
export function gradeNhlFrozenSnapshots({frozenRows,finalScores}){
 const finals=new Map((Array.isArray(finalScores)?finalScores:[]).map(g=>[g.eventId,g]));
 let settled=0,won=0,brierMl=0,brierPuck=0,brierTotal=0,totalMae=0,marginMae=0;
 let pending=0,invalid=0;
 for(const row of Array.isArray(frozenRows)?frozenRows:[]){
  const start=ms(row.scheduled_at),freeze=ms(row.frozen_at),source=ms(row.source_completed_at);
  const truth=finals.get(row.event_id),p=row.market_proxies,q=row.projection;
  if(start===null||freeze===null||source===null||source>freeze||start-freeze<60*60000||
   row.model_version!==NHL_CHALLENGER_VERSION||row.official_pick!==false||
   row.production_eligible!==false){invalid++;continue;}
  if(!truth){pending++;continue;}
  if(truth.scheduledAt!==row.scheduled_at||truth.homeId!==row.home_team_id||
    truth.awayId!==row.away_team_id||ms(truth.capturedAt)<=start){invalid++;continue;}
  const values=[p?.homeMoneylineProxy,p?.homePucklineCoverProxy,p?.overGoalsProxy,
   q?.homeGoals,q?.awayGoals,q?.totalGoals,q?.homeMargin];
  if(values.some(v=>typeof v!=='number'||!Number.isFinite(v))||
    values.slice(0,3).some(v=>v<0||v>1)){invalid++;continue;}
  const homeWins=Number(truth.homeGoals>truth.awayGoals);
  settled++;won+=Number((p.homeMoneylineProxy>=.5)===Boolean(homeWins));
  brierMl+=brier(p.homeMoneylineProxy,homeWins);
  brierPuck+=brier(p.homePucklineCoverProxy,Number(truth.homeGoals-truth.awayGoals>=2));
  brierTotal+=brier(p.overGoalsProxy,Number(truth.homeGoals+truth.awayGoals>5.5));
  totalMae+=Math.abs(q.totalGoals-truth.homeGoals-truth.awayGoals);
  marginMae+=Math.abs(q.homeMargin-truth.homeGoals+truth.awayGoals);
 }
 return {status:'STATISTICAL_SHADOW_EVALUATION_ONLY',frozenCount:frozenRows?.length??0,
  settled,pending,invalid,marketScoringCertified:false,bookmakerOddsUsed:false,officialPicksModified:false,
  directionalAccuracy: settled?round(won/settled):null,
  brier:{moneyline:settled?round(brierMl/settled):null,
   homeMinus1p5:settled?round(brierPuck/settled):null,
   over5p5:settled?round(brierTotal/settled):null},
  mae:{totalGoals:settled?round(totalMae/settled):null,homeMargin:settled?round(marginMae/settled):null},
  minimumDirectionalSample:30,holdoutPassed:false,validatedImprovement:false};
}
