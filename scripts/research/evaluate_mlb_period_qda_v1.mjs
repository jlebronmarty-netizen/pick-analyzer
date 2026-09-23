import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const contractPath=new URL('../../contracts/MLB_PERIOD_QDA_V1.json',import.meta.url);
export const contract=JSON.parse(fs.readFileSync(contractPath,'utf8'));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const classes=['HOME','AWAY','DRAW'];
const blank=()=>({n:0,sum:[0,0,0,0],cross:Array.from({length:4},()=>[0,0,0,0])});
function add(s,x){s.n++;for(let i=0;i<4;i++){s.sum[i]+=x[i];for(let j=0;j<4;j++)s.cross[i][j]+=x[i]*x[j];}}
function moments(s){const mean=s.sum.map(v=>v/s.n);return {mean,cov:s.cross.map((r,i)=>r.map((v,j)=>(v-s.n*mean[i]*mean[j])/(s.n-1)))};}
export function cholesky(cov){const l=Array.from({length:4},()=>[0,0,0,0]);for(let i=0;i<4;i++)for(let j=0;j<=i;j++){let v=cov[i][j];for(let k=0;k<j;k++)v-=l[i][k]*l[j][k];if(i===j){assert(v>0&&Number.isFinite(v),'COVARIANCE');l[i][j]=Math.sqrt(v);}else l[i][j]=v/l[j][j];}return l;}
function params(s){
  if(s.all.n<contract.min_training_analogs||classes.some(k=>s.cls[k].n<contract.min_class_examples))return null;
  const global=moments(s.all),k=contract.covariance_prior_strength;
  return Object.fromEntries(classes.map(c=>{const st=s.cls[c],m=moments(st),cov=m.cov.map((r,i)=>r.map((v,j)=>((st.n-1)*v+k*global.cov[i][j])/(st.n-1+k)+(i===j?contract.covariance_ridge:0)));return [c,{mean:m.mean,l:cholesky(cov),prior:(st.n+contract.class_probability_prior)/(s.all.n+3*contract.class_probability_prior)}];}));
}
export function classify(x,ps){
  const scores=classes.map(c=>{const p=ps[c],z=[];let q=0,det=0;for(let i=0;i<4;i++){let v=x[i]-p.mean[i];for(let j=0;j<i;j++)v-=p.l[i][j]*z[j];z.push(v/p.l[i][i]);q+=z[i]**2;det+=Math.log(p.l[i][i]);}return Math.log(p.prior)-det-q/2;});
  const max=Math.max(...scores),exp=scores.map(v=>Math.exp(v-max)),sum=exp.reduce((a,b)=>a+b,0);
  return Object.fromEntries(classes.map((c,i)=>[c,exp[i]/sum]));
}
export function evaluate(source,period){
  assert(contract.periods.includes(period)&&Array.isArray(source)&&source.length,'SOURCE');
  const rows=[...source].sort((a,b)=>a[2].localeCompare(b[2])||a[1]-b[1]),seen=new Set();
  for(const r of rows){assert(r.length===11,'SCHEMA');assert([2025,2026].includes(r[0])&&r[2].startsWith(String(r[0]))&&r[2]<=contract.max_development_date,'DATE');for(const i of [1,3,4])assert(Number.isSafeInteger(r[i])&&r[i]>=(i===1?1:0),'IDENTITY');assert(typeof r[5]==='string'&&r[5]&&typeof r[6]==='string'&&r[6]&&r[5]!==r[6],'TEAM');assert(typeof r[7]==='string'&&r[7]&&r[7]<r[2],'CUTOFF');assert(new RegExp('F'+period+'(?:_|$)').test(r[8])&&r[9]===true&&r[10]===contract.development_class,'LINEAGE');const id=r[0]+':'+r[1];assert(!seen.has(id),'DUPLICATE');seen.add(id);}
  const states=new Map(),predictions=[];let excludedHistory=0,excludedTraining=0;
  const state=y=>{if(!states.has(y))states.set(y,{games:0,runs:0,teams:new Map(),all:blank(),cls:Object.fromEntries(classes.map(k=>[k,blank()]))});return states.get(y);};
  const team=(s,t)=>s.teams.get(t)??[0,0,0];
  for(let i=0;i<rows.length;){let j=i+1;while(j<rows.length&&rows[j][2]===rows[i][2])j++;const s=state(rows[i][0]),ps=params(s),pending=[];
    for(const r of rows.slice(i,j)){
      const h=team(s,r[5]),a=team(s,r[6]);if(s.games<contract.min_league_games||Math.min(h[0],a[0])<contract.min_team_games){excludedHistory++;continue;}
      const league=s.runs/(2*s.games),k=contract.rate_prior_strength,rate=(t,n)=>Math.log1p((t[n]+k*league)/(t[0]+k));
      const x=[rate(h,1),rate(h,2),rate(a,1),rate(a,2)],truth=r[3]>r[4]?'HOME':r[3]<r[4]?'AWAY':'DRAW';
      if(ps){const p=classify(x,ps);assert(Object.values(p).every(Number.isFinite),'PROBABILITY');const ml=p.HOME/(p.HOME+p.AWAY),best=Object.entries(p).sort((a,b)=>b[1]-a[1])[0],t=contract.probability_threshold;predictions.push({game_pk:r[1],game_date:r[2],features:x,prior_training_games:s.all.n,probabilities:p,ml_home_conditional:ml,ml_side:ml>=t?'HOME':ml<=1-t?'AWAY':null,threeway_side:best[1]>=t?best[0]:null,truth});}else excludedTraining++;
      pending.push({x,truth});
    }
    for(const {x,truth} of pending){add(s.all,x);add(s.cls[truth],x);}
    for(const r of rows.slice(i,j)){for(const [id,scored,allowed] of [[r[5],r[3],r[4]],[r[6],r[4],r[3]]]){const t=team(s,id);s.teams.set(id,[t[0]+1,t[1]+scored,t[2]+allowed]);}s.games++;s.runs+=r[3]+r[4];}i=j;
  }
  const markets={};
  for(const [market,key] of [['ML','ml_side'],['3WAY','threeway_side']]){const sel=predictions.filter(r=>r[key]!==null),dec=sel.filter(r=>market!=='ML'||r.truth!=='DRAW'),wins=dec.filter(r=>r[key]===r.truth).length,monthly={};for(const r of dec){const m=r.game_date.slice(0,7);monthly[m]??={n:0,wins:0};monthly[m].n++;monthly[m].wins+=Number(r[key]===r.truth);}for(const v of Object.values(monthly))v.accuracy=v.wins/v.n;const accuracy=dec.length?wins/dec.length:null,worst=dec.length?Math.min(...Object.values(monthly).map(v=>v.accuracy)):null,g=contract.gates;markets[market]={selected:sel.length,wins,losses:dec.length-wins,pushes:sel.length-dec.length,accuracy,coverage:predictions.length?sel.length/predictions.length:null,monthly,worst_month_accuracy:worst,development_gate_pass:accuracy!==null&&accuracy>=g.accuracy&&dec.length>=g.min_n&&Object.keys(monthly).length>=g.min_months&&worst>=g.worst_month_accuracy};}
  return {source_rows:rows.length,input_sha256:hash(JSON.stringify(rows)),eligible:predictions.length,excluded_history:excludedHistory,excluded_training:excludedTraining,markets,predictions};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){assert(process.argv[2]&&process.argv[3],'Usage source.json result.json');const src=JSON.parse(fs.readFileSync(process.argv[2]));const r={contract:contract.contract,contract_sha256:hash(fs.readFileSync(contractPath)),research_only:true,external_opened:false,probability_threshold:.75,provider_calls_made:0,odds_api_credits_consumed:0,periods:Object.fromEntries(contract.periods.map(p=>[p,evaluate(src[p],p)]))};fs.writeFileSync(process.argv[3],JSON.stringify(r));console.log(JSON.stringify(Object.fromEntries(Object.entries(r.periods).map(([k,{predictions,...v}])=>[k,v])),null,2));}
