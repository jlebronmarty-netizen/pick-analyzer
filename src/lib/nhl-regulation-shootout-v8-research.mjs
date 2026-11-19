// NHL V8 regulation-only goal history and explicit final +1 goal model.
// PURE RESEARCH. Never updates NHL V1/V6, Official Picks, sports quotes or bets.
// In regular season a tied regulation result is decided in OT or shootout and
// the winner's final official score gains exactly one goal; which side wins
// is represented with an UNVALIDATED fixed 50/50 assumption.
import {createHash} from 'node:crypto';
export const NHL_REGULATION_V8='NHL_REGULATION_OTSO_SCORE_RESEARCH_V8';
const stamp=x=>{const t=Date.parse(String(x??''));return Number.isFinite(t)?t:null;};
const validInt=x=>Number.isSafeInteger(x)&&x>=0;
const round=(v,d=5)=>Number(v.toFixed(d));
const fail=(reason)=>({status:'NOT_READY',reason,calibrated:false,
 officialPick:false,modelPromotion:false});
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function reconstructNhlRegulationFinal(row){
 const b=row?.boxscore,scheduled=stamp(b?.startTimeUTC);
 const captured=stamp(row?.capturedAt??row?.boxscore_captured_at);
 const gameId=String(row?.eventId??row?.event_id??'');
 const period=b?.periodDescriptor?.periodType;
 const kind=b?.gameOutcome?.lastPeriodType;
 const h=b?.homeTeam?.score,a=b?.awayTeam?.score;
 if(!/^nhl:202602\d{4}$/.test(gameId)||Number(gameId.slice(4))!==b?.id||
  b?.gameType!==2||b?.season!==20262027||
  !['OFF','FINAL'].includes(b?.gameState)||b?.regPeriods!==3||
  scheduled===null||captured===null||captured<=scheduled||
  !validInt(h)||!validInt(a)||h===a||
  !validInt(b?.homeTeam?.id)||!validInt(b?.awayTeam?.id)||
  b.homeTeam.id===b.awayTeam.id||
  period!==kind||!['REG','OT','SO'].includes(kind))
  return fail('FINAL_SOURCE_IDENTITY_OR_PERIOD_UNVERIFIED');
 if((kind==='REG'&&b.periodDescriptor.number!==3)||
  (kind==='OT'&&(b.periodDescriptor.number!==4||b.gameOutcome.otPeriods!==1))||
  (kind==='SO'&&b.periodDescriptor.number!==5))
  return fail('PERIOD_SEQUENCE_UNVERIFIED');
 if(kind!=='REG'&&Math.abs(h-a)!==1)return fail('DECISIVE_OTSO_FINAL_NOT_ONE_GOAL');
 const regulationHome=h-(kind!=='REG'&&h>a?1:0),
  regulationAway=a-(kind!=='REG'&&a>h?1:0);
 if(regulationHome<0||regulationAway<0||
  (kind==='REG'&&regulationHome===regulationAway)||
  (kind!=='REG'&&regulationHome!==regulationAway))
  return fail('REGULATION_RECONSTRUCTION_INCONSISTENT');
 return {status:'VERIFIED_REGULATION_RECONSTRUCTION',version:NHL_REGULATION_V8,
  eventId:gameId,scheduledAt:new Date(scheduled).toISOString(),
  capturedAt:new Date(captured).toISOString(),homeId:b.homeTeam.id,
  awayId:b.awayTeam.id,regulationHomeGoals:regulationHome,
  regulationAwayGoals:regulationAway,fullHomeGoals:h,fullAwayGoals:a,
  resultKind:kind,otSoGame:kind!=='REG',
  source:'ARCHIVED_OFFICIAL_NHL_FINAL_BOXSCORE',
  pregameConfirmedStarter:false,bookContractCertified:false,
  originalForecastsChanged:false};
}
export function extractNhlRegulationAsOf({boxscoreRows,decisionAt,minimumGapHours=4}){
 const now=stamp(decisionAt);
 if(now===null||!Array.isArray(boxscoreRows)||boxscoreRows.length>500||
  !Number.isInteger(minimumGapHours)||minimumGapHours<4)
  return fail('INVALID_ASOF_HISTORY');
 const byId=new Map(),excluded={},conflicts=new Set();
 for(const row of boxscoreRows){
  const f=reconstructNhlRegulationFinal(row);
  if(f.status!=='VERIFIED_REGULATION_RECONSTRUCTION'){
   excluded[f.reason]=(excluded[f.reason]??0)+1;continue;
  }
  if(stamp(f.capturedAt)>now||stamp(f.scheduledAt)+minimumGapHours*3600000>=now){
   excluded.NOT_KNOWN_BEFORE_DECISION=(excluded.NOT_KNOWN_BEFORE_DECISION??0)+1;continue;
  }
  if(conflicts.has(f.eventId))continue;
  if(byId.has(f.eventId)){
   byId.delete(f.eventId);conflicts.add(f.eventId);
   excluded.DUPLICATED_GAME_EVIDENCE=(excluded.DUPLICATED_GAME_EVIDENCE??0)+1;
  }else byId.set(f.eventId,f);
 }
 const history=[...byId.values()].sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)||a.eventId.localeCompare(b.eventId));
 return {status:'READ_ONLY_ASOF_REGULATION_HISTORY',version:NHL_REGULATION_V8,
  games:history,excluded,conflictedEventIds:conflicts.size,
  sourceDigest:hash(history.map(f=>[f.eventId,f.capturedAt,
   f.regulationHomeGoals,f.regulationAwayGoals,f.resultKind])),
  outcomesKnownBeforeDecision:true,modelWeightsChanged:false};
}
const mass=l=>{
 const p=[Math.exp(-l)];for(let n=1;n<=18;n++)p.push(p[n-1]*l/n);return p;
};
const clamp=x=>Math.max(.6,Math.min(6.5,x));
const avg=(xs,key)=>xs.reduce((sum,x)=>sum+x[key],0)/xs.length;
export function nhlRegulationToFinalScoreDistribution(homeGoals,awayGoals,{totalLine=5.5,puckLine=-1.5}={}){
 if(![homeGoals,awayGoals,totalLine,puckLine].every(x=>Number.isFinite(x))||
  homeGoals<.6||awayGoals<.6||homeGoals>6.5||awayGoals>6.5||
  totalLine<1||totalLine>14||!Number.isInteger(totalLine*2)||
  ![-1.5,1.5].includes(puckLine))return null;
 const H=mass(homeGoals),A=mass(awayGoals);
 let z=0,homeWin=0,tieReg=0,homeCover=0,homePush=0,totalOver=0,totalPush=0;
 for(let h=0;h<H.length;h++)for(let a=0;a<A.length;a++){
  const prob=H[h]*A[a];z+=prob;
  const evaluate=(x,y,w)=>{
   homeWin+=w*Number(x>y);
   const spread=x-y+puckLine,tot=x+y;
   homeCover+=w*Number(spread>0);homePush+=w*Number(spread===0);
   totalOver+=w*Number(tot>totalLine);totalPush+=w*Number(tot===totalLine);
  };
  if(h===a){tieReg+=prob;evaluate(h+1,a,prob/2);evaluate(h,a+1,prob/2);}
  else evaluate(h,a,prob);
 }
 if(z<=0)return null;
 return {homeMoneylineProxy:round(homeWin/z),
  awayMoneylineProxy:round(1-homeWin/z),
  homePucklineCoverProxy:round(homeCover/z),
  homePucklinePushProxy:round(homePush/z),
  awayPucklineCoverProxy:round(1-(homeCover+homePush)/z),
  overGoalsProxy:round(totalOver/z),
  underGoalsProxy:round(1-(totalOver+totalPush)/z),
  totalPushProxy:round(totalPush/z),
  regulationTieProbability:round(tieReg/z),
  fullGameTieResolutionAssumed:'UNVALIDATED_EVEN_OTSO_WINNER',
  researchTotalLine:totalLine,researchHomePuckline:puckLine,
  sportsbookRulesCertified:false,calibrated:false,officialPick:false};
}
export function forecastNhlRegulationV8({game,decisionAt,boxscoreRows,minTeamGames=5}){
 const now=stamp(decisionAt),tip=stamp(game?.scheduledAt);
 if(now===null||tip===null||tip-now<60*60000||!Number.isSafeInteger(game?.homeId)||
  !Number.isSafeInteger(game?.awayId)||game.homeId===game.awayId||
  !Number.isInteger(minTeamGames)||minTeamGames<5)return fail('INVALID_FROZEN_GAME');
 const archive=extractNhlRegulationAsOf({boxscoreRows,decisionAt});
 if(archive.status!=='READ_ONLY_ASOF_REGULATION_HISTORY')return archive;
 const prior=archive.games.sort((a,b)=>b.scheduledAt.localeCompare(a.scheduledAt));
 if(prior.length<25)return fail('INSUFFICIENT_ASOF_LEAGUE_HISTORY');
 const home=prior.flatMap(x=>x.homeId===game.homeId?
  [{for:x.regulationHomeGoals,against:x.regulationAwayGoals}]:
  x.awayId===game.homeId?[{for:x.regulationAwayGoals,against:x.regulationHomeGoals}]:[]).slice(0,5);
 const away=prior.flatMap(x=>x.homeId===game.awayId?
  [{for:x.regulationHomeGoals,against:x.regulationAwayGoals}]:
  x.awayId===game.awayId?[{for:x.regulationAwayGoals,against:x.regulationHomeGoals}]:[]).slice(0,5);
 if(home.length<minTeamGames||away.length<minTeamGames)return fail('INSUFFICIENT_PRIOR_TEAM_GAMES');
 const homeLambda=clamp(.75*(avg(home,'for')+avg(away,'against'))/2+
  .25*avg(prior,'regulationHomeGoals'));
 const awayLambda=clamp(.75*(avg(away,'for')+avg(home,'against'))/2+
  .25*avg(prior,'regulationAwayGoals'));
 const markets=nhlRegulationToFinalScoreDistribution(homeLambda,awayLambda);
 return {status:'UNVALIDATED_REGULATION_CHALLENGER',version:NHL_REGULATION_V8,
  generatedAt:new Date(now).toISOString(),gameId:game.eventId,
  scheduledAt:game.scheduledAt,
  sourceDigest:archive.sourceDigest,priorLeagueGames:prior.length,
  priorHomeGames:home.length,priorAwayGames:away.length,
  priorOTSO:prior.filter(x=>x.otSoGame).length,
  projection:{regulationHomeGoals:round(homeLambda,3),
   regulationAwayGoals:round(awayLambda,3),
   regulationTotalGoals:round(homeLambda+awayLambda,3)},
  fullGameResearchProxies:markets,
  goalieAdjusted:false,modelPromoted:false,officialPick:false,
  winnerProbabilityCalibrated:false,holdoutValidated:false,
  warning:'Regulation history and assumed even OT/SO win; exploratory, no demonstrated Brier improvement on historical cohort.'};
}
