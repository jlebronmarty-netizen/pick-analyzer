import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const contractPath = new URL('../../contracts/MLB_F1_NRFI_FACTORIZED_V1.json', import.meta.url);
export const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const logit = p => Math.log(p / (1 - p));
const logistic = x => 1 / (1 + Math.exp(-x));

// Source columns: season, gamePk, date, home F1, away F1, exact home/away starter IDs,
// stored home/away teams, strictly prior cutoff, lineage, research flag, development class.
export function evaluate(input) {
  assert(Array.isArray(input) && input.length > 0, 'EMPTY_SOURCE');
  const rows = [...input].sort((a,b) => a[2].localeCompare(b[2]) || a[1]-b[1]);
  const identities = new Set();
  for (const r of rows) {
    assert(r.length === 13, 'SOURCE_SCHEMA');
    assert([2025,2026].includes(r[0]) && r[2] <= contract.max_development_date, 'DATE_BOUNDARY');
    assert(r[2].startsWith(String(r[0])), 'SEASON_DATE');
    for (const i of [1,3,4,5,6]) assert(Number.isSafeInteger(r[i]) && r[i] >= (i===3||i===4?0:1), 'IDENTITY_OR_TARGET');
    assert(typeof r[7]==='string' && r[7] && typeof r[8]==='string' && r[8] && r[7]!==r[8], 'TEAM_IDENTITY');
    assert(typeof r[9]==='string' && r[9] && r[9]<r[2], 'STRICT_PRIOR_CUTOFF');
    assert(typeof r[10]==='string' && /F1/.test(r[10]), 'OUTCOME_LINEAGE');
    assert(r[11] === true && r[12] === contract.development_class, 'SOURCE_CLASS');
    const key = `${r[0]}:${r[1]}`;
    assert(!identities.has(key), 'DUPLICATE_GAME'); identities.add(key);
  }
  const histories = new Map(), predictions = [];
  let excluded = 0;
  const state = season => {
    if (!histories.has(season)) histories.set(season,{league:[0,0],pitchers:new Map(),teams:new Map()});
    return histories.get(season);
  };
  const get = (map,key) => map.get(key) ?? [0,0];
  const add = (map,key,zero) => {const v=get(map,key); map.set(key,[v[0]+1,v[1]+zero]);};
  for (let i=0;i<rows.length;) {
    let j=i+1; while (j<rows.length && rows[j][2]===rows[i][2]) j++;
    // Outcome-independent probability pass. Current-date outcomes cannot enter histories.
    for (const r of rows.slice(i,j)) {
      const s=state(r[0]), hp=get(s.pitchers,r[5]), ap=get(s.pitchers,r[6]);
      const ho=get(s.teams,r[7]), ao=get(s.teams,r[8]);
      if (s.league[0]/2 < contract.min_league_games || Math.min(hp[0],ap[0])<contract.min_pitcher_starts || Math.min(ho[0],ao[0])<contract.min_offense_games) {excluded++;continue;}
      const league=(s.league[1]+1)/(s.league[0]+2), k=contract.entity_prior_strength;
      const half=(pitcher,offense)=>logistic(logit((pitcher[1]+k*league)/(pitcher[0]+k))+logit((offense[1]+k*league)/(offense[0]+k))-logit(league));
      const p=half(hp,ao)*half(ap,ho), threshold=contract.probability_threshold;
      const side=p>=threshold?'NRFI':p<=1-threshold?'YRFI':null;
      const truth=r[3]===0 && r[4]===0;
      predictions.push({game_pk:r[1],game_date:r[2],p_nrfi:p,side,truth_nrfi:truth,correct:side===null?null:(side==='NRFI')===truth,prior_league_games:s.league[0]/2,prior_home_pitcher_starts:hp[0],prior_away_pitcher_starts:ap[0]});
    }
    for (const r of rows.slice(i,j)) {
      const s=state(r[0]), hz=Number(r[3]===0), az=Number(r[4]===0);
      add(s.pitchers,r[5],az); add(s.pitchers,r[6],hz);
      add(s.teams,r[7],hz); add(s.teams,r[8],az);
      s.league[0]+=2; s.league[1]+=hz+az;
    }
    i=j;
  }
  const selected=predictions.filter(r=>r.side!==null), wins=selected.filter(r=>r.correct).length;
  const monthly={};
  for (const r of selected) {const m=r.game_date.slice(0,7); monthly[m]??={n:0,wins:0}; monthly[m].n++;monthly[m].wins+=Number(r.correct);}
  for(const m of Object.values(monthly)) m.accuracy=m.wins/m.n;
  const accuracy=selected.length?wins/selected.length:null;
  const worst=selected.length?Math.min(...Object.values(monthly).map(m=>m.accuracy)):null;
  const g=contract.gates, pass=accuracy!==null && accuracy>=g.accuracy && selected.length>=g.min_n && Object.keys(monthly).length>=g.min_months && worst>=g.worst_month_accuracy;
  return {contract:contract.contract,architecture:contract.architecture,contract_sha256:hash(fs.readFileSync(contractPath)),input_sha256:hash(JSON.stringify(rows)),state:pass?'DEVELOPMENT_GATE_PASS_EXTERNAL_NOT_OPENED':'DEVELOPMENT_GATE_FAILED_NO_EXTERNAL',source_rows:rows.length,min_date:rows[0][2],max_date:rows.at(-1)[2],eligible:predictions.length,excluded_insufficient_prior:excluded,selected:selected.length,wins,losses:selected.length-wins,pushes:0,accuracy,coverage:predictions.length?selected.length/predictions.length:null,coverage_all_source:selected.length/rows.length,monthly,worst_month_accuracy:worst,development_gate_pass:pass,external_opened:false,prior_result_preserved:'f1_nrfi_revisit_both_starters_075_min3_fallback_v1:399/738',probability_threshold:contract.probability_threshold,research_only:true,provider_calls_made:0,odds_api_historical_credits_consumed:0,official_picks_writes:0,apostar_activation:false,production_promotion:false,tracker_modified:false,predictions};
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  assert(process.argv[2] && process.argv[3], 'Usage: node evaluate_mlb_f1_nrfi_factorized_v1.mjs input.json output.json');
  const result=evaluate(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));
  fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');
  const {predictions,...summary}=result; console.log(JSON.stringify(summary,null,2));
}
