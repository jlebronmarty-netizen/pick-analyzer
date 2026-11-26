import test from 'node:test';
import assert from 'node:assert/strict';
import {settleContract} from '../src/lib/nba/sheet-lab/tracker.mjs';
import {evidence} from './fixtures/nba-sheet-settlement.mjs';

const start='2026-01-03T23:00:00Z',registered='2026-01-03T22:00:00Z',received='2026-01-04T02:00:00Z';
const card={quoteId:'q',book:'FanDuel',gameId:1,playerId:1,captured:registered,start,expires:start,
 statistic:'rebounds',line:4,period:'FT',ot:'INCLUDES_OT',side:'over'};
const settle=(ev,changes={},at=registered)=>settleContract({...card,...changes},ev,at,Date.parse(received));
const components={points:['pts'],rebounds:['reb'],assists:['ast'],threes:['fg3m'],
 points_rebounds_assists:['pts','reb','ast'],points_rebounds:['pts','reb'],
 points_assists:['pts','ast'],rebounds_assists:['reb','ast']};
for(const field of ['pts','reb','ast','fg3m']){
 test('invalid '+field+' cannot settle dependent contracts on either side',()=>{
  for(const invalid of [-1,null,undefined,'unknown',2.5]){
   const ev=evidence(start,received),player=ev.context.player_stats.data[0];
   if(invalid===undefined)delete player[field];else player[field]=invalid;
   for(const [statistic,keys] of Object.entries(components))for(const side of ['over','under']){
    const row=settle(ev,{statistic,side,line:1.5});
    // Missing points also prevent verification of the final team totals.
    if(field==='pts'||keys.includes(field))assert.deepEqual(row,{result:'pending',value:null});
    else {
     const total=keys.reduce((sum,key)=>sum+player[key],0);
     assert.deepEqual(row,{value:total,result:(side==='over'?total>1.5:total<1.5)?'win':'loss'});
    }
   }
  }
 });
}
test('normalized counts, valid zeros and pushes across eight markets',()=>{
 const ev=evidence(start,received),player=ev.context.player_stats.data[0];
 Object.assign(player,{pts:'2',reb:'0',ast:'3',fg3m:'0'});
 for(const [statistic,keys] of Object.entries(components))for(const side of ['over','under']){
  const value=keys.reduce((sum,k)=>sum+Number(player[k]),0);
  assert.deepEqual(settle(ev,{statistic,side,line:value}),{result:'push',value});
 }
});
test('identity, DNP, invalid minutes, receipt and cutoff checks',()=>{
 for(const mutate of [
  (ev,p)=>ev.context.player_stats.data.push(p),(ev,p)=>{p.player.team_id=2},
  ev=>{ev.context.provider_game_id=99},(ev,p)=>{p.min='4:70'},(ev,p)=>{p.min='0'},
  ev=>{ev.context.player_stats_captured_at=start},ev=>{ev.context.player_stats_captured_at='2026-01-04T02:00:01Z'}
 ]){
  const ev=evidence(start,received);mutate(ev,ev.context.player_stats.data[0]);assert.equal(settle(ev).result,'pending');
 }
 const ev=evidence(start,received);
 for(const changes of [{playerId:99},{gameId:99},{expires:registered},{captured:start}])assert.equal(settle(ev,changes).result,'pending');
 assert.equal(settle(ev,{},start).result,'pending');
 ev.context.player_stats.data.push({...ev.context.player_stats.data[0],player:{id:11,team_id:1},min:'0:00',pts:null,reb:0,ast:0,fg3m:0});
 assert.equal(settle(ev,{playerId:11}).result,'dnp');
 ev.voidReceipt={quoteId:'q',book:'FanDuel',at:received,status:'VOID'};assert.equal(settle(ev).result,'void');
 ev.voidReceipt.at='2026-01-04T02:00:01Z';assert.equal(settle(ev).result,'push');
});
test('period grading requires matching PBP, individual totals and on-time receipt',()=>{
 const ev=evidence(start,received),events=[];
 Object.assign(ev.final,{period:4});
 for(let n=1;n<=4;n++){
  ev.final['home_q'+n]=n===1?10:0;ev.final['visitor_q'+n]=n===1?5:0;
  if(n===1)events.push({order:0,period:n,type:'Shot',participants:[1],scoring_play:true,score_value:2});
  events.push({order:n,period:n,type:'End Period',clock:'0:00',home_score:10,away_score:5});
 }
 ev.pbp={provider_game_id:1,captured_at:received,payload:{data:events.map(e=>({...e,game_id:1}))}};
 const quarter={statistic:'points',period:'Q1',ot:'EXCLUDES_OT',line:1.5};
 assert.equal(settle(ev,quarter).result,'win');
 ev.pbp.payload.data[0].score_value=1;assert.equal(settle(ev,quarter).result,'pending');
 ev.pbp.payload.data[0].score_value=2;ev.pbp.captured_at='2026-01-04T02:00:01Z';
 assert.equal(settle(ev,quarter).result,'pending');assert.equal(settle(ev,{statistic:'points',line:2}).result,'push');
});
