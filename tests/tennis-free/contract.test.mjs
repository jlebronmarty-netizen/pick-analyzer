import test from 'node:test';
import assert from 'node:assert/strict';
import {parseUpcoming,parseResults} from '../../scripts/tennis-free/source-contract.mjs';
const now='2026-11-10T22:00:00.000Z';
const match={type:'atp',liveMatchId:'2-1-300-12',player1:{id:2,name:'Player Two'},player2:{id:1,name:'Player One'},tournament:{id:300,rankId:2},roundId:12,date:'2026-11-11T12:00:00Z',startTimeSource:'schedule',odds:{id_b_o:2,id1_o:1,id2_o:2,k1:2.3,k2:1.7}};
test('stable cross-stage identity and reversed price mapping; no use of provider model field',()=>{
 const p=parseUpcoming({matches:[{...match,modelPrediction:{player1WinProbability:.99}}],hasNextPage:false},now);
 assert.equal(p.events[0].key,'atp:1-2-300-12');assert.equal(p.events[0].price.aDecimal,1.7);assert.equal(p.events[0].price.bDecimal,2.3);
 assert.equal(p.forecastsIssued,0);assert.equal(p.events[0].modelPrediction,undefined);
 const result={...match,player1:match.player2,player2:match.player1,date:'2026-11-09T00:00:00Z',result_type:'completed',result:'6-2 6-4',match_winner:1};
 const r=parseResults({data:[result],hasNextPage:false},now,'atp').results[0];
 assert.equal(r.key,p.events[0].key);assert.equal(r.winnerId,'1');
});
test('unknown times, participants, live starts and duplicates are not valid upcoming forecasts',()=>{
 const rows=[{...match,date:null},{...match,date:'2026-11-10T20:00:00Z'},{...match,liveMatchId:'2-9-300-12'},{...match,player1:{id:2,name:'TBD'}},{...match,startTimeSource:'guess'}];
 assert.equal(parseUpcoming({matches:rows,hasNextPage:false},now).events.length,0);
 assert.equal(parseUpcoming({matches:[match,match],hasNextPage:false},now).events.length,0);
 assert.throws(()=>parseUpcoming({matches:[match],hasNextPage:true},now),/INCOMPLETE/);
});
test('postgame odds and unstable result matchId cannot enter price accounting; retirements excluded',()=>{
 const r={...match,id:999,matchId:999,result_type:'retired',result:'6-2 ret',match_winner:2,date:'2026-11-09T00:00:00Z'};
 assert.equal(parseResults({data:[r],hasNextPage:false},now,'atp').results.length,0);
 r.result_type='completed';r.result='6-2 6-4';
 const parsed=parseResults({data:[r],hasNextPage:false},now,'atp').results[0];
 assert.equal(parsed.winnerId,'2');assert.equal(parsed.price,undefined);assert.equal(parsed.matchId,undefined);
 assert.equal(parseUpcoming({matches:[{...match,odds:{...match.odds,id2_o:9}}],hasNextPage:false},now).events[0].price,null);
});
