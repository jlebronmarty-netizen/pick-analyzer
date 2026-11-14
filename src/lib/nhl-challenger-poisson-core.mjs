// Strictly experimental NHL 3-market goal-distribution challenger.
// Source: official NHL FINAL scores previously persisted by the free-source cron.
// No bookmaker odds, model promotion, or official bets are derived here.
export const NHL_CHALLENGER_VERSION='NHL_SCORES_POISSON_SHADOW_V1';
export const NHL_CHALLENGER_MIN_TEAM_GAMES=5;
export const NHL_CHALLENGER_MIN_LEAGUE_GAMES=25;
const HOUR=3600000;
const dateMs=value=>{const n=Date.parse(String(value??''));return Number.isFinite(n)?n:null;};
const safeInt=value=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;
const round=(n,d=4)=>Number(n.toFixed(d));
const clamp=(x,low,high)=>Math.min(high,Math.max(low,x));
const fail=(reason,details={})=>({status:'NOT_READY',reason,...details,modelProbability:null,
 calibrated:false,officialPick:false,productionEligible:false,modelPromoted:false});
const statMean=(arr,key)=>arr.reduce((sum,x)=>sum+x[key],0)/arr.length;

// Earliest evidenced FINAL wins; contradictory later scores invalidate the game.
// Postgame timestamps are NOT rewritten to scheduledAt or inferred from the scoreboard.
export function extractNhlFrozenFinalScores(runs,now=new Date().toISOString()){
 const nowMs=dateMs(now),seen=new Map(),conflicts=new Set();
 if(!Array.isArray(runs)||nowMs===null)return {games:[],conflicts:0};
 for(const row of [...runs].sort((a,b)=>dateMs(a.completed_at)-dateMs(b.completed_at))){
  const captured=dateMs(row?.completed_at);
  if(captured===null||captured>nowMs)continue;
  const games=Array.isArray(row?.games)?row.games:Array.isArray(row?.detail?.games)?row.detail.games:[];
  for(const g of games){
   const id=String(g?.eventId??''),m=/^nhl:(202602\d{4})$/.exec(id);
   if(!m||g?.status!=='FINAL'||conflicts.has(id))continue;
   const start=dateMs(g.scheduledAt),homeId=safeInt(g.homeId),awayId=safeInt(g.awayId),
    homeGoals=safeInt(g.homeScore),awayGoals=safeInt(g.awayScore);
   if(start===null||captured<=start||homeId===null||awayId===null||homeId===awayId||
    homeGoals===null||awayGoals===null||homeGoals===awayGoals)continue;
   const obj={eventId:id,gameId:Number(m[1]),scheduledAt:new Date(start).toISOString(),
    capturedAt:new Date(captured).toISOString(),homeId,awayId,homeGoals,awayGoals};
   const old=seen.get(id);
   if(!old){seen.set(id,obj);continue;}
   if(old.scheduledAt!==obj.scheduledAt||old.homeId!==homeId||old.awayId!==awayId||
     old.homeGoals!==homeGoals||old.awayGoals!==awayGoals){conflicts.add(id);seen.delete(id);}
  }
 }
 return {games:[...seen.values()].sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)||a.eventId.localeCompare(b.eventId)),
  conflicts:conflicts.size};
}
function priorEvidence(finalScores,asOf){
 const t=dateMs(asOf);
 if(t===null||!Array.isArray(finalScores))return [];
 const byId=new Map();
 for(const game of finalScores){
  const start=dateMs(game?.scheduledAt),at=dateMs(game?.capturedAt);
  if(!String(game?.eventId??'').startsWith('nhl:')||start===null||at===null||at<=start||
    start+4*HOUR>=t||at>t||byId.has(game.eventId))continue;
  if(![game.homeId,game.awayId,game.homeGoals,game.awayGoals].every(Number.isSafeInteger)||
    game.homeId===game.awayId||game.homeGoals===game.awayGoals)continue;
  byId.set(game.eventId,game);
 }
 return [...byId.values()].sort((a,b)=>b.scheduledAt.localeCompare(a.scheduledAt));
}
function teamHistory(teamId,prior){
 return prior.flatMap(g=>g.homeId===teamId?[{for:g.homeGoals,against:g.awayGoals,home:true}]:
  g.awayId===teamId?[{for:g.awayGoals,against:g.homeGoals,home:false}]:[]).slice(0,10);
}
function poissonMass(lambda,maxGoals=18){
 const p=[Math.exp(-lambda)];
 for(let k=1;k<=maxGoals;k++)p.push(p[k-1]*lambda/k);
 return p;
}
export function nhlScoreDistribution(homeLambda,awayLambda,{totalLine=5.5,puckLine=-1.5}={}){
 if(!Number.isFinite(homeLambda)||!Number.isFinite(awayLambda)||homeLambda<0.6||awayLambda<0.6||
  homeLambda>6.5||awayLambda>6.5||!Number.isFinite(totalLine)||!Number.isFinite(puckLine))return null;
 const h=poissonMass(homeLambda),a=poissonMass(awayLambda);
 let z=0,homeWin=0,regulationTieMass=0,homePuck=0,totalOver=0,exactTotal=0,puckPush=0;
 for(let i=0;i<h.length;i++)for(let j=0;j<a.length;j++){
  const w=h[i]*a[j],margin=i-j,total=i+j;z+=w;
  if(margin>0)homeWin+=w;else if(margin===0)regulationTieMass+=w;
  if(margin+puckLine>0)homePuck+=w;else if(margin+puckLine===0)puckPush+=w;
  if(total>totalLine)totalOver+=w;else if(total===totalLine)exactTotal+=w;
 }
 if(z<=0)return null;
 // NHL final results never tie: allocate simulated equal-score states 50/50 as an
 // explicit UNVALIDATED approximation, not a book-certified OT/shootout model.
 const homeMl=(homeWin+regulationTieMass/2)/z,over=totalOver/z,homeCover=homePuck/z;
 return {homeMoneylineProxy:round(homeMl),awayMoneylineProxy:round(1-homeMl),
  homePucklineCoverProxy:round(homeCover),homePucklinePushProxy:round(puckPush/z),
  awayPucklineCoverProxy:round(1-homeCover-puckPush/z),
  overGoalsProxy:round(over),underGoalsProxy:round(1-over-exactTotal/z),
  totalPushProxy:round(exactTotal/z),equalScoreProxyMass:round(regulationTieMass/z),
  researchTotalLine:totalLine,researchHomePuckline:puckLine,
  fullGameOTSOResolved:false,confirmedBookContract:false,marketOddsAvailable:false};
}
export function forecastNhlChallenger({homeId,awayId,scheduledAt,asOf,finalScores,minTeamGames=NHL_CHALLENGER_MIN_TEAM_GAMES}){
 const at=dateMs(asOf),start=dateMs(scheduledAt);
 if(at===null||start===null||at>=start-10*60000)return fail('PREGAME_CUTOFF_FAILED');
 if(!Number.isSafeInteger(homeId)||!Number.isSafeInteger(awayId)||homeId===awayId||
  !Number.isSafeInteger(minTeamGames)||minTeamGames<5)return fail('INVALID_GAME_OR_SAMPLE_GATE');
 const prior=priorEvidence(finalScores,asOf);
 if(prior.length<NHL_CHALLENGER_MIN_LEAGUE_GAMES)return fail('INSUFFICIENT_LEAGUE_HISTORY',{priorLeagueGames:prior.length});
 const home=teamHistory(homeId,prior),away=teamHistory(awayId,prior);
 if(home.length<minTeamGames||away.length<minTeamGames)return fail('INSUFFICIENT_PRIOR_TEAM_GAMES',
  {priorHomeGames:home.length,priorAwayGames:away.length,priorLeagueGames:prior.length});
 const hc=home.slice(0,5),ac=away.slice(0,5);
 const leagueHome=statMean(prior,'homeGoals'),leagueAway=statMean(prior,'awayGoals');
 const hf=statMean(hc,'for'),ha=statMean(hc,'against'),af=statMean(ac,'for'),aa=statMean(ac,'against');
 // Fixed, non-optimized parameters: 75% last-five offense/defense + 25% prior league venue scoring.
 const homeLambda=clamp(.75*(hf+aa)/2+.25*leagueHome,.6,6.5);
 const awayLambda=clamp(.75*(af+ha)/2+.25*leagueAway,.6,6.5);
 const markets=nhlScoreDistribution(homeLambda,awayLambda);
 return {status:'UNVALIDATED_SHADOW_CHALLENGER',version:NHL_CHALLENGER_VERSION,
  generatedAt:asOf,scheduledAt,homeId,awayId,priorHomeGames:home.length,priorAwayGames:away.length,
  priorLeagueGames:prior.length,projection:{homeGoals:round(homeLambda,3),awayGoals:round(awayLambda,3),
   totalGoals:round(homeLambda+awayLambda,3),homeMargin:round(homeLambda-awayLambda,3)},
  markets,modelProbability:null,expectedValue:null,edge:null,calibrated:false,holdoutPassed:false,
  officialPick:false,productionEligible:false,modelPromoted:false,
  features:{rollingGoals:true,scoreSource:'STORED_NHL_FINAL_SCORE',capturedBeforeDecision:true,
   confirmedStartingGoalie:false,injuries:false,ppPk:false,xG:false,marketPrices:false},
  warning:'Approximate independent-Poisson probabilities only; equal-score OT/SO allocation is unvalidated. Not a sportsbook recommendation.'};
}
const brier=(p,y)=>(p-y)**2;
export function walkForwardNhlChallenger(finalScores,{minEvaluatedGames=30}={}){
 const ordered=[...(Array.isArray(finalScores)?finalScores:[])].sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt));
 let evaluated=0,mlWins=0,mlBrier=0,puckBrier=0,totalBrier=0,goalsMAE=0,marginMAE=0;
 for(const g of ordered){
  const start=dateMs(g?.scheduledAt);if(start===null)continue;
  const asOf=new Date(start-HOUR).toISOString();
  const prediction=forecastNhlChallenger({homeId:g.homeId,awayId:g.awayId,scheduledAt:g.scheduledAt,
   asOf,finalScores:ordered});
  if(prediction.status!=='UNVALIDATED_SHADOW_CHALLENGER')continue;
  evaluated++;
  const homeWon=Number(g.homeGoals>g.awayGoals);
  mlWins+=Number((prediction.markets.homeMoneylineProxy>.5)===Boolean(homeWon));
  mlBrier+=brier(prediction.markets.homeMoneylineProxy,homeWon);
  const cover=Number(g.homeGoals-g.awayGoals>=2);
  puckBrier+=brier(prediction.markets.homePucklineCoverProxy,cover);
  const over=Number(g.homeGoals+g.awayGoals>5.5);
  totalBrier+=brier(prediction.markets.overGoalsProxy,over);
  goalsMAE+=Math.abs(prediction.projection.totalGoals-(g.homeGoals+g.awayGoals));
  marginMAE+=Math.abs(prediction.projection.homeMargin-(g.homeGoals-g.awayGoals));
 }
 return {status:'WALK_FORWARD_RESEARCH_ONLY',version:NHL_CHALLENGER_VERSION,evaluatedGames:evaluated,
  winRateAtPointFive:evaluated?round(mlWins/evaluated):null,
  brier:{moneyline:evaluated?round(mlBrier/evaluated):null,
   homeMinus1p5:evaluated?round(puckBrier/evaluated):null,
   totalOver5p5:evaluated?round(totalBrier/evaluated):null},
  mae:{totalGoals:evaluated?round(goalsMAE/evaluated,3):null,
   homeMargin:evaluated?round(marginMAE/evaluated,3):null},
  minimumDirectionalGames:minEvaluatedGames,moreGamesNeeded:Math.max(0,minEvaluatedGames-evaluated),
  independentHoldoutPassed:false,marketOddsCompared:false,statisticalSignificanceEstablished:false,
  approvedForOfficialUse:false,
  warning:'Strict as-of source timestamps. No results are backfilled as if known before a forecast. No edge/ROI claim.'};
}


