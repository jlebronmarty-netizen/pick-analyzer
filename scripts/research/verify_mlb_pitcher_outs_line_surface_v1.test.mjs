import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('artifacts/research/mlb_pitcher_outs_line_surface_v1.json','utf8'))

test('pitcher outs line surface preserves base V2 and research boundaries', () => {
  assert.equal(artifact.contract,'MLB_PITCHER_OUTS_LINE_SURFACE_V1/1.0.0')
  assert.equal(artifact.research_only,true)
  assert.equal(artifact.control.line,18.5)
  assert.equal(artifact.control.side,'UNDER')
  assert.equal(artifact.control.threshold,15.75)
  assert.equal(artifact.control.development_2025.n,1398)
  assert.equal(artifact.control.development_2025.wins,1245)
  assert.equal(artifact.control.reproduced_exactly,true)
  assert.equal(artifact.provider_calls_made,0)
  assert.equal(artifact.odds_api_historical_credits_consumed,0)
  assert.equal(artifact.official_picks_writes,0)
  assert.equal(artifact.apostar_activation,false)
  assert.equal(artifact.production_promotion,false)
  assert.equal(artifact.tracker_modified,false)
})

test('O14.5 is the only new cross-year stable candidate', () => {
  const over145 = artifact.candidates.find((r) => r.line===14.5 && r.side==='OVER')
  assert(over145)
  assert.equal(over145.state,'CROSS_YEAR_DIAGNOSTIC_STABLE_75_PLUS_FORWARD_VALIDATION_REQUIRED')
  assert(over145.dev2025.accuracy>=0.75)
  assert(over145.dev2025.worst_month>=0.65)
  assert(over145.dev2025.lift_pp>=5)
  assert(over145.diagnostic2026.accuracy>=0.75)
  assert(over145.diagnostic2026.worst_month>=0.65)
  assert(over145.diagnostic2026.lift_pp>=5)

  const u175 = artifact.candidates.find((r) => r.line===17.5 && r.side==='UNDER')
  assert.equal(u175.state,'POOLED_75_PLUS_2026_STABILITY_FAIL')
  assert(u175.diagnostic2026.worst_month<0.65)

  const u185 = artifact.candidates.find((r) => r.line===18.5 && r.side==='UNDER')
  assert.equal(u185.state,'DIAGNOSTIC_LIFT_BELOW_5PP_DO_NOT_REPLACE_V2')
  assert(u185.diagnostic2026.lift_pp<5)
})

test('today exact-line crossing is research-only evidence', () => {
  const rows=artifact.current_availability_2026_09_22.qualifying_today
  assert.equal(rows.length,1)
  assert.equal(rows[0].player_name,'Nick Martinez')
  assert.equal(rows[0].line,14.5)
  assert.equal(rows[0].side,'OVER')
  assert.equal(rows[0].sportsbook,'draftkings')
  assert.equal(rows[0].passes,true)
  assert.equal(rows[0].settlement.game_status,'FINAL')
  assert.equal(rows[0].settlement.observed_innings_pitched,6)
  assert.equal(rows[0].settlement.observed_outs,18)
  assert.equal(rows[0].settlement.result,'WIN')
  assert.equal(artifact.current_availability_2026_09_22.settlement_state,'SETTLED_RESEARCH_CROSSING_WIN_NOT_FORWARD_CERTIFICATION')
  assert.equal(artifact.current_availability_2026_09_22.forward_gate_opened,false)
})
