// NHL V6 late-pregame research freeze. Free archived evidence only.
// No NHL goalie adjustments, Official Picks, wagers, or model promotions.
import {createHash} from 'node:crypto';
import {forecastNhlChallenger} from './nhl-challenger-poisson-core.mjs';
import {selectEspnNhlProbablesAsOf} from './nhl-espn-free-goalie-probables-v5.mjs';
import {selectNhlSpecialTeamsAsOf} from './nhl-special-teams-asof-core.mjs';
export const NHL_LATE_V6='NHL_LATE_PROBABLE_CALIBRATION_SHADOW_V6';
const asMs=v=>{const x=Date.parse(String(v??''));return Number.isFinite(x)?x:null};
const positive=x=>Number.isSafeInteger(x)&&x>=0;
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const round=(x,d=5)=>Number(x.toFixed(d));
const reject=(reason,meta={})=>({status:'NOT_READY',reason,...meta});
const odds=x=>Number.isSafeInteger(x)&&Math.abs(x)>=100&&Math.abs(x)<=20000;
const implied=x=>x>0?100/(100+x):(-x)/(100-x);
const sameGame=(record,game)=>{
 const x=record?.body??record;
 return x?.eventId===game.eventId&&x?.scheduledAt===game.scheduledAt&&
  Number(x?.homeId)===game.homeId&&Number(x?.awayId)===game.awayId;
};
export function selectNhlV6CircaAsOf({game,decisionAt,quotes,maxAgeMinutes=40}){
 const now=asMs(decisionAt),tip=asMs(game?.scheduledAt);
 if(now===null||tip===null||tip-now<60*60000||!Array.isArray(quotes))
  return reject('MARKET_TIME_OR_SOURCE_UNVERIFIED');
 const found=quotes.filter(q=>{
  if(!sameGame(q,game)||q?.body?.sportsbook!=='CIRCA')return false;
  const at=asMs(q.captured_at),bodyAt=asMs(q.body?.capturedAt);
  return at!==null&&bodyAt===at&&at<=now&&now-at<=maxAgeMinutes*60000&&
   at<=tip-60*60000&&odds(q.body.homeOdds)&&odds(q.body.awayOdds);
 }).sort((a,b)=>asMs(b.captured_at)-asMs(a.captured_at)||String(a.id).localeCompare(String(b.id)));
 if(!found.length)return reject('NO_FRESH_MATCHED_CIRCA_QUOTE');
 const q=found[0],a=implied(q.body.homeOdds),b=implied(q.body.awayOdds);
 const vig=a+b;
 if(vig<.9||vig>1.35)return reject('CIRCA_MARGIN_UNVERIFIED');
 return {status:'CIRCA_PREGAME_RESEARCH_ONLY',eventId:game.eventId,capturedAt:q.captured_at,
  observationId:q.id,homeOdds:q.body.homeOdds,awayOdds:q.body.awayOdds,
  homeNoVig:round(a/vig),awayNoVig:round(b/vig),marketRuleVerified:false,
  quoteSourcePublicationTimeVerified:false,bookmaker:'CIRCA'};
}
export function nhlV6RollingHomeBias({decisionsAt,priorGames,quoteRows,minPrior=20,shrink=50}){
 const now=asMs(decisionsAt);
 if(now===null||!Array.isArray(priorGames)||!Array.isArray(quoteRows)||
  !Number.isSafeInteger(minPrior)||minPrior<20||!Number.isSafeInteger(shrink)||shrink<50)
  return reject('INVALID_CALIBRATION_HISTORY');
 const grouped=new Map();
 for(const g of priorGames){
  const source=g?.body??g,at=asMs(g?.observed_at),start=asMs(source?.scheduledAt);
  if(!/^nhl:202602\d{4}$/.test(String(g?.event_id??source?.eventId??''))||
   at===null||start===null||at>now||at<=start||
   !positive(source?.homeId)||!positive(source?.awayId)||source.homeId===source.awayId||
   !positive(source?.homeScore)||!positive(source?.awayScore)||source.homeScore===source.awayScore)
    continue;
  const id=String(g.event_id??source.eventId);
  if(grouped.has(id)){grouped.set(id,null);continue;}
  grouped.set(id,{eventId:id,scheduledAt:source.scheduledAt,homeId:source.homeId,
   awayId:source.awayId,homeWon:source.homeScore>source.awayScore?1:0});
 }
 let n=0,residual=0;
 for(const g of grouped.values()){
  if(!g||asMs(g.scheduledAt)>=now)continue;
  const source=quoteRows.filter(q=>sameGame(q,g)&&q.body?.sportsbook==='CIRCA').filter(q=>{
   const at=asMs(q.captured_at);
   return at!==null&&asMs(q.body?.capturedAt)===at&&at<asMs(g.scheduledAt)-10*60000&&
    odds(q.body.homeOdds)&&odds(q.body.awayOdds);
  }).sort((a,b)=>asMs(b.captured_at)-asMs(a.captured_at)||String(a.id).localeCompare(String(b.id)));
  if(!source.length)continue;
  const a=implied(source[0].body.homeOdds),b=implied(source[0].body.awayOdds);
  if(a+b<.9||a+b>1.35)continue;
  n++;residual+=g.homeWon-a/(a+b);
 }
 return {status:n>=minPrior?'FROZEN_CANDIDATE_ELIGIBLE':'INSUFFICIENT_EARLIER_RESULTS',
  priorGames:n,rawPriorHomeBias:n?round(residual/n,6):null,
  shrunkenBias:n?round((residual/n)*n/(n+shrink),6):null,
  shrink,minPrior,calibrationSelectedPostHoc:true,prospectiveHoldoutValidated:false};
}
export function buildNhlV6LateCandidate({game,decisionAt,sourceCompletedAt,
  finalScores,probableSnapshots,ppPkSnapshots=[],dratingsRows,quoteRows,outcomeRows}){
 const now=asMs(decisionAt),tip=asMs(game?.scheduledAt),source=asMs(sourceCompletedAt);
 if(now===null||tip===null||source===null||source>now||now-source>45*60000||
  tip-now<60*60000||tip-now>8*3600000)return reject('LATE_PREGAME_OR_SOURCE_FRESHNESS_FAILED');
 if(game?.status!=='SCHEDULED'||!/^nhl:202602\d{4}$/.test(String(game.eventId??''))||
  !positive(game.homeId)||!positive(game.awayId)||game.homeId===game.awayId||
  !game.home||!game.away)return reject('LATE_EVENT_IDENTITY_INVALID');
 if(!Array.isArray(finalScores)||!Array.isArray(probableSnapshots)||!Array.isArray(dratingsRows)||
  !Array.isArray(quoteRows)||!Array.isArray(outcomeRows))return reject('SOURCE_INPUTS_UNAVAILABLE');
 const goalie=selectEspnNhlProbablesAsOf({snapshots:probableSnapshots,game,decisionAt});
 if(goalie.status!=='PREGAME_PROBABLE_SOURCE_ONLY'||!goalie.home||!goalie.away)
  return reject('NO_PREGAME_PAIRED_GOALIE_PROBABLES',{goalieReason:goalie.reason??goalie.status});
 if(asMs(goalie.observedAt)>now||now-asMs(goalie.observedAt)>45*60000)
  return reject('PROBABLE_SOURCE_NOT_FRESH_AT_LATE_FREEZE');
 const dr=dratingsRows.filter(x=>sameGame(x,game)&&
  asMs(x.created_at)!==null&&asMs(x.created_at)<now&&
  asMs(x.created_at)<tip-60*60000).sort((a,b)=>asMs(a.created_at)-asMs(b.created_at))[0];
 const drp=dr?.body?.homeProbability;
 if(typeof drp!=='number'||drp<=0||drp>=1)return reject('NO_FROZEN_DRATINGS_BASELINE');
 const forecast=forecastNhlChallenger({homeId:game.homeId,awayId:game.awayId,
  scheduledAt:game.scheduledAt,asOf:decisionAt,finalScores});
 if(forecast.status!=='UNVALIDATED_SHADOW_CHALLENGER')
  return reject('SCORE_RESEARCH_GATE',{scoreReason:forecast.reason??'NO_HISTORY'});
 const price=selectNhlV6CircaAsOf({game,decisionAt,quotes:quoteRows});
 const bias=nhlV6RollingHomeBias({decisionsAt:decisionAt,priorGames:outcomeRows,quoteRows});
 const marketReady=price.status==='CIRCA_PREGAME_RESEARCH_ONLY';
 const candidate=marketReady&&bias.status==='FROZEN_CANDIDATE_ELIGIBLE'?
  Math.min(.99,Math.max(.01,price.homeNoVig+bias.shrunkenBias)):null;
 const specialTeams=selectNhlSpecialTeamsAsOf({snapshots:ppPkSnapshots,game,asOf:decisionAt});
 const sourceDigest=sha({eventId:game.eventId,decisionAt,finalScoreIds:finalScores
  .filter(x=>asMs(x.capturedAt)<=now)
  .map(x=>[x.eventId,x.capturedAt,x.homeGoals,x.awayGoals])
  .sort((a,b)=>a[0].localeCompare(b[0])),goalieSnapshot:goalie.sourceSnapshotId,
  priceId:marketReady?price.observationId:null,calibrationPrior:bias.priorGames});
 return {status:'LATE_RESEARCH_CANDIDATE',record:{
  id:NHL_LATE_V6+':'+game.eventId,event_id:game.eventId,model_version:NHL_LATE_V6,
  scheduled_at:game.scheduledAt,frozen_at:new Date(now).toISOString(),
  source_completed_at:new Date(source).toISOString(),home_team_id:game.homeId,
  away_team_id:game.awayId,source_hash:sourceDigest,
  goalie_snapshot_id:goalie.sourceSnapshotId,
  goalie_evidence:{...goalie,goalieNhlIdentityCrosswalkVerified:false,
   isConfirmedStarter:false,goalieAdjustmentApplied:false,sourcePublicationTimeVerified:false},
  calibration:{status:candidate===null?'NOT_YET_ELIGIBLE':'PROSPECTIVE_TEST_ONLY',
   originalDratingsHome:drp,dratingsOriginalObservedAt:dr.created_at,
   circaPrice:marketReady?price:null,rolling: bias,
   candidateHome: candidate===null?null:round(candidate),
   candidateAway: candidate===null?null:round(1-candidate),
   candidateParamsFrozenBeforeOutcome:true,statisticalOnly:true,expectedValue:null,
   holdoutPassed:false,officialPromotion:false},
  projection:forecast.projection,market_proxies:forecast.markets,
  special_teams_evidence:specialTeams,
  status:'FROZEN_RESEARCH',official_pick:false,production_eligible:false
 }};
}
