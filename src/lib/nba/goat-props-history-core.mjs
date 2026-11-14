// Pure historical backlog selection, no provider calls, no scoring.
export function selectNbaPropsHistoryBackfillGame(snapshots,existingIds,nowMs=Date.now(),season=2026){
 const seen=new Set(),candidates=[];
 const sorted=[...(Array.isArray(snapshots)?snapshots:[])].sort((a,b)=>Date.parse(b?.source_received_at??'')-Date.parse(a?.source_received_at??''));
 for(const snap of sorted){
  const received=Date.parse(snap?.source_received_at??'');
  const games=snap?.payload?.data?.games;
  if(!Number.isFinite(received)||received>nowMs||!Array.isArray(games))continue;
  for(const game of games){
   const gameId=Number(game?.id),start=Date.parse(game?.datetime??'');
   if(!Number.isSafeInteger(gameId)||seen.has(gameId))continue;
   seen.add(gameId);
   if(!Number.isFinite(start)||start>nowMs-4*3600000)continue;
   if(String(game?.status_state??'').toLowerCase()!=='final'||Number(game?.season)!==season||game?.postseason===true||game?.postponed===true)continue;
   if(existingIds.has(gameId))continue;
   candidates.push({providerGameId:gameId,startTime:game.datetime,sourceScheduleReceivedAt:snap.source_received_at});
  }
 }
 candidates.sort((a,b)=>Date.parse(b.startTime)-Date.parse(a.startTime));
 return candidates[0]??null;
}
