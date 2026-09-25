import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const service=fs.readFileSync('src/services/mlb-bdl-pregame-lineup-freeze.service.ts','utf8')
const route=fs.readFileSync('src/app/api/cron/mlb-official-settlement/route.ts','utf8')
const movement=fs.readFileSync('src/services/mlb-bdl-main-market-movement-capture.service.ts','utf8')
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

test('companion BDL market movement captures exact main markets only',()=>{
  assert.match(movement,/api\.balldontlie\.io\/mlb\/v1\/odds/)
  assert.match(movement,/market:'moneyline'/)
  assert.match(movement,/market:'run_line'/)
  assert.match(movement,/market:'total'/)
  assert.match(movement,/provider_timestamp:providerTimestamp/)
  assert.match(movement,/WINDOW_MINUTES = 180/)
  assert.doesNotMatch(movement,/api\.the-odds-api\.com/)
  assert.deepEqual(c.companion_main_market_movement.target_markets,['moneyline','run_line','total'])
  assert.equal(c.companion_main_market_movement.historical_odds_api_calls,0)
})

test('main market movement is non-blocking to settlement',()=>{
  assert.match(route,/captureBdlMainMarketMovement/)
  assert.match(route,/BDL_MAIN_MARKET_MOVEMENT_FAILED_NON_BLOCKING/)
  assert.match(route,/researchMainMarketMovement/)
})
