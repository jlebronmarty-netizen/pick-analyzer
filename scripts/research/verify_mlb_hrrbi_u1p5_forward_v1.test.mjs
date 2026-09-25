import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const c=JSON.parse(fs.readFileSync('contracts/MLB_BATTER_HRRBI_U1P5_FORWARD_SHADOW_V1.json','utf8'))
const t=JSON.parse(fs.readFileSync('artifacts/research/mlb_hrrbi_u1p5_forward_targets_20260925.json','utf8'))
const s=fs.readFileSync('scripts/research/mlb_hrrbi_u1p5_forward_v1.mjs','utf8')

test('frozen exact contract',()=>{
  assert.equal(c.market,'batter_hits_runs_rbis')
  assert.equal(c.exact_line,1.5)
  assert.equal(c.side,'UNDER')
  assert.equal(c.frozen_threshold,0.90)
  assert.equal(c.boundaries.no_threshold_retuning,true)
})

test('target set is exact MLBAM and strict pregame',()=>{
  assert.equal(t.target_count,119)
  assert.equal(t.targets.length,119)
  for(const x of t.targets){
    assert(Number.isInteger(Number(x.playerId)))
    assert.equal(Number(x.line),1.5)
    assert(Date.parse(x.snapshotTime)<Date.parse(x.targetStart))
  }
})

test('evaluator uses prospective MLB Official strict-prior history',()=>{
  assert.match(s,/statsapi\.mlb\.com/)
  assert.match(s,/date>=TARGET_DATE/)
  assert.match(s,/THRESHOLD=0\.90/)
  assert.match(s,/game_date < target_date/)
  assert.doesNotMatch(s,/THE_ODDS_API|historical odds/i)
})

test('research boundaries closed',()=>{
  assert.equal(c.research_only,true)
  assert.equal(c.production_eligible,false)
  assert.equal(c.official_picks_eligible,false)
  assert.equal(c.apostar_enabled,false)
  assert.equal(c.price_policy.calculate_ev,false)
})
