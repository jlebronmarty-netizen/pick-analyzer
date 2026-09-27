import fs from 'node:fs'; import test from 'node:test'; import assert from 'node:assert/strict';
const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_fanduel_batter_rbi_yes_surface_v1.json','utf8'));
const sql=fs.readFileSync('scripts/research/mlb_fanduel_batter_rbi_yes_surface_v1.sql','utf8');
test('RBI YES surface frozen protocol',()=>{assert.equal(a.development_season,2025);assert.equal(a.external_2026_opened,false);assert.equal(a.results.every(x=>x.state==='NO_75_PLUS_STABLE_SIGNAL_CANDIDATE'),true);assert.match(sql,/h\.game_date<t\.game_date/);assert.doesNotMatch(sql,/\binsert\b|\bupdate\b|\bdelete\b/i)});
