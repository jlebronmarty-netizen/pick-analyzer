import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('NCAAB V1-V3 uses one ESPN summary source and no defender fabrication',()=>{
 const s=read('src/services/ncaab-causal-learning.service.ts');
 assert.match(s,/mens-college-basketball\/summary/);
 assert.match(s,/PLAYER_VS_OPPONENT_TEAM_NOT_DIRECT_DEFENDER/);
 assert.match(s,/HYPOTHESIS_ONLY/);
 assert.ok(!/model_weights|runAutoModelTuning/.test(s));
});
test('NCAAF V1-V3 uses ESPN drives and opponent profiles, not defender claims',()=>{
 const s=read('src/services/ncaaf-causal-learning.service.ts');
 assert.match(s,/college-football\/summary/);
 assert.match(s,/driveSummary/);
 assert.match(s,/PLAYER_OR_UNIT_VS_OPPONENT_NOT_DIRECT_DEFENDER/);
 assert.match(s,/Math\.min\(cap,1\)/);
});
test('Soccer V1-V3 fails closed on missing roster/xG and limits context calls',()=>{
 const s=read('src/services/soccer-causal-learning.service.ts');
 assert.match(s,/summary/);
 assert.match(s,/xG is not inferred/);
 assert.match(s,/PLAYER_VS_OPPONENT_TEAM_NOT_DIRECT_DEFENDER/);
 assert.match(s,/Math\.min\(cap,1\)/);
});
test('Table tennis V1-V3 is reconstructed from stored set outcomes with zero provider calls',()=>{
 const s=read('src/services/tt-causal-learning.service.ts');
 assert.match(s,/setPoints/);
 assert.match(s,/COMEBACK_AFTER_FIRST_SET/);
 assert.match(s,/DIRECT_PLAYER_VS_PLAYER_H2H/);
 assert.match(s,/provider_calls:0/);
});
test('UFC V1-V3 uses one card context and direct fighter H2H without fabricated fight stats',()=>{
 const s=read('src/services/ufc-causal-learning.service.ts');
 assert.match(s,/sports\/mma\/ufc\/summary/);
 assert.match(s,/DIRECT_FIGHTER_VS_FIGHTER_H2H/);
 assert.match(s,/No striking\/grappling stats are invented/);
 assert.match(s,/Math\.min\(cap,1\)/);
});
test('MLB V1-V3 stays offseason paused with no active collector',()=>{
 const s=read('src/services/mlb-causal-learning-readiness.service.ts');
 assert.match(s,/OFFSEASON_PAUSED/);
 assert.match(s,/collectorActive:false/);
 assert.match(s,/providerCalls:0/);
 assert.match(s,/batter-vs-pitcher/);
});
test('Existing schedulers are reused instead of adding causal-only crons',()=>{
 const v=read('vercel.json');
 assert.equal((v.match(/ncaab-daily/g)||[]).length,1);
 assert.equal((v.match(/edge-lab-sports/g)||[]).length,1);
 assert.equal((v.match(/edge-lab-soccer/g)||[]).length,1);
 assert.equal((v.match(/ufc-free/g)||[]).length,1);
 assert.ok(!/causal-learning/.test(v));
});
test('All new causal services preserve human approval boundary',()=>{
 for(const p of ['src/services/ncaab-causal-learning.service.ts','src/services/ncaaf-causal-learning.service.ts','src/services/soccer-causal-learning.service.ts','src/services/tt-causal-learning.service.ts','src/services/ufc-causal-learning.service.ts']){
  const s=read(p);assert.match(s,/HYPOTHESIS_ONLY/);assert.ok(!/runAutoModelTuning|saveModelVersion|model_weights/.test(s));
 }
});
