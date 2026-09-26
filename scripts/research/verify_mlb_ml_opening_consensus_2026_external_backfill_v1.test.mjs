import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const service=fs.readFileSync('src/services/mlb-bdl-opening-ml-2026-external-backfill.service.ts','utf8')
const route=fs.readFileSync('src/app/api/research/mlb/ml-opening-consensus-2026-external-backfill/route.ts','utf8')
const c=JSON.parse(fs.readFileSync('contracts/MLB_ML_OPENING_CONSENSUS_2026_EXTERNAL_BACKFILL_V1.json','utf8'))

test('external acquisition is locked to frozen Moneyline candidate',()=>{
  assert.equal(c.frozen_candidate_pr,237)
  assert.deepEqual(c.vendors,['betmgm','betrivers'])
  assert.equal(c.formula_lock.favorite_probability_min,0.65)
  assert.equal(c.formula_lock.fundamentals_required,6)
  assert.equal(c.formula_lock.retuning_allowed,false)
})
test('2026 external universe is bounded and resumable',()=>{
  assert.equal(c.universe.games,2402)
  assert.equal(c.universe.game_dates,182)
  assert.equal(c.batching.dates_per_request,8)
  assert.match(service,/pending\.slice\(0,MAX_DATES_PER_BATCH\)/)
  assert.match(service,/\.eq\('status','completed'\)/)
})
test('only BALLDONTLIE opening Moneyline is acquired',()=>{
  assert.match(service,/api\.balldontlie\.io\/mlb\/v1\/odds\/opening/)
  assert.match(service,/ALLOWED_VENDORS=new Set\(\['betmgm','betrivers'\]\)/)
  assert.doesNotMatch(service,/api\.the-odds-api\.com/)
  assert.equal(c.boundaries.historical_odds_api_calls,0)
})
test('identity is exact and fail closed',()=>{
  assert.match(service,/PAIR_GAME_COUNT_MISMATCH/)
  assert.match(service,/DUPLICATE_PROVIDER_GAME_CONFLICT/)
  assert.equal(c.identity.fuzzy_matching,false)
})
test('endpoint is authenticated and parameter-free',()=>{
  assert.match(route,/CRON_SECRET/)
  assert.match(route,/timingSafeEqual/)
  assert.match(route,/new URL\(request\.url\)\.search/)
})
test('research boundaries remain closed',()=>{
  assert.equal(c.research_only,true)
  assert.equal(c.external_only,true)
  assert.equal(c.production_eligible,false)
  assert.equal(c.official_picks_eligible,false)
  assert.equal(c.apostar_enabled,false)
})

const scoreSql=fs.readFileSync('scripts/research/mlb_ml_opening_consensus_2026_external_score.sql','utf8')
test('external scoring SQL is frozen to the exact 2025 formula',()=>{
  assert.match(scoreSql,/vendor in \('betmgm','betrivers'\)/)
  assert.match(scoreSql,/having count\(\*\)=2/)
  assert.match(scoreSql,/favorite_prob>=0\.65/)
  assert.match(scoreSql,/aligned_votes=6/)
  assert.match(scoreSql,/f\.season=2026/)
  assert.doesNotMatch(scoreSql,/\b(insert|update|delete|merge|create|alter|drop|truncate)\b/i)
})
