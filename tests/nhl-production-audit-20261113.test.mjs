import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nhlAuditSummary,nhlWilson95} from '../src/lib/nhl-audit-core.mjs';
const now='2026-11-14T00:00:00Z';
const pick=(id,outcome,profit,started='2026-11-13T22:00:00Z')=>({
 id:'DRATINGS_PUBLIC_ARGMAX_V1:'+id,eventId:id,createdAt:'2026-11-13T12:00:00Z',scheduledAt:started,
 settlement:outcome?{outcome,profitUnits:profit}:null
});
const report={status:'AVAILABLE',health:{runStatus:'PASS',latestRunAt:now,status:'PASS',issues:[]},history:[
 pick('nhl:1','WIN',0.5),pick('nhl:2','LOSS',null),pick('nhl:3','WIN',1),pick('nhl:4',null,null,'2026-11-14T03:00:00Z')
]};
const learning={status:'AVAILABLE',sample:{settled:3,brier:0.21},evidence:{contextGames:2,pbpGames:2,boxscoreGames:2,shooterGoalieObservations:1295,shooterGoalieObservationsScanned:1295,matchupReadCapped:false}};
test('Audit accuracy and priced profit have separate denominators',()=>{
 const r=nhlAuditSummary({report,learning,now});
 assert.equal(r.settlement.settled,3);
 assert.equal(r.settlement.wins,2);assert.equal(r.settlement.losses,1);
 assert.equal(r.settlement.pending,1);assert.equal(r.settlement.overdue,0);
 assert.equal(r.pricedSubset.settled,2);assert.equal(r.pricedSubset.unpricedSettled,1);
 assert.equal(r.pricedSubset.profitUnits,1.5);assert.equal(r.pricedSubset.roiPct,75);
 assert.equal(r.pricedSubset.certifiedProfitability,false);
 assert.equal(r.sourceModel,'DRATINGS_PUBLIC_ARGMAX_V1');assert.equal(r.priceBook,'CIRCA');
 assert.equal(r.independentlyTrainedPickModel,false);assert.equal(r.fanDuelPricesCertified,false);
 assert.equal(r.productionBettingModelReady,false);
});
test('Does not misclassify future fixtures as settlement backlog',()=>{
 const r=nhlAuditSummary({report,learning,now});
 assert.equal(r.status,'READY_WITH_MONITORING');assert.equal(r.settlement.overdue,0);
});
test('Old unsettled and non-frozen records flag ATTENTION',()=>{
 const variant={...report,history:[{...pick('nhl:9',null,null,'2026-11-12T00:00:00Z'),createdAt:'2026-11-14T00:00:00Z'}]};
 const r=nhlAuditSummary({report:variant,learning:{...learning,sample:{settled:0},evidence:{...learning.evidence,contextGames:0}},now});
 assert.equal(r.status,'ATTENTION');assert.equal(r.frozen.unverifiedTiming,1);assert.equal(r.settlement.overdue,1);
});
test('Wilson confidence is directional and behaves at boundaries',()=>{
 assert.equal(nhlWilson95(0,0),null);
 assert.equal(nhlWilson95(-1,2),null);
 const a=nhlWilson95(40,22);
 assert.equal(a.sample,62);assert.ok(a.lower<.6452&&a.upper>.6452);assert.ok(a.upper<1);
});
test('Learning matchup reports use paginated scans beyond default 1000 rows',()=>{
 const s=fs.readFileSync('src/services/nhl-causal-learning.service.ts','utf8');
 assert.match(s,/async function readNhlMatchupsForReport/);
 assert.match(s,/pageSize=500,maxRows=5000/);
 assert.match(s,/\.range\(offset,offset\+pageSize-1\)/);
 assert.match(s,/shooterGoalieObservations:matchups.total/);
 assert.match(s,/matchupReadCapped:matchups.scanCapped/);
});
test('Audit API is read-only and must never mutate models, training, or crons',()=>{
 const s=fs.readFileSync('src/services/nhl-production-audit.service.ts','utf8');
 const a=fs.readFileSync('src/app/api/nhl/audit/route.ts','utf8');
 assert.ok(!/upsert|insert\(|update\(|delete\(|fetch\(|model_weights|auto_promotion/.test(s+a));
 assert.match(a,/getNhlProductionAudit/);
 assert.match(s,/getNhlFreeReport/);assert.match(s,/getNhlCausalLearningReport/);
});
