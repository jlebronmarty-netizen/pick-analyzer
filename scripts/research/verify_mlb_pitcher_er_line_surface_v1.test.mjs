import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const a = JSON.parse(fs.readFileSync('artifacts/research/mlb_pitcher_er_line_surface_v1.json','utf8'))

test('ER line-surface preserves hard boundaries', () => {
  assert.equal(a.contract,'MLB_PITCHER_ER_LINE_SURFACE_V1/1.0.0')
  assert.equal(a.research_only,true)
  assert.equal(a.provider_calls_made,0)
  assert.equal(a.odds_api_historical_credits_consumed,0)
  assert.equal(a.official_picks_writes,0)
  assert.equal(a.apostar_activation,false)
  assert.equal(a.production_promotion,false)
  assert.equal(a.tracker_modified,false)
})

test('new ER 3.5 UNDER survives validation and TEST', () => {
  const r=a.candidates.find(x=>x.line===3.5&&x.side==='UNDER')
  assert(r)
  assert.equal(r.threshold,0.775)
  assert(r.validation.n>=60)
  assert(r.validation.accuracy>=0.75)
  assert(r.validation.lift_pp>=5)
  assert(r.test.accuracy>=0.75)
  assert(r.test.lift_pp>=5)
  assert.equal(r.state,'CROSS_SPLIT_STABLE_75_PLUS')
})

test('ER 0.5 OVER remains explicitly baseline dominated in TEST', () => {
  const r=a.candidates.find(x=>x.line===0.5&&x.side==='OVER')
  assert(r)
  assert(r.test.accuracy>=0.75)
  assert(r.test.lift_pp<5)
  assert.equal(r.state,'TEST_75_PLUS_BASELINE_DOMINATED_LIFT_FAIL')
})

test('ER 4.5 UNDER clears VALIDATION but is baseline dominated in TEST', () => {
  const r=a.candidates.find(x=>x.line===4.5&&x.side==='UNDER')
  assert(r)
  assert.equal(r.threshold,0.875)
  assert.equal(r.validation.n,69)
  assert.equal(r.validation.wins,59)
  assert(r.validation.accuracy>=0.75)
  assert(r.validation.lift_pp>=5)
  assert.equal(r.test.n,71)
  assert.equal(r.test.wins,62)
  assert(r.test.accuracy>=0.75)
  assert(r.test.lift_pp<5)
  assert.equal(r.state,'TEST_75_PLUS_BASELINE_DOMINATED_LIFT_FAIL')
})

test('ER 5.5 UNDER is validation baseline dominated and OVER sides select nothing', () => {
  const r=a.candidates.find(x=>x.line===5.5&&x.side==='UNDER')
  assert(r)
  assert.equal(r.threshold,0.9)
  assert.equal(r.validation.n,685)
  assert.equal(r.validation.wins,609)
  assert(r.validation.accuracy>=0.75)
  assert(r.validation.lift_pp<5)
  assert.equal(r.state,'VALIDATION_75_PLUS_BASELINE_DOMINATED_LIFT_FAIL')
  assert(a.failed_sides.some(x=>x.startsWith('OVER 4.5')))
  assert(a.failed_sides.some(x=>x.startsWith('OVER 5.5')))
})
