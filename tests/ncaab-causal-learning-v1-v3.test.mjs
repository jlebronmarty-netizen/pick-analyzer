import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('NCAAB causal learning uses one ESPN summary source for PBP and boxscore',()=>{
  const s=fs.readFileSync('src/services/ncaab-causal-learning.service.ts','utf8');
  assert.match(s,/mens-college-basketball\/summary/);
  assert.match(s,/payload\?\.plays/);
  assert.match(s,/payload\?\.boxscore/);
  assert.match(s,/ncaab_opponent_matchups_v3/);
});

test('NCAAB V3 does not fabricate defender assignment',()=>{
  const s=fs.readFileSync('src/services/ncaab-causal-learning.service.ts','utf8');
  assert.match(s,/PLAYER_VS_OPPONENT_TEAM_NOT_DIRECT_DEFENDER/);
  assert.match(s,/directDefenderAssignments:false/);
  assert.ok(!/defender_player_id|primaryDefender/.test(s));
});

test('NCAAB causal pipeline is bounded and hypothesis-only',()=>{
  const s=fs.readFileSync('src/services/ncaab-causal-learning.service.ts','utf8');
  assert.match(s,/Math\.min\(cap,3\)/);
  assert.match(s,/HYPOTHESIS_ONLY/);
  assert.match(s,/auto_promotion:false/);
  assert.ok(!/model_weights|recommended_pick|runAutoModelTuning/.test(s));
});

test('Existing NCAAB cron composes learning without another scheduler',()=>{
  const s=fs.readFileSync('src/app/api/cron/ncaab-daily/route.ts','utf8');
  assert.match(s,/runNcaabDaily/);
  assert.match(s,/runNcaabCausalLearning/);
  const v=fs.readFileSync('vercel.json','utf8');
  assert.equal((v.match(/ncaab-daily/g)||[]).length,1);
});
