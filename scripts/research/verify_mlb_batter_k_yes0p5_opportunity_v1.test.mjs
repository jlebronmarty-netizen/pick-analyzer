import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_batter_k_yes0p5_opportunity_v1.json','utf8'))
const sql=fs.readFileSync('scripts/research/mlb_batter_k_yes0p5_opportunity_v1.sql','utf8')
test('exact YES contract frozen before OOS',()=>{
  assert.equal(a.market,'batter_strikeouts')
  assert.equal(a.exact_line,0.5)
  assert.equal(a.side,'YES')
  assert.equal(a.rule.prior_k_per_pa_min,0.30)
  assert.equal(a.rule.prior_pa_per_game_min,3.75)
  assert.equal(a.external_2026.opened,true)
  assert.equal(a.external_2026.threshold_retuned,false)
})
test('development gate passes',()=>{
  assert.equal(a.development_2025.n,1270)
  assert.equal(a.development_2025.wins,958)
  assert(a.development_2025.accuracy>=0.75)
  assert(a.development_2025.lift_pp>=5)
  assert(a.development_2025.worst_month>=0.65)
})
test('1.5 YES is closed',()=>{
  assert.equal(a.line_1p5_closeout.passing_threshold_count,0)
})
test('strict-date and research boundaries',()=>{
  assert.equal(a.rule.same_date_history_allowed,false)
  assert.equal(a.boundaries.yes_side_not_aliased_to_over,true)
  assert.match(sql,/season=2025/)
  assert.doesNotMatch(sql,/2026/)
  assert.doesNotMatch(sql,/\b(insert|update|delete|merge|create|alter|drop|truncate)\b/i)
})

test('untouched 2026 OOS fails stability and remains closed',()=>{
  assert(a.external_2026.accuracy>=0.75)
  assert(a.external_2026.lift_pp>=5)
  assert(a.external_2026.worst_month<0.65)
  assert.equal(a.external_2026.state,'EXTERNAL_75_PLUS_STABILITY_FAIL_NO_RETUNE')
})
