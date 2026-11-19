import test from 'node:test';
import assert from 'node:assert/strict';
import {
  utcScheduleSlot,scheduledRequestId,evaluateUpcomingNbaGames,scheduledEnvReady,runScheduledHoopsCapture,
  HOOPS_SCHEDULED_WINDOWS_UTC,
} from '../src/services/nba-hoopsapi-scheduler.service.mjs';

const env={VERCEL_ENV:'production',HOOPS_API_SCHEDULED_ENABLED:'true',HOOPS_API_KEY:'test_provider_credential',
  HOOPS_API_ACCOUNT_SCOPE:'pick-analyzer-hoopsapi-free-primary',CRON_SECRET:'test_cron_secret_valid'};
const now=new Date('2026-11-18T21:15:00.000Z');
const event={id:21718138,datetime:'2026-11-19T01:00:00Z',status_state:'scheduled'};
function rows(games=[event],time='2026-11-18T21:10:00Z',date='2026-11-18'){
  return [{source_received_at:time,payload:{meta:{provider:'BALLDONTLIE',date_local:date},data:{games}}}];
}
function store() {
  const attempts=new Map(),captures=new Map();
  let calls=0;
  return {
    attempts,captures,
    status:async()=>({enabled:true,remaining_app_reservations:8,blocked_until:null,uncertain_or_in_flight:false}),
    claim:async()=>{throw new Error('Manual claim must not run from cron');},
    claimScheduled:async(account,id)=>{
      const prev=attempts.get(id);
      if (prev) return {status:'ALREADY_CLAIMED',attempt_id:id,capture_id:captures.has(id)?id:null};
      attempts.set(id,{status:'reserved'}); return {status:'RESERVED',attempt_id:id};
    },
    dispatch:async(account,id)=>{const x=attempts.get(id);if (x.status!=='reserved') return {status:'DISPATCH_DENIED'};x.status='dispatched';return {status:'DISPATCH_GRANTED'};},
    complete:async(account,id,evidence)=>{captures.set(id,{...evidence.normalized,capture_id:id});attempts.get(id).status='succeeded';return {status:'ARCHIVED',capture_id:id};},
    fail:async(account,id)=>{attempts.get(id).status='failed';return {status:'FAILURE_RECORDED'};},
    capture:async(account,id)=>{const x=captures.get(id);return x?{...x,capture_persisted:true}:null;},
    setRemaining:value=>{const base=(...args)=>({enabled:true,remaining_app_reservations:value,blocked_until:null,uncertain_or_in_flight:false});return base;},
    get calls(){return calls;},increment:()=>{calls++;},
  };
}
const providerBody={games:[{game_id:123,competition:'NBA',home:'Home',away:'Away',
  periods:{q1:{fanduel:{total:{line:57.5,over:1.9,under:1.9}}}}}]};
const fakeProvider=async(s)=>{s.increment();return new Response(JSON.stringify(providerBody),{status:200});};

