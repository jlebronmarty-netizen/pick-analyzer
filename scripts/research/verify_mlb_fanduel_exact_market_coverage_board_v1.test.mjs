import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
const sql=fs.readFileSync('scripts/research/mlb_fanduel_exact_market_coverage_board_v1.sql','utf8')
const contract=JSON.parse(fs.readFileSync('contracts/MLB_FANDUEL_EXACT_MARKET_COVERAGE_BOARD_V1.json','utf8'))
test('coverage board is FanDuel exact-side only',()=>{
  assert.equal(contract.sportsbook,'fanduel')
  assert.match(sql,/lower\(sportsbook\)='fanduel'/)
  assert.match(sql,/EXACT_SIDE_AVAILABLE/)
  assert.match(sql,/OPPOSITE_SIDE_ONLY/)
  assert.doesNotMatch(sql,/\binsert\b|\bupdate\b|\bdelete\b/i)
})
