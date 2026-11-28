import test from 'node:test';
import assert from 'node:assert/strict';
import {gradeTeamContract} from '../research/nhl-sheet-tracker/grade.mjs';
test('offline grade requires matched verified event, scope, market and rule',()=>{
  const c={eventId:'g1',start:'2026-11-23T20:00Z',scope:'REG',book:'test',ruleId:'r',market:'total',line:5,side:'under'};
  const r={...c,id:'r',verified:true};
  const f={eventId:'g1',scope:'REG',verified:true,home:3,away:2,observedAt:'2026-11-23T23:00Z'};
  assert.equal(gradeTeamContract(c,r,f),'push');
  for(const change of [{verified:false},{scope:'FINAL_WITH_SO'},{home:null},{away:1.2},{eventId:'other'},{observedAt:c.start}])
    assert.equal(gradeTeamContract(c,r,{...f,...change}),null);
  assert.equal(gradeTeamContract(c,{...r,book:'other'},f),null);
  assert.equal(gradeTeamContract(c,r,{...f,away:1}),'win');
  assert.equal(gradeTeamContract(c,r,{...f,away:3}),'loss');
});
