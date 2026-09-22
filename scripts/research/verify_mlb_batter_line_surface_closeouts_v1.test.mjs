import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('artifacts/research/mlb_batter_line_surface_closeouts_v1.json','utf8'))

const replay = (market) => artifact.exact_replays.find((row) => row.market === market)
const surface = (market,target) => artifact.line_surface_results.find((row) => row.market === market && row.target === target)

test('Walks and HR controls reproduce exactly', () => {
  assert.deepEqual(replay('batter_walks').observed,{n:1489,wins:1253,accuracy:0.84150436534587})
  assert.equal(replay('batter_walks').status,'EXACT_REPLAY_PASS')
  assert.deepEqual(replay('batter_home_runs').observed,{n:12016,wins:11176,accuracy:0.930093209054594})
  assert.equal(replay('batter_home_runs').status,'EXACT_REPLAY_PASS')
})

test('alternate Walks and HR lines remain unpromoted', () => {
  for (const [market,target] of [['batter_walks','O0.5'],['batter_walks','O1.5'],['batter_home_runs','O0.5'],['batter_home_runs','O1.5']]) {
    assert.match(surface(market,target).state,/NO_75_PLUS/)
  }
  assert.match(surface('batter_walks','U1.5').state,/BASELINE_DOMINATED/)
  assert.match(surface('batter_home_runs','U1.5').state,/BASELINE_DOMINATED/)
})

test('Total Bases replay is exact and new lines fail frozen 2026 gates', () => {
  assert.deepEqual(replay('batter_total_bases').observed,{n:1187,wins:1081,accuracy:0.910699241786015})
  assert.equal(replay('batter_total_bases').status,'EXACT_REPLAY_PASS')
  assert.match(surface('batter_total_bases','U1.5').state,/BELOW_75/)
  assert.match(surface('batter_total_bases','U2.5').state,/LIFT_BELOW_5PP/)
  assert.match(surface('batter_total_bases','U3.5').state,/LIFT_BELOW_5PP/)
})

test('only Pitcher Hits Allowed remains an active traditional replay blocker', () => {
  assert.deepEqual(artifact.blocked_exact_replay.map((row) => row.market),['pitcher_hits_allowed'])
  assert.equal(artifact.additional_market_audit_2026_09_22.batter_hits_runs_rbis.state,'LINE_SURFACE_BLOCKED_EXACT_SOURCE_CORPUS_NOT_RECOVERED')
})

test('research boundaries remain closed', () => {
  assert.equal(artifact.boundaries.odds_api_historical_credits_consumed,0)
  assert.equal(artifact.boundaries.official_picks_writes,0)
  assert.equal(artifact.boundaries.apostar_activation,false)
  assert.equal(artifact.boundaries.production_promotion,false)
})
