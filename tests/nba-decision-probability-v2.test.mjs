import test from 'node:test';
import assert from 'node:assert/strict';
import {impliedProbability,expectedValue,evaluateProbabilityCohort,researchDecision}
  from '../src/lib/nba/decision-probability-v2.mjs';
const mk=(id,holdout=false)=>({
  gameId:id,market:'total',period:'ft',modelVersion:'CANDIDATE_V2',
  forecastId:'f'+id,probability:.6,probabilityOrigin:'FROZEN_PROSPECTIVE_MODEL',
  qualityStatus:'VALIDATED',contractVerified:true,
  decisionAt:holdout?'2026-11-18T12:00:00Z':'2026-01-01T12:00:00Z',
  gameStartAt:holdout?'2026-11-19T00:00:00Z':'2026-01-02T00:00:00Z',
  outcomeAt:holdout?'2026-11-19T05:00:00Z':'2026-01-02T05:00:00Z',
  result:'win'
});
const plan={trainBefore:'2026-06-01T00:00:00Z',holdoutFrom:'2026-11-01T00:00:00Z'};
test('American odds probabilities and EV are algebraically correct',()=>{
 assert.equal(impliedProbability(-200),2/3);
 assert.equal(impliedProbability(100),.5);
 assert.equal(impliedProbability(0),null);
 assert.equal(expectedValue(.6,-120),.1);
 assert.equal(expectedValue(.5,-120),-.083333);
 assert.equal(expectedValue(.6,0),null);
});
test('Four independent games cannot validate even with hundreds of contracts',()=>{
 const rows=[1,2,3,4].flatMap(id=>Array.from({length:70},(_,j)=>({...mk(id,true),forecastId:'f'+id+'_'+j})));
 const r=evaluateProbabilityCohort(rows,plan);
 assert.equal(r.models[0].holdoutGames,4);
 assert.equal(r.models[0].holdoutContracts,280);
 assert.equal(r.models[0].validationStatus,'INSUFFICIENT_INDEPENDENT_GAMES');
 assert.equal(r.approvedForBetting,false);
 assert.equal(r.models[0].holdoutBrier,.16);
});
test('Train and holdout split is based on game time and minimum games',()=>{
 const rows=[...Array.from({length:100},(_,i)=>mk(i+1)),
  ...Array.from({length:100},(_,i)=>mk(i+101,true))];
 const r=evaluateProbabilityCohort(rows,plan);
 assert.equal(r.models[0].trainGames,100);
 assert.equal(r.models[0].holdoutGames,100);
 assert.equal(r.models[0].validationStatus,'REQUIRES_CALIBRATION_AND_INDEPENDENT_REVIEW');
 assert.equal(r.models[0].approvedForBetting,false);
});
test('Reject data leakage, unaudited source, null probabilities and pushes',()=>{
 const old=mk(1,true);
 const bad=[{...mk(2,true),decisionAt:'2026-11-19T01:00:00Z'},
 {...mk(3,true),probabilityOrigin:'HISTORICAL_HIT_RATE'},
 {...mk(4,true),result:'push'}, {...mk(5,true),probability:null},
 {...mk(6,true),qualityStatus:'PARTIAL'}];
 const r=evaluateProbabilityCohort([old,...bad],plan);
 assert.equal(r.acceptedContracts,1);
 assert.equal(r.rejectedContracts,5);
});
test('Never automatically recommends betting, even with a supplied valid review',()=>{
 const candidate={dataQuality:'VALIDATED',probability:.7,americanOdds:-120,
   probabilityOrigin:'FROZEN_PROSPECTIVE_MODEL'};
 const review={validationStatus:'VALIDATED_INDEPENDENT_HOLDOUT',humanReviewed:true,
   calibrationPassed:true,contractVerified:true,regionalExecutionVerified:true};
 assert.equal(researchDecision(candidate,review).classification,'VIGILAR');
 assert.equal(researchDecision({...candidate,dataQuality:'PARTIAL'},review).classification,'PASAR');
 assert.equal(researchDecision({...candidate,probability:null},review).expectedValue,null);
});
test('Evaluation refuses insufficient cutoff separation or weakened minimums',()=>{
 assert.throws(()=>evaluateProbabilityCohort([], {...plan,minimumHoldoutGames:10}),/INVALID/);
 assert.throws(()=>evaluateProbabilityCohort([], {...plan,holdoutFrom:plan.trainBefore}),/INVALID/);
});
