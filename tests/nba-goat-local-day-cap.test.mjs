import test from 'node:test';
import assert from 'node:assert/strict';
import {NBA_GOAT_POLICY,NBA_GOAT_CONTINUOUS_DAILY_ROW_CAP,nbaGoatDailyUsage,nbaGoatGate} from '../src/lib/nba/goat-provider-policy.mjs';

// Exact created_at values from the nine archived GOAT rows that exhausted the
// UTC Nov 22 counter at 19:29:55 Puerto Rico, despite belonging to local Nov 21.
const incidentTimestamps=[
 '2026-11-22T00:00:29.481710+00:00',
 '2026-11-22T00:00:29.614718+00:00',
 '2026-11-22T00:00:29.661725+00:00',
 '2026-11-22T00:30:30.036707+00:00',
 '2026-11-22T00:30:30.163758+00:00',
 '2026-11-22T00:30:30.216500+00:00',
 '2026-11-22T01:00:32.141644+00:00',
 '2026-11-22T01:00:32.237463+00:00',
 '2026-11-22T01:00:32.327797+00:00',
];
const row=(created_at,model_version='nba_prediction_engine_v1')=>({created_at,model_version,feature_snapshot:{goatProviderPolicy:NBA_GOAT_POLICY}});
const incident=incidentTimestamps.map((stamp,i)=>row(stamp,i<6?'nba_prediction_engine_v1':'nba_prediction_engine_v1_1_inputs_shadow'));
const gateFor=rowsToday=>nbaGoatGate({enabled:true,continuousEnabled:true,repairEnabled:false,pending:0,rowsToday,statsCurrent:true,priceCount:30,contractCount:30,completedRuns:2,repairedRuns:1,canaryRows:12});

test('real Nov 21 PR emissions do not exhaust the Nov 22 PR cap',()=>{
 const now=new Date('2026-11-22T23:29:55Z');
 const original=JSON.stringify(incident);
 const oldUtcCount=incident.filter(p=>p.created_at.slice(0,10)===now.toISOString().slice(0,10)).length;
 assert.equal(oldUtcCount,9);
 assert.deepEqual(gateFor(oldUtcCount).blockers,['DAILY_SHADOW_ROW_CAP']);
 assert.deepEqual(nbaGoatDailyUsage(incident,now),{dateLocal:'2026-11-22',timeZone:'America/Puerto_Rico',rows:0,nextResetAt:'2026-11-23T04:00:00.000Z',lastCreatedAt:'2026-11-22T01:00:32.327Z'});
 assert.equal(gateFor(nbaGoatDailyUsage(incident,now).rows).allowed,true);
 assert.equal(JSON.stringify(incident),original);
});

test('all nine real rows count against Nov 21 across both model versions',()=>{
 const usage=nbaGoatDailyUsage(incident,new Date('2026-11-22T01:05:00Z'));
 assert.equal(usage.dateLocal,'2026-11-21');
 assert.equal(usage.rows,9);
 assert.deepEqual(gateFor(usage.rows).blockers,['DAILY_SHADOW_ROW_CAP']);
 assert.equal(gateFor(usage.rows).perRunWriteCap,0);
});

test('20:00 Puerto Rico / midnight UTC does not reset the operational day or cap',()=>{
 const alreadyEmitted=Array.from({length:9},()=>row('2026-11-22T19:00:00-04:00'));
 for(const stamp of ['2026-11-22T23:59:59.999Z','2026-11-23T00:00:00Z']){
  const usage=nbaGoatDailyUsage(alreadyEmitted,new Date(stamp));
  assert.equal(usage.dateLocal,'2026-11-22');
  assert.equal(usage.rows,9);
  assert.equal(gateFor(usage.rows).allowed,false);
 }
});

test('midnight Puerto Rico resets the operational day and excludes the preceding day',()=>{
 const before=nbaGoatDailyUsage(incident,new Date('2026-11-22T03:59:59.999Z'));
 const after=nbaGoatDailyUsage(incident,new Date('2026-11-22T04:00:00Z'));
 assert.deepEqual(before,{dateLocal:'2026-11-21',timeZone:'America/Puerto_Rico',rows:9,nextResetAt:'2026-11-22T04:00:00.000Z',lastCreatedAt:'2026-11-22T01:00:32.327Z'});
 assert.deepEqual(after,{dateLocal:'2026-11-22',timeZone:'America/Puerto_Rico',rows:0,nextResetAt:'2026-11-23T04:00:00.000Z',lastCreatedAt:'2026-11-22T01:00:32.327Z'});
 const withMidnightRow=[...incident,row('2026-11-22T00:00:00-04:00')];
 assert.equal(nbaGoatDailyUsage(withMidnightRow,new Date('2026-11-22T04:00:00Z')).rows,1);
});

