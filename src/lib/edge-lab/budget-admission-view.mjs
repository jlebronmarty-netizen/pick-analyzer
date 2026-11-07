import {ttBudgetStatus} from './operational-readiness.mjs';
// Read-only presentation. Database claim and per-request RPC remain enforcement.
export function presentMultiAdmission(data){
 if(!data||!Array.isArray(data.states)||!Array.isArray(data.budget))throw Error('MULTI_STATE_UNVERIFIED');
 const due=data.states.find(s=>s.sport==='TT')?.next_due,budget=ttBudgetStatus(data.budget,data.checked_at,due);
 return {...data,ncaaf:'SEE_DEDICATED_PPG_STATUS',ncaaf_status_url:'/api/edge-lab/ncaaf?mode=summary',
  states:data.states.map(s=>s.sport!=='TT'?s:{...s,last_cycle_state:s.state,
   state:budget.status!=='UNKNOWN'&&!budget.full_cycle_budget_available&&s.last_run?.status!=='RUNNING'&&['SUCCESS','PARTIAL','WARMUP','COLLECTED','NOT_RUN'].includes(s.state)?'LOCAL_BUDGET_WAIT':s.state,
   budget_admission:budget.status,next_full_cycle_not_before:budget.next_full_cycle_not_before??null,
   provider_balance_verified:false}),
 };
}
