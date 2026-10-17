import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_batter_strikeouts_line_surface_v1.json','utf8'))

test('batter K line surface preserves boundaries and replay checksums',()=>{
  assert.equal(a.contract,'MLB_BATTER_STRIKEOUTS_LINE_SURFACE_V1/1.0.0')
  assert.equal(a.external_refit_2025.n,40886)
  assert.equal(a.external_refit_2025.intercept,0.243436273584974)
  assert.equal(a.external_refit_2025.slope,0.713440597820141)
  assert.equal(a.control.development_2025.n,592)
  assert.equal(a.control.development_2025.wins,564)
  assert.equal(a.control.external_2026.n,1074)
  assert.equal(a.control.external_2026.wins,1000)
  assert.equal(a.control.replay_exact,true)
  assert.equal(a.provider_calls_made,0)
  assert.equal(a.odds_api_historical_credits_consumed,0)
  assert.equal(a.official_picks_writes,0)
  assert.equal(a.apostar_activation,false)
  assert.equal(a.production_promotion,false)
})

test('O0.5 remains frozen after external miss',()=>{
  const r=a.new_candidates.find(x=>x.line===0.5&&x.side==='OVER')
  assert(r)
  assert(r.development_2025.accuracy>=0.75)
  assert(r.external_2026.accuracy<0.75)
  assert.equal(r.state,'EXTERNAL_BELOW_75_NO_RETUNE')
})
