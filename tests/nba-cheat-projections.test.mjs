import test from 'node:test';
import assert from 'node:assert/strict';
import {projectionRows,topProjections} from '../src/lib/nba/cheat-projections.mjs';
test('partial terms retain a descriptive projection, missing history and stale lines stay out',()=>{
 const r={playerId:1,quoteId:'q',projection:27.01,line:23.5,odds:-102,advantage:3.51,
   statistic:'points',sample:10,quoteFreshness:'RECENT',startsAt:'2026-11-25T00:00Z',
   hit10:7,hit5:3,dataQuality:{book:'FanDuel',expiresAt:'2026-11-24T23:50Z',issues:[{reason:'OVERTIME_RULE_UNVERIFIED'}]}};
 const rows=projectionRows([r,{...r,projection:null},{...r,advantage:-3},{...r,dataQuality:{...r.dataQuality,issues:[{reason:'PLAYER_ROW_MISSING_AT_CUTOFF'}]}}]);
 assert.equal(rows.length,1);assert.equal(rows[0].warnings.length,1);
 assert.equal(topProjections([...rows,...rows],'points','ten',-250,Date.parse('2026-11-24T22:00Z')).length,1);
 assert.deepEqual(topProjections(rows,'points','h2h',-250,0),[]);
 assert.deepEqual(topProjections(rows,'points','ten',-250,Date.parse(r.dataQuality.expiresAt)),[]);
});

import {projectionHistories} from '../src/lib/nba/cheat-game-history.mjs';
import {buildNbaDecisionBoard} from '../src/lib/nba/decision-board-core.mjs';
import {inputs} from './fixtures/nba-shead-inputs.mjs';
test('bar values reproduce both averages from the same dated games',()=>{
 const sample=inputs(),board=buildNbaDecisionBoard(sample),row=board.rows.props[0];
 const history=projectionHistories(board,sample)[row.historyKey];
 assert.equal(history.trend.length,10);
 for(const [n,expected] of [[5,row.l5],[10,row.l10]]){
   const values=history.trend.slice(0,n);
   assert.equal(values.reduce((total,g)=>total+g.value,0)/n,expected);
 }
 const old=sample.playerHistory.find(r=>r.provider_game_id===history.trend[1].id);
 sample.playerHistory.push(old);
 assert.equal(projectionHistories(board,sample)[row.historyKey].trend.length,0);
});
