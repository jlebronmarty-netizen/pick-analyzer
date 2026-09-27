import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const contract=JSON.parse(fs.readFileSync('contracts/MLB_PITCHER_OUTS_O13P5_FORWARD_SHADOW_V1.json','utf8'))
const sql=fs.readFileSync('scripts/research/mlb_pitcher_outs_o13p5_forward_shadow_v1.sql','utf8')

test('O13.5 forward contract is exact and frozen',()=>{
  assert.equal(contract.exact_line,13.5)
  assert.equal(contract.side,'OVER')
  assert.equal(contract.threshold,16)
  assert.equal(contract.minimum_prior_starts,5)
  assert.equal(contract.research_only,true)
  assert.equal(contract.apostar_enabled,false)
})

test('O13.5 SQL is strict pregame and read only',()=>{
  assert.match(sql,/s\.line::numeric=13\.5/)
  assert.match(sql,/lower\(s\.outcome\)='over'/)
  assert.match(sql,/g\.game_date < \(select target_date from params\)/)
  assert.match(sql,/projection>=16\.00/)
  assert.doesNotMatch(sql,/\binsert\b|\bupdate\b|\bdelete\b/i)
})
