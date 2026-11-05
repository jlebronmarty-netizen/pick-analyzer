// Source envelope validation only. Model formulas, original forecasts and schedules are unchanged.
// PulseScore Tipsport results have top-level page/limit/total/totalPages/hasNextPage.
// NetBet league events may instead expose an unpaginated total/events envelope.
import {normalizeTtResults} from './multisport-core.mjs';
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj??{},key);
const integer=(value,min)=>Number.isSafeInteger(value)&&value>=min;
export function readTtPagination(body,count,{expectedPage=null,allowUnpaged=false}={}){
 if(!body||typeof body!=='object'||!integer(count,0))throw Error('INVALID_PAGINATION_INPUT');
 const candidates=[['TOP_LEVEL',body],['NESTED',body.pagination]].filter(([,p])=>p&&typeof p==='object'&&own(p,'hasNextPage'));
 if(candidates.length===2){for(const key of ['hasNextPage','page','limit','total','totalPages'])if(own(candidates[0][1],key)&&own(candidates[1][1],key)&&candidates[0][1][key]!==candidates[1][1][key])throw Error('CONFLICTED_PAGINATION');}
 if(candidates.length){
  const [layout,p]=candidates[0];if(typeof p.hasNextPage!=='boolean')throw Error('INVALID_HAS_NEXT_PAGE');
  for(const [key,min] of [['page',1],['limit',1],['total',0],['totalPages',0]])if(own(p,key)&&!integer(p[key],min))throw Error('INVALID_PAGINATION_'+key.toUpperCase());
  if(expectedPage!==null&&own(p,'page')&&p.page!==expectedPage)throw Error('WRONG_RESULT_PAGE');
  if(own(p,'limit')&&count>p.limit||own(p,'total')&&count>p.total)throw Error('PAGE_COUNT_CONFLICT');
  if(own(p,'page')&&own(p,'totalPages')&&((p.totalPages>0&&p.page>p.totalPages)||p.hasNextPage!==(p.page<p.totalPages)))throw Error('PAGE_END_CONFLICT');
  return {verified:true,layout,hasNextPage:p.hasNextPage,page:p.page??expectedPage,limit:p.limit??null,total:p.total??null,totalPages:p.totalPages??null,complete:!p.hasNextPage};
 }
 if(allowUnpaged&&integer(body.total,0)){
  if(body.total<count)throw Error('PAGE_COUNT_CONFLICT');
  return {verified:body.total===count,layout:'UNPAGED_TOTAL',hasNextPage:body.total===count?false:null,page:1,limit:null,total:body.total,totalPages:null,complete:body.total===count};
 }
 return {verified:false,layout:'UNKNOWN',hasNextPage:null,page:expectedPage,limit:null,total:null,totalPages:null,complete:false};
}
export function normalizeTtResultPage(body,receivedAt,expectedPage){
 const coverage=readTtPagination(body,body?.results?.length,{expectedPage});
 const parsed=normalizeTtResults(body,receivedAt);
 return {...parsed,hasNextPage:coverage.hasNextPage,paginationVerified:coverage.verified,coverage};
}
export function makeProviderPacer({clock=()=>Date.now(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),intervalMs=1200}={}){
 let finished=null;
 return async operation=>{if(finished!==null){const delay=Math.max(0,intervalMs-(clock()-finished));if(delay)await sleep(delay);}try{return await operation();}finally{finished=clock();}};
}
export function multiOperationalState(sport,lastRun,lock,mlbPaused){
 let state=lastRun?.status??'NOT_RUN';
 if(sport==='MLB'&&mlbPaused)state='OFFSEASON_PAUSED';
 else if(sport==='TT'&&lastRun&&['SUCCESS','PARTIAL'].includes(lastRun.status)){
  const counts=lastRun.summary?.status_counts??{};
  if((counts.FORECAST??0)+(counts.PROJECTION??0)===0&&(counts.ABSTAIN??0)>0)state='WARMUP';
 }
 return {sport,state,last_run:lastRun??null,next_due:lock?.next_due??null,coverage_status:lastRun?.status??'NOT_RUN',history_finals:lastRun?.summary?.history_finals??null,provider_calls_on_screen_refresh:0};
}
