import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MARKETS,FORMULA_WEIGHTS,collectFormulaExamples,evaluateMarketFormulas} from '../src/lib/nba/goat-formula-lab-core.mjs';
function game(id,day,player,pts=10,captured='2026-12-01T01:00:00Z') {
 return {season:2026,provider_game_id:id,player_id:player,game_datetime:day+'T01:00:00Z',source_captured_at:captured,
  projection_eligible:true,pts,reb:pts/2,ast:pts/3,fg3m:pts/10};
}
test('research produces exactly the supported four markets and a fixed bounded grid',()=>{
 assert.deepEqual(Object.keys(MARKETS),['points','rebounds','assists','threes']);
 assert.equal(FORMULA_WEIGHTS.length,11);
 assert.equal(FORMULA_WEIGHTS[0],0);assert.equal(FORMULA_WEIGHTS.at(-1),1);
});
test('same target-game data never enters its own prior 10-game features',()=>{
 const rows=Array.from({length:12},(_,i)=>game(100+i,'2026-11-'+String(i+1).padStart(2,'0'),21,i===11?100:10));
 const ex=collectFormulaExamples(rows);
 const e=ex.find(x=>x.market==='points'&&x.gameId===111);
 assert.equal(e.actual,100);assert.equal(e.L5,10);assert.equal(e.L10,10);
});
test('future-captured historical data excluded from strict prospective mode',()=>{
 const rows=Array.from({length:13},(_,i)=>game(100+i,'2026-11-'+String(i+1).padStart(2,'0'),21,10,'2026-11-30T05:00:00Z'));
 assert.equal(collectFormulaExamples(rows,{mode:'PROSPECTIVE_ASOF_VERIFIED'}).length,0);
 assert.equal(collectFormulaExamples(rows,{mode:'RETROSPECTIVE_RECONSTRUCTED'}).length,12);
});
test('duplicates are rejected before evaluation',()=>{
 const f=game(100,'2026-11-01',21);
 assert.throws(()=>collectFormulaExamples([f,f]),/DUPLICATE_PLAYER_GAME_FACT/);
});
test('one fixed holdout never selects training coefficients and cannot certify production',()=>{
 const facts=[];
 for(let day=20;day<=30;day++)for(let player=1;player<=8;player++){
  const date='2026-10-'+String(day).padStart(2,'0'),id=(day-20)*10+player;
  facts.push(game(id,date,player,20,'2026-12-01T01:00:00Z'));
 }
 for(let day=1;day<=25;day++)for(let player=1;player<=8;player++){
  const date='2026-11-'+String(day).padStart(2,'0'),id=1000+day*10+player;
  facts.push(game(id,date,player,20+(day%2?2:0),'2026-12-01T01:00:00Z'));
 }
 const examples=collectFormulaExamples(facts);
 const scores=evaluateMarketFormulas(examples,{trainFrom:'2026-11-06',trainThrough:'2026-11-15',holdoutFrom:'2026-11-16',holdoutThrough:'2026-11-25',minTrain:50,minHoldout:50});
 assert.equal(scores.length,4);
 for(const score of scores){
  assert.equal(score.status,'EXPLORATORY_RECONSTRUCTED_FORMULA_CANDIDATE');
  assert.equal(score.candidatesTried,11);
  assert.equal(score.trainRows,80);
  assert.equal(score.holdoutRows,80);
  assert.equal(score.productionEligible,false);
  assert.equal(score.holdoutCertified,false);
  assert.ok(score.selectedWeightL5>=0&&score.selectedWeightL5<=1);
 }
});
test('blocks overlapping train and holdout',()=>{
 assert.throws(()=>evaluateMarketFormulas([],{trainThrough:'2026-11-15',holdoutFrom:'2026-11-15'}),/OVERLAPPING/);
});
