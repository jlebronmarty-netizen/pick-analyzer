import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {planTtRecovery} from '../src/lib/edge-lab/tt-pending-recovery.mjs';

const mk=(i,base)=>({
 id:'f-'+i,sport:'TT',event_id:'netbet:fixture-'+i,status:'FORECAST',
 market:'MONEYLINE',scheduled_at:new Date(Date.parse(base)+60000*i).toISOString(),
 participant_a:'Alpha One',participant_b:'Beta Two'
});
const now=new Date('2026-11-18T18:00:00Z');
test('small TT backlogs keep original oldest-first two-call selection',()=>{
 const forecasts=Array.from({length:12},(_,i)=>mk(i,'2026-11-14T10:00:00Z'));
 const r=planTtRecovery(forecasts,[],[],[],now);
 assert.equal(r.strategy,'FAIR_OLDEST_FIRST');
 assert.equal(r.targets.length,2);
 assert.deepEqual(r.targets.map(x=>x.event_id),['netbet:fixture-0','netbet:fixture-1']);
});
test('large TT backlog reserves one provider request for recent untried final',()=>{
 const forecasts=Array.from({length:105},(_,i)=>mk(i,'2026-11-14T10:00:00Z'));
 const a=planTtRecovery(forecasts,[],[],[],now);
 assert.equal(a.strategy,'OLDEST_AND_RECENT_UNTRIED');
 assert.deepEqual(a.targets.map(x=>x.event_id),['netbet:fixture-0','netbet:fixture-104']);
 assert.equal(new Set(a.targets.map(x=>x.event_id)).size,2);
 const runs=[{sport:'TT',started_at:'2026-11-17T10:00:00Z',summary:{
  recoveries:a.targets.map(x=>({event_id:x.event_id,status:'SEARCH_CAPTURED',next_page:1,next_side:'B'}))
 }}];
 const b=planTtRecovery(forecasts,[],[],runs,now);
 assert.deepEqual(b.targets.map(x=>x.event_id),['netbet:fixture-1','netbet:fixture-103']);
});
test('large TT backlog never increases provider calls or touches other models',()=>{
 const service=fs.readFileSync('src/services/edge-lab-multi.service.mjs','utf8');
 assert.ok(service.includes("summary.collector_version='TT_PENDING_RECOVERY_V5'"));
 assert.ok(service.includes("if(plan.backlog_events>10)summary.warnings.push('TT_SETTLEMENT_BACKLOG')"));
 assert.ok(service.includes("plan.backlog_events>10?'SETTLEMENT_BACKLOG'"));
 assert.ok(service.includes("const recentPages=plan.backlog_events>10?0:plan.target?1:2"));
 assert.ok(service.includes("const response=await paced(()=>paidRead(db,request,'prematch',1,summary))"));
 assert.ok(service.includes("if(sport==='MLB' && process.env.MLB_OFFSEASON_PAUSED==='true')"));
});
