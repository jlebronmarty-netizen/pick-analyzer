import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FROZEN_FORMULAS,checkFrozenV3} from '../src/lib/nba/goat-formula-v3-frozen-validation.mjs';
test('frozen market parameters are stable and independent of any observed outcomes',()=>{
 assert.deepEqual(FROZEN_FORMULAS,{rebounds:'MEAN_Q35_50',threes:'MEAN_MED10_25'});
 assert.throws(()=>checkFrozenV3([],{firstDay:'2026-11-15'}),/REUSED_HISTORICAL_TEST_WINDOW/);
});
test('previously inspected historical data is never eligible in frozen check',()=>{
 const fake={market:'rebounds',day:'2026-11-14',mode:'PROSPECTIVE_ASOF_VERIFIED',gameId:1,actual:5,
  predictions:{L10:6,MEAN_Q35_50:5}};
 const r=checkFrozenV3([fake]);
 assert.equal(r[0].playerGameObservations,0);
 assert.equal(r[0].status,'INSUFFICIENT_NEW_GAME_EVIDENCE');
});
test('future proof-of-concept never self-certifies even when interval positive',()=>{
 const ex=[];
 for(let game=0;game<35;game++)for(let player=0;player<8;player++){
  const predictions={L10:6,MEAN_Q35_50:5,MEAN_MED10_25:5};
  ex.push({market:'rebounds',day:'2026-11-17',mode:'PROSPECTIVE_ASOF_VERIFIED',
   gameId:12000+game,playerId:player,actual:5,predictions});
  ex.push({market:'threes',day:'2026-11-17',mode:'PROSPECTIVE_ASOF_VERIFIED',
   gameId:12000+game,playerId:player,actual:5,predictions});
 }
 const reports=checkFrozenV3(ex);
 for(const r of reports){
  assert.equal(r.playerGameObservations,280);
  assert.equal(r.uniqueGames,35);
  assert.equal(r.deltaMAE,1);
  assert.deepEqual(r.gameCluster95CI,[1,1]);
  assert.equal(r.status,'POSITIVE_ASOF_REPLAY_REQUIRES_HUMAN_REVIEW');
  assert.equal(r.validatedCandidate,false);
  assert.equal(r.modelPromotionAuthorized,false);
 }
});
