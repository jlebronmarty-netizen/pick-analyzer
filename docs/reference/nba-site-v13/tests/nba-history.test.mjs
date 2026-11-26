import test from 'node:test';
import assert from 'node:assert/strict';
import {teamHistory,average} from '../src/nba-history.mjs';
for(const n of [0,1,5,8,10])test('observed window with '+n+' games',()=>{
 const finals=Array.from({length:n},(_,i)=>({gameId:i+1,scheduledAt:'2026-11-'+String(i+1).padStart(2,'0')+'T15:00:00Z',home:'A',away:'B',homeScore:100+i,awayScore:90}));
 const report={date:'2026-11-24',finals:[...finals,...finals,{gameId:99,scheduledAt:'2026-11-25T01:00:00Z',home:'A',away:'B',homeScore:90,awayScore:80}]};
 const rows=teamHistory(report,'A',10);
 assert.equal(rows.length,n);assert.equal(teamHistory(report,'B',5).length,Math.min(n,5));assert.equal(average(rows,'pointsFor'),n?100+(n-1)/2:null);
});
import {roster,previousMeetings} from '../src/nba-history.mjs';
test('separate pregame affiliation, injury status and prior head-to-head',()=>{
 const f={id:1,home:{id:2},away:{id:3},scheduledAt:'2026-11-25T00:00:00Z'},base={gameId:1,teamId:2,capturedAt:'2026-11-24T14:00:00Z'};
 const report={date:'2026-11-24',readAt:'2026-11-24T19:00:00Z',lineups:[{...base,status:'expected',players:[{playerId:9,name:'A'}]}],injuries:[{...base,playerId:9,status:'Out'},{...base,gameId:4,playerId:10,status:'Out'}],periods:[{awayId:2,homeId:3,date:'2026-11-22T00:00:00Z'},{awayId:3,homeId:2,date:f.scheduledAt}]};
 assert.deepEqual(roster(report,f,3),[]);assert.equal(roster(report,f,2).length,1);assert.equal(roster(report,f,2)[0].availability,'Out');assert.equal(previousMeetings(report,f).length,1);
});
import {appearances} from '../src/nba-history.mjs';
test('player window retains real zeros and historical team, excludes DNP and incomplete PRA',()=>{
 const r={gameId:7,date:'2026-11-20T21:00:00Z',teamId:2,minutes_played:10,pts:0,reb:2,ast:3};
 const rows=appearances({recent:[r,r,{...r,gameId:8,minutes_played:0},{...r,gameId:9,date:'2026-11-19',teamId:5,ast:null}]},{date:'2026-11-24'},5);
 assert.deepEqual(rows.map(x=>[x.teamId,x.pra]),[[2,5],[5,null]]);assert.equal(average(rows,'pts'),0);
});
import {periodForm,estimates} from '../src/nba-history.mjs';
test('period reconciliation and missing quarters preserve team window',()=>{
 const game={gameId:2,scheduledAt:'2026-11-23T16:00:00Z',home:'H',away:'A',homeScore:108,awayScore:105};
 const p={...game,id:'bdl_nba_2',homeQuarters:[25,25,25,25],awayQuarters:[20,30,25,25],homeOvertime:[8],awayOvertime:[5]};
 const d={finals:[game,{...game,gameId:1,scheduledAt:'2026-11-22T16:00:00Z'}],date:'2026-11-24',periods:[p]};
 assert.equal(periodForm(d,'A',5,'FT').n,2);assert.equal(periodForm(d,'A',5,'2H').pf,50);assert.equal(periodForm(d,'A',5,'1H').n,1);
 assert.equal(estimates({pf:116.8,pc:111.3},{pf:109.4,pc:110.6}).away,113.69999999999999);
 assert.deepEqual(estimates({pf:null,pc:100},{pf:100,pc:90}),{});
 p.homeOvertime=[];assert.equal(periodForm(d,'A',5,'Q1').n,0);
});
import {archiveGap} from '../src/nba-history.mjs';
test('signed handicaps match the side, full-game comparisons require overtime evidence',()=>{
 const q={line:-2.5,period:'FT',book:'demo',american_odds:-110,market:'spread',contract:'SIGNED_HANDICAP',side:'away',ot:'INCLUDES_OT'},est={total:224.1,margin:3.3};
 assert.ok(Math.abs(archiveGap(q,'FT',est)-0.8)<1e-10);
 assert.ok(Math.abs(archiveGap({...q,side:'home',line:2.5},'FT',est)+0.8)<1e-10);
 assert.equal(archiveGap({...q,ot:'NOT_VERIFIED'},'FT',est),null);
 assert.equal(archiveGap(q,'Q1',est),null);
});
test('superseded starters and malformed meeting dates cannot enter the fixture profile',()=>{
 const f={id:1,home:{id:2},away:{id:3},scheduledAt:'2026-11-25T00:00:00Z'};
 const lineups=['13:00','14:00'].map((hour,i)=>({gameId:1,teamId:2,capturedAt:'2026-11-24T'+hour+':00Z',players:[{playerId:i+1}]}));
 const d={date:'2026-11-24',readAt:'2026-11-24T16:00:00Z',lineups,injuries:[],periods:[{date:null,homeId:2,awayId:3}]};
 assert.deepEqual(roster(d,f,2).map(p=>p.playerId),[2]);assert.deepEqual(previousMeetings(d,f),[]);
});
