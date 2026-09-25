import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const service=fs.readFileSync('src/services/mlb-main-market-bdl-opening-probe.service.ts','utf8')
const route=fs.readFileSync('src/app/api/research/mlb/main-markets-bdl-opening-probe/route.ts','utf8')
const c=JSON.parse(fs.readFileSync('contracts/MLB_MAIN_MARKETS_BDL_OPENING_COVERAGE_PROBE_V1.json','utf8'))

test('probe is bounded to fixed 2025 sample dates',()=>{
  assert.equal(c.sample_dates.length,6)
  assert(c.sample_dates.every(x=>x.startsWith('2025-')))
  assert.match(service,/MAX_PROVIDER_CALLS/)
  assert.equal(c.provider_call_bound,24)
})

test('opening odds use BALLDONTLIE and never historical Odds API',()=>{
  assert.match(service,/api\.balldontlie\.io\/mlb\/v1\/odds\/opening/)
  assert.doesNotMatch(service,/api\.the-odds-api\.com/)
  assert.equal(c.historical_odds_api_calls,0)
})

test('identity is exact and ambiguous doubleheaders fail closed',()=>{
  assert.match(service,/canonical_home_team/)
  assert.match(service,/canonical_away_team/)
  assert.match(service,/candidates\.length !== 1/)
  assert.equal(c.identity_policy,'date + canonical home team + canonical away team; ambiguous doubleheaders fail closed')
})

test('route is authenticated, parameter-free and read-only',()=>{
  assert.match(route,/CRON_SECRET/)
  assert.match(route,/new URL\(request\.url\)\.search/)
  assert.doesNotMatch(service,/\.insert\(|\.upsert\(|\.update\(|\.delete\(/)
  assert.equal(c.writes,0)
})

test('research boundaries remain closed',()=>{
  assert.equal(c.research_only,true)
  assert.equal(c.production_eligible,false)
  assert.equal(c.official_picks_eligible,false)
  assert.equal(c.apostar_enabled,false)
})
