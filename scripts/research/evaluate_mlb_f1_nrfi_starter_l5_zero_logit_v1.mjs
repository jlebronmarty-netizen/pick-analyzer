import fs from 'node:fs'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'

const contractPath=new URL('../../contracts/MLB_F1_NRFI_STARTER_L5_ZERO_LOGIT_V1.json',import.meta.url)
export const contract=JSON.parse(fs.readFileSync(contractPath,'utf8'))
const hash=x=>crypto.createHash('sha256').update(x).digest('hex')
const sigmoid=z=>1/(1+Math.exp(-Math.max(-30,Math.min(30,z))))
const clip=(x,c)=>Math.max(-c,Math.min(c,x))

function solve(A,b){
  const n=b.length,M=A.map((r,i)=>[...r,b[i]])
  for(let c=0;c<n;c++){
    let p=c
    for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r
    assert(Math.abs(M[p][c])>1e-12,'SINGULAR_HESSIAN')
    ;[M[c],M[p]]=[M[p],M[c]]
    const d=M[c][c]
    for(let j=c;j<=n;j++)M[c][j]/=d
    for(let r=0;r<n;r++)if(r!==c){
      const f=M[r][c]
      if(!f)continue
      for(let j=c;j<=n;j++)M[r][j]-=f*M[c][j]
    }
  }
  return M.map(r=>r[n])
}

const halfRows=g=>[
  {y:Number(g[3]===0),raw:[g[8],g[9],...g.slice(18,24)],home:1},
  {y:Number(g[4]===0),raw:[g[10],g[11],...g.slice(12,18)],home:0}
]

function standardizer(games){
  const hs=games.flatMap(halfRows),k=8,means=Array(k).fill(0),sds=Array(k).fill(0)
  for(const h of hs)for(let j=0;j<k;j++)means[j]+=h.raw[j]
  for(let j=0;j<k;j++)means[j]/=hs.length
  for(const h of hs)for(let j=0;j<k;j++)sds[j]+=(h.raw[j]-means[j])**2
  for(let j=0;j<k;j++)sds[j]=Math.max(1e-9,Math.sqrt(sds[j]/hs.length))
  return {means,sds}
}
const vector=(h,s)=>[1,...h.raw.map((v,j)=>(v-s.means[j])/s.sds[j]),h.home]

export function fit(games){
  assert(games.length>=contract.eligibility.min_training_games,'TRAINING_MIN')
  const hs=games.flatMap(halfRows),s=standardizer(games),p=10,lambda=contract.fitting.l2_lambda
  const zeros=hs.reduce((a,h)=>a+h.y,0)
  let beta=Array(p).fill(0);beta[0]=Math.log((zeros+1)/(hs.length-zeros+1))
  let iterations=0
  for(;iterations<contract.fitting.max_iterations;iterations++){
    const H=Array.from({length:p},()=>Array(p).fill(0)),grad=Array(p).fill(0)
    for(const h of hs){
      const x=vector(h,s),pr=sigmoid(x.reduce((a,v,j)=>a+v*beta[j],0)),w=Math.max(1e-9,pr*(1-pr)),e=h.y-pr
      for(let a=0;a<p;a++){
        grad[a]+=x[a]*e
        for(let b=0;b<p;b++)H[a][b]+=x[a]*x[b]*w
      }
    }
    for(let j=1;j<p;j++){H[j][j]+=lambda;grad[j]-=lambda*beta[j]}
    H[0][0]+=1e-9
    const delta=solve(H,grad)
    let maxD=0
    for(let j=0;j<p;j++){
      const next=clip(beta[j]+delta[j],contract.fitting.coefficient_clip)
      maxD=Math.max(maxD,Math.abs(next-beta[j]));beta[j]=next
    }
    if(maxD<contract.fitting.convergence_tolerance){iterations++;break}
  }
  return {beta,standardizer:s,training_games:games.length,training_halves:hs.length,iterations}
}

function halfProb(model,h){return sigmoid(vector(h,model.standardizer).reduce((a,v,j)=>a+v*model.beta[j],0))}

