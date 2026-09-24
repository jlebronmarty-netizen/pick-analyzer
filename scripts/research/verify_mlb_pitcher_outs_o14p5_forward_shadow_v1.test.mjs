import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const contract=JSON.parse(fs.readFileSync('contracts/MLB_PITCHER_OUTS_O14P5_FORWARD_SHADOW_V1.json','utf8'))
const sql=fs.readFileSync('scripts/research/mlb_pitcher_outs_o14p5_forward_shadow_v1.sql','utf8')
const doc=fs.readFileSync('docs/research/MLB_PITCHER_OUTS_O14P5_FORWARD_SHADOW_V1.md','utf8')

test('contract is exact O14.5 only',()=>{
  assert.equal(contract.market,'pitcher_outs')
  assert.equal(contract.exact_line,14.5)
  assert.equal(contract.side,'OVER')
  assert.equal(contract.threshold,15.75)
})

test('forward evaluator is read-only and strict pregame',()=>{
  assert.doesNotMatch(sql,/\b(insert|update|delete|merge|create|alter|drop|truncate)\b/i)
  assert.match(sql,/s\.line::numeric=14\.5/)
  assert.match(sql,/lower\(s\.outcome\)='over'/)
  assert.match(sql,/snapshot_time < \(s\.metadata->>'targetStart'\)::timestamptz/)
})

test('price is collected without EV claim',()=>{
  assert.equal(contract.price_policy.calculate_ev,false)
  assert.match(doc,/no EV is calculated/i)
})

test('research boundaries stay closed',()=>{
  assert.equal(contract.research_only,true)
  assert.equal(contract.production_eligible,false)
  assert.equal(contract.official_picks_eligible,false)
  assert.equal(contract.apostar_enabled,false)
  assert.equal(contract.boundaries.no_threshold_retuning,true)
  assert.equal(contract.boundaries.no_line_extrapolation,true)
})
