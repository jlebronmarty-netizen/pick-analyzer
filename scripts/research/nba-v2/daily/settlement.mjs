import {latestArchivedFinal} from '../../../../src/lib/nba/decision-learning-core.mjs';
import {verifiedArchivedPlayerFinal} from '../../../../src/lib/nba/decision-archived-final-core.mjs';
import {settleProbabilityFreeze} from '../../../../src/lib/nba/decision-shadow-v2.mjs';
const time=Date.parse;
export function grade(f,data,at) {
  const cutoff=time(at);
  const archived=(data?.scheduleReceipts??[]).filter(r=>time(r.recorded_at)<=cutoff && time(r.source_received_at)<=cutoff)
    .sort((a,b)=>time(b.source_received_at)-time(a.source_received_at));
  const final=latestArchivedFinal(archived,f.gameId,f.gameDay,at);
  if(!final)return {forecastId:f.forecastId,reason:'AWAITING_RECONCILED_FINAL'};
  const source={game:final.game,sourceReceivedAt:final.receivedAt};
  if(f.market==='props'){
    const contexts=(data.contexts??[]).filter(c=>c.provider_game_id===f.gameId && time(c.player_stats_captured_at)<=cutoff);
    const compact=(data.compact??[]).filter(r=>r.provider_game_id===f.gameId && r.player_id===f.playerId &&
      time(r.source_captured_at)<=time(r.materialized_at) && time(r.materialized_at)<=cutoff);
    if(contexts.length===1 && compact.length===1){
      const box=verifiedArchivedPlayerFinal({context:contexts[0],final:final.game,providerGameId:f.gameId,allowPartialComponents:true});
      source.original=box?.rows.get(f.playerId);source.compact=compact[0];source.playerStatReceivedAt=box?.capturedAt;
    }
  }
  const result=settleProbabilityFreeze(f,source);
  if(result && f.market!=='props' && archived.length>1){
    const older=latestArchivedFinal(archived.slice(1),f.gameId,f.gameDay,at);
    const previous=older && settleProbabilityFreeze(f,{game:older.game,sourceReceivedAt:older.receivedAt});
    if(previous && previous.actual!==result.actual)return {forecastId:f.forecastId,reason:'DISPUTED_OR_UNVERIFIED_COMPONENT'};
  }
  return result?{...result,snapshotId:final.snapshotId}:{forecastId:f.forecastId,reason:'DISPUTED_OR_UNVERIFIED_COMPONENT'};
}