test('exact UTC triple schedule and Puerto Rico local date, no off-schedule dispatch',()=>{
  assert.deepEqual(HOOPS_SCHEDULED_WINDOWS_UTC.map(x=>x.hour),[15,21,23]);
  for(const iso of ['2026-11-18T15:15:00Z','2026-11-18T21:15:00Z','2026-11-18T23:15:00Z'])
    assert.equal(utcScheduleSlot(iso).local_date,'2026-11-18');
  assert.equal(utcScheduleSlot('2026-11-18T21:35:00Z')?.label,'early-evening');
  assert.equal(utcScheduleSlot('2026-11-18T21:36:00Z'),null);
  assert.equal(utcScheduleSlot('2026-11-18T20:45:00Z'),null);
  assert.equal(utcScheduleSlot('2026-11-18T23:15:00Z').label,'late-evening');
});
test('stable deterministic valid v4-style request IDs across duplicate invocations',()=>{
 const slot=utcScheduleSlot(now);
 const one=scheduledRequestId(env.HOOPS_API_ACCOUNT_SCOPE,slot);
 assert.equal(one,scheduledRequestId(env.HOOPS_API_ACCOUNT_SCOPE,utcScheduleSlot('2026-11-18T21:20:00Z')));
 assert.match(one,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
 assert.notEqual(one,scheduledRequestId(env.HOOPS_API_ACCOUNT_SCOPE,utcScheduleSlot('2026-11-18T23:15:00Z')));
});
test('recent NBA slate with future local games gates capture',()=>{
 assert.equal(evaluateUpcomingNbaGames(rows(),now).status,'NBA_GAMES_PENDING');
 assert.equal(evaluateUpcomingNbaGames(rows([],undefined),now).status,'NO_MORE_TODAY_NBA_GAMES');
 assert.equal(evaluateUpcomingNbaGames(rows([event],'2026-11-18T16:10:00Z'),now).status,'FRESH_LOCAL_NBA_SCHEDULE_UNAVAILABLE');
 assert.equal(evaluateUpcomingNbaGames(rows([{...event,datetime:'2026-11-18T20:00:00Z'}]),now).status,'NO_MORE_TODAY_NBA_GAMES');
 assert.equal(evaluateUpcomingNbaGames(rows([{...event,datetime:'2026-11-19T06:00:00Z'}]),now).status,'NO_MORE_TODAY_NBA_GAMES');
 assert.equal(evaluateUpcomingNbaGames(rows([event],undefined,'2026-11-17'),now).status,'FRESH_LOCAL_NBA_SCHEDULE_UNAVAILABLE');
 assert.equal(evaluateUpcomingNbaGames(rows([{...event,status_state:'final'}]),now).status,'NO_MORE_TODAY_NBA_GAMES');
});
test('production feature switch fails closed, missing credential fails closed',async()=>{
 const s=store();
 assert.equal(scheduledEnvReady({...env,HOOPS_API_SCHEDULED_ENABLED:'false'}).enabled,false);
 assert.equal(scheduledEnvReady({...env,HOOPS_API_KEY:''}).safe_configuration,false);
 const disabled=await runScheduledHoopsCapture({env:{...env,HOOPS_API_SCHEDULED_ENABLED:'false'},now,store:s,readSlate:async()=>{throw Error('no DB');}});
 assert.equal(disabled.status,'SCHEDULE_DISABLED');assert.equal(s.calls,0);
 const unavailable=await runScheduledHoopsCapture({env:{...env,HOOPS_API_KEY:''},now,store:s,readSlate:async()=>rows()});
 assert.equal(unavailable.status,'SCHEDULE_CONFIGURATION_UNAVAILABLE');assert.equal(s.calls,0);
});
test('empty, stale, unavailable schedule and exhausted reserve cause zero HoopsAPI calls',async()=>{
 const s=store();
 for(const readSlate of [async()=>[],async()=>rows([],undefined),async()=>rows([event],'2026-11-18T14:00:00Z'),async()=>{throw Error('db unavailable');}]){
  const out=await runScheduledHoopsCapture({env,now,store:s,readSlate,fetcher:()=>fakeProvider(s)});
  assert.equal(out.provider_calls_made,0);
 }
 s.status=async()=>({enabled:true,remaining_app_reservations:2,blocked_until:null,uncertain_or_in_flight:false});
 const quota=await runScheduledHoopsCapture({env,now,store:s,readSlate:async()=>rows(),fetcher:()=>fakeProvider(s)});
 assert.equal(quota.status,'SCHEDULE_QUOTA_PREFLIGHT_BLOCKED');assert.equal(s.calls,0);
});
test('one scheduled capture archives, duplicate invocation replays without another provider request',async()=>{
 const s=store();
 const opts={env,now,store:s,readSlate:async()=>rows(),fetcher:()=>fakeProvider(s)};
 const first=await runScheduledHoopsCapture(opts);
 assert.equal(first.capture_persisted,true);
 assert.equal(first.provider_calls_made,1);
 assert.equal(first.quote_sides,2);
 const second=await runScheduledHoopsCapture(opts);
 assert.equal(second.provider_calls_made,0);assert.equal(second.capture_persisted,true);
 assert.equal(s.calls,1);assert.equal(s.attempts.size,1);
});
