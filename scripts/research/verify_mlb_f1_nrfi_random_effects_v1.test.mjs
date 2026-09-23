import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_f1_nrfi_random_effects_v1.json','utf8'))

test('NRFI random-effects result is frozen as a failed development gate',()=>{
  assert.equal(a.contract,'MLB_F1_NRFI_RANDOM_EFFECTS_V1/1.0.0')
  assert.equal(a.source.source_rows,4683)
  assert.equal(a.result.eligible,2977)
  assert.equal(a.result.selected,2373)
  assert.equal(a.result.wins,1189)
  assert.equal(a.result.losses,1184)
  assert.equal(a.result.development_gate_pass,false)
  assert.equal(a.result.external_opened,false)
  assert.equal(a.result.state,'DEVELOPMENT_GATE_FAILED_NO_EXTERNAL')
  assert(a.result.accuracy<0.75)
  assert(a.result.worst_month_accuracy<0.65)
  assert(a.result.probability_range.max<0.75)
})

test('NRFI random-effects freeze and safety boundaries remain intact',()=>{
  assert.equal(a.frozen_before_evaluation.probability_threshold,0.75)
  assert.equal(a.frozen_before_evaluation.l2_pitcher,20)
  assert.equal(a.frozen_before_evaluation.l2_offense,20)
  assert.equal(a.interpretation.retuned,false)
  assert.equal(a.interpretation.threshold_rescue,false)
  assert.equal(a.boundaries.provider_calls_made,0)
  assert.equal(a.boundaries.odds_api_historical_credits_consumed,0)
  assert.equal(a.boundaries.official_picks_writes,0)
  assert.equal(a.boundaries.apostar_activation,false)
  assert.equal(a.boundaries.production_promotion,false)
  assert.equal(a.boundaries.tracker_modified,false)
})
