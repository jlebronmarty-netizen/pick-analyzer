import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const contractPath=new URL('../../contracts/MLB_PERIOD_POISSON_V1.json',import.meta.url);
export const contract=JSON.parse(fs.readFileSync(contractPath,'utf8'));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function poisson(lambda){
  assert(Number.isFinite(lambda)&&lambda>0,'INVALID_LAMBDA');
  const p=[Math.exp(-lambda)];
  for(let i=1;i<=contract.poisson_max_runs;i++) p.push(p[i-1]*lambda/i);
  assert(1-p.reduce((a,b)=>a+b,0)<contract.max_omitted_probability,'POISSON_TAIL');
  return p;
}
function probabilities(home,away){
  const hp=poisson(home),ap=poisson(away); let h=0,a=0,d=0,hcum=0,acum=0;
  for(let i=0;i<hp.length;i++){h+=hp[i]*acum;a+=ap[i]*hcum;d+=hp[i]*ap[i];hcum+=hp[i];acum+=ap[i];}
  assert(Math.abs(h+a+d-1)<2*contract.max_omitted_probability,'PROBABILITY_MASS');
  return {HOME:h,AWAY:a,DRAW:d};
}
export function evaluate(input){
  assert(Array.isArray(input)&&input.length,'EMPTY_SOURCE');
  const rows=[...input].sort((a,b)=>a[2].localeCompare(b[2])||a[1]-b[1]);
  const seen=new Set(),states=new Map(),predictions=[]; let excluded=0;
  // season,gamePk,date,home runs,away runs,home team,away team,cutoff,lineage,research,class
  for(const r of rows){
    assert(r.length===11,'SOURCE_SCHEMA');assert([2025,2026].includes(r[0])&&r[2]<=contract.max_development_date&&r[2].startsWith(String(r[0])),'DATE_BOUNDARY');
    for(const i of [1,3,4]) assert(Number.isSafeInteger(r[i])&&r[i]>=(i===1?1:0),'IDENTITY_OR_TARGET');
    assert(typeof r[5]==='string'&&r[5]&&typeof r[6]==='string'&&r[6]&&r[5]!==r[6],'TEAM_IDENTITY');
    assert(typeof r[7]==='string'&&r[7]&&r[7]<r[2],'CUTOFF');
    assert(typeof r[8]==='string'&&/F[1357]/.test(r[8])&&r[9]===true&&r[10]===contract.development_class,'LINEAGE');
    const key=`${r[0]}:${r[1]}`;assert(!seen.has(key),'DUPLICATE_GAME');seen.add(key);
  }
  const state=season=>{if(!states.has(season))states.set(season,{games:0,runs:0,teams:new Map()});return states.get(season);};
  const team=(s,id)=>s.teams.get(id)??[0,0,0];
  const add=(s,id,scored,allowed)=>{const t=team(s,id);s.teams.set(id,[t[0]+1,t[1]+scored,t[2]+allowed]);};
  for(let i=0;i<rows.length;){
    let j=i+1;while(j<rows.length&&rows[j][2]===rows[i][2])j++;
    for(const r of rows.slice(i,j)){
      const s=state(r[0]),h=team(s,r[5]),a=team(s,r[6]);
      if(s.games<contract.min_league_games||Math.min(h[0],a[0])<contract.min_team_games){excluded++;continue;}
      const league=s.runs/(2*s.games),k=contract.prior_strength;
      const rate=(t,idx)=>(t[idx]+k*league)/(t[0]+k);
      const lh=rate(h,1)*rate(a,2)/league,la=rate(a,1)*rate(h,2)/league;
      const p=probabilities(lh,la),mlp=p.HOME/(p.HOME+p.AWAY);
      const mlSide=mlp>=contract.probability_threshold?'HOME':mlp<=1-contract.probability_threshold?'AWAY':null;
      const threeSide=Object.entries(p).sort((a,b)=>b[1]-a[1])[0];
      const truth=r[3]>r[4]?'HOME':r[3]<r[4]?'AWAY':'DRAW';
      predictions.push({game_pk:r[1],game_date:r[2],lambda_home:lh,lambda_away:la,probabilities:p,ml_home_conditional:mlp,ml_side:mlSide,threeway_side:threeSide[1]>=contract.probability_threshold?threeSide[0]:null,truth,prior_league_games:s.games});
    }
    for(const r of rows.slice(i,j)){const s=state(r[0]);add(s,r[5],r[3],r[4]);add(s,r[6],r[4],r[3]);s.games++;s.runs+=r[3]+r[4];}i=j;
  }
  const markets={};
  for(const [market,sideKey] of [['ML','ml_side'],['3WAY','threeway_side']]){
    const sel=predictions.filter(r=>r[sideKey]!==null),pushes=market==='ML'?sel.filter(r=>r.truth==='DRAW').length:0;
    const decided=sel.filter(r=>market!=='ML'||r.truth!=='DRAW'),wins=decided.filter(r=>r[sideKey]===r.truth).length;
    const monthly={};for(const r of decided){const m=r.game_date.slice(0,7);monthly[m]??={n:0,wins:0};monthly[m].n++;monthly[m].wins+=Number(r[sideKey]===r.truth);}
    for(const m of Object.values(monthly))m.accuracy=m.wins/m.n;
    const accuracy=decided.length?wins/decided.length:null,worst=decided.length?Math.min(...Object.values(monthly).map(m=>m.accuracy)):null,g=contract.gates;
    const pass=accuracy!==null&&accuracy>=g.accuracy&&decided.length>=g.min_n&&Object.keys(monthly).length>=g.min_months&&worst>=g.worst_month_accuracy;
    markets[market]={selected:sel.length,wins,losses:decided.length-wins,pushes,nonpush:decided.length,accuracy,coverage:predictions.length?sel.length/predictions.length:null,monthly,worst_month_accuracy:worst,development_gate_pass:pass,state:pass?'DEVELOPMENT_GATE_PASS_EXTERNAL_NOT_OPENED':'DEVELOPMENT_GATE_FAILED_NO_EXTERNAL'};
  }
  return {source_rows:rows.length,input_sha256:hash(JSON.stringify(rows)),eligible:predictions.length,excluded_insufficient_prior:excluded,min_date:rows[0][2],max_date:rows.at(-1)[2],markets,predictions};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  assert(process.argv[2]&&process.argv[3],'Usage: input.json output.json');
  const source=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const periods=Object.fromEntries(contract.periods.map(p=>[p,evaluate(source[p])]));
  const result={contract:contract.contract,contract_sha256:hash(fs.readFileSync(contractPath)),architecture:contract.architecture,probability_threshold:contract.probability_threshold,periods,research_only:true,external_opened:false,provider_calls_made:0,odds_api_historical_credits_consumed:0,official_picks_writes:0,apostar_activation:false,production_promotion:false,tracker_modified:false};
  fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(Object.fromEntries(Object.entries(periods).map(([k,{predictions,...v}])=>[k,v])),null,2));
}
