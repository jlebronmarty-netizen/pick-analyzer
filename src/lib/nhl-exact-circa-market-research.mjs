// NHL exact-line Circa SHADOW research, using archived source receipts only.
// No claims of sportsbook rules, OT/SO model accuracy, EV or ROI.
import {nhlScoreDistribution} from './nhl-challenger-poisson-core.mjs';
export const NHL_CIRCA_EXACT_LINE_RESEARCH='NHL_CIRCA_EXACT_LINE_RESEARCH_V1';
const ms=v=>{const t=Date.parse(String(v??''));return Number.isFinite(t)?t:null;};
const odds=x=>Number.isSafeInteger(x)&&Math.abs(x)>=100&&Math.abs(x)<=20000;
const implied=x=>x>0?100/(100+x):(-x)/(100-x);
const round=(n,d=5)=>Number(n.toFixed(d));
const prob=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1;
const no=(reason)=>({status:'NOT_READY',reason,officialPick:false,settlementCertified:false});
const sameEvent=(row,x)=>x?.eventId===row?.event_id &&
 ms(x?.scheduledAt)===ms(row?.scheduled_at)&&x?.homeId===Number(row?.home_team_id)&&
 x?.awayId===Number(row?.away_team_id)&&x?.home===row?.home_team&&x?.away===row?.away_team;
