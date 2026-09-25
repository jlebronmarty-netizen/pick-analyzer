import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const service=fs.readFileSync('src/services/mlb-bdl-opening-odds-2025-backfill.service.ts','utf8')
const route=fs.readFileSync('src/app/api/research/mlb/main-markets-bdl-opening-backfill/route.ts','utf8')
const c=JSON.parse(fs.readFileSync('contracts/MLB_BDL_OPENING_ODDS_2025_BACKFILL_V1.json','utf8'))

test('backfill is exact, bounded and resumable',()=>{
  assert.equal(c.universe.games,2430)
  assert.equal(c.universe.game_dates,184)
  assert.equal(c.batching.dates_per_request,8)
  assert.match(service,/JOB_TYPE = 'mlb_bdl_opening_odds_2025_backfill_v1'/)
  assert.match(service,/status', 'COMPLETE'/)
  assert.match(service,/pending\.slice\(0, MAX_DATES_PER_BATCH\)/)
})

test('only BALLDONTLIE opening odds are used',()=>{
  assert.match(service,/api\.balldontlie\.io\/mlb\/v1\/games/)
  assert.match(service,/api\.balldontlie\.io\/mlb\/v1\/odds\/opening/)
  assert.doesNotMatch(service,/api\.the-odds-api\.com/)
  assert.equal(c.provider.historical_odds_api_calls,0)
})

test('identity and provider duplicates fail closed',()=>{
  assert.match(service,/PAIR_GAME_COUNT_MISMATCH/)
  assert.match(service,/PAIR_ORDINAL_DATETIME/)
  assert.match(service,/DUPLICATE_PROVIDER_GAME_CONFLICT/)
  assert.match(service,/signatures\.length !== 1/)
  assert.equal(c.identity.fuzzy_matching,false)
})

test('persistence is insert-only into dedicated research storage',()=>{
  assert.match(service,/TARGET_TABLE = 'mlb_bdl_opening_odds_2025_v1'/)
  assert.match(service,/\.insert\(chunk\)/)
  assert.doesNotMatch(service,/\.upsert\(|\.delete\(/)
  assert.doesNotMatch(service,/\.from\([^)]*\)\s*\.update\(/)
  assert.equal(c.persistence.insert_only,true)
})

test('endpoint is authenticated and parameter-free',()=>{
  assert.match(route,/CRON_SECRET/)
  assert.match(route,/timingSafeEqual/)
  assert.match(route,/new URL\(request\.url\)\.search/)
})

test('research boundaries remain closed',()=>{
  assert.equal(c.research_only,true)
  assert.equal(c.production_eligible,false)
  assert.equal(c.official_picks_eligible,false)
  assert.equal(c.apostar_enabled,false)
})

test('checkpoint statuses match sports_sync_jobs constraint vocabulary',()=>{
  assert.match(service,/\.eq\('status', 'completed'\)/)
  assert.match(service,/status: 'completed'/)
  assert.match(service,/status: 'failed'/)
  assert.doesNotMatch(service,/status: 'COMPLETE'|status: 'FAILED'/)
})
