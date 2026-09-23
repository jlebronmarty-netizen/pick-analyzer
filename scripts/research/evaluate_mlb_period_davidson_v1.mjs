import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
export const contractPath=new URL('../../contracts/MLB_PERIOD_DAVIDSON_V1.json',import.meta.url);
export const contract=JSON.parse(fs.readFileSync(contractPath,'utf8'));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');

export function evaluate(source,period){
  assert(contract.periods.includes(period),'PERIOD');
  assert(Array.isArray(source)&&source.length,'EMPTY_SOURCE');
  const rows=[...source].sort((a,b)=>a[2].localeCompare(b[2])||a[1]-b[1]),seen=new Set();
  for(const r of rows){
    assert(r.length===11,'SOURCE_SCHEMA');
    assert([2025,2026].includes(r[0])&&/^\d{4}-\d{2}-\d{2}$/.test(r[2])&&r[2].startsWith(String(r[0]))&&r[2]<=contract.max_development_date,'DATE_BOUNDARY');
    for(const i of [1,3,4])assert(Number.isSafeInteger(r[i])&&r[i]>=(i===1?1:0),'IDENTITY_OR_TARGET');
    assert(typeof r[5]==='string'&&r[5]&&typeof r[6]==='string'&&r[6]&&r[5]!==r[6],'TEAM_IDENTITY');
    assert(typeof r[7]==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r[7])&&r[7]<r[2],'CUTOFF');
    assert(typeof r[8]==='string'&&new RegExp('F'+period+'(?:_|$)').test(r[8])&&r[9]===true&&r[10]===contract.development_class,'LINEAGE');
    const key=r[0]+':'+r[1];assert(!seen.has(key),'DUPLICATE_GAME');seen.add(key);
  }
  const states=new Map(),predictions=[];let excluded=0;
  const state=season=>{if(!states.has(season))states.set(season,{games:0,draws:0,teams:new Map()});return states.get(season);};
  const team=(s,id)=>s.teams.get(id)??{rating:contract.rating_initial,games:0};
  for(let i=0;i<rows.length;){
    let j=i+1;while(j<rows.length&&rows[j][2]===rows[i][2])j++;
    const deltas=new Map(),s=state(rows[i][0]);let draws=0;
    for(const r of rows.slice(i,j)){
      const h=team(s,r[5]),a=team(s,r[6]),alpha=10**((h.rating-a.rating+contract.home_advantage)/contract.rating_scale);
      const d=(s.draws+contract.draw_prior_wins)/(s.games+contract.draw_prior_wins+contract.draw_prior_losses);
      const tie=2*d/(1-d)*Math.sqrt(alpha),den=alpha+1+tie;
      const probabilities={HOME:alpha/den,AWAY:1/den,DRAW:tie/den};
      assert(Object.values(probabilities).every(p=>Number.isFinite(p)&&p>=0&&p<=1),'PROBABILITIES');
      assert(Math.abs(Object.values(probabilities).reduce((a,b)=>a+b,0)-1)<1e-12,'PROBABILITY_MASS');
      const conditional=probabilities.HOME/(probabilities.HOME+probabilities.AWAY);
      const best=Object.entries(probabilities).sort((a,b)=>b[1]-a[1])[0];
      const truth=r[3]>r[4]?'HOME':r[3]<r[4]?'AWAY':'DRAW';
      if(s.games>=contract.min_league_games&&Math.min(h.games,a.games)>=contract.min_team_games){
        predictions.push({game_pk:r[1],game_date:r[2],rating_home:h.rating,rating_away:a.rating,prior_league_games:s.games,prior_draw_rate:d,probabilities,ml_home_conditional:conditional,ml_side:conditional>=.75?'HOME':conditional<=.25?'AWAY':null,threeway_side:best[1]>=.75?best[0]:null,truth});
      }else excluded++;
      // Outcomes affect only pending deltas; no same-day result is available to another prediction.
      const score=truth==='HOME'?1:truth==='DRAW'?.5:0;
      const delta=contract.rating_k*(score-probabilities.HOME-.5*probabilities.DRAW);
      for(const [id,value] of [[r[5],delta],[r[6],-delta]]){const prev=deltas.get(id)??{delta:0,games:0};deltas.set(id,{delta:prev.delta+value,games:prev.games+1});}
      draws+=Number(truth==='DRAW');
    }
    for(const [id,v] of deltas){const t=team(s,id);s.teams.set(id,{rating:t.rating+v.delta,games:t.games+v.games});}
    s.games+=j-i;s.draws+=draws;i=j;
  }
  const markets={};
  for(const [market,key] of [['ML','ml_side'],['3WAY','threeway_side']]){
    const selected=predictions.filter(p=>p[key]!==null),decided=selected.filter(p=>market!=='ML'||p.truth!=='DRAW');
    const wins=decided.filter(p=>p[key]===p.truth).length,monthly={};
    for(const r of decided){const month=r.game_date.slice(0,7);monthly[month]??={n:0,wins:0};monthly[month].n++;monthly[month].wins+=Number(r[key]===r.truth);}
    for(const m of Object.values(monthly))m.accuracy=m.wins/m.n;
    const accuracy=decided.length?wins/decided.length:null,worst=decided.length?Math.min(...Object.values(monthly).map(m=>m.accuracy)):null,g=contract.gates;
    const pass=accuracy!==null&&accuracy>=g.accuracy&&decided.length>=g.min_n&&Object.keys(monthly).length>=g.min_months&&worst>=g.worst_month_accuracy;
    markets[market]={selected:selected.length,wins,losses:decided.length-wins,pushes:selected.length-decided.length,accuracy,coverage:predictions.length?selected.length/predictions.length:null,monthly,worst_month_accuracy:worst,development_gate_pass:pass,state:pass?'DEVELOPMENT_GATE_PASS_EXTERNAL_CLOSED':'DEVELOPMENT_GATE_FAILED_NO_EXTERNAL'};
  }
  return {source_rows:rows.length,input_sha256:hash(JSON.stringify(rows)),eligible:predictions.length,excluded_insufficient_prior:excluded,min_date:rows[0][2],max_date:rows.at(-1)[2],markets,predictions};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  assert(process.argv[2]&&process.argv[3],'Usage: source.json output.json');
  const source=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const result={contract:contract.contract,contract_sha256:hash(fs.readFileSync(contractPath)),architecture:contract.architecture,probability_threshold:contract.probability_threshold,periods:Object.fromEntries(contract.periods.map(p=>[p,evaluate(source[p],p)])),research_only:true,external_opened:false,provider_calls_made:0,odds_api_historical_credits_consumed:0,official_picks_writes:0,apostar_activation:false,production_promotion:false,tracker_modified:false};
  fs.writeFileSync(process.argv[3],JSON.stringify(result)+'\n');
  console.log(JSON.stringify(Object.fromEntries(Object.entries(result.periods).map(([k,{predictions,...v}])=>[k,v])),null,2));
}
