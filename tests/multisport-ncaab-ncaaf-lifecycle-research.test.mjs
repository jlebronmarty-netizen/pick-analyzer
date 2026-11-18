import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyNcaabUnsettled} from '../src/lib/ncaab-unsettled-lifecycle-research.mjs';
import {reviewNcaafDispute} from '../src/lib/edge-lab/ncaaf-dispute-review-research.mjs';

const b={event_id:'espn:401924720',scheduled_at:'2026-11-14T16:00:00Z',home_id:'1',away_id:'2'};
const observation=(status,scheduled_at=b.scheduled_at,extras={})=>({event_id:b.event_id,
 home_id:'1',away_id:'2',captured_at:'2026-11-15T02:00:00Z',
 scheduled_at,status,...extras});
test('NCAAB postponed is never scored as a loss or final',()=>{
 const r=classifyNcaabUnsettled(b,[observation('STATUS_POSTPONED')]);
 assert.equal(r.status,'REVIEW_POSTPONED');assert.equal(r.settlement,null);
});
test('NCAAB rescheduled beyond two hours requires review',()=>{
 const r=classifyNcaabUnsettled(b,[observation('STATUS_SCHEDULED','2026-11-15T16:00:00Z')]);
 assert.equal(r.status,'REVIEW_RESCHEDULED');assert.equal(r.settlement,null);
});
test('NCAAB small timing drift still needs actual verified final',()=>{
 const r=classifyNcaabUnsettled(b,[observation('STATUS_SCHEDULED','2026-11-14T17:00:00Z')]);
 assert.equal(r.status,'PENDING_FINAL');assert.equal(r.settlement,null);
});
test('NCAAB final status defers to existing immutable reconciliation',()=>{
 const r=classifyNcaabUnsettled(b,[observation('STATUS_FINAL')]);
 assert.equal(r.status,'REVIEW_FINAL_EXISTING_RECONCILER');assert.equal(r.officialPick,false);
});
test('NCAAB fails closed on altered ID, teams and unsafe tolerance',()=>{
 assert.equal(classifyNcaabUnsettled(b,[observation('STATUS_FINAL',b.scheduled_at,{event_id:'espn:other'})]).status,'REVIEW_SOURCE_CONFLICT');
 assert.equal(classifyNcaabUnsettled(b,[observation('STATUS_FINAL',b.scheduled_at,{away_id:'9'})]).status,'REVIEW_SOURCE_CONFLICT');
 assert.throws(()=>classifyNcaabUnsettled(b,[],{toleranceMinutes:180}));
});
const f={sport:'NCAAF',event_id:'espn:401858521',scheduled_at:'2026-11-14T21:15:00Z',emitted_at:'2026-11-08T02:22:00Z',
 payload:{input:{event_id:'espn:401858521',scheduled_at:'2026-11-14T21:15:00Z',
 season:2026,home_id:'127',away_id:'264',neutral_site:false}}};
const makeFinal=(captured_at,extras={})=>({event_id:f.event_id,status:'FINAL',season:2026,
 home_id:'127',away_id:'264',neutral_site:false,outcome_validation:'PASS',
 scheduled_at:'2026-11-14T22:30:00Z',home_score:14,away_score:21,captured_at,...extras});
const evidence=[makeFinal('2026-11-15T02:00:00Z'),makeFinal('2026-11-15T03:00:00Z')];
test('NCAAF 75-minute drift becomes research-only candidate, not settlement',()=>{
 const r=reviewNcaafDispute(f,evidence);
 assert.equal(r.status,'REVIEW_CANDIDATE');assert.equal(r.driftMinutes,75);
 assert.equal(r.gradeAllowed,false);assert.equal(r.databaseWriteAllowed,false);
});
test('NCAAF >2h drift remains manual review',()=>{
 const r=reviewNcaafDispute(f,evidence.map(x=>({...x,scheduled_at:'2026-11-15T00:30:00Z'})));
 assert.equal(r.status,'MANUAL_REVIEW');assert.equal(r.databaseWriteAllowed,false);
});
test('NCAAF contradictory scores, mismatched teams or missing snapshots fail closed',()=>{
 assert.equal(reviewNcaafDispute(f,[evidence[0]]).status,'REVIEW_REQUIRED');
 assert.equal(reviewNcaafDispute(f,[evidence[0],makeFinal('2026-11-15T03:00:00Z',{home_score:33})]).status,'REVIEW_REQUIRED');
 assert.equal(reviewNcaafDispute(f,evidence.map(x=>({...x,home_id:'999'}))).status,'REVIEW_REQUIRED');
});
test('NCAAF evidence timestamp cannot predate actual finish or forecast',()=>{
 assert.equal(reviewNcaafDispute(f,[makeFinal('2026-11-14T20:00:00Z'),evidence[1]]).status,'REVIEW_REQUIRED');
 assert.throws(()=>reviewNcaafDispute(f,evidence,{toleranceMinutes:121}));
});
