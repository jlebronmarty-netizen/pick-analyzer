import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_f1_strict_pregame_logit_v1.json','utf8'))

test('strict-pregame F1 logit remains insufficient sample',()=>{
  assert.equal(a.contract,'MLB_F1_STRICT_PREGAME_LOGIT_V1/1.0.0')
  assert.equal(a.result.eligible,2702)
  assert.equal(a.result.selected,2)
  assert.equal(a.result.nonpush_n,2)
  assert.equal(a.result.wins,2)
  assert.equal(a.result.selected_months,2)
  assert.equal(a.result.development_gate_pass,false)
  assert.equal(a.result.state,'INSUFFICIENT_SAMPLE_NO_PROMOTION')
  assert.equal(a.result.external_opened,false)
})

test('strict-pregame F1 logit freeze remains intact',()=>{
  assert.equal(a.frozen_before_evaluation.confidence_threshold,0.75)
  assert.equal(a.frozen_before_evaluation.l2_lambda,8)
  assert.equal(a.interpretation.retuned,false)
  assert.equal(a.interpretation.threshold_rescue,false)
  assert.equal(a.boundaries.odds_api_historical_credits_consumed,0)
  assert.equal(a.boundaries.official_picks_writes,0)
  assert.equal(a.boundaries.apostar_activation,false)
  assert.equal(a.boundaries.production_promotion,false)
  assert.equal(a.boundaries.tracker_modified,false)
})
