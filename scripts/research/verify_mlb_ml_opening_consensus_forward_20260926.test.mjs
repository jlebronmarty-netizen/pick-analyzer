import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_ml_opening_consensus_forward_20260926.json','utf8'))
const s=fs.readFileSync('scripts/research/mlb_ml_opening_consensus_forward_settlement_20260926.mjs','utf8')

test('exact frozen forward crossing',()=>{
  assert.equal(a.candidate_count,1)
  const c=a.candidates[0]
  assert.equal(c.game_pk,824543)
  assert.equal(c.pick,'CWS')
  assert(c.opening_market.consensus_home_probability>=0.65)
  assert.equal(c.fundamentals.aligned,6)
  assert.equal(c.fundamentals.required,6)
})

test('strict-pregame lineage is preserved',()=>{
  const c=a.candidates[0]
  assert.equal(c.fundamentals.feature_cutoff_date,'2026-09-25')
  assert.equal(c.strict_pregame.feature_cutoff_before_target,true)
  assert.equal(c.strict_pregame.opening_before_first_pitch,true)
  assert.equal(c.strict_pregame.actual_winner_at_freeze,null)
  assert.equal(c.strict_pregame.same_day_outcome_used,false)
})

test('formula remains frozen despite external gate failure',()=>{
  assert.equal(a.formula_state,'EXTERNAL_ACCURACY_PASS_N_AND_STABILITY_FAIL_NO_RETUNE')
  assert.equal(a.boundaries.no_threshold_retune,true)
  assert.equal(a.boundaries.no_side_change,true)
  assert.equal(a.boundaries.no_vendor_change,true)
  assert.equal(a.boundaries.no_feature_change,true)
})

test('settlement waits for MLB final and cannot recompute formula',()=>{
  assert.match(s,/PENDING_GAME_NOT_FINAL/)
  assert.match(s,/api\/v1\.1\/game/)
  assert.doesNotMatch(s,/favorite_probability|aligned_votes|0\.65/)
})
