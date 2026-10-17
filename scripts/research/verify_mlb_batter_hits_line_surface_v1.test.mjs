import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_batter_hits_line_surface_v1.json','utf8'))
test('batter hits replay and boundaries',()=>{
  assert.equal(a.external_refit_2025.n,40886)
  assert.equal(a.external_refit_2025.intercept,0.362037519693316)
  assert.equal(a.external_refit_2025.slope,0.562031288216736)
  assert.equal(a.development_control.n,7011)
  assert.equal(a.development_control.wins,6123)
  assert.equal(a.external_control.n,9833)
  assert.equal(a.external_control.wins,8496)
  assert.equal(a.provider_calls_made,0)
  assert.equal(a.odds_api_historical_credits_consumed,0)
  assert.equal(a.official_picks_writes,0)
  assert.equal(a.apostar_activation,false)
  assert.equal(a.production_promotion,false)
})
test('broader U1.5 does not replace champion',()=>{
  const r=a.new_candidates[0]
  assert(r.development_2025.lift_pp>=5)
  assert(r.external_2026.accuracy>=0.75)
  assert(r.external_2026.lift_pp<5)
  assert.equal(r.state,'EXTERNAL_75_PLUS_LIFT_BELOW_5PP_NO_REPLACE')
})
