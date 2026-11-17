import test from 'node:test';
import assert from 'node:assert/strict';
import {poissonProxy,evaluateFrozenContext} from '../src/lib/nhl-context-ablation-research.mjs';
const fixture={
 event_id:'nhl:2026020326',
 scheduled_at:'2026-11-16T00:30:00Z',
 frozen_at:'2026-11-15T12:00:00Z',
 rest_context_asof:'2026-11-15T11:59:00Z',
 outcome_observed_at:'2026-11-16T04:00:00Z',
 home_lambda:2.547,away_lambda:2.986,
 home_score:2,away_score:5,
 home_rest_hours:24.5,away_rest_hours:24.5
};
test('distribution agrees with complementary 3-market measures',()=>{
 const p=poissonProxy(3,2.9);
 assert.ok(p.moneyline>0&&p.moneyline<1);
 assert.ok(p.homeMinus1p5>0&&p.homeMinus1p5<1);
 assert.ok(p.over5p5>0&&p.over5p5<1);
});
test('zero adjustment gives identical Brier for all three markets',()=>{
 const result=evaluateFrozenContext([fixture],{restPenalty:0});
 assert.equal(result.eligible,1);
 for(const row of Object.values(result.brier)) assert.equal(row.baseline,row.candidate);
 assert.equal(result.productionEligible,false);
 assert.equal(result.holdoutPassed,false);
});
test('reject post-game freeze, post-freeze feature and pregame outcome',()=>{
 const invalid=[
  {...fixture,frozen_at:'2026-11-16T00:29:00Z'},
  {...fixture,rest_context_asof:'2026-11-15T12:05:00Z'},
  {...fixture,outcome_observed_at:'2026-11-15T23:59:00Z'}
 ];
 const result=evaluateFrozenContext(invalid);
 assert.equal(result.eligible,0);assert.equal(result.rejected,3);
});
test('no previous starter is implied from historical rest metadata',()=>{
 const result=evaluateFrozenContext([fixture]);
 assert.equal(result.upcomingStarterInferred,false);
 assert.equal(result.marketContractVerified,false);
});
test('reject invalid penalties and missing rest',()=>{
 assert.throws(()=>evaluateFrozenContext([],{restPenalty:-1}));
 assert.equal(evaluateFrozenContext([{...fixture,home_rest_hours:null}]).eligible,0);
});
