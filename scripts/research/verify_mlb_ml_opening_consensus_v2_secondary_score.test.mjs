import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_ml_opening_consensus_v2_secondary_score.json','utf8'))

test('V2 eligibility is frozen to V1 plus secondary score >=2',()=>{
  assert.equal(a.base_gate.favorite_probability_min,0.65)
  assert.equal(a.base_gate.fundamentals_aligned_required,6)
  assert.equal(a.secondary_score.eligibility_min,2)
  assert.equal(a.secondary_score.components.length,4)
})

test('secondary cuts are fixed from May-Jul 2025 Q25 distributions',()=>{
  assert.match(a.secondary_score.components[0].cut_source,/May-Jul 2025 Q25/)
  assert.match(a.secondary_score.components[1].cut_source,/May-Jul 2025 Q25/)
  assert.match(a.secondary_score.components[2].cut_source,/May-Jul 2025 Q25/)
  assert.match(a.secondary_score.components[3].cut_source,/May-Jul 2025 Q25/)
})

test('2025 development and internal holdout both exceed 80 percent',()=>{
  assert(a.development_2025.development_may_jul.accuracy>=0.80)
  assert(a.development_2025.internal_holdout_aug_sep.accuracy>=0.80)
  assert(a.development_2025.v2_full.n>=60)
  assert(a.development_2025.worst_month_accuracy>=0.65)
})

test('known 2026 is diagnostic only',()=>{
  assert.equal(a.lineage.external_status,'NO_UNTOUCHED_EXTERNAL_AVAILABLE; 2026 already observed for V1')
  assert.equal(a.validation_mode,undefined)
  assert.equal(a.state,'FROZEN_FORWARD_ONLY_NO_RETUNE')
})

test('boundaries prevent post-hoc team or feature rescue',()=>{
  assert.equal(a.boundaries.no_team_name_filter,true)
  assert.equal(a.boundaries.no_2026_retuning,true)
  assert.equal(a.boundaries.no_threshold_changes_after_freeze,true)
  assert.equal(a.boundaries.no_side_restriction,true)
  assert.equal(a.boundaries.no_vendor_change,true)
})
