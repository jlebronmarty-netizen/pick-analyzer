// Read-only operational diagnostics. Never calls providers, changes limits or settles picks.
const DAY_CAP=9, DEFAULT_MONTH_CAP=240;
const ms=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
const count=v=>Number.isSafeInteger(v)&&v>=0;
export function ttBudgetStatus(records,checkedAt,nextDue=null){
 const at=ms(checkedAt);
 if(at===null||!Array.isArray(records))return {status:'UNKNOWN',reason:'BUDGET_OR_CLOCK_UNAVAILABLE',provider_balance_verified:false};
 const iso=new Date(at).toISOString(),month=iso.slice(0,7),day=iso.slice(0,10);
 const matching=records.filter(r=>r?.month===month);
 if(matching.length>1||records.some(r=>typeof r?.month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month)||r.month>month))return {status:'UNKNOWN',reason:'BUDGET_RECORD_INVALID',provider_balance_verified:false};
 const record=matching[0],used=record?.used??0,cap=record?.cap??DEFAULT_MONTH_CAP,dayUsed=record?.daily?.[day]??0;
 if(!count(used)||!count(cap)||!count(dayUsed)||cap===0||dayUsed>used||(record&&(!count(record.used)||!count(record.cap)||!record.daily||typeof record.daily!=='object'||Array.isArray(record.daily))))return {status:'UNKNOWN',reason:'BUDGET_RECORD_INVALID',provider_balance_verified:false};
 const dailyRemaining=Math.max(0,DAY_CAP-dayUsed),monthlyRemaining=Math.max(0,cap-used),available=Math.min(dailyRemaining,monthlyRemaining);
 const midnight=Date.parse(day+'T00:00:00Z')+86400000,d=new Date(at),nextMonth=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1);
 const reset=monthlyRemaining<3?nextMonth:dailyRemaining<3?midnight:null,due=ms(nextDue);
 return {status:available===0?'LOCAL_LIMIT_REACHED':available<3?'LOCAL_BUDGET_PARTIAL':'LOCAL_BUDGET_AVAILABLE',day_utc:day,month_utc:month,daily_used:dayUsed,daily_cap:DAY_CAP,daily_remaining:dailyRemaining,monthly_used:used,monthly_cap:cap,monthly_remaining:monthlyRemaining,cycle_max_attempts:3,full_cycle_budget_available:available>=3,budget_reset_at:reset===null?null:new Date(reset).toISOString(),next_full_cycle_not_before:due===null&&reset===null?null:new Date(Math.max(at,due??at,reset??at)).toISOString(),provider_balance_verified:false,source:record?'CURRENT_LOCAL_COUNTER':'NEW_MONTH_LOCAL_DEFAULT',schedule_guaranteed:false};
}
export function settlementCoverage(rows,sport,checkedAt,{reviewAfterHours=4}={}){
 const at=ms(checkedAt);if(!Array.isArray(rows)||at===null||!Number.isFinite(reviewAfterHours)||reviewAfterHours<=0)return {status:'UNKNOWN'};
 const result={status:'OBSERVED',sport,contracts:0,abstentions:0,future_contracts:0,started_pending_contracts:0,review_contracts:0,completed_contracts:0,disputed_contracts:0,invalid_time_contracts:0};
 const future=new Set(),pending=new Set(),review=new Set();
 for(const r of rows){if((r.sport??'SOCCER')!==sport)continue;result.contracts++;
  if(r.status==='ABSTAIN'){result.abstentions++;continue;}
  if(r.outcome){if(['W','L','PUSH','NUMERIC'].includes(r.outcome.status))result.completed_contracts++;else result.disputed_contracts++;continue;}
  const start=ms(r.scheduled_at),id=r.event_id;if(start===null||typeof id!=='string'){result.invalid_time_contracts++;continue;}
  if(start>at){result.future_contracts++;future.add(id);}else{result.started_pending_contracts++;pending.add(id);if(at-start>=reviewAfterHours*3600000){result.review_contracts++;review.add(id);}}
 }
 return {...result,future_events:future.size,started_pending_events:pending.size,review_events:review.size,review_after_hours:reviewAfterHours,warning:'Elapsed kickoff time does not certify a final result. Abstentions stay outside accuracy.'};
}
