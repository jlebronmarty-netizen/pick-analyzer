import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FORMULAS,quantile,formulaValues,buildV3Examples,gameClusterCI,evaluateV3} from '../src/lib/nba/goat-formula-lab-v3.mjs';
const f=(day,player,points=10,capture='2026-12-01T00:00:00Z')=>({
 season:2026,player_id:player,provider_game_id:10000+day*100+player,
 game_datetime:'2026-11-'+String(day).padStart(2,'0')+'T00:00:00Z',
 source_captured_at:capture,projection_eligible:true,
 minutes_played:20,pts:points,reb:points/2,ast:points/5,fg3m:points/10
});
test('quantiles are interpolated and list of formulas is fixed',()=>{
 assert.equal(FORMULAS.length,22);
 assert.equal(new Set(FORMULAS).size,22);
 assert.equal(quantile([1,2,3,4],.5),2.5);
 assert.equal(quantile([1,2,3,4],.35),2.05);
});
test('formula medians and 35th percentile use ten prior games only',()=>{
 const values=[0,1,1,1,2,2,3,4,7,9];
 const history=values.map((v,i)=>f(i+1,1,v));
 const preds=formulaValues(history,'pts');
 assert.equal(preds.L10,3);
 assert.equal(preds.MED10,2);
 assert.equal(preds.MEAN_MED10_25,2.75);
 assert.equal(preds.MEAN_Q35_50,2);
});
test('target outcomes and same-game minutes do not become features',()=>{
 const rows=Array.from({length:12},(_,i)=>f(i+1,1,i===11?99:10));
 rows[11].minutes_played=55;
 const examples=buildV3Examples(rows);
 const target=examples.find(x=>x.day==='2026-11-12'&&x.market==='points');
 assert.ok(target);assert.equal(target.actual,99);
 assert.equal(target.predictions.L10,10);
 assert.equal(target.predictions.MEAN_Q35_50,10);
 assert.equal(target.predictions.L10_MINUTE_RATIO_HALF,10);
});
test('strict source availability excludes retrospectively ingested prior games',()=>{
 const facts=Array.from({length:12},(_,i)=>f(i+1,1));
 assert.equal(buildV3Examples(facts,{mode:'PROSPECTIVE_ASOF_VERIFIED'}).length,0);
 assert.equal(buildV3Examples(facts,{mode:'RETROSPECTIVE_RECONSTRUCTED'}).length,8);
});
test('duplicate player-game facts rejected',()=>{
 const x=f(1,2);assert.throws(()=>buildV3Examples([x,x]),/DUPLICATE_FACT/);
});
test('cluster CI samples NBA games rather than individual player rows',()=>{
 const examples=Array.from({length:20},(_,i)=>({gameId:i%2,actual:5,predictions:{L10:6,MED10:5}}));
 const x=gameClusterCI(examples,'MED10');
 assert.equal(x.nGames,2);assert.equal(x.pointDelta,1);
 assert.deepEqual(x.ci95,[1,1]);
});
test('train and reused test are separated; no V3 score is certified',()=>{
 const facts=[];
 for(let day=1;day<=25;day++)for(let player=1;player<=12;player++)facts.push(f(day,player,10+(day%4)));
 const examples=buildV3Examples(facts);
 const evals=evaluateV3(examples,{trainFrom:'2026-11-11',trainThrough:'2026-11-17',testFrom:'2026-11-18',testThrough:'2026-11-25'});
 assert.equal(evals.length,4);
 for(const e of evals){
  assert.equal(e.candidates,22);assert.ok(e.trainRows>=50);assert.ok(e.testRows>=50);
  assert.equal(e.holdoutCertified,false);assert.equal(e.validatedCandidate,false);
  assert.equal(e.productionEligible,false);
 }
});
test('overlap prohibited',()=>{
 assert.throws(()=>evaluateV3([],{trainThrough:'2026-11-15',testFrom:'2026-11-15'}),/INVALID_EVALUATION_SPLIT/);
});
