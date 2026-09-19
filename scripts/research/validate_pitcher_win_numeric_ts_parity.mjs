import fs from 'node:fs'
import { applyNumericCatBoostRaw, applyNumericCatBoostProbability } from '../../src/lib/catboost-oblivious-numeric.ts'

const m0=JSON.parse(fs.readFileSync('python_models/pitcher_win_forward_numeric_model_0.json','utf8'))
const m1=JSON.parse(fs.readFileSync('python_models/pitcher_win_forward_numeric_model_1.json','utf8'))
const fx=JSON.parse(fs.readFileSync('artifacts/research/mlb_pitcher_win_forward_numeric_ts_parity_fixture.json','utf8'))
let maxRaw=0,maxProb=0
for(const [i,row] of fx.rows.entries()){
  const features=row.features.map((v)=>v===null?Number.NaN:Number(v))
  const r0=applyNumericCatBoostRaw(m0,features), r1=applyNumericCatBoostRaw(m1,features)
  const p0=applyNumericCatBoostProbability(m0,features), p1=applyNumericCatBoostProbability(m1,features)
  maxRaw=Math.max(maxRaw,Math.abs(r0-row.raw0),Math.abs(r1-row.raw1))
  maxProb=Math.max(maxProb,Math.abs(p0-row.p0),Math.abs(p1-row.p1),Math.abs((p0+p1)/2-row.ensemble))
  if(Math.abs(r0-row.raw0)>1e-12 || Math.abs(r1-row.raw1)>1e-12 || Math.abs((p0+p1)/2-row.ensemble)>1e-12){
    throw new Error('PARITY_MISMATCH:'+i+':'+r0+':'+row.raw0+':'+r1+':'+row.raw1)
  }
}
console.log(JSON.stringify({contract:'MLB_PITCHER_WIN_NUMERIC_TS_PARITY_VALIDATION/1.0.0',rows:fx.rows.length,maxRaw,maxProb,status:'PASS'},null,2))