test('equivalent instants with Z, positive and negative offsets share the same PR day',()=>{
 const equivalent=['2026-11-22T01:00:00Z','2026-11-21T21:00:00-04:00','2026-11-22T02:00:00+01:00','2026-11-21T20:00:00-05:00'];
 for(const stamp of equivalent){
  assert.equal(nbaGoatDailyUsage([row(stamp)],new Date('2026-11-22T01:05:00Z')).rows,1);
  assert.equal(nbaGoatDailyUsage([row(stamp)],new Date('2026-11-22T23:29:55Z')).rows,0);
 }
});

test('invalid or timezone-free GOAT timestamps fail closed; legacy rows remain excluded',()=>{
 const now=new Date('2026-11-22T23:29:55Z');
 for(const stamp of [undefined,null,'','not-a-date','2026-11-22T15:00:00','2026-11-22','2026-11-22T25:00:00Z']){
  assert.throws(()=>nbaGoatDailyUsage([row(stamp)],now),/NBA_GOAT_HISTORY_TIMESTAMP_INVALID/);
 }
 assert.throws(()=>nbaGoatDailyUsage(incident,new Date('invalid')),RangeError);
 assert.equal(nbaGoatDailyUsage([{created_at:'invalid',feature_snapshot:{}}],now).rows,0);
});

test('daily cap stays nine, per-run maximum stays three, and the final slot stays bounded',()=>{
 assert.equal(NBA_GOAT_CONTINUOUS_DAILY_ROW_CAP,9);
 for(const used of [0,1,6])assert.equal(gateFor(used).perRunWriteCap,3);
 assert.equal(gateFor(7).perRunWriteCap,2);
 assert.equal(gateFor(8).perRunWriteCap,1);
 assert.equal(gateFor(9).perRunWriteCap,0);
 assert.deepEqual(gateFor(9).blockers,['DAILY_SHADOW_ROW_CAP']);
});

test('correcting the day does not bypass freshness, contract, scheduler or pending gates',()=>{
 const base={enabled:true,continuousEnabled:true,repairEnabled:false,pending:0,rowsToday:0,statsCurrent:true,priceCount:30,contractCount:30,completedRuns:2,repairedRuns:1,canaryRows:12};
 const cases=[
  [{enabled:false},'SCHEDULER_DISABLED'],
  [{statsCurrent:false},'CURRENT_SEASON_STATS_MISSING_OR_STALE'],
  [{priceCount:0},'NO_FRESH_PREGAME_GOAT_QUOTES'],
  [{contractCount:0},'CONTRACT_SCOPE_REQUIRES_VERIFICATION'],
  [{pending:60},'PENDING_SHADOW_REVIEW_REQUIRED'],
 ];
 for(const [change,blocker] of cases){
  const gate=nbaGoatGate({...base,...change});
  assert.equal(gate.allowed,false);
  assert.ok(gate.blockers.includes(blocker));
 }
});

test('deployment counts rows already emitted by the UTC implementation within the same local day',()=>{
 const beforeDeployment=Array.from({length:6},(_,i)=>row(i<3?'2026-11-22T20:00:30-04:00':'2026-11-22T20:30:30-04:00'));
 const now=new Date('2026-11-23T00:45:00Z');
 const before=nbaGoatDailyUsage([...incident,...beforeDeployment],now);
 assert.equal(before.dateLocal,'2026-11-22');
 assert.equal(before.rows,6);
 assert.equal(gateFor(before.rows).perRunWriteCap,3);
 const afterDeployment=Array.from({length:3},()=>row('2026-11-22T21:00:30-04:00','nba_prediction_engine_v1_1_inputs_shadow'));
 const after=nbaGoatDailyUsage([...incident,...beforeDeployment,...afterDeployment],new Date('2026-11-23T01:05:00Z'));
 assert.equal(after.rows,9);
 assert.deepEqual(gateFor(after.rows).blockers,['DAILY_SHADOW_ROW_CAP']);
});

test('next reset is local midnight across year and leap-day boundaries',()=>{
 for(const [now,dateLocal,nextResetAt] of [
  ['2026-12-31T23:59:59-04:00','2026-12-31','2027-01-01T04:00:00.000Z'],
  ['2028-02-28T20:00:00-04:00','2028-02-28','2028-02-29T04:00:00.000Z'],
  ['2028-02-29T20:00:00-04:00','2028-02-29','2028-03-01T04:00:00.000Z'],
 ]){
  const usage=nbaGoatDailyUsage([],new Date(now));
  assert.deepEqual(usage,{dateLocal,timeZone:'America/Puerto_Rico',rows:0,nextResetAt,lastCreatedAt:null});
 }
});

test('last emission reports the newest GOAT row without confusing legacy or current read time',()=>{
 const now=new Date('2026-11-22T23:29:55Z');
 const shuffled=[incident[8],incident[0],{created_at:now.toISOString(),feature_snapshot:{}}];
 const usage=nbaGoatDailyUsage(shuffled,now);
 assert.equal(usage.rows,0);
 assert.equal(usage.lastCreatedAt,'2026-11-22T01:00:32.327Z');
 assert.notEqual(usage.lastCreatedAt,now.toISOString());
});
