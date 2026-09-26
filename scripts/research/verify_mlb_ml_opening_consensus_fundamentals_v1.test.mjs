import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_ml_opening_consensus_fundamentals_v1.json','utf8'))

test('exact frozen moneyline formula',()=>{
  assert.equal(a.market,'moneyline')
  assert.equal(a.formula.favorite_probability_min,0.65)
  assert.equal(a.formula.fundamentals_required,6)
  assert.equal(a.formula.fundamentals_total,6)
  assert.deepEqual(a.opening_market_source.vendors,['betmgm','betrivers'])
})

test('2025 gate passes',()=>{
  assert.equal(a.development_2025.n,78)
  assert.equal(a.development_2025.wins,59)
  assert(a.development_2025.accuracy>=0.75)
  assert.equal(a.development_2025.months,5)
  assert(a.development_2025.worst_month_accuracy>=0.65)
})

test('identity is exact and complete',()=>{
  assert.equal(a.exact_identity.odds_games,1853)
  assert.equal(a.exact_identity.exact_joined_games,1853)
  assert.equal(a.exact_identity.unmatched,0)
  assert.equal(a.exact_identity.ambiguous,0)
  assert.equal(a.exact_identity.fuzzy_matching,false)
})

test('2026 remains sealed and no post-readback side restriction is allowed',()=>{
  assert.equal(a.external_2026.opened,true)
  assert.equal(a.external_2026.threshold_retuned,false)
  assert.equal(a.boundaries.no_side_restriction_after_readback,true)
  assert.equal(a.boundaries.no_threshold_retuning_after_2026,true)
})

test('research boundaries remain closed',()=>{
  assert.equal(a.research_only,true)
  assert.equal(a.production_eligible,false)
  assert.equal(a.official_picks_eligible,false)
  assert.equal(a.apostar_enabled,false)
  assert.equal(a.boundaries.no_historical_odds_api_spend,true)
  assert.equal(a.price_policy.calculate_ev,false)
})

test('untouched 2026 external passes pooled accuracy but fails n and stability gates',()=>{
  assert.equal(a.external_2026.result.n,37)
  assert.equal(a.external_2026.result.wins,30)
  assert(a.external_2026.result.accuracy>=0.75)
  assert.equal(a.external_2026.gate.accuracy_pass,true)
  assert.equal(a.external_2026.gate.n_pass,false)
  assert.equal(a.external_2026.gate.worst_month_pass,false)
  assert.equal(a.external_2026.backfill.selected_games_with_extreme_price,0)
  assert.equal(a.external_2026.state,'EXTERNAL_ACCURACY_PASS_N_AND_STABILITY_FAIL_NO_RETUNE')
})
