import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
export const contract=JSON.parse(fs.readFileSync(new URL('../../contracts/MLB_NEW_FAMILIES_V1.json',import.meta.url)));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),classes=['HOME','AWAY','DRAW'];
const norm=a=>{const n=a.reduce((s,x)=>s+x,0);assert(n>0&&a.every(x=>Number.isFinite(x)&&x>=0),'MASS');return a.map(x=>x/n);};
const modal=p=>classes[p.indexOf(Math.max(...p))];
const side=p=>p[0]+p[1]===0?null:p[0]/(p[0]+p[1])>=.75?'HOME':p[1]/(p[0]+p[1])>=.75?'AWAY':null;
export function normalCdf(x){const t=1/(1+.2316419*Math.abs(x)),d=.3989422804014327*Math.exp(-x*x/2),q=d*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return x>=0?1-q:q;}
export function pava(points,minBin=30){
 const sorted=[...points].sort((a,b)=>a[0]-b[0]),groups=[];
 for(const [x,y] of sorted){let g=groups.at(-1);if(!g||g.x!==x){g={x,n:0,w:0};groups.push(g);}g.n++;g.w+=y;}
 const bins=[];let b=null;for(const g of groups){b??={min:g.x,max:g.x,n:0,w:0};b.max=g.x;b.n+=g.n;b.w+=g.w;if(b.n>=minBin){bins.push(b);b=null;}}
 if(b){if(bins.length){const q=bins.at(-1);q.max=b.max;q.n+=b.n;q.w+=b.w;}else bins.push(b);}
 const blocks=[];for(const q of bins){blocks.push({max:q.max,sum:q.w+1,weight:q.n+2});while(blocks.length>1){const a=blocks.at(-2),b=blocks.at(-1);if(a.sum/a.weight<=b.sum/b.weight)break;blocks.splice(-2,2,{max:b.max,sum:a.sum+b.sum,weight:a.weight+b.weight});}}
 return blocks.map(b=>({max:b.max,p:b.sum/b.weight}));
}
export function metrics(predictions,market){
 const key=market==='ML'?'ml_side':'threeway_side',bkey=market==='ML'?'baseline_ml':'baseline_threeway',sel=predictions.filter(r=>r[key]!==null),dec=sel.filter(r=>market!=='ML'||r.truth!=='DRAW'),pop=predictions.filter(r=>market!=='ML'||r.truth!=='DRAW');
 const wins=dec.filter(r=>r[key]===r.truth).length,baselineWins=dec.filter(r=>r[bkey]===r.truth).length,monthly={};
 for(const r of dec){const m=r.game_date.slice(0,7);monthly[m]??={n:0,wins:0,baseline_wins:0};monthly[m].n++;monthly[m].wins+=Number(r[key]===r.truth);monthly[m].baseline_wins+=Number(r[bkey]===r.truth);}
 for(const m of Object.values(monthly)){m.accuracy=m.wins/m.n;m.baseline_accuracy=m.baseline_wins/m.n;}
 const accuracy=dec.length?wins/dec.length:null,baseline=dec.length?baselineWins/dec.length:null,worst=dec.length?Math.min(...Object.values(monthly).map(m=>m.accuracy)):null,g=contract.gates;
 return {selected:sel.length,n:dec.length,wins,losses:dec.length-wins,pushes:sel.length-dec.length,accuracy,coverage:predictions.length?sel.length/predictions.length:null,monthly,selected_months:Object.keys(monthly).length,worst_month_accuracy:worst,baseline_selected_accuracy:baseline,baseline_eligible_accuracy:pop.length?pop.filter(r=>r[bkey]===r.truth).length/pop.length:null,lift_percentage_points:accuracy===null?null:100*(accuracy-baseline),development_gate_pass:accuracy!==null&&accuracy>=g.accuracy&&dec.length>=g.min_n&&Object.keys(monthly).length>=g.min_months&&worst>=g.worst_month};
}
function fresh(){return {n:0,runs:0,counts:[0,0,0],marginSum:0,marginSq:0,teams:new Map(),means:[],cov:[],lastDate:null,clusters:[],training:[]};}
function team(s,id,period){if(!s.teams.has(id)){const idx=s.means.length;s.means.push(0);s.cov.forEach(r=>r.push(0));s.cov.push(Array.from({length:idx+1},(_,j)=>j===idx?2*period:0));s.teams.set(id,{idx,n:0,overall:[0,0,0],home:[0,0,0],away:[0,0,0],recent:[]});}return s.teams.get(id);}
function context(s,h,a){const league=s.runs/(2*s.n),rate=(t,i)=>Math.log((t.recent.reduce((n,r)=>n+r[i],0)+10*league)/(t.recent.length+10)/league);if(league<=0)return null;return[rate(h,0),rate(h,1),rate(a,0),rate(a,1)];}
function nearest(clusters,x){let idx=0,d=Infinity;clusters.forEach((c,i)=>{const dd=c.center.reduce((n,v,j)=>n+(v-x[j])**2,0);if(dd<d){d=dd;idx=i;}});return idx;}
export function evaluate(input,period,architecture){
 assert(contract.periods.includes(period)&&contract.architectures[architecture],'CONTRACT');const rows=[...input].sort((a,b)=>a[2].localeCompare(b[2])||a[1]-b[1]),seen=new Set();assert(rows.length,'EMPTY');
 for(const r of rows){assert(r.length===11&&[2025,2026].includes(r[0])&&r[2].startsWith(String(r[0]))&&r[2]<=contract.history.max_date,'SCHEMA_DATE');for(const i of [1,3,4])assert(Number.isSafeInteger(r[i])&&r[i]>=(i===1?1:0),'IDENTITY');assert(r[5]&&r[6]&&r[5]!==r[6],'TEAM');assert(r[7]&&r[7]<r[2],'CUTOFF');assert(new RegExp('F'+period+'(?:_|$)').test(r[8])&&r[9]===true&&r[10]===contract.history.classification,'LINEAGE');const k=r[0]+':'+r[1];assert(!seen.has(k),'DUPLICATE');seen.add(k);}
 const states=new Map(),predictions=[];let excludedHistory=0,excludedFit=0;
 for(let i=0;i<rows.length;){let j=i+1;while(j<rows.length&&rows[j][2]===rows[i][2])j++;const date=rows[i][2],year=rows[i][0];if(!states.has(year))states.set(year,fresh());const s=states.get(year);for(const r of rows.slice(i,j)){team(s,r[5],period);team(s,r[6],period);}
  if(s.lastDate){const elapsed=(Date.parse(date)-Date.parse(s.lastDate))/86400000;s.cov.forEach((r,k)=>r[k]+=.01*period*elapsed);}s.lastDate=date;
  const base=norm(s.counts.map(x=>x+1)),variance=Math.max(.25,(s.marginSq+20*2*period)/(s.n+20)-(s.marginSum/(s.n+20))**2),blocks=architecture==='isotonic'&&s.training.length>=300?pava(s.training):null,pending=[];
  for(const r of rows.slice(i,j)){
   const h=team(s,r[5],period),a=team(s,r[6],period),truth=classes[r[3]>r[4]?0:r[3]<r[4]?1:2];if(s.n<300||Math.min(h.n,a.n)<10){excludedHistory++;continue;}
   const x=context(s,h,a);let p=null,detail={};
   if(architecture==='hierarchical'){
    const pooled=[(s.counts[0]+s.counts[1]+1)/(2*s.n+3),(s.counts[0]+s.counts[1]+1)/(2*s.n+3),(2*s.counts[2]+1)/(2*s.n+3)];
    const posterior=(t,role)=>{const all=t.overall.map((v,k)=>(v+30*pooled[k])/(t.n+30)),v=t[role],n=v.reduce((a,b)=>a+b,0);return v.map((c,k)=>(c+30*all[k])/(n+30));};
    const hp=posterior(h,'home'),ap=posterior(a,'away');p=norm([hp[0]*ap[1]/base[0],hp[1]*ap[0]/base[1],hp[2]*ap[2]/base[2]]);detail={home_posterior:hp,away_posterior:ap};
   }else if(architecture==='kalman'){
    const mean=s.means[h.idx]-s.means[a.idx],v=variance+s.cov[h.idx][h.idx]+s.cov[a.idx][a.idx]-2*s.cov[h.idx][a.idx],sd=Math.sqrt(v),lo=normalCdf((-.5-mean)/sd),hi=normalCdf((.5-mean)/sd);p=norm([1-hi,lo,hi-lo]);detail={margin_mean:mean,predictive_variance:v};
   }else if(architecture==='archetype'&&x){
    if(s.clusters.length===8){const k=nearest(s.clusters,x),c=s.clusters[k];if(c.n>=30){p=c.counts.map((v,k)=>(v+20*base[k])/(c.n+20));detail={cluster:k,prior_cluster_n:c.n,context:x};}}pending.push({x,truth});
   }else if(architecture==='isotonic'&&x){const v=x[0]+x[3]-x[2]-x[1];if(blocks){const q=(blocks.find(b=>v<=b.max)??blocks.at(-1)).p;p=[(1-base[2])*q,(1-base[2])*(1-q),base[2]];detail={score:v,prior_training_n:s.training.length,blocks:blocks.length};}if(truth!=='DRAW')pending.push({x:v,truth});}
   if(!p){excludedFit++;continue;}assert(p.every(v=>Number.isFinite(v)&&v>=0)&&Math.abs(p.reduce((a,b)=>a+b,0)-1)<1e-8,'PROBABILITY');const best=modal(p);predictions.push({game_pk:r[1],game_date:r[2],probabilities:Object.fromEntries(classes.map((c,k)=>[c,p[k]])),ml_side:side(p),threeway_side:p[classes.indexOf(best)]>=.75?best:null,truth,baseline_probabilities:base,baseline_ml:base[0]>=base[1]?'HOME':'AWAY',baseline_threeway:modal(base),prior_league_games:s.n,...detail});
  }
  for(const item of pending){if(architecture==='isotonic')s.training.push([item.x,Number(item.truth==='HOME')]);else{let c;if(s.clusters.length<8){c={center:[...item.x],n:0,counts:[0,0,0]};s.clusters.push(c);}else c=s.clusters[nearest(s.clusters,item.x)];c.center=c.center.map((v,k)=>(v*c.n+item.x[k])/(c.n+1));c.n++;c.counts[classes.indexOf(item.truth)]++;}}
  for(const r of rows.slice(i,j)){
   const h=team(s,r[5],period),a=team(s,r[6],period),m=r[3]-r[4],out=m>0?0:m<0?1:2;
   if(architecture==='kalman'){const v=s.cov.map(row=>row[h.idx]-row[a.idx]),den=variance+v[h.idx]-v[a.idx],error=m-(s.means[h.idx]-s.means[a.idx]);assert(den>0,'KALMAN_VARIANCE');s.means=s.means.map((mu,k)=>mu+v[k]*error/den);s.cov=s.cov.map((row,k)=>row.map((p,l)=>p-v[k]*v[l]/den));}
   s.n++;s.runs+=r[3]+r[4];s.counts[out]++;s.marginSum+=m;s.marginSq+=m*m;
   for(const [t,role,scored,allowed,idx]of [[h,'home',r[3],r[4],out],[a,'away',r[4],r[3],out===2?2:1-out]]){t.n++;t.overall[idx]++;t[role][idx]++;t.recent.push([scored,allowed]);if(t.recent.length>30)t.recent.shift();}
  }i=j;
 }
 return {source_rows:rows.length,input_sha256:hash(JSON.stringify(rows)),eligible:predictions.length,excluded_history:excludedHistory,excluded_fit:excludedFit,markets:{ML:metrics(predictions,'ML'),'3WAY':metrics(predictions,'3WAY')},predictions};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [architecture,inputFile]=process.argv.slice(2);assert(contract.architectures[architecture]&&inputFile,'ARGS');const source=JSON.parse(fs.readFileSync(inputFile)),prior=JSON.parse(fs.readFileSync('artifacts/research/mlb_period_poisson_v1_result.json')),periods={};for(const p of contract.periods){periods[p]=evaluate(source[p],p,architecture);assert.equal(periods[p].input_sha256,prior.periods[p].input_sha256,'SOURCE_HASH');}const full={architecture,contract_sha256:hash(JSON.stringify(contract)),research_only:true,external_opened:false,odds_api_credits:0,periods};const text=JSON.stringify(full),prefix=`artifacts/research/mlb_new_families_v1_${architecture}`;fs.writeFileSync(prefix+'.json.gz',zlib.gzipSync(text));for(const p of Object.values(full.periods))delete p.predictions;full.full_result_sha256=hash(text);fs.writeFileSync(prefix+'.json',JSON.stringify(full,null,2)+'\n');console.log(JSON.stringify(full,null,2));}
