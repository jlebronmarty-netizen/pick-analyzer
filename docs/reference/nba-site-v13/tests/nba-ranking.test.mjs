import assert from 'node:assert/strict';
import test from 'node:test';
import {rankLines,selectRankSide} from '../src/nba-ranking.mjs';
const quote={market:'props',book:'FanDuel',player_id:2,statistic:'points',period:'FT',side:'over',line:5,american_odds:-110,ot:'NOT_VERIFIED',contract:'STRICT_GREATER_THAN',source_received_at:'2026-11-24T13:00Z',quote_id:'a'};
function archive(quotes){
 const history=[2,5,7,null,0].map((pts,i)=>({pts,minutes_played:20,gameId:i,date:'2026-11-'+(20-i)+'T15:00Z'}));
 return {date:'2026-11-24',readAt:'2026-11-24T18:00Z',fixtures:[{id:1,scheduledAt:'2026-11-24T22:00Z',home:{id:3,name:'H'},away:{id:4,name:'A'}}],players:[{playerId:2,observedTeamId:3,recent:history,earlierAppearances:[history[0]]}],lineups:[],injuries:[],archivedMarkets:[{gameId:1,status:'ARCHIVED',quotes}]};
}
test('Precios únicos, lado Under, faltantes, cero real y push',()=>{
 const under={...quote,side:'under',quote_id:'b',contract:'STRICT_LESS_THAN'};
 const [pair,...rest]=rankLines(archive([quote,under,{...under,american_odds:-105,source_received_at:'2026-11-24T14:00Z'},{...quote,line:99,source_received_at:'2026-11-24T19:00Z'}]));
 const r=selectRankSide(pair);assert.equal(rest.length,0);assert.equal(pair.length,2);assert.equal(r.side,'under');assert.equal(r.price,-105);assert.equal(r.team,'Equipo sin confirmar');
 assert.equal(r.principal,true);assert.equal(r.avg10,3.5);assert.equal(r.n10,4);assert.equal(r.gap10,1.5);assert.equal(r.pct10,30);
 assert.deepEqual([r.sample10.over,r.sample10.under,r.sample10.push],[1,2,1]);assert.equal(selectRankSide(pair,'over').gap5,-1.5);
});
test('Período, OT incompatible, hito y línea cero',()=>{
 const rows=rankLines(archive([{...quote,period:'Q1'},{...quote,ot:'EXCLUDES_OT'},{...quote,line:0},{...quote,side:'yes',contract:'PROVIDER_MILESTONE_UNVERIFIED'}])).flat();
 assert.equal(rows[0].avg5,null);assert.equal(rows[0].minutes10,null);assert.equal(rows[1].gap5,null);assert.equal(rows[2].pct10,null);assert.equal(rows[3].over5,null);
});
