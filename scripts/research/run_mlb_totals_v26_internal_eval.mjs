import { createClient } from '@supabase/supabase-js'

const BRANCH = 'research/totals-2025-historical-backfill'
const TABLE = 'mlb_totals_v26_full_ml_dataset_2025_v1'
const REGISTRY = 'mlb_totals_formula_search_v1'
const CANDIDATE = 'totals_v26_full_surface_extra_trees_internal_v1'
const SEED = 20260917
const N_TREES = 200
const PAGE_SIZE = 500
const THRESHOLDS = [0.55, 0.60, 0.65, 0.70, 0.75, 0.80]
const MODES = ['two_sided', 'over_only', 'under_only']
const INTERNAL_N_MIN = 30
const INTERNAL_HALF_N_MIN = 10
const INTERNAL_ACC_MIN = 0.70
const INTERNAL_WORST_HALF_MIN = 0.65
const META = new Set(['game_pk','game_date','close_over_label','research_only'])
const FORBIDDEN = new Set([
  'total_runs','home_runs','away_runs','actual_winner','y_margin',
  'open_total_margin','close_total_margin',
  'actual_offense_score','actual_contact_score',
  'actual_starter_vulnerability_score','actual_bullpen_vulnerability_score',
  'actual_defense_error_score',
])

