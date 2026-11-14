// NHL_MAIN_MARKETS_FORWARD_RESEARCH_V1
// All calculations are descriptive research. Never produce an official pick, EV, ROI or
// sportsbook-specific settlement from these historical team features.
export const NHL_MAIN_MARKETS_RESEARCH_VERSION='NHL_MAIN_MARKETS_FORWARD_RESEARCH_V1';
export const NHL_MAIN_MARKETS=Object.freeze(['moneyline','spread','total']);
const when=s=>{const n=Date.parse(String(s??''));return Number.isFinite(n)?n:null;};
const numeric=x=>x==null||x===''?null:Number(x);
const finite=x=>{const n=numeric(x);return n!==null&&Number.isFinite(n)?n:null;};
const nonnegativeInt=x=>{const n=finite(x);return n!==null&&Number.isSafeInteger(n)&&n>=0?n:null;};
const round=(n,d=3)=>Number(n.toFixed(d));
const stamp=n=>new Date(n).toISOString();
const min4h=4*3600000;
const blocked=(reason,extra={})=>({status:'NOT_READY',reason,researchOnly:true,modelProbability:null,expectedValue:null,
 recommendedPick:false,productionEligible:false,...extra});
function goalieMinutes(value){
 const m=/^(\d+):([0-5]\d)$/.exec(String(value??''));return m?Number(m[1])*60+Number(m[2]):0;
}
function actualGoalie(teamStats){
 const goalies=Array.isArray(teamStats?.goalies)?teamStats.goalies:[];
 const active=goalies.filter(x=>Number.isSafeInteger(Number(x?.playerId))&&goalieMinutes(x?.toi)>0);
 if(!active.length)return null;
 const g=[...active].sort((a,b)=>goalieMinutes(b.toi)-goalieMinutes(a.toi))[0];
 return {id:Number(g.playerId),minutes:round(goalieMinutes(g.toi)/60,1),saves:nonnegativeInt(g.saves),
  shotsAgainst:nonnegativeInt(g.shotsAgainst),savePct:finite(g.savePctg)};
}
export function normalizeNhlStoredFinal({eventId,boxscore,capturedAt}){
 const game=boxscore??{},id=nonnegativeInt(game.id),match=/^nhl:(\d+)$/.exec(String(eventId??''));
 const start=when(game.startTimeUTC),captured=when(capturedAt);
 if(!match||!Number.isSafeInteger(id)||id!==Number(match[1])||start===null||captured===null||captured<=start)return null;
 if(!['OFF','FINAL'].includes(String(game.gameState??'').toUpperCase())||Number(game.gameType)!==2)return null;
 const a=game.awayTeam,h=game.homeTeam;
 const awayId=nonnegativeInt(a?.id),homeId=nonnegativeInt(h?.id);
 const awayGoals=nonnegativeInt(a?.score),homeGoals=nonnegativeInt(h?.score);
 const awayShots=nonnegativeInt(a?.sog),homeShots=nonnegativeInt(h?.sog);
 if(awayId===null||homeId===null||awayId===homeId||awayGoals===null||homeGoals===null||awayGoals===homeGoals||
  awayShots===null||homeShots===null)return null;
 const by=game.playerByGameStats??{};
 return {eventId,gameId:id,startTime:stamp(start),capturedAt:stamp(captured),
  away:{id:awayId,goals:awayGoals,goalsAgainst:homeGoals,shots:awayShots,shotsAgainst:homeShots,
   actualGoalie:actualGoalie(by.awayTeam)},
  home:{id:homeId,goals:homeGoals,goalsAgainst:awayGoals,shots:homeShots,shotsAgainst:awayShots,
   actualGoalie:actualGoalie(by.homeTeam)}};
}
export function buildNhlTeamPregameForm(teamId,storedFinals,asOf,minGames=5){
 const date=when(asOf),team=nonnegativeInt(teamId);
 if(date===null||team===null)return blocked('INVALID_TEAM_OR_DECISION_TIME');
 if(!Number.isInteger(minGames)||minGames<5)return blocked('UNSAFE_SAMPLE_MINIMUM');
 if(!Array.isArray(storedFinals))return blocked('HISTORICAL_SOURCE_UNAVAILABLE');
 const perEvent=new Map();
 for(const x of storedFinals){
  const start=when(x?.startTime),captured=when(x?.capturedAt);
  if(start===null||captured===null||start>=date||captured>date||captured<=start||date-start<min4h)continue;
  const side=x.home?.id===team?x.home:x.away?.id===team?x.away:null;
  if(!side||!Number.isSafeInteger(Number(x.gameId)))continue;
  const old=perEvent.get(x.eventId);
  if(!old||captured<old.captured)perEvent.set(x.eventId,{start,captured,side});
 }
 const earlier=[...perEvent.values()].sort((a,b)=>b.start-a.start),n=earlier.length;
 if(n<minGames)return blocked('INSUFFICIENT_PRIOR_TEAM_GAMES',{priorGames:n,minGames});
 const sample=earlier.slice(0,Math.min(10,n)),last5=sample.slice(0,5);
 const avg=(arr,field)=>round(arr.reduce((sum,x)=>sum+x.side[field],0)/arr.length);
 const mostRecentGoalie=earlier.find(x=>x.side.actualGoalie)?.side.actualGoalie??null;
 return {status:'HISTORICAL_FORM_AVAILABLE',researchOnly:true,teamId:team,priorGames:n,gamesUsed:sample.length,
  recent5:{goalsFor:avg(last5,'goals'),goalsAgainst:avg(last5,'goalsAgainst'),
   shotsFor:avg(last5,'shots'),shotsAgainst:avg(last5,'shotsAgainst')},
  recent10:n>=10?{goalsFor:avg(sample,'goals'),goalsAgainst:avg(sample,'goalsAgainst'),
   shotsFor:avg(sample,'shots'),shotsAgainst:avg(sample,'shotsAgainst')}:null,
  lastPlayedAt:stamp(earlier[0].start),hoursSinceLastGame:round((date-earlier[0].start)/3600000,1),
  historicalGoalie:mostRecentGoalie,startingGoalieConfirmed:false,injuriesVerified:false,
  specialTeamsVerified:false,travelVerified:false,shotsExpectedGoalsAvailable:false};
}
export function buildNhlMainMarketResearchPreview({homeId,awayId,scheduledAt,asOf,finals,minPriorGames=5}){
 const start=when(scheduledAt),at=when(asOf);
 if(start===null||at===null||at>=start-10*60000)return blocked('PREGAME_CUTOFF_FAILED');
 const home=buildNhlTeamPregameForm(homeId,finals,asOf,minPriorGames);
 const away=buildNhlTeamPregameForm(awayId,finals,asOf,minPriorGames);
 if(home.status!=='HISTORICAL_FORM_AVAILABLE'||away.status!=='HISTORICAL_FORM_AVAILABLE')
  return blocked('HISTORICAL_TEAM_COVERAGE_INCOMPLETE',{homePriorGames:home.priorGames??0,awayPriorGames:away.priorGames??0});
 const projectedHome=(home.recent5.goalsFor+away.recent5.goalsAgainst)/2;
 const projectedAway=(away.recent5.goalsFor+home.recent5.goalsAgainst)/2;
 return {status:'DESCRIPTIVE_SHADOW_ONLY',version:NHL_MAIN_MARKETS_RESEARCH_VERSION,
  researchOnly:true,homeId:Number(homeId),awayId:Number(awayId),
  inputs:{home,away},unadjustedGoals:{home:round(projectedHome),away:round(projectedAway),
   total:round(projectedHome+projectedAway),homeMargin:round(projectedHome-projectedAway)},
  marketProbabilities:{moneyline:null,spread:null,total:null},marketEdges:{moneyline:null,spread:null,total:null},
  projectedGoalieConfirmed:false,calibrated:false,validationPassed:false,holdoutPassed:false,
  recommendedPick:false,productionEligible:false,
  warning:'Simple rolling-goals benchmark only; do not grade 60-minute or full-game sportsbook markets without rule-specific calibrated distributions.'};
}
const implied=o=>o>0?100/(o+100):(-o)/((-o)+100);
export function compareNhlFrozenMoneylineBenchmark(predictions,outcomes){
 if(!Array.isArray(predictions)||!Array.isArray(outcomes))return {status:'UNAVAILABLE'};
 const finalById=new Map();
 for(const o of outcomes){const v=o?.body??o,at=when(v?.capturedAt);if(v?.eventId&&at!==null)finalById.set(v.eventId,v);}
 let allSettled=0,priced=0,modelSum=0,marketSum=0,modelAll=0;
 let wins=0,invalid=0;
 for(const record of predictions){
  const p=record?.body??record;
  const r=finalById.get(p.eventId),start=when(p.scheduledAt),captured=when(p.capturedAt),end=when(r?.capturedAt);
  if(!r)continue;
  if(start===null||captured===null||captured>=start||end===null||end<=start||
    p.eventId!==r.eventId||Number(p.homeId)!==Number(r.homeId)||Number(p.awayId)!==Number(r.awayId)||
    ![r.awayScore,r.homeScore].every(Number.isSafeInteger)||r.awayScore===r.homeScore){invalid++;continue;}
  const awayP=finite(p.awayProbability),homeP=finite(p.homeProbability);
  if(awayP===null||homeP===null||awayP<=0||homeP<=0||awayP>=1||homeP>=1||Math.abs(awayP+homeP-1)>0.002){invalid++;continue;}
  const away=awayP>homeP,y=Number(away?r.awayScore>r.homeScore:r.homeScore>r.awayScore),prob=away?awayP:homeP;
  allSettled++;wins+=y;modelAll+=(prob-y)**2;
  const ao=nonnegativeInt(Math.abs(p.awayOdds))===null?null:Number(p.awayOdds),
        ho=nonnegativeInt(Math.abs(p.homeOdds))===null?null:Number(p.homeOdds);
  if(p.sportsbook!=='CIRCA'||ao===null||ho===null||!Number.isSafeInteger(ao)||!Number.isSafeInteger(ho)||Math.abs(ao)<100||Math.abs(ho)<100)continue;
  const a=implied(ao),h=implied(ho),norm=away?a/(a+h):h/(a+h);
  priced++;modelSum+=(prob-y)**2;marketSum+=(norm-y)**2;
 }
 return {status:'DESCRIPTIVE_COMPARISON',totalSettled:allSettled,wins,losses:allSettled-wins,
  invalidRecords:invalid,pairedFrozenPriceGames:priced,unpricedSettled:allSettled-priced,
  modelBrierOverall:allSettled?round(modelAll/allSettled,4):null,
  modelBrierPaired:priced?round(modelSum/priced,4):null,
  noVigMarketBrierPaired:priced?round(marketSum/priced,4):null,
  modelMinusMarketBrier:priced?round((modelSum-marketSum)/priced,4):null,
  marketName:'moneyline',sourceModel:'DRATINGS_PUBLIC_ARGMAX_V1',benchmarkBook:'CIRCA',
  statisticalValidation:false,holdoutPassed:false,pricingJurisdictionCertified:false,
  note:'Paired comparison only. Price at freeze may be missing; no FanDuel odds or spread/total validation is claimed.'};
}
