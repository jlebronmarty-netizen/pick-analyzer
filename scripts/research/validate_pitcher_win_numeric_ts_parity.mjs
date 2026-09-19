import fs from 'node:fs'

function raw(model, features) {
  let sum=0
  for (const tree of model.oblivious_trees) {
    let idx=0
    for (let depth=0; depth<tree.splits.length; depth++) {
      const split=tree.splits[depth]
      if (split.split_type!=='FloatFeature') throw new Error('UNSUPPORTED_SPLIT')
      const value=features[split.float_feature_index]
      const numeric=value===null ? Number.NaN : Number(value)
      if (Number.isFinite(numeric) && numeric>split.border) idx|=(1<<depth)
    }
    sum+=Number(tree.leaf_values[idx])
  }
  const scale=Number(model.scale_and_bias?.[0] ?? 1)
  const bias=Number(model.scale_and_bias?.[1]?.[0] ?? 0)
  return scale*sum+bias
}
function sigmoid(x){
  if(x>=0){const z=Math.exp(-x);return 1/(1+z)}
  const z=Math.exp(x);return z/(1+z)
}
const m0=JSON.parse(fs.readFileSync('python_models/pitcher_win_forward_numeric_model_0.json','utf8'))
const m1=JSON.parse(fs.readFileSync('python_models/pitcher_win_forward_numeric_model_1.json','utf8'))
const fx=JSON.parse(fs.readFileSync('artifacts/research/mlb_pitcher_win_forward_numeric_ts_parity_fixture.json','utf8'))
let maxRaw=0,maxProb=0
for(const [i,row] of fx.rows.entries()){
  const r0=raw(m0,row.features), r1=raw(m1,row.features)
  const p0=sigmoid(r0), p1=sigmoid(r1)
  maxRaw=Math.max(maxRaw,Math.abs(r0-row.raw0),Math.abs(r1-row.raw1))
  maxProb=Math.max(maxProb,Math.abs(p0-row.p0),Math.abs(p1-row.p1),Math.abs((p0+p1)/2-row.ensemble))
  if(Math.abs(r0-row.raw0)>1e-12 || Math.abs(r1-row.raw1)>1e-12 || Math.abs((p0+p1)/2-row.ensemble)>1e-12){
    throw new Error(`PARITY_MISMATCH:${i}:${r0}:${row.raw0}:${r1}:${row.raw1}`)
  }
}
console.log(JSON.stringify({contract:'MLB_PITCHER_WIN_NUMERIC_TS_PARITY_VALIDATION/1.0.0',rows:fx.rows.length,maxRaw,maxProb,status:'PASS'},null,2))
