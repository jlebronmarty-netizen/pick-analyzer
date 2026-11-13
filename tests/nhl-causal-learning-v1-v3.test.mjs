import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('NHL causal learning uses official NHL PBP and boxscore only',()=>{
  const s=fs.readFileSync('src/services/nhl-causal-learning.service.ts','utf8');
  assert.match(s,/api-web\.nhle\.com\/v1\/gamecenter/);
  assert.match(s,/play-by-play/);
  assert.match(s,/boxscore/);
  assert.match(s,/goalieInNetId/);
  assert.match(s,/shootingPlayerId/);
  assert.match(s,/nhl_matchup_observations_v3/);
});

test('NHL causal pipeline is bounded and postgame-only',()=>{
  const s=fs.readFileSync('src/services/nhl-causal-learning.service.ts','utf8');
  assert.match(s,/Math\.min\(cap,1\)/);
  assert.match(s,/nhl_free_outcomes_v1/);
  assert.ok(!/model_weights|recommended_pick|runAutoModelTuning|savePrediction/.test(s));
});

test('NHL diagnostics remain hypothesis-only and cannot auto-promote',()=>{
  const s=fs.readFileSync('src/services/nhl-causal-learning.service.ts','utf8');
  assert.match(s,/HYPOTHESIS_ONLY/);
  assert.match(s,/auto_promotion:false/);
  assert.match(s,/validatedCandidateRequiresHoldout:true/);
});

test('Existing NHL cron composes causal learning without a second scheduler',()=>{
  const s=fs.readFileSync('src/app/api/cron/nhl-free/route.ts','utf8');
  assert.match(s,/runNhlFree/);
  assert.match(s,/runNhlCausalLearning/);
  const v=fs.readFileSync('vercel.json','utf8');
  assert.equal((v.match(/nhl-free/g)||[]).length,1);
});
