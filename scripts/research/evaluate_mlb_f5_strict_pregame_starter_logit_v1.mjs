import fs from 'node:fs'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'

const contractPath=new URL('../../contracts/MLB_F5_STRICT_PREGAME_STARTER_LOGIT_V1.json',import.meta.url)
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

function standardizer(rows){
  const k=12,means=Array(k).fill(0),sds=Array(k).fill(0)
  for(const r of rows)for(let j=0;j<k;j++)means[j]+=r[8+j]
  for(let j=0;j<k;j++)means[j]/=rows.length
  for(const r of rows)for(let j=0;j<k;j++)sds[j]+=(r[8+j]-means[j])**2
  for(let j=0;j<k;j++)sds[j]=Math.max(1e-9,Math.sqrt(sds[j]/rows.length))
  return {means,sds}
}
const vector=(r,s)=>[1,...r.slice(8,20).map((v,j)=>(v-s.means[j])/s.sds[j])]

export function fit(rows){
  const train=rows.filter(r=>r[3]!==r[4])
  assert(train.length>=contract.eligibility.min_training_nonpush,'TRAINING_MIN')
  const s=standardizer(train),p=13,lambda=contract.fitting.l2_lambda
  const home=train.filter(r=>r[3]>r[4]).length
  let beta=Array(p).fill(0);beta[0]=Math.log((home+1)/(train.length-home+1))
  let iterations=0
  for(;iterations<contract.fitting.max_iterations;iterations++){
    const H=Array.from({length:p},()=>Array(p).fill(0)),g=Array(p).fill(0)
    for(const r of train){
      const x=vector(r,s),y=Number(r[3]>r[4]),pr=sigmoid(x.reduce((a,v,j)=>a+v*beta[j],0)),w=Math.max(1e-9,pr*(1-pr)),e=y-pr
      for(let a=0;a<p;a++){
        g[a]+=x[a]*e
        for(let b=0;b<p;b++)H[a][b]+=x[a]*x[b]*w
      }
    }
    for(let j=1;j<p;j++){H[j][j]+=lambda;g[j]-=lambda*beta[j]}
    H[0][0]+=1e-9
    const delta=solve(H,g)
    let maxD=0
    for(let j=0;j<p;j++){
      const next=clip(beta[j]+delta[j],contract.fitting.coefficient_clip)
      maxD=Math.max(maxD,Math.abs(next-beta[j]));beta[j]=next
    }
    if(maxD<contract.fitting.convergence_tolerance){iterations++;break}
  }
  return {beta,standardizer:s,training_nonpush:train.length,iterations}
}
const probability=(model,r)=>sigmoid(vector(r,model.standardizer).reduce((a,v,j)=>a+v*model.beta[j],0))

export function evaluate(input){
  assert(Array.isArray(input)&&input.length,'EMPTY_SOURCE')
  const rows=[...input].sort((a,b)=>a[2].localeCompare(b[2])||a[1]-b[1]),seen=new Set()
  for(const r of rows){
    assert(r.length===20,'SOURCE_SCHEMA')
    assert([2025,2026].includes(r[0])&&r[2].startsWith(String(r[0]))&&r[2]<=contract.max_development_date,'DATE_BOUNDARY')
    assert(Number.isSafeInteger(r[1])&&r[1]>0&&Number.isSafeInteger(r[3])&&r[3]>=0&&Number.isSafeInteger(r[4])&&r[4]>=0,'IDENTITY_TARGET')
    assert(typeof r[5]==='string'&&r[5]<r[2]&&typeof r[6]==='string'&&r[6]<r[2],'STRICT_PRIOR_STARTER_DATES')
    assert(r[7]==='xyear_raw_v1','FEATURE_VERSION')
    for(const v of r.slice(8,20))assert(Number.isFinite(v),'FEATURE_VALUE')
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
      const n=history.filter(r=>r[3]!==r[4]).length
      model=n>=contract.eligibility.min_training_nonpush?fit(history):null
      if(model)fits.push({fit_date:date,max_training_date:history.at(-1)[2],training_nonpush:model.training_nonpush,iterations:model.iterations})
    }
    if(model)for(const r of rows.slice(i,j)){
      const p=probability(model,r),t=contract.selection.confidence_threshold
      const side=p>=t?'HOME':p<=1-t?'AWAY':null,truth=r[3]>r[4]?'HOME':r[3]<r[4]?'AWAY':'PUSH'
      predictions.push({game_pk:r[1],game_date:r[2],p_home:p,side,truth,correct:side===null||truth==='PUSH'?null:side===truth})
    }
    history.push(...rows.slice(i,j));i=j
  }

  const selected=predictions.filter(r=>r.side!==null),settled=selected.filter(r=>r.truth!=='PUSH'),pushes=selected.length-settled.length,wins=settled.filter(r=>r.correct).length,monthly={}
  for(const r of settled){const m=r.game_date.slice(0,7);monthly[m]??={n:0,wins:0};monthly[m].n++;monthly[m].wins+=Number(r.correct)}
  for(const m of Object.values(monthly))m.accuracy=m.wins/m.n
  const accuracy=settled.length?wins/settled.length:null,worst=settled.length?Math.min(...Object.values(monthly).map(x=>x.accuracy)):null,g=contract.gates
  const pass=accuracy!==null&&accuracy>=g.accuracy&&settled.length>=g.min_nonpush_n&&Object.keys(monthly).length>=g.min_months&&worst>=g.worst_month_accuracy
  return {
    contract:contract.contract,architecture:contract.architecture,
    contract_sha256:hash(fs.readFileSync(contractPath)),evaluator_sha256:hash(fs.readFileSync(new URL(import.meta.url))),
    input_sha256:hash(JSON.stringify(rows)),source_rows:rows.length,eligible:predictions.length,selected:selected.length,nonpush_n:settled.length,wins,losses:settled.length-wins,pushes,accuracy,
    coverage:predictions.length?selected.length/predictions.length:null,monthly,worst_month_accuracy:worst,development_gate_pass:pass,
    state:pass?'DEVELOPMENT_GATE_PASS_EXTERNAL_NOT_OPENED':'DEVELOPMENT_GATE_FAILED_NO_EXTERNAL',
    confidence_threshold:contract.selection.confidence_threshold,external_opened:false,research_only:true,
    provider_calls_made:0,odds_api_historical_credits_consumed:0,official_picks_writes:0,apostar_activation:false,production_promotion:false,tracker_modified:false,
    fits,predictions
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  assert(process.argv[2]&&process.argv[3],'Usage: node evaluate_mlb_f5_strict_pregame_starter_logit_v1.mjs input.json output.json')
  const result=evaluate(JSON.parse(fs.readFileSync(process.argv[2],'utf8')))
  fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n')
  const {predictions,fits,...summary}=result;console.log(JSON.stringify(summary,null,2))
}
