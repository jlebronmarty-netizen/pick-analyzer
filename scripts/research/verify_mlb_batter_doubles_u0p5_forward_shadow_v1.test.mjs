import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const contract=JSON.parse(fs.readFileSync('contracts/MLB_BATTER_DOUBLES_U0P5_FORWARD_SHADOW_V1.json','utf8'))
const sql=fs.readFileSync('scripts/research/mlb_batter_doubles_u0p5_forward_shadow_v1.sql','utf8')
const doc=fs.readFileSync('docs/research/MLB_BATTER_DOUBLES_U0P5_FORWARD_SHADOW_V1.md','utf8')

test('exact contract is frozen',()=>{
  assert.equal(contract.market,'batter_doubles')
  assert.equal(contract.exact_line,0.5)
  assert.equal(contract.side,'UNDER')
  assert.equal(contract.threshold,0.16)
})

test('query is read-only and strict pregame',()=>{
  assert.doesNotMatch(sql,/\b(insert|update|delete|merge|create|alter|drop|truncate)\b/i)
  assert.match(sql,/mlb_statcast_batter_sdt_game_mv/)
  assert.match(sql,/s\.line::numeric=0\.5/)
  assert.match(sql,/snapshot_time < \(s\.metadata->>'targetStart'\)::timestamptz/)
})

test('price is collected without EV substitution',()=>{
  assert.equal(contract.price_policy.calculate_ev,false)
  assert.match(doc,/No EV is calculated/)
})

test('research boundaries remain closed',()=>{
  assert.equal(contract.research_only,true)
  assert.equal(contract.production_eligible,false)
  assert.equal(contract.official_picks_eligible,false)
  assert.equal(contract.apostar_enabled,false)
})
