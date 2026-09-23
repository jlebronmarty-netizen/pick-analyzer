import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_f5_strict_pregame_count_v1.json','utf8'))
test('F5 strict-pregame count remains failed',()=>{
  assert.equal(a.result.nonpush_n,34)
  assert.equal(a.result.wins,24)
  assert.equal(a.result.losses,10)
  assert.equal(a.result.pushes,3)
  assert(a.result.accuracy<0.75)
  assert(a.result.worst_month_accuracy<0.65)
  assert.equal(a.result.development_gate_pass,false)
  assert.equal(a.result.external_opened,false)
})
test('F5 count freeze remains intact',()=>{
  assert.equal(a.frozen_before_evaluation.confidence_threshold,0.75)
  assert.equal(a.frozen_before_evaluation.l2_lambda,8)
  assert.equal(a.interpretation.retuned,false)
  assert.equal(a.interpretation.threshold_rescue,false)
  assert.equal(a.interpretation.feature_rescue,false)
  assert.equal(a.boundaries.odds_api_historical_credits_consumed,0)
  assert.equal(a.boundaries.official_picks_writes,0)
  assert.equal(a.boundaries.apostar_activation,false)
  assert.equal(a.boundaries.production_promotion,false)
  assert.equal(a.boundaries.tracker_modified,false)
})
