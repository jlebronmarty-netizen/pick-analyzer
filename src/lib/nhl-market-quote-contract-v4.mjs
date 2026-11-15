// NHL main-market exact quote contracts; pure research-only validation.
// NO claims about FanDuel availability or settled profit; no provider calls.
export const NHL_MARKET_CONTRACT_VERSION='NHL_EXACT_MARKET_CONTRACTS_V4';
const toMs=x=>{const t=Date.parse(String(x??''));return Number.isFinite(t)?t:null;};
const block=(reason)=>({status:'NOT_CERTIFIED',reason,eligibleForRecommendation:false,estimatedEdge:null});
const within=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
const allowedBooks=new Set(['fanduel','draftkings','betmgm','williamhill_us','caesars','circasports']);
const allowedMarkets=new Set(['h2h','spreads','totals']);
const american=x=>Number.isSafeInteger(x)&&Math.abs(x)>=100&&Math.abs(x)<=20000&&x!==0;
export const nhlAmericanImplied=x=>x>0?100/(100+x):(-x)/(100-x);
export function classifyNhlBookQuote({game,bookmaker,market,receivedAt,decisionAt}){
 const tip=toMs(game?.scheduledAt),now=toMs(decisionAt),
  eventStart=toMs(game?.providerCommenceTime),sourceAt=toMs(market?.last_update??bookmaker?.last_update),
  collected=toMs(receivedAt);
 if(tip===null||now===null||collected===null||eventStart===null||sourceAt===null)
  return block('UNVERIFIED_MARKET_TIMESTAMP');
 if(game?.status!=='SCHEDULED'||tip-now<60*60000||Math.abs(tip-eventStart)>15*60000)
  return block('EVENT_START_OR_PREGAME_CUTOFF_FAILED');
 if(!allowedBooks.has(String(bookmaker?.key??''))||!allowedMarkets.has(String(market?.key??'')))
  return block('UNVERIFIED_BOOK_OR_MARKET');
 if(sourceAt>now+5000||collected>now+5000||now-collected>10*60000||now-sourceAt>20*60000)
  return block('QUOTE_STALE_OR_AFTER_DECISION');
 if(String(game?.home)!==String(game?.providerHome)||String(game?.away)!==String(game?.providerAway)||
  !game?.home||!game?.away||game.home===game.away)return block('HOME_AWAY_IDENTITY_UNVERIFIED');
 const outcomes=market?.outcomes;
 if(!Array.isArray(outcomes)||outcomes.length!==2||outcomes.some(x=>!american(x?.price)))
  return block('INCOMPLETE_TWO_SIDED_MARKET');
 const key=market.key;
 let sideA,sideB,line=null;
 if(key==='h2h'){
  sideA=outcomes.find(x=>x.name===game.home);sideB=outcomes.find(x=>x.name===game.away);
  if(!sideA||!sideB||outcomes.some(x=>x.point!==undefined))return block('MONEYLINE_OUTCOME_IDENTITY_OR_LINE');
 }else if(key==='spreads'){
  sideA=outcomes.find(x=>x.name===game.home);sideB=outcomes.find(x=>x.name===game.away);
  if(!sideA||!sideB||!within(sideA.point,-5,5)||!within(sideB.point,-5,5)||
    sideA.point!==-sideB.point||sideA.point===0)
   return block('SPREAD_MISSING_OR_UNPAIRED_HANDICAP');
  line=sideA.point;
 }else{
  sideA=outcomes.find(x=>x.name==='Over');sideB=outcomes.find(x=>x.name==='Under');
  if(!sideA||!sideB||!within(sideA.point,1,14)||sideA.point!==sideB.point)
   return block('TOTAL_MISSING_OR_UNPAIRED_LINE');
  line=sideA.point;
 }
 const pA=nhlAmericanImplied(sideA.price),pB=nhlAmericanImplied(sideB.price);
 if(pA+pB<.9||pA+pB>1.35)return block('MARKET_PAIR_PRICE_INCONSISTENT');
 return {
  status:'EXACT_PRICE_PAIR_RESEARCH',version:NHL_MARKET_CONTRACT_VERSION,
  eventId:game.eventId,bookmakerKey:bookmaker.key,market:key,
  capturedAt:new Date(collected).toISOString(),sourceAt:new Date(sourceAt).toISOString(),
  scheduledAt:new Date(tip).toISOString(),line,
  first:{name:sideA.name,price:sideA.price,probNoVig:pA/(pA+pB)},
  second:{name:sideB.name,price:sideB.price,probNoVig:pB/(pA+pB)},
  sourceBookmakerRuleCertified:false,
  fullGameOTSOContractCertified:false,marketSettlementCertified:false,
  eligibleForRecommendation:false,estimatedEdge:null,
  note:'Exact two-sided provider quote research only, not verified FanDuel PR book availability or market rules.'
 };
}
export function evaluateNhlOddsSnapshotCoverage({rows,now}){
 const t=toMs(now);
 if(t===null||!Array.isArray(rows))return block('ODDS_ARCHIVE_UNAVAILABLE');
 const markets=['moneyline','spread','total'];
 return {status:'READ_ONLY_MARKET_COVERAGE',version:NHL_MARKET_CONTRACT_VERSION,
  checks:markets.map(m=>{
   const all=rows.filter(x=>x.market===m),fresh=all.filter(x=>{
    const timestamp=toMs(x.snapshot_time);
    return timestamp!==null&&timestamp<=t&&t-timestamp<=20*60000;
   });
   return {market:m,archivedRows:all.length,fresh20MinuteRows:fresh.length,
    latestArchivedAt:all.map(x=>x.snapshot_time).filter(x=>toMs(x)!==null).sort().at(-1)??null,
    priceUsableForCurrentSlate:fresh.length>0,verifiedFanDuelPairs:0,
    periodAndOTSOSettlementCertified:false};
  }),
  providerCalls:0,databaseWrites:0,paidCreditsConsumed:0,
  marketModelOfficialPicksChanged:false};
}
