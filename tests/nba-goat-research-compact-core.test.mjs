import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compactGoatBoxscores,syntheticGoatPropInputs,playedMinutes} from '../src/lib/nba/goat-research-compact-core.mjs';
const sha='a'.repeat(64);
const game={id:21718062,datetime:'2026-11-09T00:30:00.000Z',status_state:'final',home_team_id:7,visitor_team_id:3};
const make=(n,over={})=>({game,player:{id:800000+n},team:{id:n%2?7:3},min:'24:30',pts:10+n,reb:4,ast:5,fg3m:2,stl:1,blk:0,turnover:1,...over});
const params={season:2026,gameId:game.id,raw:Array.from({length:12},(_,i)=>make(i)),sourceCapturedAt:'2026-11-12T02:00:49.727Z',sourceSha256:sha};
test('materializes only typed research facts with provenance',()=>{
 const facts=compactGoatBoxscores(params);assert.equal(facts.length,12);
 assert.equal(facts[0].provider_game_id,game.id);assert.equal(facts[0].season,2026);assert.equal(facts[0].minutes_played,24.5);
 assert.equal(facts[0].projection_eligible,true);assert.equal(facts[0].source_sha256,sha);
 assert.equal(facts[0].opponent_team_id,7);assert.equal(facts[1].opponent_team_id,3);
 const synthetic=syntheticGoatPropInputs(facts);
 assert.equal(synthetic[0].stat.game.status_state,'final');
 assert.equal(synthetic[0].capturedAt,params.sourceCapturedAt);
});
test('refuses premature capture, wrong game and duplicate player identity',()=>{
 assert.throws(()=>compactGoatBoxscores({...params,sourceCapturedAt:'2026-11-08T20:00:00Z'}),/TIMESTAMP/);
 assert.throws(()=>compactGoatBoxscores({...params,raw:[...params.raw.slice(0,11),make(0)]}),/DUPLICATE/);
 assert.throws(()=>compactGoatBoxscores({...params,raw:[...params.raw.slice(0,11),make(12,{game:{...game,id:999}})]}),/IDENTITY/);
});
test('DNP rows retained but excluded from projection eligibility',()=>{
 const raw=[...params.raw.slice(0,11),make(11,{min:'DNP',pts:null,reb:null,ast:null,fg3m:null})];
 const output=compactGoatBoxscores({...params,raw});
 assert.equal(output[11].minutes_played,0);assert.equal(output[11].projection_eligible,false);
 assert.equal(playedMinutes('12:30'),12.5);
});
