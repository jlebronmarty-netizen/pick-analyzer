import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluateNhlV6Paired} from '../src/lib/nhl-v6-prospective-validation.mjs';

const id='nhl:2026020999',scheduled_at='2026-11-20T00:00:00Z';
const base={
 event_id:id,model_version:'NHL_LATE_PROBABLE_CALIBRATION_SHADOW_V6',
 scheduled_at,frozen_at:'2026-11-19T22:08:00Z',
 source_completed_at:'2026-11-19T22:07:10Z',
 home_team_id:1,away_team_id:2,goalie_snapshot_id:'snap01',
 official_pick:false,production_eligible:false,
 goalie_evidence:{status:'PREGAME_PROBABLE_SOURCE_ONLY',sourceSnapshotId:'snap01',
  observedAt:'2026-11-19T22:07:20Z',home:{displayName:'Goalie Home'},away:{displayName:'Goalie Away'},
  isConfirmedStarter:false,goalieAdjustmentApplied:false},
 calibration:{status:'PROSPECTIVE_TEST_ONLY',holdoutPassed:false,officialPromotion:false,
  expectedValue:null,originalDratingsHome:0.6,
  circaPrice:{status:'CIRCA_PREGAME_RESEARCH_ONLY',eventId:id,
   capturedAt:'2026-11-19T22:07:30Z',marketRuleVerified:false,homeNoVig:0.54},
  candidateHome:0.56,candidateAway:0.44,
  rolling:{status:'FROZEN_CANDIDATE_ELIGIBLE',priorGames:40}},
 market_proxies:{homeMoneylineProxy:0.52}
};
const finish=(event_id=id,homeScore=4,awayScore=2)=>({
 event_id,observed_at:'2026-11-20T03:00:00Z',
 body:{eventId:event_id,scheduledAt:scheduled_at,homeId:1,awayId:2,homeScore,awayScore}
});
test('four-way prospective comparison uses exactly the same settled V6 match',()=>{
 const r=evaluateNhlV6Paired({frozenRows:[base],finalRows:[finish()]});
 assert.equal(r.rows,1);assert.equal(r.settled,1);assert.equal(r.invalid,0);
 assert.equal(r.uniquePairedGames,1);assert.equal(r.minimumInitialHoldout,30);
 assert.equal(r.morePairedGamesNeeded,29);assert.equal(r.modelPromotionAllowed,false);
 for(const name of ['circaNoVig','dratings','poisson','calibrated']){
  assert.equal(r.exactSameGamePairedMetrics[name].games,1);
  assert.equal(r.exactSameGamePairedMetrics[name].hits,1);
  assert.ok(r.exactSameGamePairedMetrics[name].logLoss>0);
 }
 assert.equal(r.pairedCandidateMinusBaseline.circaNoVig.candidateMinusBaselineBrier<0,true);
 assert.equal(r.weeklyDayCoverage,1);
});
test('unpaired sample never contaminates exact same-game four-way comparisons',()=>{
 const other={...base,event_id:'nhl:2026020998',
  market_proxies:{homeMoneylineProxy:0.99},
  calibration:{...base.calibration,circaPrice:null,status:'NOT_YET_ELIGIBLE',
   candidateHome:null,candidateAway:null}};
 const r=evaluateNhlV6Paired({frozenRows:[base,other],
 finalRows:[finish(),finish(other.event_id,0,3)]});
 assert.equal(r.settled,2);assert.equal(r.uniquePairedGames,1);
 assert.equal(r.allAvailableMetrics.poisson.games,2);
 assert.equal(r.exactSameGamePairedMetrics.poisson.games,1);
 assert.equal(r.exactSameGamePairedMetrics.calibrated.games,1);
});
test('past-frozen snapshots, source timestamps and postgame finals reject lookahead',()=>{
 for(const row of [
  {...base,goalie_evidence:{...base.goalie_evidence,observedAt:'2026-11-19T22:09:00Z'}},
  {...base,calibration:{...base.calibration,circaPrice:{...base.calibration.circaPrice,
   capturedAt:'2026-11-19T22:09:00Z'}}},
  {...base,goalie_evidence:{...base.goalie_evidence,isConfirmedStarter:true}},
  {...base,official_pick:true},
  {...base,source_completed_at:'2026-11-19T23:07:10Z'}
 ]){
  const result=evaluateNhlV6Paired({frozenRows:[row],finalRows:[finish()]});
  assert.equal(result.invalid,1);assert.equal(result.uniquePairedGames,0);
 }
 const noPostgame=evaluateNhlV6Paired({frozenRows:[base],
  finalRows:[{...finish(),observed_at:'2026-11-19T21:00:00Z'}]});
 assert.equal(noPostgame.invalid,1);
});
test('duplicate same-game final rows cannot grade contradictory markets',()=>{
 const r=evaluateNhlV6Paired({frozenRows:[base],finalRows:[finish(),finish(id,0,4)]});
 assert.equal(r.invalid,1);assert.equal(r.settled,0);
 assert.equal(r.invalidReasons.OUTCOME_DUPLICATE_CONFLICT,1);
});
test('pending prospective V6 rows remain unscored and cannot be promoted',()=>{
 const r=evaluateNhlV6Paired({frozenRows:[base],finalRows:[]});
 assert.equal(r.status,'PROSPECTIVE_SAMPLE_PENDING');
 assert.equal(r.pending,1);assert.equal(r.uniquePairedGames,0);
 assert.equal(r.pairedCandidateMinusBaseline,null);
 assert.equal(r.asOfGoalieCoverage,1);assert.equal(r.candidatesFrozen,1);
});
test('NHL V6 research report and archived quote retrieval remain free and bounded',()=>{
 const service=fs.readFileSync('src/services/nhl-late-v6-freeze-writer.service.ts','utf8');
 const report=fs.readFileSync('src/services/nhl-late-v6-readiness.service.ts','utf8');
 assert.ok(service.includes('MAX_QUOTES=8000'));
 assert.ok(service.includes("NHL_LATE_V6_SHADOW_ENABLED"));
 assert.ok(service.includes("providerCalls:0"));
 assert.ok(!/\bfetch\(|the_odds_api|oddsapi|savePrediction|updateModel/.test(service));
 assert.ok(report.includes('evaluateNhlV6Paired'));
 assert.ok(!/\.upsert\(|\.insert\(|\.update\(|\.delete\(|\bfetch\(/.test(report));
});
