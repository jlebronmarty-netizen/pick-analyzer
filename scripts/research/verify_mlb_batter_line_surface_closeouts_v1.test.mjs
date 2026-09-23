import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('artifacts/research/mlb_batter_line_surface_closeouts_v1.json','utf8'))
const hrrbi = JSON.parse(fs.readFileSync('artifacts/research/mlb_batter_hrrbi_line_surface_v1.json','utf8'))

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
  assert.equal(
    artifact.additional_market_audit_2026_09_22.batter_hits_runs_rbis.state,
    'EXACT_REPLAY_RECOVERED_DEVELOPMENT_GATE_PASS_EXTERNAL_GATE_CLOSED'
  )
})

test('research boundaries remain closed', () => {
  assert.equal(artifact.boundaries.odds_api_historical_credits_consumed,0)
  assert.equal(artifact.boundaries.official_picks_writes,0)
  assert.equal(artifact.boundaries.apostar_activation,false)
  assert.equal(artifact.boundaries.production_promotion,false)
})

test('Total Bases exact replay and frozen external failures are preserved', () => {
  const r = replay('batter_total_bases')
  assert.equal(r.observed.n,1187)
  assert.equal(r.observed.wins,1081)
  assert.equal(r.status,'EXACT_REPLAY_PASS')
  assert.equal(surface('batter_total_bases','U1.5').state,'EXTERNAL_BELOW_75_NO_RETUNE')
  assert.equal(surface('batter_total_bases','U2.5').state,'EXTERNAL_LIFT_BELOW_5PP_DO_NOT_REPLACE_EXISTING')
  assert.equal(surface('batter_total_bases','U3.5').state,'EXTERNAL_75_PLUS_LIFT_BELOW_5PP_NO_PROMOTE')
})

test('RBI remains closed and HRRBI development gate is frozen', () => {
  assert.equal(artifact.rbi_hrrbi_line_surface_admission.batter_rbis.state,'NO_NEW_EXACT_LINE_TO_EXPAND')
  assert.equal(artifact.rbi_hrrbi_line_surface_admission.batter_hits_runs_rbis.exact_replay.parity,true)
  assert.equal(
    artifact.rbi_hrrbi_line_surface_admission.batter_hits_runs_rbis.state,
    'DEVELOPMENT_GATE_PASS_2026_ATTEMPT_BLOCKED_SOURCE_SNAPSHOT_DRIFT'
  )
  assert.equal(hrrbi.external_2026.authorized,true)
  assert.equal(hrrbi.external_2026.attempted,true)
  assert.equal(hrrbi.external_2026.evaluation_completed,false)
  assert.equal(hrrbi.external_2026.status,'BLOCKED_EXACT_SOURCE_SNAPSHOT_DRIFT')
  assert.equal(hrrbi.results.find((x) => x.line === 0.5 && x.direction === 'UNDER').projection_max,0.05)
  assert.equal(hrrbi.results.find((x) => x.line === 1.5 && x.direction === 'UNDER').projection_max,0.9)
})

test('Pitcher Hits Allowed remains blocked on exact MLB Official corpus replay', () => {
  const row = artifact.blocked_exact_replay.find((x) => x.market === 'pitcher_hits_allowed')
  assert(row)
  assert.equal(row.frozen_refit.n,3099)
  assert.equal(row.failed_reconstruction.eligible_n,3334)
  assert.equal(row.failed_reconstruction.parity,false)
  assert.equal(row.state,'LINE_SURFACE_BLOCKED_EXACT_REPLAY_MLB_OFFICIAL_GAMELOG_CORPUS_NOT_PERSISTED')
})
