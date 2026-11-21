import {readFileSync,writeFileSync} from 'node:fs';
import {latestArchivedFinal} from '../../../src/lib/nba/decision-learning-core.mjs';
import {verifiedArchivedPlayerFinal} from '../../../src/lib/nba/decision-archived-final-core.mjs';
import {settleProbabilityFreeze} from '../../../src/lib/nba/decision-shadow-v2.mjs';
const [batchFile,receiptsFile,out]=process.argv.slice(2);
if(!out)throw Error('Usage: node settle.mjs forward.json receipts.json new-outcomes.json');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const batch=read(batchFile),inputs=read(receiptsFile),checkedAt=new Date().toISOString();
const outcomes=[],pending=[];
for(const f of batch.rows) {
  const data=inputs[String(f.gameId)];
  const archived=(data?.scheduleReceipts??[]).filter(r=>Date.parse(r.source_received_at)<=Date.parse(checkedAt))
    .sort((a,b)=>Date.parse(b.source_received_at)-Date.parse(a.source_received_at));
  const final=latestArchivedFinal(archived,f.gameId,f.gameDay,checkedAt);
  let result=null;
  if(final){
    const source={game:final.game,sourceReceivedAt:final.receivedAt};
    if(f.market==='props'){
      const contexts=(data.contexts??[]).filter(c=>c.provider_game_id===f.gameId && Date.parse(c.player_stats_captured_at)<=Date.parse(checkedAt));
      const matches=(data.compact??[]).filter(r=>r.provider_game_id===f.gameId&&r.player_id===f.playerId &&
        Date.parse(r.source_captured_at)<=Date.parse(r.materialized_at) && Date.parse(r.materialized_at)<=Date.parse(checkedAt));
      if(contexts.length===1 && matches.length===1){
        const box=verifiedArchivedPlayerFinal({context:contexts[0],final:final.game,providerGameId:f.gameId,allowPartialComponents:true});
        source.original=box?.rows.get(f.playerId);
        source.compact=matches[0];
        source.playerStatReceivedAt=box?.capturedAt;
      }
    }
    result=settleProbabilityFreeze(f,source);
  }
  if(result)outcomes.push({...result,snapshotId:final.snapshotId});
  else pending.push({forecastId:f.forecastId,reason:final?'DISPUTED_OR_UNVERIFIED_COMPONENT':'AWAITING_RECONCILED_FINAL'});
}
writeFileSync(out,JSON.stringify({checkedAt,modelHash:batch.modelHash,outcomes,pending},null,2)+'\n',{flag:'wx'});
