// Paired diagnostic resampling, not a prediction/ROI simulation or validation.
const round=x=>Number(x.toFixed(6));
const fields=['brier','logLoss','marginMae'];
const iterations=2000;
function generator(seed){
 let state=seed>>>0;
 return ()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^t>>>15,t|1);
  t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}
function percentile(sorted,p){
 const at=(sorted.length-1)*p,lo=Math.floor(at),hi=Math.ceil(at);
 return sorted[lo]+(sorted[hi]-sorted[lo])*(at-lo);
}
function interval(groups,seed){
 if(groups.length<2)return {groups:groups.length,interval95:null,reason:'INSUFFICIENT_RESAMPLING_GROUPS'};
 const rng=generator(seed),samples=fields.map(()=>[]);
 for(let b=0;b<iterations;b++){
  let n=0;const totals=fields.map(()=>0);
  for(let j=0;j<groups.length;j++){
   const g=groups[Math.floor(rng()*groups.length)];n+=g.n;
   for(let k=0;k<fields.length;k++)totals[k]+=g.sums[k];
  }
  for(let k=0;k<fields.length;k++)samples[k].push(totals[k]/n);
 }
 return {groups:groups.length,interval95:Object.fromEntries(fields.map((name,k)=>{
  const values=samples[k].sort((a,b)=>a-b);
  return [name,[round(percentile(values,.025)),round(percentile(values,.975))]];
 }))};
}
export function ncaabPairedUncertainty(pairs){
 if(!pairs.length)return {status:'NO_PAIRED_RESULTS',uniqueGames:0,intervals:null};
 if(pairs.length>2000)return {status:'RESAMPLING_BUDGET_CAPPED',uniqueGames:pairs.length,intervals:null};
 const ordered=[...pairs].sort((a,b)=>a.eventId.localeCompare(b.eventId));
 const games=ordered.map(x=>({n:1,sums:fields.map(k=>x[k])})),days=new Map();
 for(const x of ordered){
  const g=days.get(x.date)??{n:0,sums:fields.map(()=>0)};g.n++;
  fields.forEach((k,i)=>g.sums[i]+=x[k]);days.set(x.date,g);
 }
 return {status:'DESCRIPTIVE_ONLY',method:'PAIRED_PERCENTILE_BOOTSTRAP',
  iterations,confidenceLevel:.95,uniqueGames:ordered.length,localDays:days.size,
  deltaConvention:'candidate_minus_original',
  deltas:Object.fromEntries(fields.map(k=>[k,round(ordered.reduce((s,x)=>s+x[k],0)/ordered.length)])),
  intervals:{byGame:interval(games,20261121),
   byPuertoRicoDay:interval([...days].sort(([a],[b])=>a.localeCompare(b)).map(([,g])=>g),20261122)},
  smallSample:ordered.length<100||days.size<8,
  validationEvidence:false,
  warning:'Descriptive paired uncertainty. Repeated teams, few dates and retrospective selection can invalidate nominal coverage. These intervals never authorize promotion.'};
}
