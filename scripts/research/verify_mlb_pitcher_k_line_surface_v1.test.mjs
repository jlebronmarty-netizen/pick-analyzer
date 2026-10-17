import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const artifact = JSON.parse(
  fs.readFileSync('artifacts/research/mlb_pitcher_k_line_surface_v1.json', 'utf8'),
)

test('pitcher K line surface preserves research boundaries and certified control', () => {
  assert.equal(artifact.contract, 'MLB_PITCHER_K_LINE_SURFACE_V1/1.0.0')
  assert.equal(artifact.research_only, true)
  assert.equal(artifact.provider_calls_made, 0)
  assert.equal(artifact.odds_api_historical_credits_consumed, 0)
  assert.equal(artifact.official_picks_writes, 0)
  assert.equal(artifact.apostar_activation, false)
  assert.equal(artifact.production_promotion, false)
  assert.equal(artifact.tracker_modified, false)

  assert.equal(artifact.certified_control.line, 6.5)
  assert.equal(artifact.certified_control.side, 'UNDER')
  assert.equal(artifact.certified_control.threshold, 4.5)
  assert.equal(artifact.certified_control.n2025, 1367)
  assert.equal(artifact.certified_control.wins2025, 1189)
  assert.equal(artifact.certified_control.control_reproduced_exactly, true)
})

test('line-surface candidate states reflect frozen 2026 stability evaluation', () => {
  const byKey = new Map(
    artifact.candidates.map((row) => [`${row.side}:${row.line}`, row]),
  )

  for (const key of ['OVER:3.5', 'UNDER:7.5', 'UNDER:8.5']) {
    const row = byKey.get(key)
    assert(row, key)
    assert.equal(row.state.startsWith('CROSS_YEAR_STABLE_75_PLUS'), true)
    assert(row.dev2025.accuracy >= 0.75)
    assert(row.eval2026.accuracy >= 0.75)
    assert(row.dev2025.worst_month >= 0.65)
    assert(row.eval2026.worst_month >= 0.65)
    assert(row.dev2025.lift_pp >= 5)
    assert(row.eval2026.lift_pp >= 5)
  }

  for (const key of ['OVER:4.5', 'OVER:5.5', 'UNDER:5.5']) {
    const row = byKey.get(key)
    assert(row, key)
    assert.equal(row.state, 'POOLED_75_PLUS_2026_STABILITY_FAIL')
    assert(row.eval2026.accuracy >= 0.75)
    assert(row.eval2026.worst_month < 0.65)
  }
})

test('current relevance audit does not substitute missing exact lines', () => {
  const byLine = new Map(
    artifact.current_availability_2026_09_22.map((row) => [row.line, row]),
  )
  assert.deepEqual(byLine.get(3.5).books, ['betmgm', 'draftkings', 'fanduel'])
  assert.deepEqual(byLine.get(4.5).books, ['draftkings', 'fanduel'])
  assert.deepEqual(byLine.get(5.5).books, ['betmgm'])
  for (const line of [6.5, 7.5, 8.5]) {
    assert.equal(byLine.get(line).games, 0)
    assert.equal(byLine.get(line).players, 0)
  }
})
