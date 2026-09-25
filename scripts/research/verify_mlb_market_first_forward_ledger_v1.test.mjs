import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_market_first_forward_ledger_v1_20260925.json','utf8'))
const s=fs.readFileSync('scripts/research/mlb_market_first_forward_settlement_v1.mjs','utf8')

test('ledger freezes exactly five pregame crossings',()=>{
  assert.equal(a.candidates.length,5)
  assert.deepEqual([...new Set(a.candidates.map(x=>x.source_pr))].sort(),[216,217])
  for(const x of a.candidates){
    assert.equal(x.status,'PENDING')
    assert(Number.isInteger(x.game_pk))
    assert(Number.isInteger(x.player_mlbam_id))
    assert.equal(typeof x.price,'number')
  }
})

test('non-crossing U0.5 surface is preserved without manufacturing a pick',()=>{
  assert.equal(a.non_crossing_surfaces[0].source_pr,218)
  assert.equal(a.non_crossing_surfaces[0].qualifiers,0)
})

test('settlement is exact postgame only',()=>{
  assert.match(s,/api\/v1\.1\/game/)
  assert.match(s,/PENDING_GAME_NOT_FINAL/)
  assert.match(s,/ID\$\{playerId\}/)
  assert.match(s,/totalBases=singles\+2\*doubles\+3\*triples\+4\*homeRuns/)
  assert.match(s,/hrrbi=hits\+runs\+rbi/)
})

test('research boundaries remain closed',()=>{
  assert.equal(a.research_only,true)
  assert.equal(a.production_eligible,false)
  assert.equal(a.official_picks_eligible,false)
  assert.equal(a.apostar_enabled,false)
  assert.equal(a.boundaries.no_model_recompute_after_game,true)
  assert.equal(a.boundaries.no_price_replacement,true)
})
