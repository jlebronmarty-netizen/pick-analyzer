import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_f1_nrfi_factorized_v1_result.json','utf8'))

test('factorized NRFI frozen result remains fail-closed',()=>{
  assert.equal(a.contract,'MLB_F1_NRFI_FACTORIZED_V1/1.0.0')
  assert.equal(a.source_rows,4683)
  assert.equal(a.eligible,3188)
  assert.equal(a.selected,0)
  assert.equal(a.accuracy,null)
  assert.equal(a.coverage,0)
  assert.equal(a.development_gate_pass,false)
  assert.equal(a.external_opened,false)
  assert.equal(a.state,'DEVELOPMENT_GATE_FAILED_NO_EXTERNAL')
})

test('factorized NRFI research boundaries remain closed',()=>{
  assert.equal(a.provider_calls_made,0)
  assert.equal(a.odds_api_historical_credits_consumed,0)
  assert.equal(a.official_picks_writes,0)
  assert.equal(a.apostar_activation,false)
  assert.equal(a.production_promotion,false)
  assert.equal(a.tracker_modified,false)
})
