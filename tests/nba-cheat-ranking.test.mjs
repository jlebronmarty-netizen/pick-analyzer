import test from 'node:test';
import assert from 'node:assert/strict';
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
