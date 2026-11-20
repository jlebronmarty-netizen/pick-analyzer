import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 NCAAB_CALIBRATION_VERSION,ncaabVerifiedHistoricalResult,
 planNcaabCalibrationShadow
} from '../src/lib/ncaab-prospective-calibration-core.mjs';
import {evaluateNcaabFrozenCalibration} from '../src/lib/ncaab-prospective-calibration-evaluation.mjs';
const sha='4fd07cc48ade1b1accd1ebb0f00c0ea414e93a2991567d70ed4ac890c88fdbf4';
const tip='2026-11-20T02:00:00Z', issued='2026-11-19T22:00:16Z';
const decision='2026-11-19T22:00:30Z';
const prediction={
 id:'NCAAB_PRESEASON_V1:espn:401900999',event_id:'espn:401900999',
 scheduled_at:tip,created_at:issued,
 body:{model:'NCAAB_PRESEASON_V1',state:'FORECAST',event_id:'espn:401900999',
  home_id:'1',away_id:'2',created_at:issued,scheduled_at:tip,
  home_win_probability:.48,away_win_probability:.52,
  predicted_winner:'2',projected_margin:-2,projected_total:142,
  home_score:70,away_score:72,profile_sha256:sha}
};
const history=Array.from({length:120},(_,i)=>({
 status:'VERIFIED_PAST_FINAL',event_id:'espn:'+(401901000+i),
 scheduled_at:'2026-11-16T02:00:00Z',
 predicted_at:'2026-11-15T12:00:00Z',
 result_observed_at:'2026-11-16T06:00:00Z',
 original_home_probability:.55,
 projected_margin:2,projected_total:142,
 actual_home_won:i%5===0?0:1,
 actual_margin:i%5===0?-10:10,
 actual_total:140
}));
test('past validated ESPN final must exactly match original event, teams, schedule and time',()=>{
 const orig={...prediction,id:'NCAAB_PRESEASON_V1:espn:401900998',
  event_id:'espn:401900998',scheduled_at:'2026-11-17T02:00:00Z',
  created_at:'2026-11-16T12:00:00Z',body:{
   ...prediction.body,event_id:'espn:401900998',
   created_at:'2026-11-16T12:00:00Z',
   scheduled_at:'2026-11-17T02:00:00Z',home_win_probability:.55,
   away_win_probability:.45,predicted_winner:'1',projected_margin:2,
   home_score:72,away_score:70}
 };
 const o={event_id:orig.event_id,observed_at:'2026-11-17T06:00:00Z',
  body:{event_id:orig.event_id,scheduled_at:orig.scheduled_at,
   captured_at:'2026-11-17T06:00:00Z',status:'FINAL',
   home_id:'1',away_id:'2',home_score:80,away_score:70}};
 assert.equal(ncaabVerifiedHistoricalResult(orig,o).status,'VERIFIED_PAST_FINAL');
 assert.equal(ncaabVerifiedHistoricalResult(orig,{...o,body:{...o.body,home_id:'2'}}).status,'NOT_READY');
 assert.equal(ncaabVerifiedHistoricalResult(orig,{...o,body:{...o.body,scheduled_at:'2026-11-17T03:00:00Z'}}).status,'NOT_READY');
 assert.equal(ncaabVerifiedHistoricalResult(orig,{...o,observed_at:'2026-11-17T00:00:00Z'}).status,'NOT_READY');
});
test('candidate preserves winner side even when unrestricted probability flips',()=>{
 const r=planNcaabCalibrationShadow({prediction,decisionAt:decision,history});
 assert.equal(r.status,'FROZEN_RESEARCH_CANDIDATE');
 const q=r.record;
 assert.equal(q.model_version,NCAAB_CALIBRATION_VERSION);
 assert.equal(q.history_evidence.priorGames,120);
 assert.equal(q.history_evidence.shrinkPrior,100);
 assert.ok(q.candidate.probability_home_unrestricted>.5);
 assert.ok(q.candidate.probability_home_preserve_original_side<.5);
 assert.equal(q.candidate.predicted_winner_unchanged,'2');
 assert.equal(q.baseline.predicted_winner,'2');
 assert.equal(q.candidate.projected_total_unchanged,q.baseline.projected_total);
 assert.equal(q.official_pick,false);assert.equal(q.production_eligible,false);
 assert.equal(q.candidate.model_promotion_allowed,false);
 assert.equal(q.history_evidence.totalAdjustmentApplied,false);
});
test('home favorite can never be flipped to away by negative bias',()=>{
 const historyAway=history.map(x=>({...x,original_home_probability:.9,actual_home_won:0}));
 const fav={...prediction,body:{...prediction.body,
  home_win_probability:.52,away_win_probability:.48,predicted_winner:'1',
  home_score:72,away_score:70,projected_margin:2}};
 const r=planNcaabCalibrationShadow({prediction:fav,decisionAt:decision,history:historyAway});
 assert.equal(r.status,'FROZEN_RESEARCH_CANDIDATE');
 assert.ok(r.record.candidate.probability_home_unrestricted<.5);
 assert.ok(r.record.candidate.probability_home_preserve_original_side>.5);
});
test('future observed finals and same event cannot train earlier predictions',()=>{
 const later=history.map(x=>({...x,result_observed_at:'2026-11-20T10:00:00Z'}));
 assert.equal(planNcaabCalibrationShadow({prediction,decisionAt:decision,history:later}).reason,
  'INSUFFICIENT_EARLIER_SETTLED_GAMES');
 const same=history.map(x=>({...x,event_id:prediction.event_id}));
 assert.equal(planNcaabCalibrationShadow({prediction,decisionAt:decision,history:same}).status,
  'NOT_READY');
});
test('conflicted duplicate original final histories are rejected',()=>{
 const evidence=[...history.slice(0,100),history[0]];
 assert.equal(planNcaabCalibrationShadow({prediction,decisionAt:decision,history:evidence}).reason,
  'INSUFFICIENT_EARLIER_SETTLED_GAMES');
});
test('an old forecast cannot be silently backfilled at later time',()=>{
 assert.equal(planNcaabCalibrationShadow({prediction,decisionAt:'2026-11-19T23:00:00Z',history}).reason,
  'FORECAST_IDENTITY_OR_ASOF_GATE');
 assert.equal(planNcaabCalibrationShadow({prediction:{...prediction,created_at:tip},decisionAt:tip,history}).status,
  'NOT_READY');
});
test('frozen side-preserving candidate and baseline are graded only on identical valid finals',()=>{
 const row=planNcaabCalibrationShadow({prediction,decisionAt:decision,history}).record;
 const finals=[{event_id:prediction.event_id,observed_at:'2026-11-20T05:00:00Z',
  body:{event_id:prediction.event_id,scheduled_at:tip,status:'FINAL',
   captured_at:'2026-11-20T05:00:00Z',home_id:'1',away_id:'2',
   home_score:81,away_score:75}}];
 const score=evaluateNcaabFrozenCalibration({frozenRows:[row],finalRows:finals});
 assert.equal(score.settled,1);assert.equal(score.invalid,0);
 assert.equal(score.metrics.baseline.n,1);
 assert.equal(score.metrics.sidePreserving.n,1);
 assert.equal(score.metrics.baseline.hits,score.metrics.sidePreserving.hits);
 assert.equal(score.metrics.totalUnchanged.n,1);
 assert.equal(score.modelPromotionAllowed,false);
 assert.equal(score.independentValidationPassed,false);
 const uncertain=evaluateNcaabFrozenCalibration({frozenRows:[row],
  finalRows:[finals[0],{...finals[0]}]});
 assert.equal(uncertain.invalid,1);assert.equal(uncertain.settled,0);
});
test('missing finals remain pending; source identity mismatch not attributed a win or loss',()=>{
 const row=planNcaabCalibrationShadow({prediction,decisionAt:decision,history}).record;
 const missing=evaluateNcaabFrozenCalibration({frozenRows:[row],finalRows:[]});
 assert.equal(missing.pending,1);
 const wrong=evaluateNcaabFrozenCalibration({frozenRows:[row],
  finalRows:[{event_id:row.event_id,observed_at:'2026-11-20T05:00:00Z',
   body:{status:'FINAL',event_id:row.event_id,scheduled_at:tip,
   captured_at:'2026-11-20T05:00:00Z',home_id:'2',away_id:'1',
   home_score:78,away_score:65}}]});
 assert.equal(wrong.invalid,1);assert.equal(wrong.settled,0);
});
test('optional research cron uses zero external calls, never alters original engine',()=>{
 const cron=fs.readFileSync('src/app/api/cron/ncaab-daily/route.ts','utf8');
 const writer=fs.readFileSync('src/services/ncaab-calibration-shadow-writer.service.ts','utf8');
 const migration=fs.readFileSync('supabase/migrations/20261120010000_ncaab_calibration_shadow_v1.sql','utf8');
 const readiness=fs.readFileSync('src/services/ncaab-calibration-readiness.service.ts','utf8');
 assert.ok(cron.indexOf('runNcaabDaily()')<cron.indexOf('runNcaabProspectiveCalibrationShadow('));
 assert.match(writer,/NCAAB_CALIBRATION_SHADOW_ENABLED/);
 assert.match(writer,/providerCalls:0/);
 assert.ok(!/\bfetch\(|THE_ODDS_API_KEY|model_weights|savePrediction/.test(writer));
 assert.ok(!/\.upsert\(|\.insert\(|\.update\(|\.delete\(|\bfetch\(/.test(readiness));
 assert.match(migration,/enable row level security/i);
 assert.match(migration,/revoke update,delete,truncate/i);
 assert.match(migration,/ncaab_calibration_never_official/i);
});
