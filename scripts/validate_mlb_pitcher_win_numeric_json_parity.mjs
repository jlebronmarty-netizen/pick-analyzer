import fs from 'node:fs'
import path from 'node:path'
import {
  catboostNumericProbability,
  catboostNumericEnsembleProbability,
} from '../src/lib/catboost-numeric-json.js'

const root=process.cwd()
const readJson=(p)=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'))

const models=[
  readJson('python_models/pitcher_win_forward_numeric_model_0.json'),
  readJson('python_models/pitcher_win_forward_numeric_model_1.json'),
]
const golden=readJson('artifacts/research/mlb_pitcher_win_forward_numeric_v1_golden.json')

if(golden.contract!=='MLB_PITCHER_WIN_FORWARD_NUMERIC_GOLDEN/1.0.0') {
  throw new Error('PWFN_GOLDEN_CONTRACT')
}
if(golden.feature_names.length!==29) throw new Error('PWFN_FEATURE_COUNT')

let maxModelDiff=0
let maxEnsembleDiff=0
let checked=0

for(const row of golden.rows){
  const features=row.features.map((value)=>value===null ? Number.NaN : Number(value))
  for(let i=0;i<models.length;i+=1){
    const actual=catboostNumericProbability(models[i],features)
    const expected=Number(row.per_model_p_win[i])
    const diff=Math.abs(actual-expected)
    maxModelDiff=Math.max(maxModelDiff,diff)
    if(diff>1e-12){
      throw new Error(`PWFN_MODEL_PARITY:${row.row_index}:${i}:${actual}:${expected}:${diff}`)
    }
  }
  const ensemble=catboostNumericEnsembleProbability(models,features)
  const expectedEnsemble=Number(row.ensemble_p_win)
  const ediff=Math.abs(ensemble-expectedEnsemble)
  maxEnsembleDiff=Math.max(maxEnsembleDiff,ediff)
  if(ediff>1e-12){
    throw new Error(`PWFN_ENSEMBLE_PARITY:${row.row_index}:${ensemble}:${expectedEnsemble}:${ediff}`)
  }
  checked+=1
}

console.log(JSON.stringify({
  status:'PASS',
  checked,
  maxModelDiff,
  maxEnsembleDiff,
  threshold:golden.threshold,
},null,2))
