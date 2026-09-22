import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const contractPath=new URL('../../contracts/MLB_NRFI_ANALOG_V1.json',import.meta.url);
export const contract=JSON.parse(fs.readFileSync(contractPath,'utf8'));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
export function evaluate(input) {
  assert(Array.isArray(input)&&input.length,'EMPTY_SOURCE');
  const rows=[...input].sort((a,b)=>a[2].localeCompare(b[2])||a[1]-b[1]), ids=new Set();
  for(const r of rows){
    assert(r.length===13,'SOURCE_SCHEMA');
    assert([2025,2026].includes(r[0])&&r[2]<=contract.max_development_date&&r[2].startsWith(String(r[0])),'DATE_BOUNDARY');
    for(const i of [1,3,4,5,6])assert(Number.isSafeInteger(r[i])&&r[i]>=(i===3||i===4?0:1),'IDENTITY_OR_TARGET');
    assert(typeof r[7]==='string'&&r[7]&&typeof r[8]==='string'&&r[8]&&r[7]!==r[8],'TEAM_IDENTITY');
    assert(typeof r[9]==='string'&&r[9]&&r[9]<r[2],'STRICT_PRIOR_CUTOFF');
    assert(typeof r[10]==='string'&&/F1/.test(r[10]),'OUTCOME_LINEAGE');
    assert(r[11]===true&&r[12]===contract.development_class,'SOURCE_CLASS');
    const key=`${r[0]}:${r[1]}`;assert(!ids.has(key),'DUPLICATE_GAME');ids.add(key);
  }
  const histories=new Map(),predictions=[];let excludedPrior=0,excludedAnalogs=0;
  const state=season=>{if(!histories.has(season))histories.set(season,{league:[0,0],pitchers:new Map(),teams:new Map(),analogs:[]});return histories.get(season);};
  const get=(m,k)=>m.get(k)??[0,0];
  const add=(m,k,z)=>{const v=get(m,k);m.set(k,[v[0]+1,v[1]+z]);};
  for(let i=0;i<rows.length;){
    let j=i+1;while(j<rows.length&&rows[j][2]===rows[i][2])j++;
    const pending=[];
    for(const r of rows.slice(i,j)){
      const s=state(r[0]),hp=get(s.pitchers,r[5]),ap=get(s.pitchers,r[6]),ho=get(s.teams,r[7]),ao=get(s.teams,r[8]);
      if(s.league[0]/2<contract.min_league_games||Math.min(hp[0],ap[0])<contract.min_pitcher_starts||Math.min(ho[0],ao[0])<contract.min_offense_games){excludedPrior++;continue;}
      const league=(s.league[1]+1)/(s.league[0]+2),k=contract.entity_prior_strength,q=v=>(v[1]+k*league)/(v[0]+k);
      const features=[[q(hp),q(ao)],[q(ap),q(ho)]].sort((a,b)=>a[0]-b[0]||a[1]-b[1]).flat();
      const truth=r[3]===0&&r[4]===0;
      pending.push({season:r[0],game_pk:r[1],game_date:r[2],features,truth});
      if(s.analogs.length<contract.k){excludedAnalogs++;continue;}
      const neighbors=s.analogs.map(a=>({a,d:a.features.reduce((v,x,l)=>v+(x-features[l])**2,0)})).sort((a,b)=>a.d-b.d||a.a.game_date.localeCompare(b.a.game_date)||a.a.game_pk-b.a.game_pk).slice(0,contract.k);
      const nrfi=neighbors.reduce((n,x)=>n+Number(x.a.truth),0),p=(1+nrfi)/(contract.k+2),t=contract.probability_threshold,side=p>=t?'NRFI':p<=1-t?'YRFI':null;
      predictions.push({game_pk:r[1],game_date:r[2],features,p_nrfi:p,side,truth_nrfi:truth,correct:side===null?null:(side==='NRFI')===truth,prior_league_games:s.league[0]/2,prior_analog_count:s.analogs.length,neighbor_nrfi:nrfi,neighbor_game_pks:neighbors.map(x=>x.a.game_pk),latest_neighbor_date:neighbors.map(x=>x.a.game_date).sort().at(-1)});
    }
    for(const a of pending)state(a.season).analogs.push(a);
    for(const r of rows.slice(i,j)){
      const s=state(r[0]),hz=Number(r[3]===0),az=Number(r[4]===0);
      add(s.pitchers,r[5],az);add(s.pitchers,r[6],hz);add(s.teams,r[7],hz);add(s.teams,r[8],az);s.league[0]+=2;s.league[1]+=hz+az;
    }
    i=j;
  }
  const selected=predictions.filter(x=>x.side),wins=selected.filter(x=>x.correct).length,monthly={};
  for(const r of selected){const m=r.game_date.slice(0,7);monthly[m]??={n:0,wins:0};monthly[m].n++;monthly[m].wins+=Number(r.correct);}
  for(const m of Object.values(monthly))m.accuracy=m.wins/m.n;
  const accuracy=selected.length?wins/selected.length:null,worst=selected.length?Math.min(...Object.values(monthly).map(x=>x.accuracy)):null,g=contract.gates;
  const pass=accuracy!==null&&accuracy>=g.accuracy&&selected.length>=g.min_n&&Object.keys(monthly).length>=g.min_months&&worst>=g.worst_month_accuracy;
  return {contract:contract.contract,contract_sha256:hash(fs.readFileSync(contractPath)),evaluator_sha256:hash(fs.readFileSync(new URL(import.meta.url))),input_sha256:hash(JSON.stringify(rows)),source_rows:rows.length,min_date:rows[0][2],max_date:rows.at(-1)[2],eligible:predictions.length,excluded_insufficient_prior:excludedPrior,excluded_insufficient_analogs:excludedAnalogs,selected:selected.length,wins,losses:selected.length-wins,pushes:0,accuracy,coverage:predictions.length?selected.length/predictions.length:null,coverage_all_source:selected.length/rows.length,monthly,worst_month_accuracy:worst,development_gate_pass:pass,state:pass?'DEVELOPMENT_GATE_PASS_EXTERNAL_NOT_OPENED':'DEVELOPMENT_GATE_FAILED_NO_EXTERNAL',research_only:true,external_opened:false,provider_calls_made:0,odds_api_historical_credits_consumed:0,predictions};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  assert(process.argv[2]&&process.argv[3],'Usage: node evaluate_mlb_nrfi_analog_v1.mjs input.json output.json');
  const result=evaluate(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');
  const {predictions,...summary}=result;console.log(JSON.stringify(summary,null,2));
}
