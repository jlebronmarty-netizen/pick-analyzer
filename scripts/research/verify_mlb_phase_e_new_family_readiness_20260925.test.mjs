import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_phase_e_new_family_readiness_20260925.json','utf8'))

test('market-first admission remains required',()=>{
  assert.equal(a.admission_policy.market_first,true)
  assert.equal(a.admission_policy.require_real_quote_capture_before_formula_search,true)
  assert.equal(a.admission_policy.exact_market_line_side,true)
  assert.equal(a.admission_policy.no_threshold_rescue,true)
})

test('highest-priority families have non-dominant baseline headroom',()=>{
  const x=a.families.filter(f=>f.priority<=4)
  assert.deepEqual(x.map(f=>f.market),[
    'batter_extra_base_hits',
    'batter_runs_rbis',
    'batter_hits_runs_stolen_bases',
    'batter_hits_walks_stolen_bases'
  ])
})

test('runs and stolen-base under families are flagged for baseline dominance risk',()=>{
  const runs=a.families.find(f=>f.market==='batter_runs')
  const sb=a.families.find(f=>f.market==='batter_stolen_bases')
  assert(runs.under_baseline_2025>0.89)
  assert(sb.under_baseline_2025>0.93)
})

test('first home run stays blocked until ordered settlement exists',()=>{
  const x=a.families.find(f=>f.market==='batter_first_home_run')
  assert.equal(x.prospective_outcome_ready,false)
})

test('research boundaries remain closed',()=>{
  assert.equal(a.boundaries.no_official_picks,true)
  assert.equal(a.boundaries.apostar_disabled,true)
  assert.equal(a.boundaries.no_production_promotion,true)
  assert.equal(a.boundaries.no_historical_odds_api_spend,true)
})
