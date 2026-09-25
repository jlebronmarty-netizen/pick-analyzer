import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_tb_u1p5_low_volume_v1.json','utf8'))
const sql=fs.readFileSync('scripts/research/mlb_tb_u1p5_low_volume_v1.sql','utf8')

test('contract is exact and frozen before OOS',()=>{
  assert.equal(a.market,'batter_total_bases')
  assert.equal(a.exact_line,1.5)
  assert.equal(a.side,'UNDER')
  assert.equal(a.rule.threshold,3.5)
  assert.equal(a.external_2026.opened,false)
})

test('2025 development gate passes',()=>{
  assert.equal(a.development_2025.n,9813)
  assert.equal(a.development_2025.wins,7406)
  assert(a.development_2025.accuracy>=0.75)
  assert(a.development_2025.lift_pp>=5)
  assert(a.development_2025.months>=5)
  assert(a.development_2025.worst_month>=0.65)
})

test('same-date leakage is forbidden and SQL is read-only 2025-only',()=>{
  assert.equal(a.rule.same_date_history_allowed,false)
  assert.equal(a.rule.source_game_date_rule,'source_game_date < target_game_date')
  assert.match(sql,/season=2025/)
  assert.doesNotMatch(sql,/2026/)
  assert.doesNotMatch(sql,/\b(insert|update|delete|merge|create|alter|drop|truncate)\b/i)
})

test('failed projection architecture remains closed',()=>{
  assert.equal(a.prior_failed_architecture.state,'EXTERNAL_BELOW_75_NO_RETUNE')
  assert.equal(a.boundaries.no_threshold_rescue,true)
  assert.equal(a.boundaries.no_2026_outcomes_used_for_selection,true)
})
