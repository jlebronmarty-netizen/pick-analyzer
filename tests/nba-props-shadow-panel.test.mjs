import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildPropPanelRows,PANEL_MARKETS} from '../src/lib/nba/nba-props-panel-core.mjs';
const at='2026-11-17T23:00:00Z';
const game={id:300000,datetime:'2026-11-18T01:00:00Z',status_state:'scheduled'};
const quote=(more={})=>({quote_id:'sample',provider_game_id:300000,player_id:42,market:'props',
 statistic:'rebounds',side:'over',line:7.5,american_odds:-110,phase:'PREGAME',
 contract:'STRICT_GREATER_THAN',period:'FULL_GAME_LABEL_OT_UNVERIFIED',source_received_at:at,...more});
const f=(i,more={})=>({player_id:42,provider_game_id:i,pts:18,reb:7,ast:4,fg3m:2,
 game_datetime:'2026-11-'+String(i).padStart(2,'0')+'T01:00:00Z',
 source_captured_at:'2026-11-16T04:00:00Z',projection_eligible:true,...more});
test('panel supports four props markets without certifying picks or EV',()=>{
 assert.deepEqual(PANEL_MARKETS,['points','rebounds','assists','threes']);
 const x=buildPropPanelRows({game,quotes:[quote()],facts:Array.from({length:10},(_,i)=>f(i+1)),asOf:at});
 assert.equal(x.status,'READ_ONLY_DESCRIPTIVE_SHADOW');
 assert.equal(x.rows.length,1);
 const row=x.rows[0];assert.equal(row.projection,7);assert.equal(row.l5,7);assert.equal(row.l10,7);
 assert.equal(row.delta,-.5);assert.equal(row.availablePriorGames,10);
 assert.equal(row.formula,'L10');assert.equal(row.modelProbability,null);
 assert.equal(row.expectedValue,null);assert.equal(row.recommendedPick,false);assert.equal(row.productionEligible,false);
});
test('5 to 9 captured prior games are explicitly L5 descriptive only',()=>{
 const x=buildPropPanelRows({game,quotes:[quote()],facts:Array.from({length:7},(_,i)=>f(i+1)),asOf:at});
 assert.equal(x.rows[0].l10,null);
 assert.equal(x.rows[0].formula,'L5_DESCRIPTIVE');
 assert.equal(x.rows[0].availablePriorGames,7);
});
test('four captured prior games do not invent a projection',()=>{
 const x=buildPropPanelRows({game,quotes:[quote()],facts:Array.from({length:4},(_,i)=>f(i+1)),asOf:at});
 assert.equal(x.rows[0].projection,null);
 assert.equal(x.rows[0].status,'INSUFFICIENT_CAPTURED_PRIOR_GAMES');
});
test('last-game facts first ingested after quote are excluded, even if played before',()=>{
 const facts=Array.from({length:10},(_,i)=>f(i+1));
 facts[9].source_captured_at='2026-11-17T23:05:00Z';
 const x=buildPropPanelRows({game,quotes:[quote()],facts,asOf:at});
 assert.equal(x.rows[0].availablePriorGames,9);
 assert.equal(x.rows[0].l10,null);
});
test('future and same-game truth do not enter prior features',()=>{
 const facts=Array.from({length:10},(_,i)=>f(i+1));
 facts.push(f(11,{provider_game_id:300000,game_datetime:game.datetime,reb:100}));
 const x=buildPropPanelRows({game,quotes:[quote()],facts,asOf:at});
 assert.equal(x.rows[0].projection,7);
});
test('never invent data when game already started or quote stale',()=>{
 const facts=Array.from({length:10},(_,i)=>f(i+1));
 assert.equal(buildPropPanelRows({game,quotes:[quote()],facts,asOf:'2026-11-18T00:55:00Z'}).rows.length,0);
 assert.equal(buildPropPanelRows({game,quotes:[quote({source_received_at:'2026-11-17T21:00:00Z'})],facts,asOf:at}).rows.length,0);
});
test('rejects in-play, unverified period, and mismatched contract',()=>{
 const facts=Array.from({length:10},(_,i)=>f(i+1));
 for(const item of [quote({phase:'IN_PLAY'}),quote({period:'UNKNOWN'}),quote({contract:'OTHER'})])
  assert.equal(buildPropPanelRows({game,quotes:[item],facts,asOf:at}).rows.length,0);
});
test('deduplicates observations without miscounting props',()=>{
 const facts=Array.from({length:10},(_,i)=>f(i+1));
 const x=buildPropPanelRows({game,quotes:[quote(),quote({quote_id:'different'})],facts,asOf:at});
 assert.equal(x.rows.length,1);
});
test('NBA panel UI and private API remain strictly research-only',()=>{
 const ui=readFileSync('src/app/nba-market-data/props-shadow-panel.jsx','utf8');
 const board=readFileSync('src/app/nba-market-data/board.jsx','utf8');
 const route=readFileSync('src/app/api/market-data/nba/props-shadow/route.ts','utf8');
 assert.match(ui,/SIN PROBABILIDADES/);
 assert.match(ui,/SIN EV/);
 assert.match(board,/PropsShadowPanel/);
 assert.match(route,/privateHost/);
 assert.match(route,/x-vercel-oidc-token/);
 assert.match(route,/GOAT_COMPACT_HISTORY_UNAVAILABLE/);
 assert.doesNotMatch(route,/\.(insert|upsert|update|delete)\(/);
});
