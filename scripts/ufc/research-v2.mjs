import fs from 'node:fs';import {gzipSync,gunzipSync} from 'node:zlib';import crypto from 'node:crypto';
import {buildElo,updateEloDate,predictElo,fighterKey} from '../../src/lib/ufc/elo-v2.ts';
const root='research/ufc-identity-v2',input=JSON.parse(gunzipSync(fs.readFileSync('research/ufc-free-v1/inputs.json.gz'))),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const protocol=fs.readFileSync(root+'/PROTOCOL_AMENDMENT.md','utf8'),pair=b=>b.date+':'+[fighterKey(b.a),fighterKey(b.b)].sort().join(':');
const identities=JSON.parse(fs.readFileSync('src/lib/ufc/identity-v2.json')),original=new Map();for(const b of input.history){const key=pair(b);original.set(key,[...(original.get(key)??[]),b.id]);}
const rename=(name,bid)=>fighterKey(name)==='brunosilva'&&identities.legacyBoutDivision[bid]?`Bruno Silva [${identities.legacyBoutDivision[bid]}]`:name;
for(const q of input.quotes){const ids=original.get(pair(q));if(ids?.length===1)for(const field of ['a','b','fav','dog'])q[field]=rename(q[field],ids[0]);}
for(const b of input.history){b.a=rename(b.a,b.id);b.b=rename(b.b,b.id);}
const official=new Map(),excluded=[];for(const b of input.history){const key=pair(b);official.set(key,[...(official.get(key)??[]),b]);}
const unique=new Map();for(const q of input.quotes)unique.set(pair(q),[...(unique.get(pair(q))??[]),q]);
const quotes=[];for(const [key,group] of unique){const q=group[0],o=official.get(key);
 if(group.length!==1||o?.length!==1){excluded.push({key,reason:'NON_UNIQUE_IDENTITY'});continue;}
 const winner=b=>b.result==='A'?fighterKey(b.a):b.result==='B'?fighterKey(b.b):b.result;
 if(winner(q)!==winner(o[0])){excluded.push({key,reason:'OUTCOME_DISAGREEMENT'});continue;}
 quotes.push({...q,id:o[0].id});
}
const parameters=[16,32,64].flatMap(k=>[.03,.07].map(ev=>({id:`ELO_K${k}_EV${Math.round(ev*100)}`,k,ev})));
const variants=[...parameters,{id:'FAVORITE_BASELINE',k:32,baseline:'FAVORITE'},{id:'ELO_K32_ARGMAX',k:32,baseline:'ARGMAX'}];
const bets=[],trials=[],byDate=new Map();for(const b of input.history)byDate.set(b.date,[...(byDate.get(b.date)??[]),b]);
const qm=new Map(quotes.map(q=>[q.id,q])),ratings=new Map([16,32,64].map(k=>[k,new Map()]));
for(const date of [...byDate.keys()].sort()){
 for(const b of byDate.get(date)){
  const q=qm.get(b.id);if(!q||date<'2017-01-01')continue;
  const a=fighterKey(b.a),c=fighterKey(b.b),fav=fighterKey(q.fav),dog=fighterKey(q.dog);
  const prices=q.favOdds>1&&q.dogOdds>1&&new Set([fav,dog]).size===2&&[fav,dog].includes(a)&&[fav,dog].includes(c)?{[fav]:q.favOdds,[dog]:q.dogOdds}:null;
  for(const v of variants){
   const model=predictElo(ratings.get(v.k),b.a,b.b);let side=null,p=null,odds=null,reason='NO_PAIRED_PRICE';
   if(prices){
    if(v.baseline==='FAVORITE'){side=fav;odds=prices[side];reason='SELECTED';}
    else if(!model)reason='INSUFFICIENT_HISTORY';
    else if(v.baseline==='ARGMAX'){if(model.probabilityA!==.5){side=model.probabilityA>.5?a:c;p=side===a?model.probabilityA:model.probabilityB;odds=prices[side];reason='SELECTED';}else reason='TIED_PROBABILITY';}
    else{const choices=[{side:a,p:model.probabilityA,odds:prices[a]},{side:c,p:model.probabilityB,odds:prices[c]}].filter(s=>s.odds>=1.2&&s.odds<=6&&s.p*s.odds-1>=v.ev).sort((a,b)=>(b.p*b.odds-a.p*a.odds)||a.side.localeCompare(b.side));const best=choices[0];if(best){({side,p,odds}=best);reason='SELECTED';}else reason='NO_EDGE';}
   }
   const phase=date<'2021-01-01'?'DEVELOPMENT':'CONFIRMATION';
   trials.push({formula:v.id,bout:b.id,date,phase,reason,probabilityA:model?.probabilityA??null});
   if(side){const outcome=b.result==='A'?a:b.result==='B'?c:null;const result=outcome===null?b.result:side===outcome?'WIN':'LOSS';bets.push({formula:v.id,bout:b.id,date,phase,a:b.a,b:b.b,side,probability:p,decimal:odds,result,stake:outcome===null?0:1,profit:outcome===null?null:side===outcome?odds-1:-1});}
  }
 }
 for(const k of [16,32,64])updateEloDate(ratings.get(k),byDate.get(date),k);
}
let state=20261108;const rng=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
function metrics(rows,interval=true){const paid=rows.filter(b=>b.profit!==null),wins=paid.filter(b=>b.result==='WIN').length,profit=paid.reduce((s,b)=>s+b.profit,0),by=new Map();for(const b of paid){const g=by.get(b.date)??{profit:0,n:0};g.profit+=b.profit;g.n++;by.set(b.date,g);}const groups=[...by.values()],boot=[];if(interval&&groups.length){for(let t=0;t<2000;t++){let p=0,n=0;for(let j=0;j<groups.length;j++){const g=groups[Math.floor(rng()*groups.length)];p+=g.profit;n+=g.n;}boot.push(100*p/n);}boot.sort((a,b)=>a-b);}return {selected:rows.length,settled:paid.length,excludedDrawNC:rows.length-paid.length,wins,losses:paid.length-wins,accuracy:paid.length?wins/paid.length:null,profitUnits:paid.length?profit:null,roiPct:paid.length?100*profit/paid.length:null,interval95:boot.length?[boot[49],boot[1949]]:null};}
// Freeze selection from development BEFORE calculating confirmation metrics.
const development=variants.map(v=>({id:v.id,...metrics(bets.filter(b=>b.formula===v.id&&b.phase==='DEVELOPMENT'),false)}));
const chosen=development.filter(v=>parameters.some(p=>p.id===v.id)&&v.settled>=150&&v.roiPct>0).sort((a,b)=>b.roiPct-a.roiPct||a.id.localeCompare(b.id))[0]?.id??null;
const selection={chosen,development,rule:'development ROI >0, >=150; no confirmatory reselection',protocolSha256:hash(protocol)};
fs.writeFileSync(root+'/results/selection.json',JSON.stringify(selection,null,2)+'\n');
const experiments=variants.map(v=>({parameters:v,development:development.find(d=>d.id===v.id),confirmation:metrics(bets.filter(b=>b.formula===v.id&&b.phase==='CONFIRMATION')),byYear:[...new Set(bets.filter(b=>b.formula===v.id).map(b=>b.date.slice(0,4)))].sort().map(year=>({year,...metrics(bets.filter(b=>b.formula===v.id&&b.date.startsWith(year)),false)}))}));
const selected=experiments.find(e=>e.parameters.id===chosen),success=!!selected&&selected.confirmation.settled>=200&&selected.confirmation.roiPct>0&&selected.confirmation.interval95[0]>0;
const summary={identityRepair:true,independentConfirmation:false,identityPatchSha256:hash(fs.readFileSync('src/lib/ufc/identity-v2.json')),status:success?'CONDITIONAL_CANDIDATE_ONLY':'NO_DEMONSTRATED_ROI',protocolSha256:hash(protocol),inputSha256:hash(fs.readFileSync('research/ufc-free-v1/inputs.json.gz')),selectionSha256:hash(fs.readFileSync(root+'/results/selection.json')),facts:input.history.length,quotes:input.quotes.length,matched:quotes.length,excluded:excluded.length,trialCount:trials.length,betCount:bets.length,chosen,experiments,limits:['retrospective prices; book and pre-event availability unverified','draw/NC excluded; no certified sportsbook contracts','name-only historic identity bridge; all ambiguous bout pairs excluded','current captured career stats never used','forward model K32 independent of retrospective winner']};
for(const [file,data] of Object.entries({'summary.json':summary,'bets.json':bets,'trials.json':trials,'excluded.json':excluded})){const raw=JSON.stringify(data)+'\n';fs.writeFileSync(root+'/results/'+file+(file==='bets.json'||file==='trials.json'?'.gz':''),file==='bets.json'||file==='trials.json'?gzipSync(raw):raw);}
const seed={model:'UFC_ELO_K32_FREE_V2_IDENTITY',through:'2026-05-16',source:input.sources.history,ratings:[...buildElo(input.history)].sort(([a],[b])=>a.localeCompare(b))};
fs.writeFileSync('src/lib/ufc/seed-v2.json',JSON.stringify(seed)+'\n');
console.log(JSON.stringify({status:summary.status,chosen,matched:quotes.length,excluded:excluded.length,trialCount:trials.length,betCount:bets.length,results:experiments.map(e=>({id:e.parameters.id,...e.confirmation}))},null,2));
