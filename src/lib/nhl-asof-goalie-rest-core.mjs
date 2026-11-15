// NHL historical goalie/rest context V2. Evidence-only; never assert next-game starter.
import {createHash} from 'node:crypto';
export const NHL_ASOF_CONTEXT_VERSION='NHL_ASOF_GOALIE_REST_V2';
const HOUR=3600000;
const time=x=>{const v=Date.parse(String(x??''));return Number.isFinite(v)?v:null;};
const int=x=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0?x:null;
const round=(x,n=3)=>Number(x.toFixed(n));
const blocked=(reason)=>({status:'NOT_READY',reason,version:NHL_ASOF_CONTEXT_VERSION});
const toiSeconds=x=>{
 const m=/^(\d+):([0-5]\d)$/.exec(String(x??''));return m?Number(m[1])*60+Number(m[2]):null;
};
const compact=(v)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');

// Full NHL Gamecenter boxscore used ONLY as historical postgame evidence.
// An observed goalie who started the prior game is not today's confirmed starter.
export function normalizeNhlHistoricalGoalieContext({eventId,boxscore,capturedAt}){
 const id=String(eventId??''),match=/^nhl:(202602\d{4})$/.exec(id),b=boxscore??{};
 const start=time(b.startTimeUTC),captured=time(capturedAt);
 if(!match||Number(b.id)!==Number(match[1])||Number(b.gameType)!==2||
  !['OFF','FINAL'].includes(String(b.gameState??''))||
  start===null||captured===null||captured<=start)return null;
 const homeId=int(b.homeTeam?.id),awayId=int(b.awayTeam?.id);
 if(homeId===null||awayId===null||homeId===awayId)return null;
 const parseGoalies=(id,side)=>{
  const raw=b.playerByGameStats?.[side]?.goalies;
  if(!Array.isArray(raw))return {teamId:id,starter:null,validGoalieRows:0};
  const filtered=raw.flatMap(row=>{
   const gid=int(row?.playerId),toi=toiSeconds(row?.toi),saves=int(row?.saves),
    shotsAgainst=int(row?.shotsAgainst),goalsAgainst=int(row?.goalsAgainst);
   if(gid===null||toi===null||toi<600||saves===null||shotsAgainst===null||
    goalsAgainst===null||shotsAgainst<=0||Math.abs(shotsAgainst-(saves+goalsAgainst))>1)return [];
   return [{playerId:gid,toiSeconds:toi,saves,shotsAgainst,goalsAgainst,
    savePct:round(saves/shotsAgainst,4),starterVerifiedForThisHistoricalGame:row?.starter===true}];
  });
  const starters=filtered.filter(g=>g.starterVerifiedForThisHistoricalGame);
  const starter=starters.length===1?starters[0]:null;
  return {teamId:id,starter,validGoalieRows:filtered.length};
 };
 return {eventId:id,scheduledAt:new Date(start).toISOString(),
  capturedAt:new Date(captured).toISOString(),
  home:parseGoalies(homeId,'homeTeam'),away:parseGoalies(awayId,'awayTeam')};
}
function asOfScoreHistory(teamId,finalScores,cutoff){
 return (Array.isArray(finalScores)?finalScores:[])
  .filter(g=>g?.homeId===teamId||g?.awayId===teamId)
  .filter(g=>{
   const started=time(g.scheduledAt),captured=time(g.capturedAt);
   return started!==null&&captured!==null&&started+4*HOUR<cutoff&&captured<=cutoff;
  }).sort((a,b)=>time(b.scheduledAt)-time(a.scheduledAt));
}
function asOfGoalieHistory(teamId,boxscoreRows,cutoff){
 const byEvent=new Map();
 for(const row of Array.isArray(boxscoreRows)?boxscoreRows:[]){
  const game=normalizeNhlHistoricalGoalieContext(row);
  if(!game||!([game.home.teamId,game.away.teamId].includes(teamId)))continue;
  const start=time(game.scheduledAt),captured=time(game.capturedAt);
  if(start===null||captured===null||start+4*HOUR>=cutoff||captured>cutoff)continue;
  const side=game.home.teamId===teamId?game.home:game.away;
  if(!side.starter)continue;
  const existing=byEvent.get(game.eventId);
  if(!existing||captured<existing.captured){
   byEvent.set(game.eventId,{eventId:game.eventId,start,captured,goalie:side.starter});
  }
 }
 return [...byEvent.values()].sort((a,b)=>b.start-a.start);
}
function teamFeatures(teamId,finalScores,boxscoreRows,decision,start){
 const games=asOfScoreHistory(teamId,finalScores,decision),last=games[0]??null;
 const goalieGames=asOfGoalieHistory(teamId,boxscoreRows,decision);
 const mostRecent=goalieGames[0]??null,priorId=mostRecent?.goalie?.playerId??null;
 const sameGoalie=priorId===null?[]:goalieGames.filter(x=>x.goalie.playerId===priorId).slice(0,5);
 const saves=sameGoalie.reduce((a,x)=>a+x.goalie.saves,0),against=sameGoalie.reduce((a,x)=>a+x.goalie.shotsAgainst,0);
 const datesKnown=games.length?round((start-time(last.scheduledAt))/HOUR,2):null;
 return {
  teamId,priorTeamScoresKnown:games.length,
  hoursSincePreviousGame:datesKnown,
  playedWithin36Hours:datesKnown===null?null:datesKnown<36,
  playedWithin48Hours:datesKnown===null?null:datesKnown<48,
  lastKnownMatch:last?.eventId??null,
  priorGoalieStartsWithCaptureEvidence:goalieGames.length,
  lastObservedHistoricalStarter:mostRecent?{
   playerId:priorId,gameId:mostRecent.eventId,
   actualGameAt:new Date(mostRecent.start).toISOString(),
   capturedAt:new Date(mostRecent.captured).toISOString(),
   priorStartsForSameGoalie:sameGoalie.length,
   priorSavePct:against>=10?round(saves/against,4):null,
   priorShotsAgainst:against
  }:null,
  upcomingGoalieConfirmed:false,injuriesAsOfVerified:false,
  powerPlayAsOfVerified:false,penaltyKillAsOfVerified:false,travelAsOfVerified:false
 };
}
export function buildNhlAsOfPregameContext({game,asOf,finalScores,boxscoreRows}){
 const decision=time(asOf),start=time(game?.scheduledAt);
 if(decision===null||start===null||start-decision<60*60000)return blocked('NOT_FROZEN_60M_BEFORE_START');
 if(game?.status!=='SCHEDULED'||!/^nhl:202602\d{4}$/.test(String(game?.eventId??''))||
  int(game?.homeId)===null||int(game?.awayId)===null||game.homeId===game.awayId)
  return blocked('NHL_TEAM_EVENT_UNVERIFIED');
 if(!Array.isArray(finalScores)||!Array.isArray(boxscoreRows))return blocked('MISSING_EVIDENCE');
 const home=teamFeatures(game.homeId,finalScores,boxscoreRows,decision,start);
 const away=teamFeatures(game.awayId,finalScores,boxscoreRows,decision,start);
 const goalieEvidence=[home,away].filter(x=>x.lastObservedHistoricalStarter).length;
 const restEvidence=[home,away].filter(x=>x.hoursSincePreviousGame!==null).length;
 const sourceRows=[home.lastKnownMatch,away.lastKnownMatch,
  home.lastObservedHistoricalStarter?.gameId,away.lastObservedHistoricalStarter?.gameId].filter(Boolean);
 return {status:'RESEARCH_CONTEXT_ONLY',version:NHL_ASOF_CONTEXT_VERSION,
  asOf:new Date(decision).toISOString(),eventId:game.eventId,
  home,away,coverage:{historicalGoalieTeams:goalieEvidence,
   restEvidenceTeams:restEvidence,confirmedNextGameGoalieTeams:0},
  sourceHash:compact({eventId:game.eventId,asOf:new Date(decision).toISOString(),
   sourceRows,home,away}),
  powerPlayPenaltyKillNotScored:true,addedProviderCalls:0,
  scoreAdjusted:false,officialPicksChanged:false,
  warning:'A goalie observed STARTING in a previous game is not a confirmed starter for the upcoming game.'};
}
