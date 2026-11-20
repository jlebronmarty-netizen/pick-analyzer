// Read-only operational readiness for Soccer, UFC and ATP.
// Counts verified source/ledger evidence without generating or grading picks.
// This is intentionally separate from NCAAF, NHL, NBA, MLB and Table Tennis.
export const THREE_SPORTS_READINESS_V1='SOCCER_UFC_ATP_SOURCE_READINESS_V1';
const ms=x=>{const n=Date.parse(String(x??''));return Number.isFinite(n)?n:null;};
const whole=x=>Number.isSafeInteger(x)&&x>=0;
const asArray=x=>Array.isArray(x)?x:[];
const blocked=(reason,extra={})=>({status:'NOT_READY',reason,...extra,
 officialPicksChanged:false,providerCalls:0,modelPromoted:false});
export function auditSoccerReadiness(report,nowIso){
 const now=ms(nowIso);
 if(now===null)return blocked('CLOCK_UNVERIFIED');
 if(report?.status!=='AVAILABLE')return blocked('SOCCER_BRIDGE_UNAVAILABLE',{
  sourceState:'UNAVAILABLE',sourceContinuous:false,eligibleSelections:0});
 const source=ms(report.capturedAt),events=asArray(report.events);
 if(source===null||source>now+1000||events.length>2000)
  return blocked('SOCCER_SOURCE_TIME_OR_SCHEMA');
 const qualified=events.filter(x=>x?.warmupComplete===true&&
  ['QUALIFIED','STRONG'].includes(x.qualificationStatus));
 const settled=qualified.filter(x=>x.settlement&&['WIN','LOSS','VOID'].includes(x.settlement.result));
 const decisions=settled.filter(x=>['WIN','LOSS'].includes(x.settlement.result));
 const ageDays=(now-source)/86400000;
 const continuous=report.continuousCollection===true;
 const stale=ageDays>7;
 return {
  status:!continuous?'PUBLISHED_CHECKPOINT_NO_CONTINUOUS_CAPTURE':
    stale?'SOURCE_STALE':qualified.length===0?'NO_QUALIFIED_SELECTION':'RESEARCH_OBSERVATIONS_AVAILABLE',
  sourceCapturedAt:report.capturedAt,sourceAgeDays:Number(ageDays.toFixed(2)),
  staleOver7Days:stale,sourceContinuous:continuous,
  sourceModel:report.model,competition:report.competition,market:report.market,
  archivedProjections:events.length,
  insufficientWarmup:events.filter(x=>x.qualificationStatus==='INSUFFICIENT_HISTORY').length,
  eligibleSelections:qualified.length,settledQualified:settled.length,
  decisionsWithOutcome:decisions.length,
  accuracy:decisions.length?decisions.filter(x=>x.settlement.result==='WIN').length/decisions.length:null,
  outcomesForUnqualifiedMustNotBeCounted:true,providerCalls:0,officialPicksChanged:false,
  modelPromoted:false,action:'ACTIVATE_AND_VALIDATE_A_PERMISSIONED_CONTINUOUS_SOURCE_SEPARATELY'
 };
}
export function auditUfcReadiness({latestRun,predictions,results,quotes,nowIso}){
 const now=ms(nowIso);
 if(now===null||!Array.isArray(predictions)||!Array.isArray(results)||!Array.isArray(quotes))
  return blocked('UFC_LEDGER_UNAVAILABLE');
 const runAt=ms(latestRun?.started_at),detail=latestRun?.detail??{};
 if(runAt===null||runAt>now+1000)return blocked('UFC_RUN_UNVERIFIED');
 const bouts=asArray(detail.bouts),abstentions=asArray(detail.abstentions),
  issues=asArray(detail.issues).filter(x=>typeof x==='string').map(x=>x.slice(0,180));
 const v2=predictions.filter(x=>x?.body?.model==='UFC_ELO_K32_FREE_V2_IDENTITY');
 const retired=predictions.length-v2.length;
 const resultIds=new Set(results.filter(x=>typeof x?.bout_id==='string').map(x=>x.bout_id));
 const quotedIds=new Set(quotes.filter(x=>typeof x?.bout_id==='string').map(x=>x.bout_id));
 const eligibleV2=v2.filter(x=>x?.scheduled_at&&x?.captured_at&&ms(x.captured_at)<ms(x.scheduled_at));
 const settledIds=new Set(eligibleV2.filter(x=>resultIds.has(x.bout_id)).map(x=>x.bout_id));
 const counts={};for(const a of abstentions){
  const why=typeof a?.reason==='string'?a.reason:'UNCLASSIFIED';
  counts[why]=(counts[why]??0)+1;
 }
 return {status:issues.length?'CAPTURE_ACTIVE_SELECTIVE_HISTORY_REVIEW':'CAPTURE_ACTIVE',
  latestRunAt:latestRun.started_at,sourceState:latestRun.status,
  latestProviderCalls:whole(latestRun.provider_calls)?latestRun.provider_calls:null,
  latestBouts:bouts.length,latestAbstentions:abstentions.length,abstentionReasons:counts,
  historicalBouts:whole(Number(detail.historyBouts))?Number(detail.historyBouts):null,
  sourceIssues:issues,
  activeModel:'UFC_ELO_K32_FREE_V2_IDENTITY',
  v2ArchivedForecasts:v2.length,retiredV1Rows:retired,
  v2ValidPrematchRows:eligibleV2.length,
  v2BoutsWithResultEvidence:settledIds.size,
  quoteSnapshots:quotes.length,quotedDistinctBouts:quotedIds.size,
  forecastsAreNotAutomaticallyGradedByResultPresence:true,
  immediateAccuracy:null,reasonForNoImmediateAccuracy:'STRICT_RESULT_IDENTITY_SETTLEMENT_REQUIRED',
  providerCalls:0,officialPicksChanged:false,modelPromoted:false,
  action:'PRESERVE_ABSTENTIONS_AND_VALIDATE_WINNER_IDENTITY;REVIEW_SOURCE_BUDGET'
 };
}
export function auditAtpReadiness({runs,forecastCount=0,resultCount=0,nowIso}){
 const now=ms(nowIso);
 if(now===null||!Array.isArray(runs)||!whole(forecastCount)||!whole(resultCount))
  return blocked('ATP_LEDGER_UNAVAILABLE');
 const good=runs.filter(r=>r.state==='OK'&&r?.captureOnly===true&&
  ms(r.requested_at)!==null&&ms(r.requested_at)<=now&&r?.normalized?.status==='OFFLINE_CONTRACT_ONLY');
 const latest=[...good].sort((a,b)=>ms(b.requested_at)-ms(a.requested_at))[0]??null;
 const byKey=new Map(),all=[];
 for(const run of good){
  for(const x of asArray(run.normalized?.events)){
   if(typeof x?.key!=='string'||typeof x?.scheduledAt!=='string'||ms(x.scheduledAt)===null)continue;
   const previous=byKey.get(x.key)??{seen:0,times:new Set()};
   previous.seen++;previous.times.add(new Date(ms(x.scheduledAt)).toISOString());
   byKey.set(x.key,previous);
   all.push(x);
  }
 }
 const repeated=[...byKey.values()].filter(x=>x.seen>=2);
 const drift=repeated.filter(x=>x.times.size>1);
 const latestEvents=asArray(latest?.normalized?.events);
 const latestPrices=latestEvents.filter(x=>x.price&&typeof x.price==='object');
 const anyPrice=all.filter(x=>x.price&&typeof x.price==='object');
 return {
  status:forecastCount>0?'FORECAST_LEDGER_REQUIRES_VERIFICATION':
   !latest?'NO_VERIFIED_SOURCE_CAPTURE':
   drift.length?'CAPTURE_ONLY_TEMPORAL_IDENTITY_DRIFT':'CAPTURE_ONLY_NO_MODEL',
  latestSourceAt:latest?.observed_at??null,
  latestFixtures:latestEvents.length,latestPricedFixtures:latestPrices.length,
  successfulReceipts:good.length,allObservedFixtures:all.length,
  distinctFixtureKeys:byKey.size,repeatedKeys:repeated.length,
  repeatedWithChangingScheduledAt:drift.length,
  pricedObservationsAcrossSnapshots:anyPrice.length,
  frozenPredictions:forecastCount,finalOutcomes:resultCount,
  matchTimeSemanticsCertified:false,
  historicalDecisiveResultsCertified:false,
  sportsbookExecutionVerified:false,sourcePlanForResultsCertified:false,
  providerCalls:0,officialPicksChanged:false,modelPromoted:false,
  action:'VALIDATE_EVENT_IDENTITY_AND_FINALS_ENTITLEMENT_BEFORE_ENABLING_FORECASTS'
 };
}
export function threeSportsReadiness({soccer,ufc,atp,nowIso}){
 return {version:THREE_SPORTS_READINESS_V1,asOf:nowIso,
  readOnly:true,databaseWrites:0,providerSportsCalls:0,
  soccer:auditSoccerReadiness(soccer,nowIso),
  ufc:auditUfcReadiness({...ufc,nowIso}),
  atp:auditAtpReadiness({...atp,nowIso}),
  excludedSports:['NCAAF'],researchOnly:true,
  warning:'Operational readiness is not predictive accuracy or profitability. Sources without future frozen forecasts and independently verified final outcomes cannot claim accuracy.'};
}
