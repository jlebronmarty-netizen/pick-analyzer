import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const artifact = JSON.parse(
  fs.readFileSync('artifacts/research/mlb_pitcher_hits_allowed_line_surface_recovery_v1.json','utf8')
)

test('certified Hits Allowed runtime reference remains frozen', () => {
  assert.equal(artifact.certified_runtime_reference.candidate_id,'pitcher_hits_allowed_under_6p5_proj_5p0_v1')
  assert.equal(artifact.certified_runtime_reference.frozen_refit_2025.n,3099)
  assert.equal(artifact.certified_runtime_reference.frozen_refit_2025.intercept,2.97876810879942)
  assert.equal(artifact.certified_runtime_reference.frozen_refit_2025.slope,0.415326852941172)
  assert.equal(artifact.certified_runtime_reference.frozen_control_2025.n,761)
  assert.equal(artifact.certified_runtime_reference.frozen_control_2025.wins,634)
  assert.equal(artifact.certified_runtime_reference.runtime_parity_certified,true)
})

test('recovery attempts fail exact parity and do not authorize line search', () => {
  assert.equal(artifact.source_recovery_attempts[0].reconstructed_refit.n,3404)
  assert.equal(artifact.source_recovery_attempts[0].parity,false)
  assert.equal(artifact.source_recovery_attempts[1].reconstructed_refit_all_eligible.n,3395)
  assert.equal(artifact.source_recovery_attempts[1].reconstructed_refit_may_sep.n,3277)
  assert.equal(artifact.source_recovery_attempts[1].parity,false)
  assert.equal(
    artifact.state,
    'LINE_SURFACE_BLOCKED_EXACT_FROZEN_ROWSET_NOT_PERSISTED_CURRENT_SOURCE_DRIFT'
  )
  assert.equal(
    artifact.decision,
    'NO_ALTERNATE_LINE_SEARCH_ON_APPROXIMATE_OR_DRIFTED_CORPUS'
  )
})

test('research boundaries remain closed', () => {
  assert.equal(artifact.boundaries.official_picks_writes,0)
  assert.equal(artifact.boundaries.apostar_activation,false)
  assert.equal(artifact.boundaries.production_promotion,false)
  assert.equal(artifact.boundaries.odds_api_historical_credits_consumed,0)
  assert.equal(artifact.boundaries.tracker_modified,false)
  assert.equal(artifact.boundaries.certified_runtime_retuned,false)
})
