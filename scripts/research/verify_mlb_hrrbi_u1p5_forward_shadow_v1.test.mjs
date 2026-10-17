import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const t=JSON.parse(fs.readFileSync('artifacts/research/mlb_hrrbi_u1p5_forward_targets_20260925.json','utf8'))
const s=fs.readFileSync('scripts/research/mlb_hrrbi_u1p5_forward_shadow_v1.mjs','utf8')

test('exact forward surface is frozen',()=>{
  assert.equal(t.exact_market,'batter_hits_runs_rbis')
  assert.equal(t.exact_line,1.5)
  assert.equal(t.side,'UNDER')
  assert.equal(t.frozen_projection_max,0.90)
  assert.equal(t.target_count,119)
})

test('strict prior and exact identity boundaries are explicit',()=>{
  assert.equal(t.exact_mlbam_identity,true)
  assert.equal(t.fuzzy_matching,false)
  assert.match(s,/r\.date<TARGET_DATE/)
  assert.match(s,/same_date_history_allowed:false/)
  assert.match(s,/rows\.slice\(-10\)/)
  assert.match(s,/0\.50\*\(priorRate\*recentPaPerGame\)\+0\.50\*recentPerGame/)
})

test('forward script does not call Odds API or alter thresholds',()=>{
  assert.doesNotMatch(s,/the-odds-api|ODDS_API_KEY/i)
  assert.match(s,/const THRESHOLD=0\.90/)
  assert.match(s,/calculate_ev:false/)
})