if (process.env.VERCEL_GIT_COMMIT_REF !== BRANCH) {
  console.log('SKIP_V26_INTERNAL_EVAL_NON_RESEARCH_BRANCH')
  process.exit(0)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('MISSING_SUPABASE_BUILD_ENV')

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

function specs() {
  const out = []
  for (const maxDepth of [3,5,null]) {
    for (const minLeaf of [5,15]) {
      for (const maxFeatures of ['sqrt',0.5]) {
        out.push({ maxDepth, minLeaf, maxFeatures })
      }
    }
  }
  return out
}

async function fetchRows(from,to) {
  const rows = []
  for (let offset=0;;offset+=PAGE_SIZE) {
    const { data, error } = await supabase.from(TABLE).select('*')
      .gte('game_date',from).lt('game_date',to)
      .in('close_over_label',[0,1])
      .order('game_date',{ascending:true}).order('game_pk',{ascending:true})
      .range(offset,offset+PAGE_SIZE-1)
    if (error) throw new Error('V26_QUERY_FAILED:'+error.message)
    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function medians(rows, features) {
  const med = new Float64Array(features.length)
  for (let j=0;j<features.length;j++) {
    const values=[]
    for (const row of rows) {
      const v=finiteNumber(row[features[j]])
      if (v !== null) values.push(v)
    }
    values.sort((a,b)=>a-b)
    med[j]=!values.length ? 0 :
      (values.length%2 ? values[(values.length-1)>>1] :
      (values[values.length/2-1]+values[values.length/2])/2)
  }
  return med
}

function toMatrix(rows,features,med) {
  const p=features.length
  const x=new Float64Array(rows.length*p)
  const y=new Int8Array(rows.length)
  const day=new Int8Array(rows.length)
  for (let i=0;i<rows.length;i++) {
    const row=rows[i]
    y[i]=Number(row.close_over_label)
    day[i]=Number(String(row.game_date).slice(8,10))
    for (let j=0;j<p;j++) {
      const v=finiteNumber(row[features[j]])
      x[i*p+j]=v===null ? med[j] : v
    }
  }
  return {x,y,day,n:rows.length,p}
}

function mulberry32(seed) {
  let a=seed>>>0
  return ()=>{
    a|=0
    a=(a+0x6d2b79f5)|0
    let t=Math.imul(a^(a>>>15),1|a)
    t=(t+Math.imul(t^(t>>>7),61|t))^t
    return ((t^(t>>>14))>>>0)/4294967296
  }
}

function gini(n0,n1) {
  const n=n0+n1
  if (!n) return 0
  const p0=n0/n,p1=n1/n
  return 1-p0*p0-p1*p1
}

function sampleFeatures(rand,p,count) {
  const arr=new Int32Array(p)
  for (let i=0;i<p;i++) arr[i]=i
  for (let i=0;i<count;i++) {
    const k=i+Math.floor(rand()*(p-i))
    const tmp=arr[i]; arr[i]=arr[k]; arr[k]=tmp
  }
  return arr.subarray(0,count)
}

function buildTree(matrix,spec,seed) {
  const rand=mulberry32(seed)
  const {x,y,p}=matrix
  const mtry=spec.maxFeatures==='sqrt'
    ? Math.max(1,Math.floor(Math.sqrt(p)))
    : Math.max(1,Math.floor(p*spec.maxFeatures))

  function recurse(idx,depth) {
    let n1=0
    for (const i of idx) n1+=y[i]
    const n=idx.length,n0=n-n1,prob=n1/n
    if (n < 2*spec.minLeaf || n1===0 || n0===0 ||
        (spec.maxDepth!==null && depth>=spec.maxDepth)) {
      return {leaf:true,prob}
    }

    const parent=gini(n0,n1)
    let bestGain=-1,bestFeature=-1,bestThreshold=0
    const fs=sampleFeatures(rand,p,mtry)

    for (let z=0;z<fs.length;z++) {
      const feature=fs[z]
      let min=Infinity,max=-Infinity
      for (const i of idx) {
        const v=x[i*p+feature]
        if (v<min) min=v
        if (v>max) max=v
      }
      if (!(max>min)) continue
      const threshold=min+rand()*(max-min)
      let l0=0,l1=0,r0=0,r1=0
      for (const i of idx) {
        const left=x[i*p+feature] <= threshold
        if (left) { if (y[i]) l1++; else l0++ }
        else { if (y[i]) r1++; else r0++ }
      }
      const ln=l0+l1,rn=r0+r1
      if (ln<spec.minLeaf || rn<spec.minLeaf) continue
      const gain=parent-(ln/n)*gini(l0,l1)-(rn/n)*gini(r0,r1)
      if (gain>bestGain) {
        bestGain=gain; bestFeature=feature; bestThreshold=threshold
      }
    }

    if (bestFeature<0) return {leaf:true,prob}
    const left=[],right=[]
    for (const i of idx) {
      if (x[i*p+bestFeature] <= bestThreshold) left.push(i)
      else right.push(i)
    }
    return {
      leaf:false, feature:bestFeature, threshold:bestThreshold,
      left:recurse(left,depth+1), right:recurse(right,depth+1),
    }
  }

  return recurse(Array.from({length:matrix.n},(_,i)=>i),0)
}

function predictTree(tree,matrix,row) {
  let node=tree
  while (!node.leaf) {
    node=matrix.x[row*matrix.p+node.feature] <= node.threshold ? node.left : node.right
  }
  return node.prob
}

function forestProb(train,validation,spec,specIndex) {
  const probs=new Float64Array(validation.n)
  for (let k=0;k<N_TREES;k++) {
    const tree=buildTree(train,spec,SEED+specIndex*100003+k*997)
    for (let i=0;i<validation.n;i++) probs[i]+=predictTree(tree,validation,i)
  }
  for (let i=0;i<validation.n;i++) probs[i]/=N_TREES
  return probs
}

function fullAccuracy(prob,y) {
  let correct=0
  for (let i=0;i<y.length;i++) if ((prob[i]>=0.5?1:0)===y[i]) correct++
  return correct/y.length
}

function evaluateSelection(prob,validation,mode,threshold) {
  let n=0,correct=0,firstN=0,firstCorrect=0,secondN=0,secondCorrect=0
  for (let i=0;i<validation.n;i++) {
    const score=prob[i]
    let selected=false,pred=0
    if (mode==='two_sided') { selected=score>=threshold || score<=1-threshold; pred=score>=threshold?1:0 }
    else if (mode==='over_only') { selected=score>=threshold; pred=1 }
    else { selected=score<=1-threshold; pred=0 }
    if (!selected) continue
    const ok=pred===validation.y[i]
    n++; if (ok) correct++
    if (validation.day[i]<=15) { firstN++; if (ok) firstCorrect++ }
    else { secondN++; if (ok) secondCorrect++ }
  }
  if (n<INTERNAL_N_MIN || firstN<INTERNAL_HALF_N_MIN || secondN<INTERNAL_HALF_N_MIN) return null
  const accuracy=correct/n
  const firstAccuracy=firstCorrect/firstN
  const secondAccuracy=secondCorrect/secondN
  const worstHalfAccuracy=Math.min(firstAccuracy,secondAccuracy)
  return {
    mode,threshold,n,correct,accuracy,
    first_half:{n:firstN,correct:firstCorrect,accuracy:firstAccuracy},
    second_half:{n:secondN,correct:secondCorrect,accuracy:secondAccuracy},
    worst_half_accuracy:worstHalfAccuracy,
    min_half_n:Math.min(firstN,secondN),
    passes_internal_gate:accuracy>=INTERNAL_ACC_MIN && worstHalfAccuracy>=INTERNAL_WORST_HALF_MIN,
  }
}

const [trainRows,juneRows]=await Promise.all([
  fetchRows('2025-04-01','2025-06-01'),
  fetchRows('2025-06-01','2025-07-01'),
])
if (trainRows.length!==769 || juneRows.length!==381) {
  throw new Error(`V26_SPLIT_COUNT_MISMATCH:${trainRows.length}:${juneRows.length}`)
}

const features=Object.keys(trainRows[0] ?? {}).filter(k=>!META.has(k)).sort()
const leaked=features.filter(k=>FORBIDDEN.has(k))
if (leaked.length) throw new Error('FORBIDDEN_FEATURES_PRESENT:'+leaked.join(','))

const med=medians(trainRows,features)
const train=toMatrix(trainRows,features,med)
const june=toMatrix(juneRows,features,med)
const allSpecs=specs()
const summaries=[]
const gateCandidates=[]

for (let s=0;s<allSpecs.length;s++) {
  const spec=allSpecs[s]
  console.log('V26_SPEC_START',s,JSON.stringify(spec))
  const prob=forestProb(train,june,spec,s)
  const candidates=[]
  for (const mode of MODES) {
    for (const threshold of THRESHOLDS) {
      const c=evaluateSelection(prob,june,mode,threshold)
      if (c) candidates.push(c)
    }
  }
  candidates.sort((a,b)=>b.accuracy-a.accuracy || b.worst_half_accuracy-a.worst_half_accuracy || b.n-a.n)
  const passes=candidates.filter(x=>x.passes_internal_gate)
  for (const c of passes) gateCandidates.push({spec_index:s,spec,...c})
  summaries.push({
    spec_index:s,
    spec,
    full_june_accuracy_at_0_5:fullAccuracy(prob,june.y),
    gate_pass_count:passes.length,
    best_candidate:candidates[0] ?? null,
    best_gate_candidate:passes[0] ?? null,
  })
  console.log('V26_SPEC_DONE',s,JSON.stringify(summaries[s]))
}

gateCandidates.sort((a,b)=>b.accuracy-a.accuracy || b.worst_half_accuracy-a.worst_half_accuracy || b.n-a.n)
const selected=gateCandidates[0] ?? null
const status=selected ? 'INTERNAL_JUNE_GATE_PASSED_PREGATE_NOT_OPENED' : 'REJECTED_INTERNAL_JUNE_GATE'

const formulaSpec={
  family:'deterministic_extra_trees_style',
  n_estimators:N_TREES,
  bootstrap:false,
  split_rule:'one_random_threshold_per_sampled_feature_per_node_best_gini_gain',
  seed:SEED,
  feature_count:features.length,
  spec_grid:allSpecs,
  threshold_modes:MODES,
  thresholds:THRESHOLDS,
  forbidden_feature_check:'PASS',
  jul_aug_queried:false,
  external_2026_queried:false,
}
const developmentMetrics={
  train_period:'2025-04-01/2025-05-31',
  internal_validation_period:'2025-06-01/2025-06-30',
  train_rows:train.n,
  june_rows:june.n,
  internal_gate:{
    accuracy_min:INTERNAL_ACC_MIN,
    worst_half_accuracy_min:INTERNAL_WORST_HALF_MIN,
    n_min:INTERNAL_N_MIN,
    half_n_min:INTERNAL_HALF_N_MIN,
  },
  specs_tried:allSpecs.length,
  internal_gate_candidate_count:gateCandidates.length,
  selected_candidate_before_pregate:selected,
  spec_summaries:summaries,
  feature_median_imputation_fit_on:'Apr-May only',
  jul_aug_status:selected ? 'AUTHORIZED_NEXT_STEP_NOT_YET_OPENED' : 'NOT_OPENED',
  external_2026_status:'NOT_OPENED',
  odds_api_historical_credits_consumed:0,
}

const { error: upsertError } = await supabase.from(REGISTRY).upsert({
  candidate_name:CANDIDATE,
  branch_type:'PREGAME',
  market:'total',
  target_line_role:'closing',
  formula_spec:formulaSpec,
  development_metrics:developmentMetrics,
  holdout_metrics:null,
  full_2025_metrics:null,
  status,
  selected_using:'Apr-May train; June internal gate only; Jul-Aug unopened unless gate passes; 2026 unopened',
  research_only:true,
  official_picks_writes:false,
  apostar_activation:false,
  external_2026_metrics:null,
},{onConflict:'candidate_name'})

if (upsertError) throw new Error('V26_REGISTRY_UPSERT_FAILED:'+upsertError.message)

console.log('V26_INTERNAL_EVAL_COMPLETE',JSON.stringify({
  candidate_name:CANDIDATE,
  status,
  feature_count:features.length,
  specs_tried:allSpecs.length,
  internal_gate_candidate_count:gateCandidates.length,
  selected_candidate_before_pregate:selected,
  odds_api_historical_credits_consumed:0,
  jul_aug_opened:false,
  external_2026_opened:false,
}))
