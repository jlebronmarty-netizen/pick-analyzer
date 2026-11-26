import test from 'node:test';
import assert from 'node:assert/strict';
import {comparableOriginal,prepareSnapshots,gradeSnapshot,settleContract} from '../src/lib/nba/sheet-lab/tracker.mjs';
import {rankContracts} from '../src/lib/nba/sheet-lab/rank.mjs';
import {playerValues} from '../src/lib/nba/sheet-lab/nba-props.mjs';
const start='2026-11-25T23:00:00Z',at='2026-11-25T22:10:00Z',captured='2026-11-25T22:00:00Z';
const r={id:'a',gameId:1,playerId:12,start,captured,expires:start,ot:'INCLUDES_OT',metric:'pra',market:'points_rebounds_assists',period:'FT',side:'over',line:11,odds:-300,n:8,rate:.75,gap:2,pct:18,conditions:3};
const o={id:'o',gameId:1,playerId:12,market:'props',statistic:r.market,start,captured,decisionAt:at,recordedAt:at,ot:r.ot,period:'ft',book:'FanDuel',side:'under',line:r.line};
const g={id:1,date:'2026-11-25',datetime:start,status_state:'final',home_team_id:1,visitor_team_id:2,home_team_score:10,visitor_team_score:5};
const players=Array.from({length:10},(_,i)=>{const team=i<5?1:2;return {game:g,player:{id:12+i,team_id:team},team:{id:team},min:'10:00',pts:team===1?2:1,reb:5,ast:5,fg3m:0};});
const context={provider_game_id:1,player_stats_captured_at:'2026-11-26T02:00Z',player_stats:{data:players}};
test('exact archived contracts, alternating bands, missing metrics and signed gap',()=>{
 const f={market:r.market,side:'over',band:'-650',sort:'gap'};
 assert.deepEqual(rankContracts([r,{...r,id:'duplicateBand',odds:-250},{...r,id:'excluded',gap:null}],f,Date.parse(at)).map(r=>r.id),['a']);
 assert.equal(playerValues({pts:1,reb:null,ast:3}).pra,null);assert.equal(playerValues({pts:1,reb:0,ast:3}).pra,4);
});
test('frozen pairs require pregame receipt, same rules, line, player and period',()=>{
 for(const x of [{ot:'NOT_VERIFIED'},{start:at},{line:10},{period:'q1'},{playerId:9},{book:'Other'},{recordedAt:start}])assert.equal(comparableOriginal(r,[{...o,...x}],at),null);
 const lab={date:'2026-11-25',at,rows:[r]};
 const s=prepareSnapshots(lab,[o]);assert.deepEqual(s,prepareSnapshots(lab,[o]));assert.equal(s.length,8);
 const result=gradeSnapshot({...s[0],captured_at:at},new Map([[1,{context,final:g}]]))[0];
 assert.equal(result.result,'win');assert.equal(result.pick_result,'loss');assert.equal(result.value,12);
});
test('independent result policies: push, pending, explicit void and documented zero minutes',()=>{
 const c=prepareSnapshots({date:'2026-11-25',at,rows:[r]})[0].payload.cards[0],ev={final:g,context};
 assert.equal(settleContract({...c,line:12},ev,at).result,'push');
 assert.equal(settleContract({...c,ot:'NOT_VERIFIED'},ev,at).result,'pending');
 assert.equal(settleContract(c,{...ev,final:{...g,home_team_score:1}},at).result,'pending');
 assert.equal(settleContract(c,{voidReceipt:{quoteId:'a',book:'FanDuel',at:start,status:'VOID'}},at).result,'void');
 const dnp={...players[0],player:{id:99,team_id:1},min:'0',pts:0,reb:0,ast:0,fg3m:0};
 assert.equal(settleContract({...c,playerId:99},{final:g,context:{...context,player_stats:{data:[...players,dnp]}}},at).result,'dnp');
});

import {buildSheetLab} from '../src/lib/nba/sheet-lab/build.mjs';
import {inputs,target,id} from './fixtures/nba-shead-inputs.mjs';
test('real archived fixture crosses signed receipt, historical rows and profile; periods need their own evidence',async()=>{
 const i=inputs();i.pregame=[{game_ids:[target.id],captured_at:i.asOf,coverage:{injuriesComplete:true,projectedLineupsComplete:true},injuries:{data:[]},projected_lineups:{data:[{game_id:target.id,team_id:28,status:'confirmed',updated_at:i.asOf,lineup:[{position:'PG',player:{id}}]}]}}];
 const quote=i.goatPropQuotes[0],q={...quote,period:'Q1',quote_id:'q1',payload:{...quote.payload,quote_id:'q1',period:'Q1'}};i.goatPropQuotes.push(q);
 const stub={from(){return new Proxy({},{get:(_,k)=>k==='then'?resolve=>resolve({data:[],error:null}):()=>stub.from()})}};
 const lab=await buildSheetLab(i,stub),ft=lab.rows.find(r=>r.period==='FT'),quarter=lab.rows.find(r=>r.period==='Q1');
 assert.equal(ft.n,10);assert.equal(quarter.n,0);assert.equal(quarter.gap,null);
 assert.ok(lab.profiles[ft.key].history.length);assert.equal(Object.keys(ft.checks).length,8);
 assert.ok(!rankContracts(lab.rows,{band:'-250',period:'Q1',sort:'rate'},Date.parse(i.asOf)).length);
});
