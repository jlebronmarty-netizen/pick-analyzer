import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {metrics} from './evaluate_mlb_new_families_v1.mjs';
export const contract=JSON.parse(fs.readFileSync(new URL('../../contracts/MLB_NRFI_BOOSTING_V1.json',import.meta.url)));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const sigmoid=z=>1/(1+Math.exp(-z));
export function contexts(input){
 const rows=[...input].sort((a,b)=>a[2].localeCompare(b[2])||a[1]-b[1]),ids=new Set();
 for(const r of rows){assert(r.length===11&&[2025,2026].includes(r[0])&&r[2].startsWith(String(r[0]))&&r[2]<='2026-09-18','DATE');assert(r[7]<r[2]&&r[9]===true&&r[10]==='HISTORICAL_SEEN_DEVELOPMENT'&&/F1(?:_|$)/.test(r[8]),'LINEAGE');assert(Number.isSafeInteger(r[1])&&r[1]>0&&!ids.has(r[1]),'IDENTITY');ids.add(r[1]);assert(r[5]&&r[6]&&r[5]!==r[6]&&[r[3],r[4]].every(x=>Number.isSafeInteger(x)&&x>=0),'OUTCOME');}
 let season=null,n=0,zero=0,nrfi=0,runs=0,teams=new Map();const out=[];
 for(let i=0;i<rows.length;){let j=i+1;while(j<rows.length&&rows[j][2]===rows[i][2])j++;
  if(season!==rows[i][0]){season=rows[i][0];n=zero=nrfi=runs=0;teams=new Map();}
  for(const r of rows.slice(i,j)){const h=teams.get(r[5])??[],a=teams.get(r[6])??[];if(n<300||Math.min(h.length,a.length)<20)continue;
   const feature=t=>{const d=t.length+10;return[(t.filter(v=>v[0]===0).length+10*zero/(2*n))/d,(t.filter(v=>v[1]===0).length+10*zero/(2*n))/d,(t.filter(v=>v[0]+v[1]===0).length+10*nrfi/n)/d,Math.log1p((t.reduce((s,v)=>s+v[0],0)+10*runs/(2*n))/d),Math.log1p((t.reduce((s,v)=>s+v[1],0)+10*runs/(2*n))/d)];};
   out.push({game_pk:r[1],game_date:r[2],features:[...feature(h),...feature(a)],y:Number(r[3]+r[4]===0),prior_league_nrfi:nrfi/n,baseline_ml:nrfi/n>=.5?'HOME':'AWAY'});
  }
  for(const r of rows.slice(i,j)){n++;zero+=Number(r[3]===0)+Number(r[4]===0);nrfi+=Number(r[3]+r[4]===0);runs+=r[3]+r[4];for(const[id,s,a]of [[r[5],r[3],r[4]],[r[6],r[4],r[3]]]){const t=teams.get(id)??[];t.push([s,a]);if(t.length>30)t.shift();teams.set(id,t);}}
  i=j;
 }return out;
}
export function fit(rows){
 assert(rows.length>=600,'TRAINING');const n=rows.length,p=(rows.reduce((s,r)=>s+r.y,0)+1)/(n+2),intercept=Math.log(p/(1-p)),scores=Array(n).fill(intercept),cuts=[];
 for(let f=0;f<10;f++){const v=rows.map(r=>r.features[f]).sort((a,b)=>a-b);for(const fraction of [.2,.4,.6,.8]){const threshold=v[Math.floor((n-1)*fraction)],left=rows.map(r=>r.features[f]<=threshold);const count=left.reduce((s,v)=>s+Number(v),0);if(count>=60&&n-count>=60)cuts.push({f,threshold,left});}}
 const stumps=[];
 for(let round=0;round<60;round++){const prob=scores.map(sigmoid),g=prob.map((v,i)=>rows[i].y-v),h=prob.map(v=>v*(1-v)),G=g.reduce((a,b)=>a+b,0),H=h.reduce((a,b)=>a+b,0);let best=null;
  for(const cut of cuts){let gl=0,hl=0;for(let i=0;i<n;i++)if(cut.left[i]){gl+=g[i];hl+=h[i];}const gr=G-gl,hr=H-hl,gain=gl*gl/(hl+10)+gr*gr/(hr+10)-G*G/(H+10);if(gain>0&&(!best||gain>best.gain))best={...cut,gain,l:gl/(hl+10),r:gr/(hr+10)};}
  if(!best)break;for(let i=0;i<n;i++)scores[i]+=.05*(best.left[i]?best.l:best.r);stumps.push({feature:best.f,threshold:best.threshold,left:best.l,right:best.r});
 }return {intercept,stumps};
}
export function probability(model,x){return sigmoid(model.intercept+.05*model.stumps.reduce((s,t)=>s+(x[t.feature]<=t.threshold?t.left:t.right),0));}
export function evaluate(input){const rows=contexts(input),predictions=[],fits=[];let year=null,month=null,history=[],model=null;
 for(let i=0;i<rows.length;){let j=i+1;while(j<rows.length&&rows[j].game_date===rows[i].game_date)j++;const y=rows[i].game_date.slice(0,4),m=rows[i].game_date.slice(0,7);if(y!==year){year=y;month=null;history=[];model=null;}if(m!==month){month=m;model=history.length>=600?fit(history):null;if(model)fits.push({fit_date:rows[i].game_date,max_training_date:history.at(-1).game_date,n:history.length,model});}
  if(model)for(const r of rows.slice(i,j)){const p=probability(model,r.features);predictions.push({...r,p_nrfi:p,truth:r.y?'HOME':'AWAY',ml_side:p>=.75?'HOME':null});}history.push(...rows.slice(i,j));i=j;
 }return {source_rows:input.length,feature_contexts:rows.length,eligible:predictions.length,market:metrics(predictions,'ML'),eligible_nrfi_prevalence:predictions.length?predictions.reduce((s,r)=>s+r.y,0)/predictions.length:null,fits,predictions};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const source=JSON.parse(zlib.gunzipSync(fs.readFileSync('artifacts/research/mlb_new_families_v1_source.json.gz')))[1],prior=JSON.parse(fs.readFileSync('artifacts/research/mlb_period_poisson_v1_result.json')),input_sha256=hash(JSON.stringify([...source].sort((a,b)=>a[2].localeCompare(b[2])||a[1]-b[1])));assert.equal(input_sha256,prior.periods[1].input_sha256,'SOURCE_HASH');const full={architecture:contract.architecture,contract_sha256:hash(JSON.stringify(contract)),input_sha256,research_only:true,external_opened:false,odds_api_credits:0,...evaluate(source)},text=JSON.stringify(full);fs.writeFileSync('artifacts/research/mlb_nrfi_boosting_v1.json.gz',zlib.gzipSync(text));delete full.fits;delete full.predictions;full.full_result_sha256=hash(text);fs.writeFileSync('artifacts/research/mlb_nrfi_boosting_v1.json',JSON.stringify(full,null,2)+'\n');console.log(JSON.stringify(full,null,2));}
