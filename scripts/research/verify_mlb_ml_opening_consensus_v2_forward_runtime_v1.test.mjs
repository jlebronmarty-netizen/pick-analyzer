import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const s=fs.readFileSync('src/services/mlb-opening-consensus-v2-forward.service.ts','utf8')
const route=fs.readFileSync('src/app/api/cron/mlb-official-settlement/route.ts','utf8')
const c=JSON.parse(fs.readFileSync('contracts/MLB_ML_OPENING_CONSENSUS_V2_FORWARD_RUNTIME_V1.json','utf8'))

test('V2 only reads frozen V1 rows and makes no odds calls',()=>{
  assert.match(s,/mlb_ml_opening_consensus_forward_v1/)
  assert.doesNotMatch(s,/balldontlie|the-odds-api/i)
  assert.equal(c.no_new_odds_calls,true)
})

test('secondary score thresholds are frozen exactly',()=>{
  assert.match(s,/bullpenRa9:0\.935409247675931/)
  assert.match(s,/commonOpp:0\.158617424242424/)
  assert.match(s,/venue:0\.238452767470625/)
  assert.match(s,/starterRa9:1\.55737077764639/)
  assert.match(s,/MIN_SCORE=2/)
})

test('pregame and missing-data gates fail closed',()=>{
  assert.match(s,/actual_winner/)
  assert.match(s,/feature_cutoff_date/)
  assert.match(s,/missingSecondary/)
  assert.equal(c.eligibility.missing_secondary_data,'FAIL_CLOSED')
})

test('settlement requires MLB final and does not recompute formula',()=>{
  assert.match(s,/abstractGameState/)
  assert.match(s,/detailedState/)
  assert.match(s,/SETTLED/)
  assert.equal(c.settlement.require_final,true)
  assert.equal(c.settlement.recompute_formula,false)
})

test('Official settlement remains non-blocking',()=>{
  assert.match(route,/runMlbOpeningConsensusV2Shadow/)
  assert.match(route,/MLB_OPENING_CONSENSUS_V2_SHADOW_FAILED_NON_BLOCKING/)
  assert.match(route,/settleMlbOfficialPickBacklog/)
})
