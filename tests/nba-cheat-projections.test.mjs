import test from 'node:test';
import assert from 'node:assert/strict';
import {projectionRows,topProjections} from '../src/lib/nba/cheat-projections.mjs';
test('partial terms retain a descriptive projection, missing history and stale lines stay out',()=>{
 const r={playerId:1,quoteId:'q',projection:27.01,line:23.5,odds:-102,advantage:3.51,
   statistic:'points',sample:10,quoteFreshness:'RECENT',startsAt:'2026-11-25T00:00Z',
   hit10:7,hit5:3,dataQuality:{book:'FanDuel',expiresAt:'2026-11-24T23:50Z',issues:[{reason:'OVERTIME_RULE_UNVERIFIED'}]}};
 const rows=projectionRows([r,{...r,projection:null},{...r,advantage:-3},{...r,dataQuality:{...r.dataQuality,issues:[{reason:'PLAYER_ROW_MISSING_AT_CUTOFF'}]}}]);
 assert.equal(rows.length,1);assert.equal(rows[0].warnings.length,1);
 assert.equal(topProjections([...rows,...rows],'points','ten',-200,Date.parse('2026-11-24T22:00Z')).length,1);
 assert.deepEqual(topProjections(rows,'points','h2h',-200,0),[]);
 assert.deepEqual(topProjections(rows,'points','ten',-200,Date.parse(r.dataQuality.expiresAt)),[]);
});
