import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTeamSchedule} from '../src/lib/edge-lab/ncaaf-sources.mjs';

const capture={id:'source',captured_at:'2026-11-18T12:00:00Z'};
const valid={
  team:{id:'68',displayName:'Boise State',groups:{id:'8',parent:{id:'80'}}},
  season:{year:2026,type:2},requestedSeason:{year:2026,type:2},
  events:[{id:'401858433',season:{year:2026},date:'2026-09-05T19:30:00Z',
  competitions:[{id:'401858433',timeValid:true,neutralSite:false,
    status:{type:{completed:true,state:'post',name:'STATUS_FINAL'}},
    competitors:[
    {id:'68',homeAway:'away',score:{value:20},winner:false,team:{displayName:'Boise State'}},
    {id:'2483',homeAway:'home',score:{value:35},winner:true,team:{displayName:'Oregon'}}
  ]}]}]
};
const parse=b=>parseTeamSchedule(b,'68',2026,capture);
test('valid FBS event retains exactly the existing score and identity contract',()=>{
  const r=parse(valid);assert.equal(r.rows.length,1);assert.equal(r.rows[0].event_id,'espn:401858433');
  assert.equal(r.rows[0].outcome_validation,'PASS');
});
test('competition identity error now supplies the event, still rejects whole schedule',()=>{
  assert.throws(()=>parse({...valid,events:[{...valid.events[0],competitions:[{...valid.events[0].competitions[0],id:'OTHER'}]}]}),
    e=>e.message==='EVENT_IDENTITY_MISMATCH'&&e.event_id==='401858433'&&e.diagnostic==='COMPETITION_ID_CONFLICT');
});
test('requested team absent from event remains rejected',()=>{
 const e=structuredClone(valid.events[0]);e.competitions[0].competitors[0].id='999';
 assert.throws(()=>parse({...valid,events:[e]}),
   x=>x.message==='EVENT_IDENTITY_MISMATCH'&&x.event_id===e.id&&x.diagnostic==='REQUESTED_TEAM_NOT_IN_EVENT');
});
test('duplicate event ID still invalidates the whole schedule',()=>{
 assert.throws(()=>parse({...valid,events:[valid.events[0],valid.events[0]]}),
   e=>e.message==='EVENT_IDENTITY_MISMATCH'&&e.diagnostic==='DUPLICATE_EVENT_ID');
});
test('unexpected season mismatch cannot be silently skipped',()=>{
 assert.throws(()=>parse({...valid,events:[{...valid.events[0],season:{year:2025}}]}),
   e=>e.message==='EVENT_IDENTITY_MISMATCH'&&e.diagnostic==='EVENT_SEASON_MISMATCH');
});
test('timed future TBD is inventoried while valid fixtures survive',()=>{
 const e=structuredClone(valid.events[0]);e.id='401869545';e.date='2026-12-05T21:00:00Z';
 const c=e.competitions[0];c.id=e.id;c.status.type={completed:false,state:'pre',name:'STATUS_SCHEDULED'};
 c.competitors[1]={homeAway:'home',id:'-2',team:{id:'-2',displayName:'TBD'}};
 const fixture={...valid,events:[valid.events[0],e]};
 const result=parse(fixture);
 assert.equal(result.rows.length,1);
 assert.deepEqual(result.excluded,[{event_id:'espn:'+e.id,scheduled_at:e.date,reason:'UNASSIGNED_FUTURE_OPPONENT'}]);
 for(const mutate of [
  ev=>{ev.date=capture.captured_at;},ev=>{ev.competitions[0].status.type.state='post';},
  ev=>{ev.competitions[0].competitors[1].team.displayName='Unknown';},
  ev=>{ev.competitions[0].id='123';},ev=>{ev.competitions[0].competitors[0].id='999';}
 ]){
  const changed=structuredClone(e);mutate(changed);
  assert.throws(()=>parse({...valid,events:[changed]}),/EVENT_IDENTITY_MISMATCH/);
 }
});
