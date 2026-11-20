import test from 'node:test';
import assert from 'node:assert/strict';
import {collegeScoreAccuracy} from '../src/lib/college-score-accuracy.mjs';

const base={event_id:'game1',state:'FORECAST',review_required:false,
 created_at:'2026-11-18T18:00:00Z',scheduled_at:'2026-11-18T20:00:00Z',
 projected_margin:5,projected_total:150,
 settlement:{home_score:80,away_score:65,observed_at:'2026-11-19T00:00:00Z'}};
test('scores independent frozen margin and total errors without sportsbook lines',()=>{
 const report=collegeScoreAccuracy([base]);
 assert.deepEqual(report,{games:1,marginMae:10,totalMae:5,marginBias:-10,totalBias:5,scoring:'NUMERIC_ONLY_NOT_BETTING_ACCURACY',
  audit:{loadedRows:1,uniqueEvents:1,duplicateRows:0,invalidIdentityRows:0,
   excluded:{conflictingDuplicates:0,nonForecast:0,reviewRequired:0,pending:0,invalidTiming:0,invalidNumeric:0}}});
});
test('blocks duplicate, post-start, reviewed and non-settled observations',()=>{
 const rows=[base,{...base,event_id:'game2',created_at:'2026-11-18T21:00:00Z'},
 {...base,event_id:'game3',review_required:true},{...base,event_id:'game4',settlement:null},
 {...base,event_id:'game5',settlement:{...base.settlement,observed_at:'2026-11-18T19:00:00Z'}},
 {...base}, {...base,event_id:'game6',state:'ABSTAIN'}, {...base,event_id:null}];
 const report=collegeScoreAccuracy(rows);
 assert.equal(report.games,1);assert.equal(report.audit.duplicateRows,1);
 assert.equal(report.audit.invalidIdentityRows,1);
 assert.deepEqual(report.audit.excluded,{conflictingDuplicates:0,nonForecast:1,reviewRequired:1,pending:1,invalidTiming:2,invalidNumeric:0});
 assert.equal(report.audit.loadedRows,report.games+report.audit.duplicateRows+report.audit.invalidIdentityRows+Object.values(report.audit.excluded).reduce((a,b)=>a+b,0));
});
test('conflicting duplicates exclude the event instead of selecting a result by input order',()=>{
 const rows=[base,{...base,projected_margin:15},{...base,event_id:'game2'}];
 const a=collegeScoreAccuracy(rows),b=collegeScoreAccuracy([...rows].reverse());
 assert.deepEqual(a,b);assert.equal(a.games,1);assert.equal(a.marginMae,10);
 assert.equal(a.audit.excluded.conflictingDuplicates,1);assert.equal(a.audit.duplicateRows,1);
});
test('invalid numeric values and tied finals cannot enter the numeric cohort',()=>{
 const rows=[null,Infinity,NaN,'5',false].map((value,i)=>({...base,event_id:'projection'+i,projected_margin:value}));
 rows.push({...base,event_id:'score',settlement:{...base.settlement,home_score:Infinity}},
  {...base,event_id:'negative',settlement:{...base.settlement,away_score:-1}},
  {...base,event_id:'tie',settlement:{...base.settlement,away_score:80}});
 const report=collegeScoreAccuracy(rows);assert.equal(report.games,0);assert.equal(report.marginMae,null);
 assert.equal(report.audit.excluded.invalidNumeric,rows.length);
});
test('empty sample is null, never fabricated accuracy',()=>{
 const x=collegeScoreAccuracy([]);
 assert.equal(x.games,0);assert.equal(x.marginMae,null);assert.equal(x.totalMae,null);
 assert.equal(x.audit.loadedRows,0);assert.equal(x.audit.uniqueEvents,0);
});
