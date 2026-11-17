// NHL frozen Poisson context ablation V0. Research only; no production imports or I/O.
// Evaluates exactly the historical frozen projections. Caller supplies previously
// captured rows and verified outcomes; do not fabricate retrospective goalie/PP/PK.
export const NHL_CONTEXT_ABLATION_VERSION = 'NHL_CONTEXT_ABLATION_RESEARCH_V0';
const asMillis = x => { const t=Date.parse(String(x??'')); return Number.isFinite(t)?t:null; };
const finite = x => Number.isFinite(x) ? x : null;
export function poissonProxy(h, a, {maxGoals=18}={}) {
  if(![h,a].every(v=>Number.isFinite(v)&&v>0&&v<10)) return null;
  const hp=[Math.exp(-h)],ap=[Math.exp(-a)];
  for(let n=1;n<=maxGoals;n++){hp.push(hp[n-1]*h/n);ap.push(ap[n-1]*a/n);}
  let z=0,homeWin=0,tie=0,homeCover=0,over=0;
  for(let i=0;i<=maxGoals;i++) for(let j=0;j<=maxGoals;j++){
    const w=hp[i]*ap[j];z+=w;
    if(i>j)homeWin+=w; else if(i===j)tie+=w;
    if(i-j>=2)homeCover+=w;
    if(i+j>=6)over+=w;
  }
  return {moneyline:(homeWin+tie/2)/z,homeMinus1p5:homeCover/z,over5p5:over/z};
}
const sampleBrier=(p,y)=>(p-y)**2;
export function evaluateFrozenContext(rows,{restPenalty=0.05}={}) {
  if(!Array.isArray(rows)||!Number.isFinite(restPenalty)||restPenalty<0||restPenalty>0.2)
    throw Error('Invalid research inputs');
  const evaluated=[];
  let rejected=0;
  for(const row of rows){
    const start=asMillis(row.scheduled_at), frozen=asMillis(row.frozen_at);
    const resultAt=asMillis(row.outcome_observed_at);
    const homeGoals=finite(Number(row.home_lambda)),awayGoals=finite(Number(row.away_lambda));
    const hs=finite(Number(row.home_score)),as=finite(Number(row.away_score));
    const rh=row.home_rest_hours==null?null:finite(Number(row.home_rest_hours));
    const ra=row.away_rest_hours==null?null:finite(Number(row.away_rest_hours));
    const sourceAt=row.rest_context_asof ? asMillis(row.rest_context_asof) : null;
    if(!row.event_id?.startsWith('nhl:202602')||start==null||frozen==null||
       frozen>=start-10*60*1000||resultAt==null||resultAt<=start||
       homeGoals==null||awayGoals==null||!Number.isInteger(hs)||!Number.isInteger(as)||
       hs===as||rh==null||ra==null||rh<0||ra<0||
       (sourceAt!==null&&sourceAt>frozen)){rejected++;continue;}
    const base=poissonProxy(homeGoals,awayGoals);
    const shifted=poissonProxy(homeGoals*(rh<36?1-restPenalty:1),awayGoals*(ra<36?1-restPenalty:1));
    if(!base||!shifted){rejected++;continue;}
    const labels={moneyline:Number(hs>as),homeMinus1p5:Number(hs-as>=2),over5p5:Number(hs+as>=6)};
    evaluated.push({eventId:row.event_id,base,shifted,labels,
      goalsMaEBase:Math.abs(homeGoals+awayGoals-hs-as),
      goalsMaEShifted:Math.abs(homeGoals*(rh<36?1-restPenalty:1)+awayGoals*(ra<36?1-restPenalty:1)-hs-as)});
  }
  const metric=(which,key)=>evaluated.length?
    Number((evaluated.reduce((s,r)=>s+sampleBrier(r[which][key],r.labels[key]),0)/evaluated.length).toFixed(5)):null;
  const keys=['moneyline','homeMinus1p5','over5p5'];
  return {version:NHL_CONTEXT_ABLATION_VERSION,status:'RESEARCH_ONLY_UNVALIDATED',
    eligible:evaluated.length,rejected,restPenalty,
    brier:Object.fromEntries(keys.map(k=>[k,{baseline:metric('base',k),candidate:metric('shifted',k)}])),
    minimumIndependentHoldout:30,holdoutPassed:false,marketContractVerified:false,
    upcomingStarterInferred:false,officialPick:false,productionEligible:false,
    caveat:'Frozen Poisson score proxies: ML tie share=50%; no verified sportsbook contract. Small retrospective cohort, not independent validation.'};
}
