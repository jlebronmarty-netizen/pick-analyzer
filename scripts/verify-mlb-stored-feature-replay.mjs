// Read only a separately acquired private SQL snapshot. Never acquires data or writes DB rows.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { buildVector } from './mlb-data-02f-moneyline-prediction-generation-prep.mjs'
import { featureManifest, inferChampion, ARTIFACT_DIGEST, FEATURE_SET } from './mlb-data-02r-r2t-real-feature-champion.mjs'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
const input = process.argv[2]
assert.ok(input, 'PRIVATE_SQL_SNAPSHOT_REQUIRED')
const cases = JSON.parse(fs.readFileSync(input, 'utf8'))
assert.ok(cases.length > 0)
const results = cases.map(({ evidence: e }) => {
  const p = e.prediction, m = p.metadata
  assert.equal(p.model_artifact_digest, ARTIFACT_DIGEST)
  const first = e.firstInning[0]
  const game = { gamePk: p.game_pk, gameDate: first.feature_date, homeTeamId: m.home_team_id, awayTeamId: m.away_team_id }
  const maps = { first: new Map([[p.game_pk, first]]) }
  for (const [domain, key] of [['team', 'team_id'], ['starter', 'mlbam_pitcher_id'], ['bullpen', 'team_id']]) {
    assert.equal(e[domain].length, 2)
    maps[domain] = new Map(e[domain].map(row => [`${p.game_pk}|${row[key]}`, row]))
  }
  const snapshotIds = new Set(e.snapshots.map(s => s.id))
  for (const domain of ['team', 'starter', 'bullpen', 'batter', 'matchup', 'firstInning']) for (const row of e[domain] ?? []) {
    assert.equal(row.target_game_pk, p.game_pk)
    assert.ok(snapshotIds.has(row.feature_snapshot_id))
    assert.ok(m.feature_snapshot_ids.includes(row.feature_snapshot_id))
  }
  const values = buildVector(game, maps)
  assert.equal(values.length, 76)
  assert.equal(sha256(values), m.vector_digest)
  const vector = { gamePk: p.game_pk, runAsOf: p.predicted_at, values, featureNames: featureManifest().map(f => f.name), featureSetVersion: FEATURE_SET, mode: 'STORED_FEATURE_REPLAY', liveEvidenceCertified: false, sourceDigest: m.source_lineage_digest }
  const actual = inferChampion({ vector }).artifact
  const homeError = Math.abs(actual.home_probability - Number(p.home_probability))
  const awayError = Math.abs(actual.away_probability - Number(p.away_probability))
  assert.ok(homeError < 1e-12 && awayError < 1e-12)
  return { gamePk: p.game_pk, predictionId: p.id, vectorCount: 76, vectorDigest: sha256(values), homeAbsoluteError: homeError, awayAbsoluteError: awayError, status: 'PASS' }
})
console.log(JSON.stringify({ status: 'PASS', scope: 'IMMUTABLE_STORED_INPUT_INFERENCE_REPLAY_NOT_RAW_REBUILD_OR_LIVE_ELIGIBILITY', cases: results, providerCalls: 0, databaseWrites: 0 }, null, 2))
