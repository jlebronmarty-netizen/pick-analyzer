import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('NBA causal V2 uses bounded GOAT context endpoints and no auto model mutation',()=>{
  const s=fs.readFileSync('src/services/nba-causal-v2-context.service.ts','utf8');
  assert.match(s,/projected_lineups/);
  assert.match(s,/\/nba\/v1\/lineups/);
  assert.match(s,/\/v1\/stats/);
  assert.match(s,/Math\.min\(cap,3\)/);
  assert.match(s,/NBA_CAUSAL_CONTEXT_V2/);
  assert.ok(!/model_weights|saveModelVersion|runAutoModelTuning|recommended_pick/.test(s));
});

test('NBA causal diagnostics preserve hypothesis-only boundary',()=>{
  const s=fs.readFileSync('src/services/nba-causal-learning.service.ts','utf8');
  assert.match(s,/HYPOTHESIS_ONLY/);
  assert.match(s,/missingCurrentLineupTruth/);
  assert.match(s,/missingCurrentPlayerGameStats/);
  assert.match(s,/getNbaCausalV2Evidence/);
  assert.ok(!/VALIDATED_PATTERN['"]/.test(s.replace(/check \(causal_status[^;]+/g,'')));
});

test('Existing NBA cron composes settlement then bounded context then diagnostics without new cron',()=>{
  const s=fs.readFileSync('src/app/api/cron/nba-current-era-shadow/route.ts','utf8');
  for(const name of ['reconcileNbaGoatShadowResults','syncNbaCausalPbpForSettled','syncNbaCausalV2Context','runNbaCausalDiagnostics','runNbaGoatShadowScheduler']) assert.match(s,new RegExp(name));
  const v=fs.readFileSync('vercel.json','utf8');
  assert.equal((v.match(/nba-current-era-shadow/g)||[]).length,1);
});
