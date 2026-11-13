import test from 'node:test';
import assert from 'node:assert/strict';
import {wilsonInterval,nbaGoatLearningReadiness} from '../src/lib/nba/goat-calibration-core.mjs';
test('Historical NBA moneyline n=12 shows interval, not validation of 88% confidence',()=>{
 const interval=wilsonInterval(9,3);
 assert.ok(interval.lower>0.45&&interval.lower<0.49);
 assert.ok(interval.upper>0.90&&interval.upper<0.93);
 assert.equal(interval.sample,12);
});
test('Undefined samples do not claim certainty',()=>{
 assert.equal(wilsonInterval(0,0),null);
 assert.equal(wilsonInterval(-1,4),null);
 assert.equal(wilsonInterval(3.2,4),null);
});
test('Future sample accumulation remains non-promoted and never fabricates historical quality',()=>{
 const state=nbaGoatLearningReadiness({settledMarkets:15,settledMoneyline:12,distinctMoneylineProbabilities:[88],featureScoresCaptured:0});
 assert.equal(state.stillNeededForDirectionalMinimum,15);
 assert.equal(state.probabilitySaturated,true);
 assert.equal(state.historicInputReplaySufficient,false);
 assert.equal(state.validationReady,false);
 assert.equal(state.approvedForModelPromotion,false);
});
