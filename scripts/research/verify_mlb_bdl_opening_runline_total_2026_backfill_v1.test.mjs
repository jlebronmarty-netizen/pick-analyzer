import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const service = fs.readFileSync('src/services/mlb-bdl-opening-runline-total-2026-backfill.service.ts','utf8')
const route = fs.readFileSync('src/app/api/research/mlb/bdl-opening-runline-total-2026-backfill/route.ts','utf8')
const contract = JSON.parse(fs.readFileSync('contracts/MLB_BDL_OPENING_RUNLINE_TOTAL_2026_BACKFILL_V1.json','utf8'))

test('2026 BDL runline/total backfill is research-only and exact-market bounded', () => {
  assert.equal(contract.research_only, true)
  assert.equal(contract.diagnostic_only, true)
  assert.equal(contract.production_eligible, false)
  assert.equal(contract.official_picks_eligible, false)
  assert.equal(contract.apostar_enabled, false)
  assert.deepEqual(contract.vendors, ['betmgm','betrivers'])
  assert.deepEqual(contract.target_markets, ['run_line','total'])
  assert.equal(contract.frozen_replay.retuning_allowed, false)
  assert.equal(contract.frozen_replay.sign_reversal_allowed, false)
})

test('service does not use historical Odds API and persists exact lines', () => {
  assert.match(service, /api\.balldontlie\.io\/mlb\/v1\/odds\/opening/)
  assert.doesNotMatch(service, /api\.the-odds-api\.com/)
  assert.match(service, /spread_home_value/)
  assert.match(service, /total_value/)
  assert.match(service, /outcome\.line/)
  assert.match(service, /DUPLICATE_PROVIDER_GAME_CONFLICT/)
  assert.match(service, /PAIR_GAME_COUNT_MISMATCH/)
  assert.match(service, /historicalOddsApiCalls: 0/)
})

test('route is authenticated and fail-closed', () => {
  assert.match(route, /timingSafeEqual/)
  assert.match(route, /CRON_SECRET/)
  assert.match(route, /UNAUTHORIZED/)
  assert.match(route, /INVALID_REQUEST/)
})


test('frozen replay SQL exists and contains exact 2025-derived constants', () => {
  const rl = fs.readFileSync('scripts/research/mlb_runline_bdl_opening_2026_replay.sql','utf8')
  const tt = fs.readFileSync('scripts/research/mlb_totals_bdl_opening_2026_replay.sql','utf8')
  assert.match(rl, /0\.614472548213551/)
  assert.match(rl, /0\.609468425467735/)
  assert.match(rl, /NO 2026 threshold selection|No 2026 threshold selection/i)
  assert.match(tt, /0\.991581133919843/)
  assert.match(tt, /1\.20590885779599/)
  assert.match(tt, /0\.832120315086954/)
  assert.match(tt, /No 2026 retuning/i)
})
