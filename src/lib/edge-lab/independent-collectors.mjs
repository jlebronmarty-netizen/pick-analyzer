// Isolate failures and avoid adding each independent worker's worst-case duration.
// Workers retain their own durable locks, budgets and append-only ledgers.
export async function runIndependentCollectors(request,{multi,ncaaf},now=()=>new Date()){
 if(typeof multi!=='function'||typeof ncaaf!=='function')throw Error('COLLECTOR_CONFIGURATION_INVALID');
 const started=now().toISOString();
 const tasks=await Promise.allSettled([
  Promise.resolve().then(()=>multi(request)),
  Promise.resolve().then(()=>ncaaf()),
 ]);
 const results=[],failures=[];
 for(let i=0;i<tasks.length;i++){
  const item=tasks[i],scope=i===0?'TT_MLB':'NCAAF';
  const valid=item.status==='fulfilled'&&(i===0?Array.isArray(item.value?.results):item.value?.sport==='NCAAF'&&typeof item.value?.status==='string');
  if(!valid){failures.push(scope);results.push({sport:scope,status:'FAILED',error:'COLLECTOR_EXECUTION_FAILED'});continue;}
  results.push(...(i===0?item.value.results:[item.value]));
 }
 const impaired=results.some(r=>['FAILED','BLOCKED','PARTIAL'].includes(r?.status));
 return {status:failures.length===2?'FAILED':failures.length||impaired?'PARTIAL':'COMPLETE',started_at:started,checked_at:now().toISOString(),results,unexpected_failures:failures,execution:'INDEPENDENT_WORKERS',all_sports_certified:false};
}
