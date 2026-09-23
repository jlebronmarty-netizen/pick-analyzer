import fs from 'node:fs'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const contractPath=new URL('../../contracts/MLB_F1_NRFI_RANDOM_EFFECTS_V1.json',import.meta.url)
export const contract=JSON.parse(fs.readFileSync(contractPath,'utf8'))
const hash=x=>crypto.createHash('sha256').update(x).digest('hex')
const sigmoid=z=>1/(1+Math.exp(-Math.max(-30,Math.min(30,z))))
const logit=p=>Math.log(p/(1-p))
const clip=(x,c)=>Math.max(-c,Math.min(c,x))

function fit(rows){
  assert(rows.length>=contract.eligibility.min_prior_league_games,'TRAINING_MIN')
  const y=rows.map(r=>Number(r[3]===0&&r[4]===0))
  const mean=(y.reduce((a,b)=>a+b,0)+1)/(y.length+2)
  let intercept=logit(mean)
  const pitcher=new Map(),offense=new Map()
  for(let iter=0;iter<contract.fitting.iterations;iter++){
    let gi=0,hi=0
    const pg=new Map(),ph=new Map(),og=new Map(),oh=new Map()
    let maxDelta=0
    for(let i=0;i<rows.length;i++){
      const r=rows[i]
      const ids=[r[5],r[6]],teams=[r[7],r[8]]
      const eta=intercept+(pitcher.get(ids[0])??0)+(pitcher.get(ids[1])??0)+(offense.get(teams[0])??0)+(offense.get(teams[1])??0)
      const p=sigmoid(eta),g=y[i]-p,h=Math.max(1e-9,p*(1-p))
      gi+=g;hi+=h
      for(const id of ids){pg.set(id,(pg.get(id)??0)+g);ph.set(id,(ph.get(id)??0)+h)}
      for(const id of teams){og.set(id,(og.get(id)??0)+g);oh.set(id,(oh.get(id)??0)+h)}
    }
    const di=gi/(hi+contract.fitting.l2_intercept)
    intercept=clip(intercept+di,contract.fitting.coefficient_clip)
    maxDelta=Math.max(maxDelta,Math.abs(di))
    const update=(map,g,h,lambda)=>{
      for(const [id,grad] of g){
        const old=map.get(id)??0
        const d=(grad-lambda*old)/((h.get(id)??0)+lambda)
        const next=clip(old+d,contract.fitting.coefficient_clip)
        map.set(id,next);maxDelta=Math.max(maxDelta,Math.abs(next-old))
      }
    }
    update(pitcher,pg,ph,contract.fitting.l2_pitcher)
    update(offense,og,oh,contract.fitting.l2_offense)
    if(maxDelta<contract.fitting.convergence_tolerance)break
  }
  return {intercept,pitcher,offense,training_n:rows.length}
}
function probability(model,r){
  return sigmoid(model.intercept+(model.pitcher.get(r[5])??0)+(model.pitcher.get(r[6])??0)+(model.offense.get(r[7])??0)+(model.offense.get(r[8])??0))
}
export function evaluate(input){
  assert(Array.isArray(input)&&input.length,'EMPTY_SOURCE')
  const rows=[...input].sort((a,b)=>a[2].localeCompare(b[2])||a[1]-b[1]),seen=new Set()
  for(const r of rows){
    assert(r.length===13,'SOURCE_SCHEMA')
    assert([2025,2026].includes(r[0])&&r[2].startsWith(String(r[0]))&&r[2]<=contract.max_development_date,'DATE_BOUNDARY')
    for(const i of [1,3,4,5,6])assert(Number.isSafeInteger(r[i])&&r[i]>=(i===3||i===4?0:1),'IDENTITY_OR_TARGET')
    assert(typeof r[7]==='string'&&r[7]&&typeof r[8]==='string'&&r[8]&&r[7]!==r[8],'TEAM_IDENTITY')
    assert(typeof r[9]==='string'&&r[9]&&r[9]<r[2],'STRICT_PRIOR_CUTOFF')
    assert(typeof r[10]==='string'&&/F1/.test(r[10]),'OUTCOME_LINEAGE')
    assert(r[11]===true&&r[12]===contract.development_class,'SOURCE_CLASS')
    const key=`${r[0]}:${r[1]}`;assert(!seen.has(key),'DUPLICATE_GAME');seen.add(key)
  }
  const predictions=[],fits=[]
  let season=null,month=null,history=[],model=null,leagueGames=0
  let pitcherCounts=new Map(),offenseCounts=new Map()
  for(let i=0;i<rows.length;){
    let j=i+1;while(j<rows.length&&rows[j][2]===rows[i][2])j++
    const date=rows[i][2],yr=rows[i][0],mo=date.slice(0,7)
    if(yr!==season){season=yr;month=null;history=[];model=null;leagueGames=0;pitcherCounts=new Map();offenseCounts=new Map()}
    if(mo!==month){month=mo;model=history.length>=contract.eligibility.min_prior_league_games?fit(history):null;if(model)fits.push({fit_date:date,max_training_date:history.at(-1)[2],n:history.length})}
    if(model&&leagueGames>=contract.eligibility.min_prior_league_games){
      for(const r of rows.slice(i,j)){
        const pc=Math.min(pitcherCounts.get(r[5])??0,pitcherCounts.get(r[6])??0)
        const oc=Math.min(offenseCounts.get(r[7])??0,offenseCounts.get(r[8])??0)
        if(pc<contract.eligibility.min_pitcher_starts||oc<contract.eligibility.min_offense_games)continue
        const p=probability(model,r),t=contract.selection.probability_threshold
        const side=p>=t?'NRFI':p<=1-t?'YRFI':null
        const truth=r[3]===0&&r[4]===0
        predictions.push({game_pk:r[1],game_date:r[2],p_nrfi:p,side,truth_nrfi:truth,correct:side===null?null:(side==='NRFI')===truth,prior_league_games:leagueGames,prior_min_pitcher_starts:pc,prior_min_offense_games:oc})
      }
    }
    for(const r of rows.slice(i,j)){
      history.push(r);leagueGames++
      pitcherCounts.set(r[5],(pitcherCounts.get(r[5])??0)+1);pitcherCounts.set(r[6],(pitcherCounts.get(r[6])??0)+1)
      offenseCounts.set(r[7],(offenseCounts.get(r[7])??0)+1);offenseCounts.set(r[8],(offenseCounts.get(r[8])??0)+1)
    }
    i=j
  }
  const selected=predictions.filter(r=>r.side!==null),wins=selected.filter(r=>r.correct).length,monthly={}
  for(const r of selected){const m=r.game_date.slice(0,7);monthly[m]??={n:0,wins:0};monthly[m].n++;monthly[m].wins+=Number(r.correct)}
  for(const m of Object.values(monthly))m.accuracy=m.wins/m.n
  const accuracy=selected.length?wins/selected.length:null,worst=selected.length?Math.min(...Object.values(monthly).map(x=>x.accuracy)):null,g=contract.gates
  const pass=accuracy!==null&&accuracy>=g.accuracy&&selected.length>=g.min_n&&Object.keys(monthly).length>=g.min_months&&worst>=g.worst_month_accuracy
  return {
    contract:contract.contract,architecture:contract.architecture,
    contract_sha256:hash(fs.readFileSync(contractPath)),evaluator_sha256:hash(fs.readFileSync(new URL(import.meta.url))),
    input_sha256:hash(JSON.stringify(rows)),source_rows:rows.length,eligible:predictions.length,selected:selected.length,
    wins,losses:selected.length-wins,pushes:0,accuracy,coverage:predictions.length?selected.length/predictions.length:null,
    monthly,worst_month_accuracy:worst,development_gate_pass:pass,
    state:pass?'DEVELOPMENT_GATE_PASS_EXTERNAL_NOT_OPENED':'DEVELOPMENT_GATE_FAILED_NO_EXTERNAL',
    probability_threshold:contract.selection.probability_threshold,external_opened:false,research_only:true,
    provider_calls_made:0,odds_api_historical_credits_consumed:0,official_picks_writes:0,apostar_activation:false,
    production_promotion:false,tracker_modified:false,fits,predictions
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  assert(process.argv[2]&&process.argv[3],'Usage: node evaluate_mlb_f1_nrfi_random_effects_v1.mjs input.json output.json')
  const result=evaluate(JSON.parse(fs.readFileSync(process.argv[2],'utf8')))
  fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n')
  const {predictions,fits,...summary}=result;console.log(JSON.stringify(summary,null,2))
}
