import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ttSettlementCallPlan,TT_PAUSE_BACKLOG_AT} from '../src/lib/edge-lab/tt-settlement-first.mjs';

test('at >=40 missing finals TT creates zero new forecasts, at most three provider calls',()=>{
 for(const backlog of [40,121,1000]){
  const x=ttSettlementCallPlan(backlog,2);
  assert.equal(x.pauseNewForecasts,true);
  assert.equal(x.prematchCalls,0);
  assert.equal(x.resultPages,1);
  assert.equal(x.callsMaximum,3);
 }
 assert.equal(TT_PAUSE_BACKLOG_AT,40);
});
test('no forecast pause at 39 events, preserving original source intake',()=>{
 const p=ttSettlementCallPlan(39,2);
 assert.equal(p.pauseNewForecasts,false);
 assert.equal(p.prematchCalls,1);
 assert.equal(p.resultPages,0);
 assert.equal(p.callsMaximum,3);
});
test('one targeted recovery allows two result pages without creating forecasts',()=>{
 const x=ttSettlementCallPlan(121,1);
 assert.equal(x.pauseNewForecasts,true);
 assert.equal(x.resultPages,2);
 assert.equal(x.callsMaximum,3);
});
test('no targets still caps result page calls',()=>{
 const x=ttSettlementCallPlan(121,0);
 assert.equal(x.resultPages,2);
 assert.equal(x.callsMaximum,2);
});
test('small backlog never exceeds three paid source calls',()=>{
 for(let n=0;n<=39;n++)for(let targets=0;targets<=2;targets++){
  const p=ttSettlementCallPlan(n,targets);
  assert.equal(p.callsMaximum<=3,true);
  assert.equal(p.prematchCalls,1);
 }
});
test('fail closed for invalid budgets or counts',()=>{
 for(const [b,t] of [[-1,1],[40,3],[1,-1],[1,1.5],[NaN,1]])assert.throws(()=>ttSettlementCallPlan(b,t));
});
test('source uses plan before prematch, retains exact final settlement checks',()=>{
 const svc=fs.readFileSync('src/services/edge-lab-multi.service.mjs','utf8');
 const start=svc.indexOf('async function collectTt');
 const end=svc.indexOf('async function getMlb',start);
 const tt=svc.slice(start,end);
 assert.ok(tt.includes('ttSettlementCallPlan(plan.backlog_events'));
 assert.ok(tt.includes('const recentPages=callPlan.resultPages'));
 assert.ok(tt.indexOf('if(callPlan.pauseNewForecasts)')<tt.indexOf("paidRead(db,request,'prematch'"));
 assert.ok(tt.includes("summary.operational_state='SETTLEMENT_RECOVERY_NO_NEW_FORECASTS'"));
 assert.ok(tt.includes("await settle(db,existing,outcomes,f=>ttOutcome(f,history.finals),summary)"));
 assert.ok(svc.includes("if(sport==='MLB' && process.env.MLB_OFFSEASON_PAUSED==='true')"));
});
