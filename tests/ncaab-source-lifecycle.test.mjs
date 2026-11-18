import test from 'node:test';
import assert from 'node:assert/strict';
import {ncaabSourceLifecycle} from '../src/lib/ncaab-source-lifecycle.mjs';
const frozen={event_id:'espn:401924720',home_id:'172',away_id:'2430',scheduled_at:'2026-11-14T16:00:00Z'};
const raw={event_id:frozen.event_id,home_id:frozen.home_id,away_id:frozen.away_id,scheduled_at:frozen.scheduled_at,status:'SCHEDULED',captured_at:'2026-11-14T17:00:00Z'};
test('original postponed game remains ungraded, has provider receipt',()=>{
 const x=ncaabSourceLifecycle(frozen,{...raw,status:'STATUS_POSTPONED'});
 assert.equal(x.kind,'POSTPONED');assert.equal(x.source_captured_at,raw.captured_at);assert.equal(x.provider_status,'STATUS_POSTPONED');
 assert.equal('settlement' in x,false);assert.equal('probability' in x,false);
});
test('original event rescheduled more than two hours receives review-only status',()=>{
 assert.equal(ncaabSourceLifecycle(frozen,{...raw,scheduled_at:'2026-11-15T19:00:00Z'}).kind,'RESCHEDULED');
});
test('exactly two hours is not automatically a reprogramming',()=>{
 assert.equal(ncaabSourceLifecycle(frozen,{...raw,scheduled_at:'2026-11-14T18:00:00Z'}).kind,'SCHEDULED');
});
test('cancelled and verified final statuses do not generate scores',()=>{
 assert.equal(ncaabSourceLifecycle(frozen,{...raw,status:'STATUS_CANCELLED'}).kind,'CANCELLED');
 assert.equal(ncaabSourceLifecycle(frozen,{...raw,status:'STATUS_FINAL'}).kind,'REVIEW_FINAL');
});
test('same two teams swapped remains same identity; missing team remains in review',()=>{
 assert.equal(ncaabSourceLifecycle(frozen,{...raw,home_id:frozen.away_id,away_id:frozen.home_id}).kind,'SCHEDULED');
 assert.equal(ncaabSourceLifecycle(frozen,{...raw,home_id:'999'}).kind,'REVIEW_IDENTITY');
});
test('different event IDs cannot attach statuses or identity',()=>{
 assert.equal(ncaabSourceLifecycle(frozen,{...raw,event_id:'espn:OTHER'}),null);
});
test('unknown provider statuses and broken time data fail closed',()=>{
 assert.equal(ncaabSourceLifecycle(frozen,{...raw,status:'GAME_COMPLETED'}).kind,'REVIEW_SOURCE');
 assert.equal(ncaabSourceLifecycle(frozen,{...raw,captured_at:'invalid'}).kind,'REVIEW_SOURCE');
});
