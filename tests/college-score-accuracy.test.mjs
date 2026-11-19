import test from 'node:test';
import assert from 'node:assert/strict';
import {collegeScoreAccuracy} from '../src/lib/college-score-accuracy.mjs';

const base={event_id:'game1',state:'FORECAST',review_required:false,
 created_at:'2026-11-18T18:00:00Z',scheduled_at:'2026-11-18T20:00:00Z',
 projected_margin:5,projected_total:150,
 settlement:{home_score:80,away_score:65,observed_at:'2026-11-19T00:00:00Z'}};
test('scores independent frozen margin and total errors without sportsbook lines',()=>{
 const report=collegeScoreAccuracy([base]);
 assert.deepEqual(report,{games:1,marginMae:10,totalMae:5,marginBias:-10,totalBias:5,scoring:'NUMERIC_ONLY_NOT_BETTING_ACCURACY'});
});
test('blocks duplicate, post-start, reviewed and non-settled observations',()=>{
 const rows=[base,{...base,event_id:'game2',created_at:'2026-11-18T21:00:00Z'},
 {...base,event_id:'game3',review_required:true},{...base,event_id:'game4',settlement:null},
 {...base,event_id:'game5',settlement:{...base.settlement,observed_at:'2026-11-18T19:00:00Z'}},
 {...base,event_id:'game1',projected_margin:999}];
 assert.equal(collegeScoreAccuracy(rows).games,1);
});
test('empty sample is null, never fabricated accuracy',()=>{
 const x=collegeScoreAccuracy([]);
 assert.equal(x.games,0);assert.equal(x.marginMae,null);assert.equal(x.totalMae,null);
});
