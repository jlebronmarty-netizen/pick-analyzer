// Select archived official NHL finals for team-form research, never tied to public forecast eligibility.
// Newest observed state for each event wins; incomplete, postponed, non-regular or pre-final are blocked.
export function selectNhlMainMarketHistoryTarget({runDetails,knownEventIds,nowMs=Date.now()}){
 if(!Number.isFinite(nowMs))return null;
 const seen=new Set(),eligible=[];
 const sorted=(Array.isArray(runDetails)?runDetails:[])
  .filter(x=>Number.isFinite(Date.parse(x?.completed_at??''))&&Date.parse(x.completed_at)<=nowMs)
  .sort((a,b)=>Date.parse(b.completed_at)-Date.parse(a.completed_at));
 for(const run of sorted){
  const games=run?.detail?.games;
  if(!Array.isArray(games))continue;
  for(const g of games){
   const eventId=String(g?.eventId??''),m=/^nhl:(\d{10})$/.exec(eventId);
   if(!m||seen.has(eventId))continue;
   seen.add(eventId);
   const gid=Number(m[1]),start=Date.parse(g?.scheduledAt??'');
   const homeId=Number(g?.homeId),awayId=Number(g?.awayId);
   if(String(m[1]).slice(0,6)!=='202602'||!Number.isSafeInteger(gid)||
     g?.status!=='FINAL'||!Number.isFinite(start)||start+4*3600000>=nowMs||
     !Number.isSafeInteger(homeId)||!Number.isSafeInteger(awayId)||homeId===awayId||
     !Number.isSafeInteger(g?.homeScore)||!Number.isSafeInteger(g?.awayScore)||
     g.homeScore<0||g.awayScore<0||g.homeScore===g.awayScore||knownEventIds.has(eventId))continue;
   eligible.push({eventId,gameId:gid,scheduledAt:g.scheduledAt,homeId,awayId,
    homeScore:g.homeScore,awayScore:g.awayScore,archivedAt:run.completed_at});
  }
 }
 eligible.sort((a,b)=>Date.parse(b.scheduledAt)-Date.parse(a.scheduledAt));
 return eligible[0]??null;
}
export function nhlOfficialHistoryResponseValid({candidate,boxscore,pbp}){
 const b=boxscore,p=pbp;
 if(!candidate||Number(b?.id)!==candidate.gameId||Number(p?.id)!==candidate.gameId||
   Number(b?.gameType)!==2||Number(p?.gameType)!==2||
   !['OFF','FINAL'].includes(String(b?.gameState??''))||!['OFF','FINAL'].includes(String(p?.gameState??'')))return false;
 if(Number(b?.homeTeam?.id)!==candidate.homeId||Number(b?.awayTeam?.id)!==candidate.awayId||
   b?.homeTeam?.score!==candidate.homeScore||b?.awayTeam?.score!==candidate.awayScore)return false;
 if(!Array.isArray(p?.plays)||p.plays.length<10||!b?.playerByGameStats)return false;
 return true;
}
