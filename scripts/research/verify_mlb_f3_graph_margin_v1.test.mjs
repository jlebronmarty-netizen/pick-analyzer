import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_f3_graph_margin_v1.json','utf8'))

test('F3 graph-margin result remains a failed frozen gate',()=>{
  assert.equal(a.contract,'MLB_F3_GRAPH_MARGIN_V1/1.0.0')
  assert.equal(a.source.source_rows,4680)
  assert.equal(a.result.eligible,3756)
  assert.equal(a.result.selected,12)
  assert.equal(a.result.nonpush_n,10)
  assert.equal(a.result.wins,6)
  assert.equal(a.result.pushes,2)
  assert.equal(a.result.accuracy,0.6)
  assert.equal(a.result.selected_months,3)
  assert.equal(a.result.development_gate_pass,false)
  assert.equal(a.result.external_opened,false)
})

test('F3 graph-margin safety and no-rescue boundaries remain intact',()=>{
  assert.equal(a.frozen_before_evaluation.ridge_lambda,12)
  assert.equal(a.frozen_before_evaluation.confidence_threshold,0.75)
  assert.equal(a.interpretation.retuned,false)
  assert.equal(a.interpretation.threshold_rescue,false)
  assert.equal(a.boundaries.provider_calls_made,0)
  assert.equal(a.boundaries.odds_api_historical_credits_consumed,0)
  assert.equal(a.boundaries.official_picks_writes,0)
  assert.equal(a.boundaries.apostar_activation,false)
  assert.equal(a.boundaries.production_promotion,false)
  assert.equal(a.boundaries.tracker_modified,false)
})
