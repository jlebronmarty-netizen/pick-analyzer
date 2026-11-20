import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 auditSoccerReadiness,auditUfcReadiness,auditAtpReadiness,threeSportsReadiness
} from '../src/lib/three-sports-readiness.mjs';

const NOW='2026-11-20T22:20:00Z';
const soccer={
 status:'AVAILABLE',capturedAt:'2026-10-16T02:17:50Z',
 continuousCollection:false,model:'SOCCER_POISSON_V0',competition:'LaLiga',market:'TOTAL_2_5',
 events:Array.from({length:7},(_,i)=>({eventId:'soccer-'+i,
  qualificationStatus:'INSUFFICIENT_HISTORY',warmupComplete:false,settlement:null}))
};
const ufc={
 latestRun:{started_at:'2026-11-20T21:49:27Z',status:'PARTIAL',provider_calls:8,
  detail:{bouts:Array.from({length:28},(_,i)=>({id:'bout'+i})),
   abstentions:Array.from({length:14},(_,i)=>({boutId:'bout'+i,reason:'INSUFFICIENT_OR_UNCERTAIN_HISTORY'})),
   issues:['6 identidades/historias afectadas por finales sin ganador inequívoco'],
   historyBouts:315}},
 predictions:[
  {id:'old',bout_id:'old',body:{model:'UFC_ELO_K32_FREE_V1'},
   scheduled_at:'2026-11-21T18:00:00Z',captured_at:'2026-11-19T20:00:00Z'},
  {id:'v2',bout_id:'battle',body:{model:'UFC_ELO_K32_FREE_V2_IDENTITY'},
   scheduled_at:'2026-11-21T18:00:00Z',captured_at:'2026-11-19T20:00:00Z'}],
 results:[{bout_id:'battle'}],quotes:[{bout_id:'battle'},{bout_id:'battle'},{bout_id:'different'}]
};
const atp={runs:[
 {state:'OK',requested_at:'2026-11-19T00:13:08Z',observed_at:'2026-11-19T00:13:09Z',
  captureOnly:true,normalized:{status:'OFFLINE_CONTRACT_ONLY',events:[
   {key:'atp:111-222-333-4',scheduledAt:'2026-11-21T10:00:00Z',price:null},
   {key:'atp:333-444-333-4',scheduledAt:'2026-11-21T11:00:00Z',price:null}]}},
 {state:'OK',requested_at:'2026-11-20T00:13:08Z',observed_at:'2026-11-20T00:13:09Z',
  captureOnly:true,normalized:{status:'OFFLINE_CONTRACT_ONLY',events:[
   {key:'atp:111-222-333-4',scheduledAt:'2026-11-21T13:00:00Z',price:null}]}}
],forecastCount:0,resultCount:0};

test('soccer static October checkpoint cannot claim current active accuracy',()=>{
 const r=auditSoccerReadiness(soccer,NOW);
 assert.equal(r.status,'PUBLISHED_CHECKPOINT_NO_CONTINUOUS_CAPTURE');
 assert.equal(r.sourceContinuous,false);assert.equal(r.staleOver7Days,true);
 assert.equal(r.archivedProjections,7);assert.equal(r.insufficientWarmup,7);
 assert.equal(r.eligibleSelections,0);assert.equal(r.accuracy,null);
 assert.equal(r.providerCalls,0);assert.equal(r.officialPicksChanged,false);
});
test('soccer genuinely qualifying independent results can count, not blocked ones',()=>{
 const improved={...soccer,continuousCollection:true,capturedAt:'2026-11-20T20:00:00Z',
  events:[...soccer.events,{
   eventId:'qualified',qualificationStatus:'QUALIFIED',warmupComplete:true,
   settlement:{result:'WIN'}
  }]};
 const r=auditSoccerReadiness(improved,NOW);
 assert.equal(r.status,'RESEARCH_OBSERVATIONS_AVAILABLE');
 assert.equal(r.decisionsWithOutcome,1);assert.equal(r.accuracy,1);
 assert.equal(r.archivedProjections,8);
});
test('soccer unavailable bridge never claims zero accuracy as a measured result',()=>{
 const r=auditSoccerReadiness({status:'UNAVAILABLE'},NOW);
 assert.equal(r.status,'NOT_READY');assert.equal(r.sourceState,'UNAVAILABLE');
 assert.equal(r.eligibleSelections,0);
});
test('UFC PARTIAL due to uncertain winner history still has functioning source and separate retired V1',()=>{
 const r=auditUfcReadiness({...ufc,nowIso:NOW});
 assert.equal(r.status,'CAPTURE_ACTIVE_SELECTIVE_HISTORY_REVIEW');
 assert.equal(r.latestBouts,28);assert.equal(r.latestAbstentions,14);
 assert.equal(r.abstentionReasons.INSUFFICIENT_OR_UNCERTAIN_HISTORY,14);
 assert.equal(r.historicalBouts,315);
 assert.equal(r.v2ArchivedForecasts,1);assert.equal(r.retiredV1Rows,1);
 assert.equal(r.quoteSnapshots,3);assert.equal(r.quotedDistinctBouts,2);
 assert.equal(r.v2BoutsWithResultEvidence,1);
 assert.equal(r.immediateAccuracy,null);
 assert.equal(r.providerCalls,0);assert.equal(r.modelPromoted,false);
});
test('ATP fixture key reused with changed UTC start cannot be silently promoted',()=>{
 const r=auditAtpReadiness({...atp,nowIso:NOW});
 assert.equal(r.status,'CAPTURE_ONLY_TEMPORAL_IDENTITY_DRIFT');
 assert.equal(r.distinctFixtureKeys,2);
 assert.equal(r.repeatedKeys,1);assert.equal(r.repeatedWithChangingScheduledAt,1);
 assert.equal(r.latestFixtures,1);assert.equal(r.latestPricedFixtures,0);
 assert.equal(r.frozenPredictions,0);assert.equal(r.finalOutcomes,0);
 assert.equal(r.sportsbookExecutionVerified,false);
});
test('ATP return of HTTP 200 alone cannot imply a model or historical accuracy',()=>{
 const r=auditAtpReadiness({...atp,runs:[atp.runs[0]],nowIso:NOW});
 assert.equal(r.status,'CAPTURE_ONLY_NO_MODEL');
 assert.equal(r.historicalDecisiveResultsCertified,false);
 assert.equal(r.modelPromoted,false);
});
test('all three statuses remain separated; explicitly exclude NCAAF',()=>{
 const report=threeSportsReadiness({soccer,ufc,atp,nowIso:NOW});
 assert.equal(report.providerSportsCalls,0);assert.equal(report.databaseWrites,0);
 assert.ok(report.excludedSports.includes('NCAAF'));
 assert.equal(report.soccer.staleOver7Days,true);
 assert.equal(report.ufc.retiredV1Rows,1);
 assert.equal(report.atp.repeatedWithChangingScheduledAt,1);
});
test('new operations endpoint reads existing saved evidence only',()=>{
 const service=fs.readFileSync('src/services/three-sports-readiness.service.ts','utf8');
 const api=fs.readFileSync('src/app/api/operations/soccer-ufc-atp/route.ts','utf8');
 assert.match(service,/getSoccerShadowReport/);
 assert.match(service,/ufc_free_runs_v1/);
 assert.match(service,/free_sports_runs_v1/);
 assert.match(service,/evidence->normalized/);
 assert.ok(!/\.insert\(|\.upsert\(|\.update\(|\.delete\(|\bfetch\(|THE_ODDS_API_KEY/.test(service+api));
 assert.ok(!/NCAAF|mlb.*cron|paidRead/.test(service+api));
});
