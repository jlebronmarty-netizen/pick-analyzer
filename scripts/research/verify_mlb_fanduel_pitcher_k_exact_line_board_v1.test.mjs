import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const sql = fs.readFileSync('scripts/research/mlb_fanduel_pitcher_k_exact_line_board_v1.sql','utf8')
const contract = JSON.parse(fs.readFileSync('contracts/MLB_FANDUEL_PITCHER_K_EXACT_LINE_BOARD_V1.json','utf8'))

test('FanDuel K board preserves exact-line frozen contracts', () => {
  assert.equal(contract.status, 'RESEARCH_ONLY')
  assert.equal(contract.sportsbook, 'fanduel')
  assert.equal(contract.market, 'pitcher_strikeouts')
  assert.equal(contract.minimum_prior_starts, 5)
  assert.equal(contract.strict_pregame, true)
  assert.equal(contract.historical_odds_api_credits, 0)
  assert.deepEqual(
    contract.stable_contracts.map(x => [x.line,x.side,x.threshold]),
    [[3.5,'OVER',4.25],[6.5,'UNDER',4.5],[7.5,'UNDER',5.5],[8.5,'UNDER',4.75]]
  )
})

test('SQL is strict pregame, exact identity, no DML', () => {
  assert.match(sql, /lower\(s\.sportsbook\)='fanduel'/)
  assert.match(sql, /s\.snapshot_time < \(s\.metadata->>'targetStart'\)::timestamptz/)
  assert.match(sql, /pitcherMlbamId/)
  assert.match(sql, /h\.game_date < \(select target_date from params\)/)
  assert.doesNotMatch(sql, /\binsert\b|\bupdate\b|\bdelete\b/i)
})

test('same-opponent history is display-only and rules are not retuned', () => {
  assert.equal(contract.same_opponent_history.role, 'DISPLAY_ONLY_CONTEXT')
  assert.equal(contract.same_opponent_history.affects_selection, false)
  assert.ok(contract.forbidden.includes('threshold retuning'))
  assert.match(sql, /same_opponent_prior_starts/)
  assert.match(sql, /stable_contract/)
})
