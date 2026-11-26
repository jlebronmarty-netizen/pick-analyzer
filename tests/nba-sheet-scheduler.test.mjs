import test from 'node:test';
import assert from 'node:assert/strict';
import {captureFromBoard,settlePending} from '../src/lib/nba/sheet-lab/scheduler.mjs';

test('a scheduled board read freezes the same three ranking families on retry',async()=>{
 const now=new Date(),at=now.toISOString(),start=new Date(+now+3600000).toISOString();
 const r={id:'q',gameId:123,playerId:45,market:'points',side:'over',line:12.5,odds:-175,
  period:'FT',start,captured:at,expires:start,n:10,rate:.8,gap:2,pct:16,conditions:4,ot:'INCLUDES_OT'};
 const vals=Array.from({length:10},()=>({value:15}));
 const board={asOf:at,day:at.slice(0,10),lab:{date:at.slice(0,10),at,rows:[r]},
  cheatSheets:[{...r,quoteId:'q',book:'FanDuel',updated:at,expiresAt:start,ten:vals,five:vals.slice(0,5),h2h:vals}],
  rows:{props:[{...r,projection:14.5,advantage:2,sample:10,statistic:'points',selection:'Over',startsAt:start,
   quoteId:'q',hit5:5,hit10:10,capturedAt:at,quoteFreshness:'RECENT',dataQuality:{book:'FanDuel',expiresAt:start,issues:[],overtimeRule:'INCLUDES_OVERTIME'}}]}};
 const saved=new Map();
 const db={from(table){
  if(table==='nba_cheat_snapshots_v1')return {upsert(rows,options){
   assert.deepEqual(options,{onConflict:'snapshot_id',ignoreDuplicates:true});
   for(const row of rows)saved.set(row.snapshot_id,row);return {error:null};}};
  assert.equal(table,'nba_decision_shadow_forecasts_v1');
  const query=new Proxy({},{get:(_,key)=>key==='range'?()=>({data:[]}):()=>query});return query;
 }};
 const receipt=await captureFromBoard(db,board);assert.equal(receipt.attempted,13);
 await captureFromBoard(db,board);assert.equal(saved.size,13);
 const methods=new Set([...saved.values()].map(s=>s.payload.method));
 assert.deepEqual([...methods].sort(),['conditions','gap','pct','projection_five','projection_ten','rate','verified_five','verified_h2h','verified_ten']);
 for(const s of saved.values())assert.equal(s.payload.cards[0].odds,-175);
});
test('an unverified final leaves the game pending on a scheduled retry',async()=>{
 const db={from(table){assert.equal(table,'nba_sheet_pending_games_v1');
 const query=new Proxy({},{get:(_,key)=>key==='range'?()=>({data:[{game_id:1,day_local:'2026-11-25'}]}):()=>query});return query;}};
 assert.deepEqual(await settlePending(db,new Date(),async()=>({final:null})),{pendingGames:1,attempted:0});
});
