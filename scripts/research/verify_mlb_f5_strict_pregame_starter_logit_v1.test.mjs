import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_f5_strict_pregame_starter_logit_v1.json','utf8'))

test('F5 starter logit preserves pooled 75 but failed evidence gates',()=>{
  assert.equal(a.contract,'MLB_F5_STRICT_PREGAME_STARTER_LOGIT_V1/1.0.0')
  assert.equal(a.result.eligible,1562)
  assert.equal(a.result.selected,13)
  assert.equal(a.result.nonpush_n,12)
  assert.equal(a.result.wins,9)
  assert.equal(a.result.losses,3)
  assert.equal(a.result.pushes,1)
  assert.equal(a.result.accuracy,0.75)
  assert.equal(a.result.selected_months,3)
  assert.equal(a.result.worst_month_accuracy,0.625)
  assert.equal(a.result.development_gate_pass,false)
  assert.equal(a.result.state,'POOLED_75_INSUFFICIENT_SAMPLE_STABILITY_FAIL')
  assert.equal(a.result.external_opened,false)
})

test('F5 starter logit remains frozen with no rescue',()=>{
  assert.equal(a.frozen_before_evaluation.l2_lambda,8)
  assert.equal(a.frozen_before_evaluation.confidence_threshold,0.75)
  assert.equal(a.interpretation.retuned,false)
  assert.equal(a.interpretation.threshold_rescue,false)
  assert.equal(a.interpretation.feature_rescue,false)
  assert.equal(a.boundaries.provider_calls_made,0)
  assert.equal(a.boundaries.odds_api_historical_credits_consumed,0)
  assert.equal(a.boundaries.official_picks_writes,0)
  assert.equal(a.boundaries.apostar_activation,false)
  assert.equal(a.boundaries.production_promotion,false)
  assert.equal(a.boundaries.tracker_modified,false)
})
