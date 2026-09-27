import fs from 'node:fs'; import test from 'node:test'; import assert from 'node:assert/strict';
const a=JSON.parse(fs.readFileSync('artifacts/research/mlb_pitcher_outs_o13p5_line_surface_v1.json','utf8'));
const sql=fs.readFileSync('scripts/research/mlb_pitcher_outs_o13p5_line_surface_v1.sql','utf8');
test('O13.5 candidate is frozen and strict-prior',()=>{assert.equal(a.frozen_candidate.threshold,16);assert.equal(a.frozen_candidate.development_2025.accuracy,0.8468);assert.equal(a.frozen_candidate.diagnostic_2026.accuracy,0.8503);assert.match(sql,/h\.game_date<t\.game_date/);assert.doesNotMatch(sql,/\binsert\b|\bupdate\b|\bdelete\b/i)});
