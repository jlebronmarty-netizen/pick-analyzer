import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const service=fs.readFileSync('src/services/mlb-approved-prop-pitcher-feature-materializer.service.ts','utf8')
const stat=fs.readFileSync('src/app/api/cron/mlb-statcast-daily/route.ts','utf8')
const run=fs.readFileSync('src/app/api/cron/mlb-runline-v2-forward/route.ts','utf8')
const evaluator=fs.readFileSync('src/services/mlb-approved-prop-daily-evaluation.service.ts','utf8')
const doc=fs.readFileSync('docs/research/MLB_APPROVED_PROP_FEATURE_BLOCKER_REPAIR_V1.md','utf8')

test('canonical slate reconcile is actually invoked before freezes',()=>{
  assert.match(run,/await reconcileMlbCanonicalSlateFromOfficial\(targetDate\)/)
  assert.match(run,/Freeze both Run Line research tracks only after canonical slate preflight/)
  assert.match(stat,/safeCanonicalSlateReconcile\(operatingClock\.date\)/)
})

test('pitcher materializer is strict-prior and narrowly scoped',()=>{
  assert.match(service,/pick2_raw_mlb_statcast_pitches/)
  assert.match(service,/\.lt\('game_date', targetDate\)/)
  assert.match(service,/pick2_mlb_pitcher_daily_features/)
  assert.doesNotMatch(service,/pick2_mlb_batter_daily_features/)
  assert.doesNotMatch(service,/pick2_mlb_bullpen_daily_features/)
  assert.match(service,/officialPicksModified: false/)
  assert.match(service,/apostarActivated: false/)
})

test('walks no longer requires redundant target feature but keeps strict history',()=>{
  const walk= evaluator.slice(evaluator.indexOf("market: 'batter_walks'"), evaluator.indexOf("] as const", evaluator.indexOf("market: 'batter_walks'")))
  assert.match(walk,/requireTargetFeature: false/)
  assert.match(evaluator,/def\.requireTargetFeature && !strictTargetFeature/)
  assert.match(evaluator,/NOT_REQUIRED_STRICT_HISTORY_IS_MODEL_INPUT/)
  assert.match(evaluator,/\.lt\('game_date', targetDate\)/)
})

test('repair documentation preserves boundaries',()=>{
  assert.match(doc,/no model\/threshold changes/)
  assert.match(doc,/no Official Picks/)
  assert.match(doc,/APOSTAR disabled/)
  assert.match(doc,/no batter feature writes/)
})
