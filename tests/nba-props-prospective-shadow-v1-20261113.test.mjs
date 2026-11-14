import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNbaPropShadowHypothesis,NBA_PROPS_SHADOW_STATS,NBA_PROPS_MIN_PRIOR_GAMES} from '../src/lib/nba/goat-props-shadow-core.mjs';
const event={id:'bdl_nba_100',start_time:'2026-11-14T02:00:00Z'};
const base={quote_id:'q1',provider_game_id:100,player_id:42,market:'props',phase:'PREGAME',statistic:'points',side:'over',contract:'STRICT_GREATER_THAN',period:'FULL_GAME_LABEL_OT_UNVERIFIED',line:19.5,american_odds:-115,source_received_at:'2026-11-14T00:00:00Z'};
const sample=(i,pts=20,statDate='2026-11-0'+i+'T01:00:00Z')=>({capturedAt:'2026-11-13T00:00:00Z',stat:{player:{id:42},game:{id:i,datetime:statDate,status_state:'final'},min:'32:10',pts,reb:6,ast:5,fg3m:2}});
const run=(changes={},history=[sample(4,22),sample(5,18),sample(6,24),sample(7,20),sample(8,16)])=>buildNbaPropShadowHypothesis({quote:{...base,...changes},event,playerGameStats:history,asOf:'2026-11-14T00:01:00Z'});
test('Only four first-stage prop statistics; minimum five prior games',()=>{assert.deepEqual(Object.keys(NBA_PROPS_SHADOW_STATS),['points','rebounds','assists','threes']);assert.equal(NBA_PROPS_MIN_PRIOR_GAMES,5);});
test('Valid historical five-game baseline is not a bet or a calibrated probability',()=>{
 const r=run();assert.equal(r.status,'SHADOW_HYPOTHESIS_ONLY');assert.equal(r.projection,20);assert.equal(r.historicalGames,5);assert.equal(r.recommendedPick,false);assert.equal(r.productionEligible,false);assert.equal(r.modelProbability,null);assert.equal(r.expectedValue,null);assert.equal(r.injuryAdjusted,false);
});
test('All four stat mappings use exact player actuals',()=>{
 for(const [stat,expected] of [['points',20],['rebounds',6],['assists',5],['threes',2]]){const r=run({statistic:stat});assert.equal(r.projection,expected);assert.equal(r.statistic,stat);}
});
test('Fail closed when there are not five truly distinct verified historical games',()=>{
 for(const history of [[],[sample(4)],Array(5).fill(sample(4)),[sample(4),sample(5),sample(6),sample(7),sample(8,19,'2026-11-15T01:00:00Z')]]){
  const r=run({},history);assert.equal(r.status,'NOT_READY');assert.equal(r.reason,'INSUFFICIENT_PRIOR_GAMES');
 }
});
test('Exclude post-quote-ingested, DNP, player mismatch, non-final, wrong game and missing stat',()=>{
 const good=[sample(4),sample(5),sample(6),sample(7)];
 for(const last of [
  {...sample(8),capturedAt:'2026-11-14T00:01:00Z'},
  {...sample(8),stat:{...sample(8).stat,min:'0:00'}},
  {...sample(8),stat:{...sample(8).stat,player:{id:999}}},
  {...sample(8),stat:{...sample(8).stat,game:{...sample(8).stat.game,status_state:'live'}}},
  {...sample(8),stat:{...sample(8).stat,game:{...sample(8).stat.game,id:100}}},
  {...sample(8),stat:{...sample(8).stat,pts:null}},
 ]){
  assert.equal(run({},[...good,last]).reason,'INSUFFICIENT_PRIOR_GAMES');
 }
});
test('Reject uncertain contract, late price, game identity, in-play and impossible odds',()=>{
 for(const changed of [
  {side:'yes'},{contract:'MILESTONE_AS_PUBLISHED'}, {period:'UNVERIFIED'}, {phase:'IN_PLAY'},
  {provider_game_id:101},{player_id:null},{line:null},{american_odds:75},
  {source_received_at:'2026-11-14T01:55:00Z'},{source_received_at:'2026-11-13T22:00:00Z'},
 ]){
  const r=run(changed);assert.equal(r.status,'NOT_READY',JSON.stringify(changed));assert.equal(r.recommendedPick,false);
 }
});
test('Cannot lower minimum below safety gate or use games after quote cutoff',()=>{
 assert.equal(buildNbaPropShadowHypothesis({quote:base,event,playerGameStats:Array(5).fill(sample(4)),asOf:'2026-11-14T00:01:00Z',minPriorGames:1}).reason,'UNSAFE_MINIMUM_HISTORY');
 const after=run({},[sample(4),sample(5),sample(6),sample(7),sample(8,20,'2026-11-14T00:00:30Z')]);assert.equal(after.reason,'INSUFFICIENT_PRIOR_GAMES');
});
