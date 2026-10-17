import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_market_first_phase_d_coverage_expansion_v1.json','utf8'))

test('baseline and expanded coverage are frozen',()=>{
  assert.equal(a.baseline.row_coverage_pct,8.72)
  assert.equal(a.baseline.surface_coverage_pct,9.09)
  assert.equal(a.expanded_research_contract_coverage.exact_contract_rows,1586)
  assert.equal(a.expanded_research_contract_coverage.row_coverage_pct,13.73)
  assert.equal(a.expanded_research_contract_coverage.covered_surfaces,12)
  assert.equal(a.expanded_research_contract_coverage.surface_coverage_pct,12.12)
})

test('TB U1.5 is cross-year pass without retune',()=>{
  const x=a.findings.find(x=>x.family==='batter_total_bases'&&x.surface==='U1.5')
  assert(x.development_2025.accuracy>=0.75)
  assert(x.external_2026.accuracy>=0.75)
  assert(x.development_2025.lift_pp>=5)
  assert(x.external_2026.lift_pp>=5)
  assert.equal(x.pr,216)
})

test('failed new architectures remain closed',()=>{
  const singles=a.findings.find(x=>x.family==='batter_singles')
  const hits=a.findings.find(x=>x.family==='batter_hits')
  const walks=a.findings.find(x=>x.family==='batter_walks')
  const k=a.findings.find(x=>x.family==='batter_strikeouts')
  assert(singles.best_attempt.accuracy<0.75)
  assert(hits.best_attempt.accuracy<0.75)
  assert(walks.best_attempt.accuracy<0.75)
  assert(k.development_2025.accuracy>=0.75)
  assert(k.external_2026_through_feature_coverage_2026_09_03.accuracy<0.75)
  assert.equal(k.state,'EXTERNAL_BELOW_75_NO_RETUNE')
})

test('research boundaries remain closed',()=>{
  assert.equal(a.research_only,true)
  assert.equal(a.production_eligible,false)
  assert.equal(a.official_picks_eligible,false)
  assert.equal(a.apostar_enabled,false)
  assert.equal(a.tracker_modified,false)
  assert.equal(a.boundaries.no_yes_to_over_alias,true)
  assert.equal(a.boundaries.no_historical_odds_api_spend,true)
})
