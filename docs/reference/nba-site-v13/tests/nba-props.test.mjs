import test from 'node:test';import assert from 'node:assert/strict';
import {lineState,scoreComparison,windowStats,mainQuote,playerValues} from '../src/nba-props.mjs';
const q={market:'props',period:'FULL_GAME_LABEL_OT_UNVERIFIED',ot:'NOT_VERIFIED',line:10,book:'A',american_odds:-110,source_received_at:'2026-11-24T18:00Z',side:'over',contract:'STRICT_GREATER_THAN'};
test('conditional full game comparison, partial contracts and unmatched periods',()=>{
 assert.equal(lineState(q),'Línea pendiente por regla OT');assert.ok(scoreComparison(q));
 assert.equal(lineState({...q,ot:'INCLUDES_OT'}),'Línea verificada');assert.equal(scoreComparison({...q,period:'Q1'}),false);
 assert.equal(scoreComparison({...q,ot:'EXCLUDES_OT'}),false);assert.equal(lineState({...q,side:'yes'}),'Línea parcialmente verificada');
 assert.deepEqual(windowStats([0,10,14,null].map(pts=>({pts})),'pts',10),{n:3,avg:8,over:1,under:1,push:1,gap:-2});
});
test('paired threshold takes precedence over alternate and missing stats stay absent',()=>{
 assert.equal(mainQuote([{...q,line:7},{...q},{...q,side:'under',contract:'STRICT_LESS_THAN'}]).line,10);assert.equal(mainQuote([{...q,side:'yes'}]),null);assert.equal(playerValues({pts:2,reb:0,ast:null}).pra,null);
});
import {defensiveGroups} from '../src/nba-props.mjs';
test('historical defense groups by opponent ID and distinct game, preserving missing totals',()=>{
 const row={offensive_player_id:1,defender_player_id:2,provider_game_id:10,game_date:'2026-11-10',captured_at:'2026-11-12',matchup_seconds:35,player_points:2};
 const data=[row,row,{...row,provider_game_id:11,matchup_seconds:40},{...row,defender_player_id:3,matchup_seconds:80},{...row,offensive_player_id:4}];
 const g=defensiveGroups(data,1,new Set(['2','3']),'2026-11-24','2026-11-24T14:00Z');assert.deepEqual(g.map(x=>[x.id,x.n,x.matchup_seconds,x.player_points,x.assists]),[['3',1,80,2,null],['2',2,75,4,null]]);
});
