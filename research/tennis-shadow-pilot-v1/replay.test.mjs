import assert from 'node:assert/strict';
import test from 'node:test';
import {replay} from './replay.mjs';
const mk=(day,tournament,winner,loser,rankId=2)=>({
 date:day+'T12:00:00Z',player1:{id:winner,name:'Player '+winner},player2:{id:loser,name:'Player '+loser},
 tournament:{id:tournament,rankId},roundId:1,liveMatchId:[winner,loser,tournament,1].join('-'),
 match_winner:winner,result_type:'completed',result:'6-3 6-4',
});
const input=(rows)=>({holdoutFrom:'2026-10-04',holdoutThrough:'2026-10-05',
 captures:[{tour:'atp',observedAt:'2026-10-07T00:00:00Z',body:{data:rows,hasNextPage:false}}]});
const warm=['01','02','03'].flatMap((d,i)=>[mk('2026-10-'+d,10+i,1,3),mk('2026-10-'+d,20+i,4,2)]);
test('winner-first response does not leak the label; same-day results cannot change a pick',()=>{
 const day='2026-10-04';
 const a=replay(input([...warm,mk(day,30,1,2),mk(day,40,2,1)]));
 const b=replay(input([...warm,mk(day,30,2,1),mk(day,40,1,2)]));
 assert.equal(a.summaries.atp.issued,2);
 assert.deepEqual(a.forecasts.map(x=>x.probabilityA),b.forecasts.map(x=>x.probabilityA));
 assert.ok(a.forecasts.every(x=>x.selectedId==='p1'&&x.lastDateA==='2026-10-03'));
 assert.equal(a.summaries.atp.correct,1);
 assert.equal(a.summaries.wta.issued,0);
 assert.equal(a.roi,null);
});
test('partial pages fail closed; duplicates, outside-tour and ambiguous results are excluded',()=>{
 const f=mk('2026-10-04',30,1,2);
 const d=input([...warm,f,f,mk('2026-10-04',32,1,2,1),{...mk('2026-10-04',33,1,2),result_type:'retired'}]);
 const r=replay(d);
 assert.equal(r.forecasts.length,0);
 assert.equal(r.excluded.CONFLICTING_IDENTITIES,1);
 assert.equal(r.excluded.OUTSIDE_VERIFIED_MAIN_SINGLES,1);
 assert.equal(r.excluded.NON_DECISIVE_OR_AMBIGUOUS_RESULT,1);
 d.captures[0].body.hasNextPage=true;
 assert.throws(()=>replay(d),/SOURCE_SCHEMA_OR_PAGE_INCOMPLETE/);
});
