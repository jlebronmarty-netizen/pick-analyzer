// A normalized quote ID may be reused when the provider price is unchanged.
// The immutable envelope identifies the actual capture, including a legitimately empty menu.
export function readMarketBatches(rows, game, lane, cutoff) {
  const invalid=reason=>({quotes:[],reason});
  if(!rows.length)return invalid('SOURCE_UNAVAILABLE');
  const first=rows[0], captured=Date.parse(first.source_received_at);
  if(!Number.isFinite(captured)||captured>Date.parse(cutoff))return invalid('INVALID_CAPTURE_TIME');
  const size=lane==='props'?Number(first.batch_count):1;
  if(!Number.isSafeInteger(size)||size<1||size>32||rows.length!==size)return invalid('MISSING_OR_CONFLICTING_BATCH');
  const batches=new Set(),seen=new Set(),quotes=[];
  for(const r of rows){
    if(r.provider_game_id!==game.id||r.game?.id!==game.id||r.game?.season!==game.season||
       r.game?.home_team?.id!==game.home_team.id||r.game?.visitor_team?.id!==game.visitor_team.id||
       Date.parse(r.game?.datetime)!==Date.parse(game.datetime)||
       r.phase!=='PREGAME'||r.payload_phase!==r.phase)return invalid('GAME_OR_PHASE_MISMATCH');
    if(r.snapshot_id!==r.payload_snapshot_id||!r.snapshot_id||r.provider!=='BALLDONTLIE'||r.book!=='FanDuel'||
       r.namespace!=='balldontlie'||r.status!=='DATA_RETRIEVED'||
       captured!==Date.parse(r.source_received_at)||captured!==Date.parse(r.payload_received_at)||
       !(Date.parse(r.recorded_at)<=Date.parse(cutoff))||
       !Array.isArray(r.quotes)||r.quotes.length!==r.quote_count||Number(r.payload_count)!==r.quote_count)
      return invalid('CAPTURE_NOT_RECONCILED');
    if(lane==='props'){
      const index=Number(r.batch_index);
      if(!r.capture_id||r.capture_id!==first.capture_id||r.response_hash!==first.response_hash||
         !/^[a-f0-9]{64}$/.test(r.response_hash)||r.complete!==true||Number(r.batch_count)!==size||
         r.batch_index==null||!Number.isInteger(index)||index<0||index>=size||batches.has(index)||
         Number(r.normalized_count)!==Number(first.normalized_count))return invalid('INCOMPLETE_PROP_CAPTURE');
      batches.add(index);
    }
    for(const q of r.quotes){
      if(q.game_id!==game.id||q.provider!=='BALLDONTLIE'||q.sportsbook!==r.book||
         !/^[a-f0-9]{64}$/.test(q.quote_id)||seen.has(q.quote_id)||
         (q.source_received_at!=null&&Date.parse(q.source_received_at)!==captured))return invalid('QUOTE_RECEIPT_MISMATCH');
      seen.add(q.quote_id);
      if(lane==='props'?q.market!=='props'||!['over','under'].includes(q.side):!['moneyline','spread','total'].includes(q.market))continue;
      quotes.push({...q,provider_game_id:game.id,source_received_at:r.source_received_at,
        phase:r.phase,snapshot_id:r.snapshot_id,envelopeReceivedAt:r.payload_received_at,payload:q});
    }
  }
  if(lane==='props'&&seen.size!==Number(first.normalized_count))return invalid('INCOMPLETE_PROP_CAPTURE');
  return {quotes,reason:null};
}
