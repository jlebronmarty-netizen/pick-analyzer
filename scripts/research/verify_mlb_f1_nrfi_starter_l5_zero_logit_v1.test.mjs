import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_f1_nrfi_starter_l5_zero_logit_v1.json','utf8'))

test('starter-L5 NRFI zero-logit remains a failed frozen gate',()=>{
  assert.equal(a.contract,'MLB_F1_NRFI_STARTER_L5_ZERO_LOGIT_V1/1.0.0')
  assert.equal(a.source.source_rows,2663)
  assert.equal(a.result.eligible,1563)
  assert.equal(a.result.selected,0)
  assert.equal(a.result.accuracy,null)
  assert.equal(a.result.coverage,0)
  assert.equal(a.result.development_gate_pass,false)
  assert.equal(a.result.external_opened,false)
  assert(a.result.probability_nrfi_range[1] < 0.75)
})

test('starter-L5 NRFI freeze and boundaries remain intact',()=>{
  assert.equal(a.frozen_before_evaluation.l2_lambda,8)
  assert.equal(a.frozen_before_evaluation.probability_threshold,0.75)
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