export function evaluate(input){
  assert(Array.isArray(input)&&input.length,'EMPTY_SOURCE')
  const rows=[...input].sort((a,b)=>a[2].localeCompare(b[2])||a[1]-b[1]),seen=new Set()
  for(const r of rows){
    assert(r.length===24,'SOURCE_SCHEMA')
    assert([2025,2026].includes(r[0])&&r[2].startsWith(String(r[0]))&&r[2]<=contract.max_development_date,'DATE_BOUNDARY')
    assert(Number.isSafeInteger(r[1])&&r[1]>0&&Number.isSafeInteger(r[3])&&r[3]>=0&&Number.isSafeInteger(r[4])&&r[4]>=0,'IDENTITY_TARGET')
    assert(typeof r[5]==='string'&&r[5]<r[2]&&typeof r[6]==='string'&&r[6]<r[2],'STRICT_PRIOR_STARTER_DATES')
    assert(r[7]==='xyear_raw_v1','FEATURE_VERSION')
    for(const v of r.slice(8,24))assert(Number.isFinite(v),'FEATURE_VALUE')
    const key=`${r[0]}:${r[1]}`;assert(!seen.has(key),'DUPLICATE_GAME');seen.add(key)
  }

  const predictions=[],fits=[]
  let season=null,month=null,history=[],model=null
  for(let i=0;i<rows.length;){
    let j=i+1;while(j<rows.length&&rows[j][2]===rows[i][2])j++
    const date=rows[i][2],yr=rows[i][0],mo=date.slice(0,7)
    if(yr!==season){season=yr;month=null;history=[];model=null}
    if(mo!==month){
      month=mo
      model=history.length>=contract.eligibility.min_training_games?fit(history):null
      if(model)fits.push({fit_date:date,max_training_date:history.at(-1)[2],training_games:model.training_games,iterations:model.iterations})
    }
    if(model)for(const r of rows.slice(i,j)){
      const [hh,ah]=halfRows(r),ph=halfProb(model,hh),pa=halfProb(model,ah),p=ph*pa,t=contract.selection.probability_threshold
      const side=p>=t?'NRFI':p<=1-t?'YRFI':null,truth=r[3]===0&&r[4]===0
      predictions.push({game_pk:r[1],game_date:r[2],p_home_half_zero:ph,p_away_half_zero:pa,p_nrfi:p,side,truth_nrfi:truth,correct:side===null?null:(side==='NRFI')===truth})
    }
    history.push(...rows.slice(i,j));i=j
  }

  const selected=predictions.filter(r=>r.side!==null),wins=selected.filter(r=>r.correct).length,monthly={}
  for(const r of selected){const m=r.game_date.slice(0,7);monthly[m]??={n:0,wins:0};monthly[m].n++;monthly[m].wins+=Number(r.correct)}
  for(const m of Object.values(monthly))m.accuracy=m.wins/m.n
  const accuracy=selected.length?wins/selected.length:null,worst=selected.length?Math.min(...Object.values(monthly).map(x=>x.accuracy)):null,g=contract.gates
  const pass=accuracy!==null&&accuracy>=g.accuracy&&selected.length>=g.min_n&&Object.keys(monthly).length>=g.min_months&&worst>=g.worst_month_accuracy
  return {
    contract:contract.contract,architecture:contract.architecture,
    contract_sha256:hash(fs.readFileSync(contractPath)),evaluator_sha256:hash(fs.readFileSync(new URL(import.meta.url))),
    input_sha256:hash(JSON.stringify(rows)),source_rows:rows.length,eligible:predictions.length,selected:selected.length,wins,losses:selected.length-wins,accuracy,
    coverage:predictions.length?selected.length/predictions.length:null,monthly,worst_month_accuracy:worst,development_gate_pass:pass,
    state:pass?'DEVELOPMENT_GATE_PASS_EXTERNAL_NOT_OPENED':'DEVELOPMENT_GATE_FAILED_NO_EXTERNAL',
    probability_threshold:contract.selection.probability_threshold,external_opened:false,research_only:true,
    provider_calls_made:0,odds_api_historical_credits_consumed:0,official_picks_writes:0,apostar_activation:false,production_promotion:false,tracker_modified:false,
    fits,predictions
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  assert(process.argv[2]&&process.argv[3],'Usage: node evaluate_mlb_f1_nrfi_starter_l5_zero_logit_v1.mjs input.json output.json')
  const result=evaluate(JSON.parse(fs.readFileSync(process.argv[2],'utf8')))
  fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n')
  const {predictions,fits,...summary}=result;console.log(JSON.stringify(summary,null,2))
}
