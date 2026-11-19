import test from 'node:test';
import assert from 'node:assert/strict';
import {collegeNumericEvaluation} from '../src/lib/college-numeric-evaluation.mjs';

const row={forecast_id:'margin1',event_id:'espn:1',model_version:'NCAAF_PPG_V1_PICK_PORT_1',
 market:'POINT_MARGIN',outcome_status:'NUMERIC',projection:10,actual:24,absolute_error:14};

test('only valid NUMERIC outcomes contribute to MAE and its exact denominator',()=>{
 const rows=[row,{...row,forecast_id:'zero',absolute_error:0},
  {...row,forecast_id:'dispute',outcome_status:'DISPUTE',absolute_error:null},
  {...row,forecast_id:'unverifiable',outcome_status:'NOT_VERIFIABLE',absolute_error:2},
  {...row,forecast_id:'win',outcome_status:'W',absolute_error:0}];
 const summary=collegeNumericEvaluation(rows,'POINT_MARGIN');
 assert.equal(summary.n,2);assert.equal(summary.mae,7);
 assert.equal(summary.excluded.nonNumeric,3);
 assert.equal(summary.loadedRows,summary.n+summary.duplicateRows+Object.values(summary.excluded).reduce((a,b)=>a+b,0));
});

test('null and non-finite or coerced errors never become perfect predictions',()=>{
 const rows=[null,undefined,'0','',true,false,NaN,Infinity,-1].map((error,i)=>({...row,forecast_id:'bad'+i,absolute_error:error}));
 const summary=collegeNumericEvaluation(rows,'POINT_MARGIN');
 assert.equal(summary.n,0);assert.equal(summary.mae,null);
 assert.equal(summary.excluded.invalidError,rows.length);
 const withValid=collegeNumericEvaluation([row,...rows],'POINT_MARGIN');
 assert.equal(withValid.n,1);assert.equal(withValid.mae,14);
});

test('identical duplicates count once and conflicting duplicate outcomes are order independent',()=>{
 const copies=[row,{...row}];
 const summary=collegeNumericEvaluation(copies,'POINT_MARGIN');
 assert.equal(summary.n,1);assert.equal(summary.mae,14);assert.equal(summary.duplicateRows,1);
 const conflict=[...copies,{...row,absolute_error:0},{...row,forecast_id:'valid',absolute_error:8}];
 const a=collegeNumericEvaluation(conflict,'POINT_MARGIN'),b=collegeNumericEvaluation([...conflict].reverse(),'POINT_MARGIN');
 assert.deepEqual(a,b);assert.equal(a.n,1);assert.equal(a.mae,8);
 assert.equal(a.excluded.conflictingDuplicates,1);assert.equal(a.duplicateRows,2);
});

test('ledger rows and diagnostic rows produce the same strict sample',()=>{
 const diagnostics=[row,{...row,forecast_id:'dispute',outcome_status:'DISPUTE',absolute_error:null},
  {...row,forecast_id:'total',market:'TOTAL_POINTS',absolute_error:5},
  {...row,forecast_id:'zero',absolute_error:0}];
 const ledger=diagnostics.map(({forecast_id,outcome_status,absolute_error,actual,...r})=>({...r,id:forecast_id,status:'PROJECTION',outcome:{status:outcome_status,absolute_error,actual}}));
 for(const market of ['POINT_MARGIN','TOTAL_POINTS']){
  assert.deepEqual(collegeNumericEvaluation(ledger,market,{source:'ledger'}),collegeNumericEvaluation(diagnostics,market));
 }
 assert.equal(collegeNumericEvaluation(ledger,'POINT_MARGIN',{source:'ledger'}).n,2);
 assert.equal(collegeNumericEvaluation(ledger,'TOTAL_POINTS',{source:'ledger'}).n,1);
 const abstained={...ledger[0],status:'ABSTAIN'};
 assert.equal(collegeNumericEvaluation([abstained],'POINT_MARGIN',{source:'ledger'}).n,0);
});

test('missing identities, empty cohorts and unrelated markets never imply a numeric sample',()=>{
 const report=collegeNumericEvaluation([{...row,forecast_id:''},{...row,forecast_id:null}],'POINT_MARGIN');
 assert.equal(report.n,0);assert.equal(report.excluded.invalidIdentity,2);
 assert.equal(collegeNumericEvaluation([],'POINT_MARGIN').mae,null);
 assert.equal(collegeNumericEvaluation(null,'TOTAL_POINTS').n,0);
 assert.equal(collegeNumericEvaluation([{...row,market:'MONEYLINE'}],'MONEYLINE').n,0);
});
