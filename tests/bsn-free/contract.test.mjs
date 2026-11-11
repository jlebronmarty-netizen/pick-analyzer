import test from 'node:test';
import assert from 'node:assert/strict';
import {envelope,auditGames,auditTeamStats,auditPlayers,buildTasks,SEASONS} from '../../scripts/bsn-free/archive-contract.mjs';
const game=(id=1)=>({id,date:'2024-04-04T00:00:00+00:00',timestamp:1712188800,league:{id:76,season:2024},status:{short:'FT'},teams:{home:{id:2239,name:'Mets'},away:{id:1645,name:'Osos'}},scores:{home:{quarter_1:25,quarter_2:19,quarter_3:14,quarter_4:35,over_time:null,total:93},away:{quarter_1:20,quarter_2:24,quarter_3:24,quarter_4:33,over_time:null,total:101}}});
test('envelope fails closed on provider errors, truncation and pagination',()=>{
 for(const x of [{errors:{plan:'Unavailable'},results:0,response:[]},{errors:[],results:2,response:[]},{errors:[],results:0,response:[],paging:{total:2}}])assert.throws(()=>envelope(x));
 assert.deepEqual(envelope({errors:[],results:0,response:[]}),[]);
});
test('final identity, scoring, clocks, status and duplicate quarantine',()=>{
 const g=game();assert.equal(auditGames([g],2024).accepted.length,1);
 for(const mutate of [g=>g.league.id=1,g=>g.scores.home.total=94,g=>g.status.short='NS',g=>g.timestamp=1,g=>g.teams.away.id=g.teams.home.id]){
  const bad=structuredClone(g);mutate(bad);assert.equal(auditGames([bad],2024).accepted.length,0);
 }
 assert.equal(auditGames([g,g],2024).excluded.length,2);
 assert.equal(auditGames([g],2024).coverageCertified,false);
});
const stats=(gameId,teamId,fg,tp,ft)=>({game:{id:gameId},team:{id:teamId},field_goals:{total:fg,attempts:78},threepoint_goals:{total:tp,attempts:34},freethrows_goals:{total:ft,attempts:32},rebounds:{total:38,offence:14,defense:24},assists:10,steals:9,blocks:2,turnovers:10,personal_fouls:22});
test('reproduces both supplied team scoring checks; excludes missing/duplicate teams',()=>{
 const g=auditGames([game()],2024).accepted;
 assert.equal(auditTeamStats([stats(1,2239,32,12,17),stats(1,1645,31,10,29)],g).accepted.length,2);
 g[0].homeScore=81;g[0].awayScore=82;
 const bad=auditTeamStats([stats(1,2239,30,8,15),stats(1,1645,28,5,22)],g);
 assert.equal(bad.accepted.length,0);assert.ok(bad.excluded.every(x=>x.reasons.includes('POINTS_MISMATCH')));
 assert.equal(auditTeamStats([],g).excluded.length,2);
 assert.ok(auditTeamStats([stats(1,2239,30,8,15),stats(1,2239,30,8,15)],g).excluded.some(x=>x.reasons.includes('DUPLICATE_TEAM')));
});
test('queue batches <=20 exact game ids; player rows never silently admitted',()=>{
 const gs=Array.from({length:45},(_,i)=>auditGames([game(i+1)],2024).accepted[0]);
 const q=buildTasks(SEASONS,gs);
 assert.equal(q.length,19);assert.equal(new Set(q.map(t=>t.url)).size,q.length);
 for(const t of q.filter(x=>x.kind==='teams'||x.kind==='players'))assert.ok(t.games.length<=20);
 assert.equal(auditPlayers([],gs).admittedForModeling,false);
 assert.ok(auditPlayers([{game:{id:1},team:{id:999},player:{id:1}}],gs).issues.length);
});
