import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const c=JSON.parse(fs.readFileSync('contracts/MLB_BATTER_HRRBI_YES_MILESTONES_V1.json','utf8'))
const s=fs.readFileSync('scripts/research/mlb_hrrbi_yes_milestones_v1.py','utf8')
test('contracts remain exact YES milestones',()=>{
  assert.deepEqual(c.exact_sides,['YES'])
  assert.deepEqual(c.exact_lines,[2.5,3.5])
  assert.equal(c.boundaries.no_yes_over_aliasing,true)
})
test('same-date history is forbidden',()=>{
  assert.equal(c.same_date_history_allowed,false)
  assert.equal(c.source_rule,'source_game_date < target_game_date')
  assert.match(s,/Every target on this date uses only dates strictly before it/)
  assert.match(s,/SAME_DATE_LEAKAGE_DETECTED/)
})
test('2026 remains sealed during selection',()=>{
  assert.equal(c.boundaries.no_2026_selection_use,true)
  assert.doesNotMatch(s,/season.*2026/i)
})
test('research boundaries remain closed',()=>{
  assert.equal(c.research_only,true)
  assert.equal(c.production_eligible,false)
  assert.equal(c.official_picks_eligible,false)
  assert.equal(c.apostar_enabled,false)
})
