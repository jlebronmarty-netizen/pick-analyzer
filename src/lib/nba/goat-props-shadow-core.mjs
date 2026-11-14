// NBA player props V1: strictly prospective, research-only baseline. No bookmaker recommendations.
export const NBA_PROPS_SHADOW_VERSION='NBA_PROPS_PROSPECTIVE_SHADOW_V1';
export const NBA_PROPS_SHADOW_STATS=Object.freeze({points:'pts',rebounds:'reb',assists:'ast',threes:'fg3m'});
export const NBA_PROPS_MIN_PRIOR_GAMES=5;
const ms=value=>{const n=Date.parse(String(value??''));return Number.isFinite(n)?n:null;};
const num=value=>value===null||value===undefined||value===''?null:Number(value);
const integer=value=>Number.isSafeInteger(Number(value))&&value!==null&&value!==undefined&&value!=='';
const round=n=>Number(n.toFixed(2));
function playedMinutes(value) {
 const s=String(value??'').trim();
 if(!s||s.toUpperCase()==='DNP')return 0;
 if(/^\d+:\d{1,2}$/.test(s)){const [minutes,seconds]=s.split(':').map(Number);return seconds<60?minutes+seconds/60:0;}
 const n=Number(s);return Number.isFinite(n)&&n>=0?n:0;
}
const blocked=(reason,details={})=>({
 status:'NOT_READY',reason,version:NBA_PROPS_SHADOW_VERSION,projection:null,
 modelProbability:null,expectedValue:null,recommendedPick:false,productionEligible:false,
 ...details
});
// Inputs are postgame rows with per-game capturedAt evidence. Never use results captured after the archived quote.
export function buildNbaPropShadowHypothesis({quote,event,playerGameStats,asOf,minPriorGames=NBA_PROPS_MIN_PRIOR_GAMES}) {
 const decisionMs=ms(asOf),quoteMs=ms(quote?.source_received_at),startMs=ms(event?.start_time);
 if(decisionMs===null||quoteMs===null||startMs===null)return blocked('MISSING_DECISION_TIMESTAMPS');
 if(decisionMs<quoteMs||quoteMs>=startMs-600000||decisionMs>=startMs-600000)return blocked('NOT_FROZEN_PREGAME');
 if(decisionMs-quoteMs>1800000)return blocked('STALE_ARCHIVED_PRICE');
 if(!integer(quote?.player_id)||!integer(quote?.provider_game_id)||String(event?.id)!=='bdl_nba_'+String(quote.provider_game_id))return blocked('PLAYER_GAME_IDENTITY_UNVERIFIED');
 const statistic=String(quote?.statistic??'');
 if(quote?.market!=='props'||quote?.phase!=='PREGAME'||!Object.hasOwn(NBA_PROPS_SHADOW_STATS,statistic))return blocked('UNSUPPORTED_PROP_CONTRACT');
 const side=String(quote?.side??'').toLowerCase();
 if(!['over','under'].includes(side)||quote?.contract!==(side==='over'?'STRICT_GREATER_THAN':'STRICT_LESS_THAN')||quote?.period!=='FULL_GAME_LABEL_OT_UNVERIFIED')return blocked('UNVERIFIED_FULL_GAME_SCOPE');
 const line=num(quote?.line),odds=num(quote?.american_odds);
 if(line===null||!Number.isFinite(line)||line<0||odds===null||!Number.isInteger(odds)||Math.abs(odds)<100)return blocked('INVALID_LINE_OR_ODDS');
 if(!Array.isArray(playerGameStats))return blocked('PLAYER_HISTORY_UNAVAILABLE');
 const seen=new Set(),history=[];
 for(const input of playerGameStats){
  const row=input?.stat,game=row?.game,gameId=Number(game?.id),playerId=Number(row?.player?.id);
  const gameMs=ms(game?.datetime),capturedMs=ms(input?.capturedAt);
  if(!Number.isSafeInteger(gameId)||!Number.isSafeInteger(playerId)||playerId!==Number(quote.player_id)||gameId===Number(quote.provider_game_id)||seen.has(gameId))continue;
  if(gameMs===null||gameMs>=quoteMs||capturedMs===null||capturedMs>quoteMs||String(game?.status_state??'').toLowerCase()!=='final')continue;
  if(playedMinutes(row?.min)<10)continue;
  const value=num(row[NBA_PROPS_SHADOW_STATS[statistic]]);
  if(value===null||!Number.isSafeInteger(value)||value<0)continue;
  seen.add(gameId);history.push({gameId,at:gameMs,value});
 }
 history.sort((a,b)=>b.at-a.at);
 const available=history.length;
 if(!Number.isInteger(minPriorGames)||minPriorGames<5)return blocked('UNSAFE_MINIMUM_HISTORY');
 if(available<minPriorGames)return blocked('INSUFFICIENT_PRIOR_GAMES',{historicalGames:available,minPriorGames});
 const recent=history.slice(0,Math.min(10,available)),lastFive=recent.slice(0,5);
 const avg=items=>items.reduce((sum,item)=>sum+item.value,0)/items.length;
 const mean5=avg(lastFive),mean10=avg(recent);
 const projection=.65*mean5+.35*mean10;
 const variance=recent.reduce((sum,item)=>sum+(item.value-mean10)**2,0)/Math.max(1,recent.length-1);
 const stdev=Math.sqrt(variance);
 return {
  status:'SHADOW_HYPOTHESIS_ONLY',version:NBA_PROPS_SHADOW_VERSION,
  providerGameId:Number(quote.provider_game_id),playerId:Number(quote.player_id),statistic,
  marketLine:line,americanOdds:odds,archivedQuoteId:quote.quote_id??null,quoteCapturedAt:quote.source_received_at,
  projection:round(projection),rawLastFiveAverage:round(mean5),rawLastTenAverage:round(mean10),
  indicativeRange:[round(Math.max(0,projection-1.5*stdev)),round(projection+1.5*stdev)],
  historicalGames:available,gamesUsed:recent.length,lastHistoricalGameAt:new Date(recent[0].at).toISOString(),
  sampleStandardDeviation:round(stdev),projectionMinusLine:round(projection-line),
  calibrated:false,validated:false,holdoutPassed:false,
  injuryAdjusted:false,lineupAdjusted:false,opponentAdjusted:false,
  modelProbability:null,expectedValue:null,recommendedPick:false,productionEligible:false,
  warning:'Descriptive pregame hypothesis only. No calibrated probability, model edge, ROI or sportsbook settlement certification.'
 };
}