export function pairedNhlChallengerBenchmark(finalScores,dratingsRows){
 const finalMap=new Map((Array.isArray(finalScores)?finalScores:[]).map(g=>[g.eventId,g]));
 let paired=0,withMarket=0,invalid=0,challengerBrier=0,dratingsBrier=0,
  marketBrier=0,marketMatchedChallengerBrier=0,marketMatchedDratingsBrier=0;
 const pairedIds=new Set();
 for(const row of Array.isArray(dratingsRows)?dratingsRows:[]){
  const source=row?.body??row,truth=finalMap.get(source?.eventId);
  if(!truth||pairedIds.has(truth.eventId))continue;
  const start=dateMs(source?.scheduledAt),seen=dateMs(source?.capturedAt);
  if(start===null||seen===null||seen>=start-10*60000||start!==dateMs(truth.scheduledAt)||
   source.homeId!==truth.homeId||source.awayId!==truth.awayId){invalid++;continue;}
  const homeP=Number(source.homeProbability),awayP=Number(source.awayProbability);
  if(!Number.isFinite(homeP)||!Number.isFinite(awayP)||homeP<=0||awayP<=0||
   homeP>=1||awayP>=1||Math.abs(homeP+awayP-1)>0.002){invalid++;continue;}
  const challenger=forecastNhlChallenger({homeId:truth.homeId,awayId:truth.awayId,
   scheduledAt:truth.scheduledAt,asOf:source.capturedAt,finalScores});
  if(challenger.status!=='UNVALIDATED_SHADOW_CHALLENGER')continue;
  const actual=Number(truth.homeGoals>truth.awayGoals);
  const challengerP=challenger.markets.homeMoneylineProxy;
  paired++;pairedIds.add(truth.eventId);
  challengerBrier+=brier(challengerP,actual);dratingsBrier+=brier(homeP,actual);
  if(source.sportsbook!=='CIRCA'||!Number.isSafeInteger(source.homeOdds)||
   !Number.isSafeInteger(source.awayOdds)||Math.abs(source.homeOdds)<100||
   Math.abs(source.awayOdds)<100)continue;
  const implied=o=>o>0?100/(100+o):(-o)/(100-o);
  const hm=implied(source.homeOdds),am=implied(source.awayOdds),marketP=hm/(hm+am);
  withMarket++;marketBrier+=brier(marketP,actual);
  marketMatchedChallengerBrier+=brier(challengerP,actual);
  marketMatchedDratingsBrier+=brier(homeP,actual);
 }
 return {status:'UNVALIDATED_PAIRED_BENCHMARK',model:NHL_CHALLENGER_VERSION,
  pairedChallengerAndDratings:paired,pairedWithCircaMarket:withMarket,
  invalidSourcePairs:invalid,
  brierOnSameGames:{
   challenger:paired?round(challengerBrier/paired):null,
   dratings:paired?round(dratingsBrier/paired):null},
  brierOnPricedGames:{
   challenger:withMarket?round(marketMatchedChallengerBrier/withMarket):null,
   dratings:withMarket?round(marketMatchedDratingsBrier/withMarket):null,
   circaNoVig:withMarket?round(marketBrier/withMarket):null},
  minimumDirectionalSample:30,validationPassed:false,holdoutPassed:false,
  officialRecommendationEligible:false,
  note:'Matching event, teams and frozen pregame source. Strict captured-at prevents using later backfilled final scores.'};
}
