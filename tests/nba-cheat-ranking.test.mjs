import test from 'node:test';
import assert from 'node:assert/strict';
import {describeMenu,milestoneHistory} from '../src/lib/nba/cheat-menu-coverage.mjs';
import {rankSheet,captureRankings,outcome} from '../src/lib/nba/cheat-ranking.mjs';
const values=Array.from({length:10},(_,i)=>({value:i}));
const card={quoteId:'a',playerId:1,market:'points',side:'over',line:1,odds:-200,ten:values,five:values.slice(0,5),h2h:values.slice(0,4),expiresAt:'2026-11-25T01:00Z'};
test('one line per player, odds limits, small H2H and original price in capture',()=>{
 const better={...card,quoteId:'b',odds:-150},costly={...card,playerId:2,odds:-251};
 assert.deepEqual(rankSheet([card,better,costly],'points','ten',-250),[better]);
 assert.deepEqual(rankSheet([card],'points','h2h'),[]);
 assert.deepEqual(rankSheet([{...card,ten:[]}],'points','ten'),[]);
 const snap=captureRankings([card,better],Date.parse('2026-11-24T23:00Z'));
 assert.equal(snap.cards[0].odds,-150);
 assert.equal(captureRankings([card],Date.parse(card.expiresAt)).cards.length,0);
 assert.equal(outcome(card,1),'push');assert.equal(outcome({...card,side:'under'},0),'win');
});

test('exclusive price ranges apply before ranking and freezing',()=>{
 const prices=[-651,-650,-300,-251,-250,-100,100,160];
 const rows=prices.map((odds,i)=>({...card,odds,playerId:i,quoteId:String(i)}));
 const pricesIn=floor=>rankSheet(rows,'points','ten',floor).map(r=>r.odds).sort((a,b)=>a-b);
 assert.deepEqual(pricesIn(-250),[-250,-100,100,160]);
 assert.deepEqual(pricesIn(-650),[-650,-300,-251]);
 const {rankings}=captureRankings(rows,Date.parse('2026-11-24T23:00Z'));
 const lower=rankings.find(r=>r.window==='ten' && r.floor===-650);
 assert.equal(lower.ceiling,-251);
 assert.deepEqual(lower.quotes.sort(),['1','2','3']);
});

test('each market and band can show ten distinct players with original prices',()=>{
 const rows=[];
 for(const market of ['points','rebounds','assists','threes']){
   for(const odds of [-250,-650]){
     for(let playerId=1;playerId<=12;playerId++){
       const quoteId=[market,odds,playerId].join('|');
       rows.push({...card,market,playerId,odds,quoteId});
     }
   }
 }
 for(const market of ['points','rebounds','assists','threes']){
   for(const floor of [-250,-650]){
     const top=rankSheet(rows,market,'ten',floor);
     assert.equal(new Set(top.map(c=>c.playerId)).size,10);
     assert.equal(top.length,10);
     assert.ok(top.every(c=>c.odds===floor && c.market===market));
   }
 }
});

test('archived menu counts distinguish strict contracts, excluded milestones and conflicts',()=>{
 const q={market:'props',game_id:1,player_id:12,statistic:'points',side:'over',line:9.5,
   period:'FULL_GAME_LABEL_OT_UNVERIFIED',contract:'STRICT_GREATER_THAN',american_odds:-250,
   source_received_at:'2026-11-27T10:00Z'};
 const milestone={...q,line:10,side:'yes',contract:'PROVIDER_MILESTONE_UNVERIFIED',american_odds:-650};
 const under={...q,line:1.5,statistic:'threes',side:'under',contract:'STRICT_LESS_THAN',american_odds:-251};
 const conflict={...q,line:7.5};
 const {menuCounts:counts}=describeMenu([{quotes:[q,milestone,under,conflict]},
   {quotes:[q,{...conflict,american_odds:-300},{...milestone,line:5,american_odds:-651},
   {...milestone,period:'Q1'},{...under,line:3.5,contract:'STRICT_GREATER_THAN'}]}]);
 assert.deepEqual(counts,{points:{'-250':{strict:1,milestones:0},'-650':{strict:0,milestones:1}},
   threes:{'-650':{strict:1,milestones:0}}});
 assert.deepEqual(describeMenu([{quotes:[]}]),{menuCounts:{},milestones:[]});
});

test('descriptive thresholds use exact player, game and market, equality counts and expiration is bounded',()=>{
 const m={gameId:2,player:3,market:'points',threshold:10,updated:'2026-11-27T12:00Z'};
 const projection={gameId:2,player:3,market:'points',start:'2026-11-27T19:00Z',
   expires:'2026-11-27T16:00Z',trend:[9,10,9,11,10,8,7,11,9,5].map(value=>({value}))};
 const [row]=milestoneHistory([m],[projection]);
 assert.equal(row.five,3);assert.equal(row.ten,4);
 assert.equal(row.expires,Date.parse('2026-11-27T15:00Z'));
 for(const change of [{gameId:7},{player:8},{market:'rebounds'},{trend:[]}]){
   assert.deepEqual(milestoneHistory([m],[{...projection,...change}]),[]);
 }
});
