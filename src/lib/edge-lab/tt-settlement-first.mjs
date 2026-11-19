// Pure TT source-call allocation: at most three budgeted provider calls/cycle.
// While backlog is high, do not ingest new prematch forecasts. Spend the same
// quota on retrieving verified finals. No changes to settlement identity rules.
export const TT_PAUSE_BACKLOG_AT = 40;
export function ttSettlementCallPlan(backlogEvents,targetCount){
 if(!Number.isSafeInteger(backlogEvents)||backlogEvents<0||!Number.isSafeInteger(targetCount)||targetCount<0||targetCount>2)
  throw Error('TT_CALL_PLAN_INVALID');
 const pauseNewForecasts=backlogEvents>=TT_PAUSE_BACKLOG_AT;
 const prematchCalls=pauseNewForecasts?0:1;
 const maxResults=3-targetCount-prematchCalls;
 const requestedRecentPages=pauseNewForecasts?2:backlogEvents>10?0:targetCount?1:2;
 const resultPages=Math.min(requestedRecentPages,maxResults);
 const callsMaximum=resultPages+targetCount+prematchCalls;
 if(callsMaximum>3)throw Error('TT_CALL_PLAN_EXCEEDS_CAP');
 return {version:'TT_SETTLEMENT_FIRST_CALL_PLAN_V1',pauseNewForecasts,
  resultPages,targetCount,prematchCalls,callsMaximum,
  resumeWhenBacklogBelow:TT_PAUSE_BACKLOG_AT};
}
