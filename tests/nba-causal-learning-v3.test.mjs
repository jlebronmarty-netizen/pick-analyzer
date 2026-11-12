import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('NBA causal V3 uses confirmed matchup and advanced tracking endpoints',()=>{
  const s=fs.readFileSync('src/services/nba-causal-v3-matchup.service.ts','utf8');
  assert.match(s,/\/nba\/v1\/matchups/);
  assert.match(s,/\/nba\/v2\/stats\/advanced/);
  assert.match(s,/CONFIRMED_PRIMARY_DEFENDER/);
  assert.match(s,/PRIMARY_DEFENDER_SUPPRESSION/);
  assert.match(s,/PRIMARY_DEFENDER_EXPLOITED/);
  assert.match(s,/HIGH_SWITCH_DEFENSE/);
  assert.match(s,/HIGH_CONTEST_VOLUME/);
});

test('NBA causal V3 is bounded, cooldown-protected and postgame only',()=>{
  const s=fs.readFileSync('src/services/nba-causal-v3-matchup.service.ts','utf8');
  assert.match(s,/Math\.min\(cap,1\)/);
  assert.match(s,/RETRY_HOURS=12/);
  assert.match(s,/MIN_SETTLED_AGE_HOURS=3/);
  assert.match(s,/MAX_ATTEMPTS=3/);
  assert.match(s,/settled_at/);
  assert.ok(!/savePrediction|model_weights|recommended_pick|runAutoModelTuning/.test(s));
});

test('NBA causal diagnostics keep V3 evidence hypothesis-only',()=>{
  const s=fs.readFileSync('src/services/nba-causal-learning.service.ts','utf8');
  assert.match(s,/getNbaCausalV3Evidence/);
  assert.match(s,/matchupTracking:v3/);
  assert.match(s,/missingConfirmedMatchup/);
  assert.match(s,/HYPOTHESIS_ONLY/);
});

test('NBA cron adds V3 to existing pipeline without adding a new scheduler',()=>{
  const s=fs.readFileSync('src/app/api/cron/nba-current-era-shadow/route.ts','utf8');
  assert.match(s,/syncNbaCausalV3Matchups/);
  assert.match(s,/v3MatchupCalls/);
  const v=fs.readFileSync('vercel.json','utf8');
  assert.equal((v.match(/nba-current-era-shadow/g)||[]).length,1);
});
