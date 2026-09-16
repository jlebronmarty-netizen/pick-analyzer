import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const routePath = 'src/app/api/consumer/v1/mlb/moneyline-recommendations/route.ts'
const source = await readFile(routePath, 'utf8')

const required = [
  "PE_MLB_MONEYLINE_RECOMMENDATION/1.0.0",
  "pregame_high_conf_home_v2",
  ".from('mlb_ml_forward_tracker_v1')",
  ".eq('tracking_date', targetDate)",
  ".eq('model_version', MODEL_VERSION)",
  "row.data_status !== 'FROZEN'",
  "row.pick_status !== 'PICK' && row.pick_status !== 'NO_PICK'",
  "failClosedReason: 'UNFROZEN_OR_UNEXPECTED_TRACKER_STATE'",
  "function isFailClosedRow",
  "const frozenInputGaps = data.filter(isFailClosedRow)",
  "const failClosedPick = pickRows.some(isFailClosedRow)",
  "failClosedPick ? 'FAIL_CLOSED_ROW_CANNOT_BE_PICK' : 'MALFORMED_FROZEN_PICK'",
  "failClosedGames: frozenInputGaps.length",
  "const coverageComplete = frozenInputGaps.length === 0",
  "officialPicksWrites: false",
  "apostarActive: false",
  "scope: 'MONEYLINE_ONLY'",
  "status: pickRows.length > 0 ? 'PICK_AVAILABLE' : 'NO_PICK'",
]

for (const marker of required) {
  assert.ok(source.includes(marker), `missing required serving marker: ${marker}`)
}

const forbidden = [
  ".from('pick2_mlb_official_picks')",
  '.insert(',
  '.update(',
  '.upsert(',
  '.delete(',
  'APOSTAR=true',
  'APOSTAR = true',
  "failClosedReason: 'FROZEN_FAIL_CLOSED_INPUT_GAP'",
]

for (const marker of forbidden) {
  assert.ok(!source.includes(marker), `forbidden write/activation/global fail-closed marker present: ${marker}`)
}

assert.ok(!source.includes('0.7843'), 'historical selected-set accuracy must not be served as per-game probability')
assert.ok(!source.includes('expectedValue'), 'EV must not be synthesized in the Moneyline recommendation contract')
assert.ok(!source.includes('edgePct'), 'edge must not be synthesized in the Moneyline recommendation contract')

console.log(JSON.stringify({
  status: 'PASS',
  contract: 'PE_MLB_MONEYLINE_RECOMMENDATION/1.0.0',
  modelVersion: 'pregame_high_conf_home_v2',
  sourceTable: 'mlb_ml_forward_tracker_v1',
  readOnly: true,
  failClosed: 'PER_GAME_WITH_STRUCTURAL_FEED_FAIL_CLOSED',
  officialPicksWrites: false,
  apostarActive: false,
  synthesizedProbability: false,
  synthesizedEdgeOrEv: false,
}, null, 2))
