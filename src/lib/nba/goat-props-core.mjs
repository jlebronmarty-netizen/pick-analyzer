// Statistical-only historical prop comparison; NEVER a prediction or sportsbook settlement.
const STAT_FIELDS=Object.freeze({points:'pts',rebounds:'reb',assists:'ast',threes:'fg3m'});
export const NBA_PROP_RESEARCH_MARKETS=Object.freeze(Object.keys(STAT_FIELDS));

export function gradeNbaPropStoredQuote(quote,playerStat) {
  const blocked=(reason)=>({status:'NOT_GRADED',reason,statisticalOnly:true,sportsbookSettlement:false,predictionAccuracy:false});
  if(quote?.market!=='props'||quote?.phase!=='PREGAME')return blocked('NOT_CERTIFIED_PREGAME_PROP');
  if(quote?.period!=='FULL_GAME_LABEL_OT_UNVERIFIED')return blocked('UNKNOWN_PERIOD_SCOPE');
  if(!Object.hasOwn(STAT_FIELDS,quote?.statistic))return blocked('UNSUPPORTED_PLAYER_STAT');
  const side=String(quote?.side??'').toLowerCase();
  if((side!=='over'&&side!=='under')||(side==='over'&&quote?.contract!=='STRICT_GREATER_THAN')||(side==='under'&&quote?.contract!=='STRICT_LESS_THAN'))return blocked('CONTRACT_MISMATCH');
  const line=Number(quote?.line);
  if(quote?.line==null||!Number.isFinite(line)||line<0)return blocked('INVALID_EXACT_LINE');
  const quoteGame=Number(quote?.provider_game_id),actualGame=Number(playerStat?.game?.id);
  const quotePlayer=Number(quote?.player_id),actualPlayer=Number(playerStat?.player?.id);
  if(!Number.isSafeInteger(quoteGame)||!Number.isSafeInteger(quotePlayer)||quoteGame!==actualGame||quotePlayer!==actualPlayer)return blocked('EXACT_GAME_PLAYER_IDENTITY_MISMATCH');
  const receivedMs=Date.parse(quote?.source_received_at??''),scheduledMs=Date.parse(playerStat?.game?.datetime??'');
  if(!Number.isFinite(receivedMs)||!Number.isFinite(scheduledMs)||receivedMs>=scheduledMs-600000)return blocked('PREGAME_CUTOFF_UNVERIFIED');
  if(String(playerStat?.game?.status_state??'').toLowerCase()!=='final')return blocked('FINAL_GAME_UNVERIFIED');
  const minutes=String(playerStat?.min??'').trim();
  if(!minutes||minutes==='0'||minutes==='0:00'||minutes==='00:00'||minutes==='DNP')return blocked('PLAYER_DID_NOT_PLAY_OR_MINUTES_UNVERIFIED');
  const rawActual=playerStat[STAT_FIELDS[quote.statistic]];
  if(rawActual==null||rawActual==='')return blocked('ACTUAL_PLAYER_STAT_UNVERIFIED');
  const actual=Number(rawActual);
  if(!Number.isSafeInteger(actual)||actual<0)return blocked('ACTUAL_PLAYER_STAT_UNVERIFIED');
  const outcome=actual===line?'push':side==='over'?(actual>line?'win':'loss'):(actual<line?'win':'loss');
  return {status:'STATISTICAL_COMPARISON',outcome,actual,line,statistic:quote.statistic,side,statisticalOnly:true,sportsbookSettlement:false,predictionAccuracy:false};
}
