import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const artifact = JSON.parse(
  fs.readFileSync('artifacts/research/mlb_batter_hrrbi_line_surface_v1.json','utf8')
)

const result = (line,direction) =>
  artifact.results.find((row) => row.line === line && row.direction === direction)

test('HRRBI exact replay lineage remains frozen', () => {
  assert.equal(artifact.source.archive_sha256,'3d1e0e81d5913a635ae7a80366b811b777b832b488274124b4e38e04dd892753')
  assert.equal(artifact.exact_lineage.eligible_rows,58410)
  assert.equal(artifact.exact_lineage.plate_appearances,'Retrosheet b_pa exact')
  assert.equal(artifact.parity_controls.rbi_u0p5_proj_le_0p10.n,2402)
  assert.equal(artifact.parity_controls.rbi_u0p5_proj_le_0p10.wins,2053)
  assert.equal(artifact.parity_controls.hrrbi_u2p5_proj_le_0p70.n,2582)
  assert.equal(artifact.parity_controls.hrrbi_u2p5_proj_le_0p70.wins,2278)
})

test('HRRBI U0.5 development threshold is frozen', () => {
  const row = result(0.5,'UNDER')
  assert.equal(row.candidate_id,'batter_hrrbi_under_0p5_proj_0p05_v1')
  assert.equal(row.projection_max,0.05)
  assert.equal(row.development_2025.n,118)
  assert.equal(row.development_2025.wins,117)
  assert(row.development_2025.accuracy >= 0.75)
  assert(row.development_2025.lift_pp >= 5)
  assert(row.development_2025.months >= 5)
  assert(row.development_2025.worst_month >= 0.65)
  assert.equal(row.state,'DEVELOPMENT_GATE_PASS_EXTERNAL_GATE_CLOSED')
})

test('HRRBI U1.5 development threshold is frozen', () => {
  const row = result(1.5,'UNDER')
  assert.equal(row.candidate_id,'batter_hrrbi_under_1p5_proj_0p90_v1')
  assert.equal(row.projection_max,0.9)
  assert.equal(row.development_2025.n,4795)
  assert.equal(row.development_2025.wins,3607)
  assert(row.development_2025.accuracy >= 0.75)
  assert(row.development_2025.lift_pp >= 5)
  assert(row.development_2025.months >= 5)
  assert(row.development_2025.worst_month >= 0.65)
  assert.equal(row.state,'DEVELOPMENT_GATE_PASS_EXTERNAL_GATE_CLOSED')
})

test('HRRBI OVER 0.5 and OVER 1.5 remain closed', () => {
  assert.equal(result(0.5,'OVER').state,'NO_75_PLUS_STABLE_SIGNAL_CANDIDATE')
  assert.equal(result(1.5,'OVER').state,'NO_75_PLUS_STABLE_SIGNAL_CANDIDATE')
})

test('authorized 2026 gate fails closed on exact-source snapshot drift', () => {
  assert.equal(artifact.external_2026.authorized,true)
  assert.equal(artifact.external_2026.attempted,true)
  assert.equal(artifact.external_2026.evaluation_completed,false)
  assert.equal(artifact.external_2026.status,'BLOCKED_EXACT_SOURCE_SNAPSHOT_DRIFT')
  assert.deepEqual(artifact.external_2026.frozen_reference.control_u2p5.n,1255)
  assert.deepEqual(artifact.external_2026.frozen_reference.control_u2p5.wins,1073)
  assert.equal(artifact.external_2026.current_source_recovery.hrrbi_u2p5_control.n,1263)
  assert.equal(artifact.external_2026.current_source_recovery.hrrbi_u2p5_control.wins,1079)
  assert.equal(artifact.external_2026.current_source_recovery.parity,false)
  assert.equal(artifact.external_2026.decision,'FAIL_CLOSED_NO_U0P5_OR_U1P5_2026_SCORE')
  assert.equal(artifact.boundaries.official_picks_writes,0)
  assert.equal(artifact.boundaries.apostar_activation,false)
  assert.equal(artifact.boundaries.production_promotion,false)
  assert.equal(artifact.boundaries.odds_api_historical_credits_consumed,0)
  assert.equal(artifact.boundaries.provider_odds_calls,0)
  assert.equal(artifact.boundaries.tracker_modified,false)
})
