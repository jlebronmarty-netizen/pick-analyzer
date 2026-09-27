import fs from 'node:fs'; import test from 'node:test'; import assert from 'node:assert/strict';
const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_fanduel_batter_singles_yes_surface_v1.json','utf8'));
const sql=fs.readFileSync('scripts/research/mlb_fanduel_batter_singles_yes_surface_v1.sql','utf8');
test('Singles YES closes fail',()=>{assert.equal(a.state,'NO_75_PLUS_STABLE_SIGNAL_CANDIDATE');assert.equal(a.external_2026_opened,false);assert.match(sql,/rows between unbounded preceding and 1 preceding/);assert.doesNotMatch(sql,/\binsert\b|\bupdate\b|\bdelete\b/i)});
