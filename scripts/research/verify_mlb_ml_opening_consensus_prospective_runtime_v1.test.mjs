import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const s=fs.readFileSync('src/services/mlb-opening-consensus-prospective.service.ts','utf8')
const route=fs.readFileSync('src/app/api/cron/mlb-official-settlement/route.ts','utf8')
const c=JSON.parse(fs.readFileSync('contracts/MLB_ML_OPENING_CONSENSUS_PROSPECTIVE_RUNTIME_V1.json','utf8'))

test('schedule staging is insert-only and outcome-null',()=>{
  assert.match(s,/actual_winner:null/)
  assert.match(s,/home_score:null/)
  assert.match(s,/away_score:null/)
  assert.match(s,/\.insert\(rows\)/)
  assert.doesNotMatch(s,/mlb_ml_xyear_game_v1'\)\.update/)
})
test('V4 lineage gates are mandatory',()=>{
  assert.match(s,/mlb_ml_xyear_materialize_pregame_v4/)
  assert.match(s,/BLOCKED_MATERIALIZATION_NOT_COMPLETE/)
  assert.match(s,/BLOCKED_PREGAME_LINEAGE_VIOLATION/)
})
test('opening capture is exact BetMGM plus BetRivers and not current odds',()=>{
  assert.match(s,/mlb\/v1\/odds\/opening/)
  assert.match(s,/REQUIRED_BOOKS=\['betmgm','betrivers'\]/)
  assert.equal(c.boundaries.no_current_odds_substitution,true)
})
test('frozen formula cannot drift',()=>{
  assert.match(s,/FAVORITE_THRESHOLD=0\.65/)
  assert.match(s,/REQUIRED_VOTES=6/)
  assert.equal(c.formula.favorite_probability_min,0.65)
  assert.equal(c.formula.aligned_votes,6)
})
test('runtime writes only research forward evidence',()=>{
  assert.match(s,/mlb_ml_opening_consensus_forward_v1/)
  assert.equal(c.research_only,true)
  assert.equal(c.production_eligible,false)
  assert.equal(c.official_picks_eligible,false)
  assert.equal(c.apostar_enabled,false)
})
test('hourly settlement remains non-blocking',()=>{
  assert.match(route,/runMlbOpeningConsensusProspective/)
  assert.match(route,/MLB_OPENING_CONSENSUS_PROSPECTIVE_FAILED_NON_BLOCKING/)
  assert.match(route,/settleMlbOfficialPickBacklog/)
})
