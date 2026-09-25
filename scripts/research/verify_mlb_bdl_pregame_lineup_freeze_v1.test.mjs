import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const service=fs.readFileSync('src/services/mlb-bdl-pregame-lineup-freeze.service.ts','utf8')
const route=fs.readFileSync('src/app/api/cron/mlb-official-settlement/route.ts','utf8')
const c=JSON.parse(fs.readFileSync('contracts/MLB_BDL_PREGAME_LINEUP_FREEZE_V1.json','utf8'))

test('capture uses BDL lineup endpoint inside T-180 only',()=>{
  assert.match(service,/api\.balldontlie\.io\/mlb\/v1\/lineups/)
  assert.match(service,/WINDOW_MINUTES = 180/)
  assert.equal(c.window_minutes_to_first_pitch,180)
})

test('freeze requires complete 9+9 exact MLBAM lineup',()=>{
  assert.match(service,/byTeam\.size !== 2/)
  assert.match(service,/teamRows\.size !== 9/)
  assert.match(service,/matches\.length !== 1/)
  assert.match(service,/output\.length === 18/)
  assert.match(service,/fuzzyMatchingUsed: false/)
})

test('timestamp is explicitly first observation, not provider publication time',()=>{
  assert.match(service,/providerPublishedAtAvailable: false/)
  assert.match(service,/first complete BALLDONTLIE lineup observed by Pick Analyzer before first pitch/)
  assert.equal(c.provider_publication_timestamp_available,false)
})

test('hourly settlement remains independent and no new cron is created',()=>{
  assert.match(route,/freezeBdlPregameLineups/)
  assert.match(route,/BDL_PREGAME_LINEUP_FREEZE_FAILED_NON_BLOCKING/)
  assert.match(route,/settleMlbOfficialPickBacklog/)
  assert.equal(c.new_cron,false)
})

test('research boundaries remain closed',()=>{
  assert.equal(c.research_only,true)
  assert.equal(c.production_eligible,false)
  assert.equal(c.official_picks_eligible,false)
  assert.equal(c.apostar_enabled,false)
  assert.equal(c.historical_odds_api_calls,0)
})
