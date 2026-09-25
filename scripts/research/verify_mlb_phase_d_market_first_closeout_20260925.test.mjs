import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_phase_d_market_first_closeout_20260925.json','utf8'))
test('coverage improves materially without production changes',()=>{
  assert.equal(a.live_coverage_before_phase_d.row_coverage_pct,8.71)
  assert.equal(a.coverage_after_successes.row_coverage_pct,13.73)
  assert.equal(a.coverage_after_successes.row_coverage_delta_pp,5.02)
  assert.equal(a.coverage_after_successes.covered_surfaces,12)
})
test('three successful exact research expansions are preserved',()=>{
  assert.deepEqual(a.successful_expansions.map(x=>x.pr),[221,222,223])
})
test('Batter K YES0.5 remains closed on external stability',()=>{
  const x=a.failed_new_architectures.find(x=>x.market==='batter_strikeouts'&&x.line===0.5&&x.side==='YES')
  assert(x)
  assert(x.external_2026.accuracy>=0.75)
  assert(x.external_2026.worst_month<0.65)
  assert.equal(x.state,'EXTERNAL_75_PLUS_STABILITY_FAIL_NO_RETUNE')
})
test('methodology gate forbids threshold rescue and side aliasing',()=>{
  assert.equal(a.methodology_gate.state,'HIGH_VOLUME_SURFACES_EXHAUSTED_WITH_CURRENT_FEATURE_FAMILIES')
  assert(a.methodology_gate.prohibited_next_steps.includes('threshold rescue on failed surfaces'))
  assert(a.methodology_gate.prohibited_next_steps.includes('YES/OVER side aliasing'))
})
test('research boundaries remain closed',()=>{
  assert.equal(a.boundaries.official_picks_modified,false)
  assert.equal(a.boundaries.apostar_activated,false)
  assert.equal(a.boundaries.production_promotions,0)
  assert.equal(a.boundaries.historical_odds_api_calls,0)
  assert.equal(a.boundaries.tracker_modified,false)
})
