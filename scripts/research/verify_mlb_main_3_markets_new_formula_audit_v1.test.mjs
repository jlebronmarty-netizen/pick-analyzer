import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_main_3_markets_new_formula_audit_v1.json','utf8'))

test('moneyline bounded new architecture fails permanent gate',()=>{
  assert(a.moneyline.best_pooled.accuracy>=0.75)
  assert(a.moneyline.best_pooled.n<60)
  assert(a.moneyline.best_n_ge_60.accuracy<0.75)
  assert.equal(a.moneyline.market_residual_followup.historical_2025_open_prob_rows,0)
})

test('favorite minus 1.5 new architecture fails while DOG V2 remains research path',()=>{
  assert(a.run_line.best_n_ge_60.accuracy<0.75)
  const union=a.run_line.surviving_existing_research.find(x=>x.id==='rl_v2_broad_union_fixed_v1')
  assert(union.development_accuracy>=0.75)
})

test('totals new run-prevention projection fails',()=>{
  assert.equal(a.totals.results.length,3)
  assert(a.totals.results.every(x=>x.accuracy<0.75))
  assert(a.totals.latest_v37.oof_accuracy<0.75)
})

test('boundaries remain closed',()=>{
  assert.equal(a.research_only,true)
  assert.equal(a.production_eligible,false)
  assert.equal(a.official_picks_eligible,false)
  assert.equal(a.apostar_enabled,false)
  assert.equal(a.boundaries.historical_odds_api_spend,0)
  assert.equal(a.boundaries.no_2026_threshold_rescue,true)
})

test('strict-prior bullpen workload follow-up fails all three main markets',()=>{
  const x=a.new_information_followup
  assert.equal(x.moneyline.state,'FAIL')
  assert(x.moneyline.best.accuracy<0.75)
  assert.equal(x.totals.state,'FAIL')
  assert(x.totals.best.accuracy<0.75)
  assert.equal(x.run_line_dog_p1p5.state,'FAIL')
  assert(x.run_line_dog_p1p5.best_n_ge_60.accuracy<0.75)
  assert.equal(x.disposition,'BULLPEN_WORKLOAD_CLOSED_FOR_MAIN_3_MARKETS_NO_SIGN_OR_THRESHOLD_REVERSAL')
})
