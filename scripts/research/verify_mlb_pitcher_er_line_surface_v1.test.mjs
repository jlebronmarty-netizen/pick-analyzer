import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const artifact=JSON.parse(fs.readFileSync('artifacts/research/mlb_pitcher_er_line_surface_v1.json','utf8'))
const sql=fs.readFileSync('scripts/research/mlb_pitcher_er_line_surface_v1.sql','utf8')
const doc=fs.readFileSync('docs/research/MLB_PITCHER_ER_LINE_SURFACE_V1.md','utf8')

test('research boundaries remain closed',()=>{
  assert.equal(artifact.research_only,true)
  assert.equal(artifact.production_eligible,false)
  assert.equal(artifact.official_picks_eligible,false)
  assert.equal(artifact.apostar_enabled,false)
  assert.equal(artifact.boundaries.no_2026_outcomes_opened,true)
  assert.equal(artifact.boundaries.no_runs_allowed_substitution,true)
})

test('U3.5 cross-split candidate is frozen exactly',()=>{
  const row=artifact.lines.find((x)=>x.line===3.5)
  assert.equal(row.side,'UNDER')
  assert.equal(row.threshold,2.2)
  assert.equal(row.validation.n,123)
  assert.equal(row.validation.wins,98)
  assert.equal(row.test.n,115)
  assert.equal(row.test.wins,92)
  assert.equal(row.state,'CROSS_SPLIT_75_PLUS_RESEARCH_CANDIDATE_FORWARD_VALIDATION_REQUIRED')
})

test('ER 2.5 is not promoted',()=>{
  const row=artifact.lines.find((x)=>x.line===2.5)
  assert.equal(row.state,'NO_75_PLUS_CROSS_SPLIT_CANDIDATE')
})

test('SQL is read-only and uses exact ER frozen runtime',()=>{
  assert.doesNotMatch(sql,/\b(insert|update|delete|merge|create|alter|drop|truncate)\b/i)
  assert.match(sql,/mlb_pitcher_er_frozen_2025_runtime_v1/)
  assert.match(doc,/Runs Allowed is never substituted/)
})
