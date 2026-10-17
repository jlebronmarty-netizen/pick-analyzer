import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_batter_tb_u1p5_low_volume_v1.json','utf8'))
const sql=fs.readFileSync('scripts/research/mlb_batter_tb_u1p5_low_volume_v1.sql','utf8')
const doc=fs.readFileSync('docs/research/MLB_BATTER_TB_U1P5_LOW_VOLUME_V1.md','utf8')

test('contract is exact and research-only',()=>{
  assert.equal(a.market,'batter_total_bases')
  assert.equal(a.exact_line,1.5)
  assert.equal(a.side,'UNDER')
  assert.equal(a.frozen_rule.prior_pa_per_game_max,3.5)
  assert.equal(a.research_only,true)
  assert.equal(a.production_eligible,false)
  assert.equal(a.official_picks_eligible,false)
  assert.equal(a.apostar_enabled,false)
})

test('development champion was frozen before external read',()=>{
  assert.equal(a.development_2025.selected_n,9813)
  assert.equal(a.development_2025.wins,7406)
  assert(a.development_2025.accuracy>=0.75)
  assert(a.development_2025.lift_pp>=5)
  assert(a.development_2025.worst_month>=0.65)
  assert.equal(a.selection_protocol.no_retune_after_external,true)
})

test('2026 external passes unchanged rule',()=>{
  assert.equal(a.external_2026.selected_n,12142)
  assert.equal(a.external_2026.wins,9145)
  assert(a.external_2026.accuracy>=0.75)
  assert(a.external_2026.lift_pp>=5)
  assert(a.external_2026.worst_month>=0.65)
  assert.equal(a.external_2026.state,'EXTERNAL_75_PLUS_STABLE_PASS')
})

test('coverage gain is measured against frozen daily baseline',()=>{
  assert.equal(a.coverage_impact_if_added_to_research_board.baseline_row_coverage_pct,8.72)
  assert.equal(a.coverage_impact_if_added_to_research_board.new_row_coverage_pct,9.99)
  assert.equal(a.coverage_impact_if_added_to_research_board.row_coverage_delta_pp,1.27)
  assert.equal(a.market_first_2026_09_25.qualifying_player_games,2)
})

test('SQL is read-only and strict-date safe',()=>{
  assert.doesNotMatch(sql,/\b(insert|update|delete|merge|create|alter|drop|truncate)\b/i)
  assert.match(sql,/rows between unbounded preceding and 1 preceding/)
  assert.match(sql,/game_date<current_date/)
  assert.match(doc,/Game 1 of a doubleheader never enters Game 2/)
})