function validatedQuote(row,x,{maxAgeMinutes=60}={}){
 const freeze=ms(row?.frozen_at),start=ms(row?.scheduled_at),at=ms(x?.capturedAt);
 if(freeze===null||start===null||at===null||freeze>start-60*60000||
  at>freeze||at>start-60*60000||freeze-at>maxAgeMinutes*60000||
  !sameEvent(row,x)||x.book!=='CIRCA'||x?.quote?.book!=='CIRCA'||
  x?.marketRulesCertified!==false||x?.officialPick!==false||
  x?.quote?.readyForOfficialPicks!==false||
  x?.quote?.fullGameContractCertified!==false||
  !['spread','total'].includes(x.market)||x.quote.market!==x.market)
  return no('QUOTE_IDENTITY_OR_ASOF_REJECTED');
 const q=x.quote;let line,priceA,priceB;
 if(x.market==='spread'){
  if(q.home?.name!==row.home_team||q.away?.name!==row.away_team||
   ![-1.5,1.5].includes(q.home?.line)||q.away?.line!==-q.home.line)
   return no('UNPAIRED_PUCK_LINE');
  line=q.home.line;priceA=q.home.price;priceB=q.away.price;
 } else {
  if(q.over?.side!=='Over'||q.under?.side!=='Under'||
   typeof q.over.line!=='number'||q.over.line<1||q.over.line>14||
   !Number.isInteger(q.over.line*2)||q.over.line!==q.under?.line)
   return no('UNPAIRED_TOTAL');
  line=q.over.line;priceA=q.over.price;priceB=q.under.price;
 }
 if(!odds(priceA)||!odds(priceB))return no('QUOTE_PRICES_INVALID');
 const a=implied(priceA),b=implied(priceB),sum=a+b;
 if(sum<.90||sum>1.35)return no('QUOTE_VIG_INVALID');
 return {status:'VALID_CIRCA_RESEARCH_QUOTE',market:x.market,line,priceA,priceB,
  capturedAt:x.capturedAt,sourceId:x.sourceId??null,eventId:row.event_id,
  noVigFirst:round(a/sum),noVigSecond:round(b/sum),
  sourceUpdatedAtVerified:false,marketRulesCertified:false,
  officialPick:false,settlementCertified:false};
}
export function selectNhlExactCircaAsOf({frozen,observations,market,maxAgeMinutes=60}){
 if(!frozen||!Array.isArray(observations)||!['spread','total'].includes(market)||
  !Number.isInteger(maxAgeMinutes)||maxAgeMinutes<1||maxAgeMinutes>60)return no('INVALID_SOURCE_REQUEST');
 const possible=observations.filter(x=>x?.eventId===frozen.event_id&&x.market===market)
  .map(x=>validatedQuote(frozen,x,{maxAgeMinutes}))
  .filter(x=>x.status==='VALID_CIRCA_RESEARCH_QUOTE')
  .sort((a,b)=>ms(b.capturedAt)-ms(a.capturedAt));
 if(!possible.length)return no('NO_VERIFIED_MATCHED_ASOF_QUOTE');
 const newest=possible[0],sameTime=possible.filter(x=>x.capturedAt===newest.capturedAt);
 if(sameTime.some(x=>x.line!==newest.line||x.priceA!==newest.priceA||x.priceB!==newest.priceB))
  return no('CONTRADICTORY_SAME_TIME_QUOTES');
 return newest;
}
export function nhlExactMarketProxy({frozen,quote}){
 if(quote?.status!=='VALID_CIRCA_RESEARCH_QUOTE'||!frozen?.projection||
   quote.eventId!==frozen.event_id)return no('NO_FROZEN_MARKET_PAIR');
 const h=frozen.projection.homeGoals,a=frozen.projection.awayGoals;
 const dist=nhlScoreDistribution(h,a,
  {puckLine:quote.market==='spread'?quote.line:-1.5,
   totalLine:quote.market==='total'?quote.line:5.5});
 if(!dist)return no('INVALID_SCORE_DISTRIBUTION');
 const first=quote.market==='spread'?dist.homePucklineCoverProxy:dist.overGoalsProxy;
 const push=quote.market==='spread'?dist.homePucklinePushProxy:dist.totalPushProxy;
 const second=quote.market==='spread'?dist.awayPucklineCoverProxy:dist.underGoalsProxy;
 if(![first,push,second].every(prob)||Math.abs(first+push+second-1)>.0015||
    first+second<.01)return no('INCOMPLETE_RESEARCH_SCORE_MASS');
 return {status:'UNVALIDATED_EXACT_LINE_PROXY',market:quote.market,line:quote.line,
  modelFirstConditional:round(first/(first+second)),
  modelSecondConditional:round(second/(first+second)),
  modelPushProbability:round(push),bookNoVigFirst:quote.noVigFirst,
  quoteCapturedAt:quote.capturedAt,sourceId:quote.sourceId,
  independentPoisson:true,OTSOModelCertified:false,marketRulesCertified:false,
  bookmakerEdgeCertified:false,expectedValue:null,officialPick:false};
}
function empty(){
 return {pricedEvents:0,graded:0,pushes:0,invalid:0,
 modelBrierSum:0,bookBrierSum:0,modelLogLossSum:0,bookLogLossSum:0,
 modelHits:0,bookHits:0,lines:new Map()};
}
function scoreReport(s){
 return {pricedEvents:s.pricedEvents,graded:s.graded,pushes:s.pushes,
  modelBrier:s.graded?round(s.modelBrierSum/s.graded):null,
  circaNoVigBrier:s.graded?round(s.bookBrierSum/s.graded):null,
  modelLogLoss:s.graded?round(s.modelLogLossSum/s.graded):null,
  circaNoVigLogLoss:s.graded?round(s.bookLogLossSum/s.graded):null,
  modelHits:s.modelHits,circaHits:s.bookHits,
  observedLines:[...s.lines].sort((a,b)=>a[0]-b[0]).map(([line,n])=>({line,n}))};
}
export function gradeNhlExactCircaCohort({frozenRows,observations,finalRows,maxAgeMinutes=60}){
 if(!Array.isArray(frozenRows)||!Array.isArray(observations)||!Array.isArray(finalRows))
  return no('MISSING_COHORT_SOURCE');
 const outcomes=new Map(),conflicted=new Set();
 for(const o of finalRows){
  if(!o?.event_id||conflicted.has(o.event_id))continue;
  if(outcomes.has(o.event_id)){outcomes.delete(o.event_id);conflicted.add(o.event_id);}
  else outcomes.set(o.event_id,o);
 }
 const data={spread:empty(),total:empty()};
 let validFrozen=0,skippedFrozen=0,invalidResults=0,settledDistinct=new Set();
 for(const row of frozenRows){
  const freeze=ms(row?.frozen_at),tip=ms(row?.scheduled_at);
  if(freeze===null||tip===null||tip-freeze<60*60000||
   row?.official_pick!==false||row?.production_eligible!==false||
   !/^nhl:202602\d{4}$/.test(String(row?.event_id??''))||
   !Number.isSafeInteger(Number(row?.home_team_id))||
   !Number.isSafeInteger(Number(row?.away_team_id))||
   row.home_team_id===row.away_team_id){skippedFrozen++;continue;}
  validFrozen++;
  const final=outcomes.get(row.event_id),b=final?.body;
  const hasTruth=final&&ms(final.observed_at)!==null&&ms(final.observed_at)>tip&&
   ms(b?.scheduledAt)===tip&&Number(b?.homeId)===Number(row.home_team_id)&&
   Number(b?.awayId)===Number(row.away_team_id)&&
   Number.isSafeInteger(b?.homeScore)&&Number.isSafeInteger(b?.awayScore)&&
   b.homeScore!==b.awayScore;
  if(final&&!hasTruth)invalidResults++;
  if(hasTruth)settledDistinct.add(row.event_id);
  for(const market of ['spread','total']){
   const q=selectNhlExactCircaAsOf({frozen:row,observations,market,maxAgeMinutes});
   if(q.status!=='VALID_CIRCA_RESEARCH_QUOTE')continue;
   const proxy=nhlExactMarketProxy({frozen:row,quote:q});
   if(proxy.status!=='UNVALIDATED_EXACT_LINE_PROXY')continue;
   const s=data[market];s.pricedEvents++;s.lines.set(q.line,(s.lines.get(q.line)??0)+1);
   if(!hasTruth||conflicted.has(row.event_id))continue;
   const margin=b.homeScore-b.awayScore,total=b.homeScore+b.awayScore;
   const difference=market==='spread'?margin+q.line:total-q.line;
   if(difference===0){s.pushes++;continue;}
   const y=difference>0?1:0,p=proxy.modelFirstConditional,z=proxy.bookNoVigFirst;
   if(p<=0||p>=1||z<=0||z>=1)continue;
   s.graded++;s.modelHits+=Number((p>=.5)===Boolean(y));s.bookHits+=Number((z>=.5)===Boolean(y));
   s.modelBrierSum+=(p-y)**2;s.bookBrierSum+=(z-y)**2;
   s.modelLogLossSum+=-(y*Math.log(p)+(1-y)*Math.log(1-p));
   s.bookLogLossSum+=-(y*Math.log(z)+(1-y)*Math.log(1-z));
  }
 }
 return {status:'STATISTICAL_EXACT_LINE_RESEARCH_ONLY',version:NHL_CIRCA_EXACT_LINE_RESEARCH,
  frozenRows:frozenRows.length,validFrozen,skippedFrozen,
  settledDistinctGames:settledDistinct.size,invalidResults,
  markets:{spread:scoreReport(data.spread),total:scoreReport(data.total)},
  modelValidated:false,officialPicksChanged:false,marketRulesCertified:false,
  OTSOModelCertified:false,noBookmakerROIClaim:true,providerCalls:0,databaseWrites:0,
  warning:'Independent Poisson approximate score distribution; Circa source update timestamps and exact settlement eligibility unverified. Integer total pushes excluded from win/loss scoring. Do not promote from retrospective data.'};
}
