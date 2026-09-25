import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs'
const t=JSON.parse(fs.readFileSync('artifacts/research/mlb_hrrbi_u0p5_forward_targets_20260925.json','utf8'))
const s=fs.readFileSync('scripts/research/mlb_hrrbi_u0p5_forward_shadow_v1.mjs','utf8')
test('exact frozen contract',()=>{assert.equal(t.exact_market,'batter_hits_runs_rbis');assert.equal(t.exact_line,0.5);assert.equal(t.side,'UNDER');assert.equal(t.frozen_projection_max,0.05);assert.equal(t.target_count,50)})
test('strict prior no odds spend',()=>{assert.match(s,/x\.date<TARGET_DATE/);assert.match(s,/same_date_history_allowed:false/);assert.doesNotMatch(s,/the-odds-api|ODDS_API_KEY/i);assert.match(s,/THRESHOLD=0\.05/)})
