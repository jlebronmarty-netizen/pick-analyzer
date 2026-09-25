import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const bdl=fs.readFileSync('src/services/mlb-approved-prop-balldontlie-capture.service.ts','utf8')
const odds=fs.readFileSync('src/services/mlb-approved-prop-market-capture.service.ts','utf8')
const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_bdl_new_prop_family_capture_v1.json','utf8'))

const expected=[
  ['stolen_bases','batter_stolen_bases'],
  ['runs_scored','batter_runs'],
  ['runs_rbis','batter_runs_rbis'],
  ['hits_runs_stolen_bases','batter_hits_runs_stolen_bases'],
  ['hits_stolen_bases','batter_hits_stolen_bases'],
  ['hits_walks_stolen_bases','batter_hits_walks_stolen_bases'],
  ['extra_base_hits','batter_extra_base_hits'],
  ['first_home_run','batter_first_home_run'],
]

test('new BALLDONTLIE families are mapped exactly',()=>{
  for(const [provider,canonical] of expected){
    assert(bdl.includes(provider+": '"+canonical+"'"))
  }
  assert.equal(a.new_family_map.length,8)
})

test('open-ended provider types are audited instead of silently hidden',()=>{
  assert.match(bdl,/observedPropTypes/)
  assert.match(bdl,/unmappedPropTypes/)
  assert.match(bdl,/providerPropType/)
  assert.match(bdl,/providerMarketType/)
  assert.equal(a.discovery_guard.persist_observed_prop_types,true)
  assert.equal(a.discovery_guard.persist_unmapped_prop_types,true)
})

test('Odds API request catalog is not expanded',()=>{
  for(const [,canonical] of expected){
    assert.equal(odds.includes("'"+canonical+"'"),false)
  }
  assert.equal(a.odds_api_boundary.request_markets_modified,false)
  assert.equal(a.odds_api_boundary.historical_calls_added,false)
})

test('research boundaries remain closed',()=>{
  assert.equal(a.research_only,true)
  assert.equal(a.production_eligible,false)
  assert.equal(a.official_picks_eligible,false)
  assert.equal(a.apostar_enabled,false)
  assert.equal(a.identity_boundary.exact_mlbam_only,true)
})
