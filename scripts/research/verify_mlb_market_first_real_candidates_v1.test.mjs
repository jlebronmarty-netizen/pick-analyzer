import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const contract=JSON.parse(fs.readFileSync('contracts/MLB_REAL_BET_CANDIDATE_SHADOW_V1.json','utf8'))
const priority=JSON.parse(fs.readFileSync('artifacts/research/mlb_market_first_priority_20260924_v1.json','utf8'))
const doc=fs.readFileSync('docs/research/MLB_MARKET_FIRST_REAL_CANDIDATES_V1.md','utf8')
const sql=fs.readFileSync('scripts/research/mlb_market_availability_tracker_v1.sql','utf8')

test('shadow contract cannot activate betting or production',()=>{
  assert.equal(contract.research_only,true)
  assert.equal(contract.production_eligible,false)
  assert.equal(contract.official_picks_eligible,false)
  assert.equal(contract.apostar_enabled,false)
})

test('candidate contract forbids extrapolation and retuning',()=>{
  assert.equal(contract.rules.exact_contract_only,true)
  assert.equal(contract.rules.no_line_extrapolation,true)
  assert.equal(contract.rules.no_threshold_retuning_from_forward_results,true)
  assert.equal(contract.rules.no_historical_odds_api_spend,true)
})

test('market-first priorities preserve failed-line freezes',()=>{
  assert(priority.do_not_rescue.includes('Pitcher K O4.5'))
  assert(priority.do_not_rescue.includes('Pitcher Outs U17.5'))
  assert.equal(priority.price_example.price_gate,'FAIL_NO_PRICE_EDGE')
})

test('availability query is read-only and provider-bounded',()=>{
  assert.match(sql,/select/i)
  assert.doesNotMatch(sql,/\b(insert|update|delete|merge|create|alter|drop)\b/i)
  assert.match(sql,/the-odds-api/)
  assert.match(sql,/balldontlie/)
})

test('documentation preserves research boundaries',()=>{
  assert.match(doc,/Official Picks unchanged/)
  assert.match(doc,/APOSTAR disabled/)
  assert.match(doc,/no threshold rescue/)
  assert.match(doc,/no historical Odds API spend/)
})
