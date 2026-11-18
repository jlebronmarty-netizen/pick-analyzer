import {test} from 'node:test';
import assert from 'node:assert/strict';
import {STATS,CANDIDATES,buildV2Examples,evaluateV2} from '../src/lib/nba/goat-formula-lab-v2.mjs';
const date=i=>'2026-11-'+String(i+1).padStart(2,'0')+'T01:00:00Z';
const fact=(day,player,pts=20,minutes=20,capture='2026-12-01T01:00:00Z')=>({
 season:2026,provider_game_id:1000+day*100+player,player_id:player,
 game_datetime:date(day),source_captured_at:capture,
 projection_eligible:true,pts,reb:pts/2,ast:pts/4,fg3m:pts/10,minutes_played:minutes
});
test('four markets and eight preregistered candidates, no market risk output',()=>{
 assert.deepEqual(Object.keys(STATS),['points','rebounds','assists','threes']);
 assert.equal(CANDIDATES.length,8);assert.equal(new Set(CANDIDATES).size,8);
});
test('historical outcomes and minutes from current game never leak into formula',()=>{
 const facts=Array.from({length:12},(_,i)=>fact(i,9,i===11?100:20,i===11?40:20));
 const cases=buildV2Examples(facts);
 const target=cases.find(x=>x.gameId===211?true:x.playerId===9&&x.day==='2026-11-12'&&x.market==='points');
 assert.ok(target);
 assert.equal(target.actual,100);
 assert.equal(target.predictions.L10,20);
 assert.equal(target.predictions.L5,20);
 assert.equal(target.predictions.RATE_L10_MIN_L5,20);
 for(const k of ['EWMA_0_2','EWMA_0_4','EWMA_0_6'])assert.equal(target.predictions[k],20);
});
test('strict prospective dates reject late-captured reconstructed histories',()=>{
 const facts=Array.from({length:13},(_,i)=>fact(i,7));
 assert.equal(buildV2Examples(facts,{mode:'PROSPECTIVE_ASOF_VERIFIED'}).length,0);
 assert.equal(buildV2Examples(facts,{mode:'RETROSPECTIVE_RECONSTRUCTED'}).length,12);
});
test('same-player same-game duplicates are rejected',()=>{
 const one=fact(0,7);
 assert.throws(()=>buildV2Examples([one,one]),/DUPLICATE_PLAYER_GAME/);
});
test('minute rate is based on historical game minutes, never target minutes',()=>{
 const facts=Array.from({length:12},(_,i)=>fact(i,7,i>=7&&i<=10?30:10,i>=7&&i<=10?30:10));
 facts[11]=fact(11,7,80,48);
 const e=buildV2Examples(facts).find(x=>x.day==='2026-11-12'&&x.market==='points');
 assert.ok(e);
 assert.ok(Number.isFinite(e.predictions.RATE_L10_MIN_L5));
 assert.equal(e.predictions.RATE_L10_MIN_L10,e.predictions.L10);
});
test('selection uses only train, holdout remains an uncertified diagnostic',()=>{
 const facts=[];
 for(let player=1;player<=8;player++)for(let day=0;day<25;day++)
  facts.push(fact(day,player,18+(day%3),20+(day%4)));
 const examples=buildV2Examples(facts);
 const scores=evaluateV2(examples,{trainFrom:'2026-11-11',trainThrough:'2026-11-17',holdoutFrom:'2026-11-18',holdoutThrough:'2026-11-25',minTrain:50,minHoldout:50});
 assert.equal(scores.length,4);
 for(const m of scores){
  assert.equal(m.trainScores.length,8);
  assert.equal(m.certified,false);assert.equal(m.productionEligible,false);
  assert.equal(m.status,'EXPLORATORY_RECONSTRUCTED_FORMULA_CANDIDATE');
  assert.ok(CANDIDATES.includes(m.selectedFormula));
 }
});
test('overlapping evaluation windows are forbidden',()=>{
 assert.throws(()=>evaluateV2([],{trainThrough:'2026-11-15',holdoutFrom:'2026-11-15'}),/INVALID_CHRONOLOGY/);
});
