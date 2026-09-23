import fs from 'node:fs'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'

const contractPath=new URL('../../contracts/MLB_F3_GRAPH_MARGIN_V1.json',import.meta.url)
export const contract=JSON.parse(fs.readFileSync(contractPath,'utf8'))
const hash=x=>crypto.createHash('sha256').update(x).digest('hex')
const clip=(x,c)=>Math.max(-c,Math.min(c,x))
export function normalCdf(x){
  const t=1/(1+.2316419*Math.abs(x)),d=.3989422804014327*Math.exp(-x*x/2)
  const q=d*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))))
  return x>=0?1-q:q
}
export function fit(rows){
  assert(rows.length>=contract.eligibility.min_prior_league_games,'TRAINING_MIN')
  const lambda=contract.fitting.ridge_lambda,clipAt=contract.fitting.coefficient_clip
  const teams=[...new Set(rows.flatMap(r=>[r[5],r[6]]))].sort()
  const ratings=new Map(teams.map(t=>[t,0]))
  let homeAdv=rows.reduce((s,r)=>s+(r[3]-r[4]),0)/rows.length
  let sweeps=0
  for(;sweeps<contract.fitting.coordinate_sweeps;sweeps++){
    let maxDelta=0
    const newHome=rows.reduce((s,r)=>s+(r[3]-r[4])-(ratings.get(r[5])??0)+(ratings.get(r[6])??0),0)/(rows.length+contract.fitting.home_advantage_ridge)
    maxDelta=Math.max(maxDelta,Math.abs(newHome-homeAdv));homeAdv=clip(newHome,clipAt)
    for(const team of teams){
      let num=0,den=lambda
      for(const r of rows){
        const y=r[3]-r[4],rh=ratings.get(r[5])??0,ra=ratings.get(r[6])??0
        if(r[5]===team){num+=y-homeAdv+ra;den+=1}
        else if(r[6]===team){num+=-y+homeAdv+rh;den+=1}
      }
      const old=ratings.get(team)??0,next=clip(num/den,clipAt)
      ratings.set(team,next);maxDelta=Math.max(maxDelta,Math.abs(next-old))
    }
    if(maxDelta<contract.fitting.convergence_tolerance){sweeps++;break}
  }
  const residuals=rows.map(r=>(r[3]-r[4])-(homeAdv+(ratings.get(r[5])??0)-(ratings.get(r[6])??0)))
  const sigma=Math.sqrt(residuals.reduce((s,x)=>s+x*x,0)/residuals.length)
  assert(Number.isFinite(sigma)&&sigma>0,'RESIDUAL_SIGMA')
  return {homeAdv,ratings,sigma,training_n:rows.length,sweeps}
}
function probability(model,r){
  const mu=model.homeAdv+(model.ratings.get(r[5])??0)-(model.ratings.get(r[6])??0),sd=model.sigma
  const away=normalCdf((-0.5-mu)/sd),home=1-normalCdf((0.5-mu)/sd),push=Math.max(0,1-home-away),den=home+away
  return {mu,home,away,push,homeConditional:den>0?home/den:null,awayConditional:den>0?away/den:null}
}
export function evaluate(input){
  assert(Array.isArray(input)&&input.length,'EMPTY_SOURCE')
  const rows=[...input].sort((a,b)=>a[2].localeCompare(b[2])||a[1]-b[1]),seen=new Set()
  for(const r of rows){
    assert(r.length===11,'SOURCE_SCHEMA')
    assert([2025,2026].includes(r[0])&&r[2].startsWith(String(r[0]))&&r[2]<=contract.max_development_date,'DATE_BOUNDARY')
    for(const i of [1,3,4])assert(Number.isSafeInteger(r[i])&&r[i]>=(i===1?1:0),'IDENTITY_OR_TARGET')
    assert(typeof r[5]==='string'&&r[5]&&typeof r[6]==='string'&&r[6]&&r[5]!==r[6],'TEAM_IDENTITY')
    assert(typeof r[7]==='string'&&r[7]&&r[7]<r[2],'STRICT_PRIOR_CUTOFF')
    assert(typeof r[8]==='string'&&/F3/.test(r[8]),'OUTCOME_LINEAGE')
    assert(r[9]===true&&r[10]===contract.development_class,'SOURCE_CLASS')
    const key=`${r[0]}:${r[1]}`;assert(!seen.has(key),'DUPLICATE_GAME');seen.add(key)
  }
  const predictions=[],fits=[]
  let season=null,month=null,history=[],model=null,teamCounts=new Map()
  for(let i=0;i<rows.length;){
    let j=i+1;while(j<rows.length&&rows[j][2]===rows[i][2])j++
    const date=rows[i][2],yr=rows[i][0],mo=date.slice(0,7)
    if(yr!==season){season=yr;month=null;history=[];model=null;teamCounts=new Map()}
    if(mo!==month){month=mo;model=history.length>=contract.eligibility.min_prior_league_games?fit(history):null;if(model)fits.push({fit_date:date,max_training_date:history.at(-1)[2],n:history.length,sigma:model.sigma,home_advantage:model.homeAdv,sweeps:model.sweeps})}
    if(model){
      for(const r of rows.slice(i,j)){
        const minTeam=Math.min(teamCounts.get(r[5])??0,teamCounts.get(r[6])??0)
        if(minTeam<contract.eligibility.min_team_games)continue
        const p=probability(model,r),t=contract.selection.confidence_threshold
        const side=p.homeConditional>=t?'HOME':p.awayConditional>=t?'AWAY':null
        const truth=r[3]>r[4]?'HOME':r[3]<r[4]?'AWAY':'PUSH'
        predictions.push({game_pk:r[1],game_date:r[2],side,truth,correct:side===null||truth==='PUSH'?null:side===truth,...p,prior_min_team_games:minTeam})
      }
    }
    for(const r of rows.slice(i,j)){history.push(r);teamCounts.set(r[5],(teamCounts.get(r[5])??0)+1);teamCounts.set(r[6],(teamCounts.get(r[6])??0)+1)}
    i=j
  }
  const selected=predictions.filter(r=>r.side!==null),settled=selected.filter(r=>r.truth!=='PUSH'),pushes=selected.length-settled.length,wins=settled.filter(r=>r.correct).length,monthly={}
  for(const r of settled){const m=r.game_date.slice(0,7);monthly[m]??={n:0,wins:0};monthly[m].n++;monthly[m].wins+=Number(r.correct)}
  for(const m of Object.values(monthly))m.accuracy=m.wins/m.n
  const accuracy=settled.length?wins/settled.length:null,worst=settled.length?Math.min(...Object.values(monthly).map(x=>x.accuracy)):null,g=contract.gates
  const pass=accuracy!==null&&accuracy>=g.accuracy&&settled.length>=g.min_nonpush_n&&Object.keys(monthly).length>=g.min_months&&worst>=g.worst_month_accuracy
  return {
    contract:contract.contract,architecture:contract.architecture,
    contract_sha256:hash(fs.readFileSync(contractPath)),evaluator_sha256:hash(fs.readFileSync(new URL(import.meta.url))),
    input_sha256:hash(JSON.stringify(rows)),source_rows:rows.length,eligible:predictions.length,selected:selected.length,
    nonpush_n:settled.length,wins,losses:settled.length-wins,pushes,accuracy,
    coverage:predictions.length?selected.length/predictions.length:null,monthly,worst_month_accuracy:worst,
    development_gate_pass:pass,state:pass?'DEVELOPMENT_GATE_PASS_EXTERNAL_NOT_OPENED':'DEVELOPMENT_GATE_FAILED_NO_EXTERNAL',
    confidence_threshold:contract.selection.confidence_threshold,external_opened:false,research_only:true,
    provider_calls_made:0,odds_api_historical_credits_consumed:0,official_picks_writes:0,apostar_activation:false,
    production_promotion:false,tracker_modified:false,fits,predictions
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  assert(process.argv[2]&&process.argv[3],'Usage: node evaluate_mlb_f3_graph_margin_v1.mjs input.json output.json')
  const result=evaluate(JSON.parse(fs.readFileSync(process.argv[2],'utf8')))
  fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n')
  const {predictions,fits,...summary}=result;console.log(JSON.stringify(summary,null,2))
}
