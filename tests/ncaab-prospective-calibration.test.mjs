import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 NCAAB_CALIBRATION_VERSION,ncaabVerifiedHistoricalResult,
 planNcaabCalibrationShadow
} from '../src/lib/ncaab-prospective-calibration-core.mjs';
import {evaluateNcaabFrozenCalibration} from '../src/lib/ncaab-prospective-calibration-evaluation.mjs';
import {ncaabEvidenceTime,ncaabUniqueEventIndex} from '../src/lib/ncaab-calibration-evidence.mjs';
import {readNcaabBoundedArchive} from '../src/lib/ncaab-bounded-archive-reader.mjs';
const sha='4fd07cc48ade1b1accd1ebb0f00c0ea414e93a2991567d70ed4ac890c88fdbf4';
const tip='2026-11-20T02:00:00Z', issued='2026-11-19T22:00:16Z';
const decision='2026-11-19T22:00:30Z';
const persisted=row=>({...row,created_at:row.frozen_at});
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
 home_id:'3',away_id:'4',
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
 const row=persisted(planNcaabCalibrationShadow({prediction,decisionAt:decision,history}).record);
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
 assert.equal(score.metrics.baseline.mae,null);
 assert.equal(score.metrics.totalUnchanged.brier,null);
 assert.equal(score.metrics.correctedMargin.accuracy,null);
 assert.equal(score.modelPromotionAllowed,false);
 assert.equal(score.independentValidationPassed,false);
 const uncertain=evaluateNcaabFrozenCalibration({frozenRows:[row],
  finalRows:[finals[0],{...finals[0]}]});
 assert.equal(uncertain.invalid,1);assert.equal(uncertain.settled,0);
});
test('missing finals remain pending; source identity mismatch not attributed a win or loss',()=>{
 const row=persisted(planNcaabCalibrationShadow({prediction,decisionAt:decision,history}).record);
 const missing=evaluateNcaabFrozenCalibration({frozenRows:[row],finalRows:[]});
 assert.equal(missing.pending,1);
 const wrong=evaluateNcaabFrozenCalibration({frozenRows:[row],
  finalRows:[{event_id:row.event_id,observed_at:'2026-11-20T05:00:00Z',
   body:{status:'FINAL',event_id:row.event_id,scheduled_at:tip,
   captured_at:'2026-11-20T05:00:00Z',home_id:'2',away_id:'1',
   home_score:78,away_score:65}}]});
 assert.equal(wrong.invalid,1);assert.equal(wrong.settled,0);
});
test('temporal evidence rejects malformed, timezone-less and impossible calendar dates',()=>{
 for(const time of [null,0,'2026-11-19','2026-11-19T22:00:00','2026-02-30T22:00:00Z','2026-11-19T24:00:00Z'])
  assert.equal(ncaabEvidenceTime(time),null);
 assert.equal(ncaabEvidenceTime('2026-11-19T22:00Z'),Date.parse('2026-11-19T22:00:00Z'));
 assert.equal(ncaabEvidenceTime('2026-11-19 22:00:00+00'),Date.parse('2026-11-19T22:00:00Z'));
 for(const changes of [
  {scheduled_at:'invalid'},
  {predicted_at:'2026-11-16T03:00:00Z'},
  {result_observed_at:issued},
  {result_observed_at:'2026-11-16T01:00:00Z'}
 ])assert.equal(planNcaabCalibrationShadow({prediction,decisionAt:decision,
   history:history.map(x=>({...x,...changes}))}).status,'NOT_READY');
});
test('inconsistent winner, projected scores or formula parameter cannot be frozen',()=>{
 for(const changes of [
  {predicted_winner:'1'},
  {home_win_probability:.5,away_win_probability:.5},
  {home_score:75},
  {projected_margin:2}
 ])assert.equal(planNcaabCalibrationShadow({prediction:{...prediction,body:{...prediction.body,...changes}},
   decisionAt:decision,history}).status,'NOT_READY');
 assert.equal(planNcaabCalibrationShadow({prediction,decisionAt:decision,history,shrinkPrior:200}).status,'NOT_READY');
 assert.equal(planNcaabCalibrationShadow({prediction:{...prediction,id:'NCAAB_PRESEASON_V1:espn:999999999'},
  decisionAt:decision,history}).status,'NOT_READY');
});
test('complete input evidence strengthens future traceability without changing legacy formula or hashes',()=>{
 const legacy=planNcaabCalibrationShadow({prediction,decisionAt:decision,history}).record;
 const stronger=planNcaabCalibrationShadow({prediction,decisionAt:decision,history,captureFullEvidence:true}).record;
 assert.deepEqual(stronger.baseline,legacy.baseline);
 assert.deepEqual(stronger.candidate,legacy.candidate);
 assert.equal(stronger.source_hash,legacy.source_hash);
 assert.equal(stronger.history_evidence.historicalSourceDigest,legacy.history_evidence.historicalSourceDigest);
 assert.equal(stronger.history_evidence.evaluationType,'PROSPECTIVE_SEQUENTIAL');
 assert.equal(stronger.history_evidence.separateHoldoutVerified,false);
 assert.equal(stronger.history_evidence.trainingCutoffAt,new Date(issued).toISOString());
 const changed=planNcaabCalibrationShadow({prediction,decisionAt:decision,captureFullEvidence:true,
  history:history.map((x,i)=>i===0?{...x,projected_margin:x.projected_margin+1}:x)}).record;
 assert.equal(changed.history_evidence.historicalSourceDigest,stronger.history_evidence.historicalSourceDigest);
 assert.notEqual(changed.history_evidence.historicalFullInputDigest,stronger.history_evidence.historicalFullInputDigest);
 assert.notEqual(changed.history_evidence.fullSourceHash,stronger.history_evidence.fullSourceHash);
});
test('duplicate original indexes quarantine both occurrences independent of order',()=>{
 const altered={...prediction,id:'different',body:{...prediction.body,projected_margin:5}};
 for(const rows of [[prediction,altered],[altered,prediction]]){
  const result=ncaabUniqueEventIndex(rows);
  assert.equal(result.unique.has(prediction.event_id),false);
  assert.equal(result.duplicates.has(prediction.event_id),true);
 }
});
function finalFor(row,homeScore=81,awayScore=75){
 const observed=new Date(Date.parse(row.scheduled_at)+3*3600000).toISOString();
 return {event_id:row.event_id,observed_at:observed,body:{event_id:row.event_id,
  scheduled_at:row.scheduled_at,captured_at:observed,status:'FINAL',home_id:row.home_id,
  away_id:row.away_id,home_score:homeScore,away_score:awayScore}};
}
test('duplicate shadow rows never contribute a first arbitrarily selected result',()=>{
 const row=persisted(planNcaabCalibrationShadow({prediction,decisionAt:decision,history}).record);
 const other={...row,candidate:{...row.candidate,probability_home_preserve_original_side:.1}};
 for(const frozenRows of [[row,other],[other,row]]){
  const score=evaluateNcaabFrozenCalibration({frozenRows,finalRows:[finalFor(row)]});
  assert.equal(score.settled,0);assert.equal(score.invalid,2);
  assert.equal(score.uniqueFrozenGames,1);assert.equal(score.uniquePairedGames,0);
 }
});
test('frozen probabilities, preserved side and original baseline must agree',()=>{
 const row=persisted(planNcaabCalibrationShadow({prediction,decisionAt:decision,history}).record);
 for(const changes of [
  {baseline:{...row.baseline,away_win_probability:.3}},
  {baseline:{...row.baseline,predicted_winner:'1'}},
  {candidate:{...row.candidate,probability_away_preserve_original_side:.3}},
  {candidate:{...row.candidate,bookmaker_value_estimated:.1}},
  {created_at:'2026-11-20T02:01:00Z'},
  {source_hash:'bad'}
 ])assert.equal(evaluateNcaabFrozenCalibration({frozenRows:[{...row,...changes}],finalRows:[finalFor(row)]}).settled,0);
 assert.equal(evaluateNcaabFrozenCalibration({frozenRows:[row],finalRows:[finalFor(row,-1,2)]}).settled,0);
 const valid=evaluateNcaabFrozenCalibration({frozenRows:[row],finalRows:[finalFor(row)],originalRows:[prediction]});
 assert.equal(valid.settled,1);assert.equal(valid.originalForecastsCrossChecked,true);
 const mutated={...prediction,body:{...prediction.body,projected_margin:-3}};
 const blocked=evaluateNcaabFrozenCalibration({frozenRows:[row],finalRows:[finalFor(row)],originalRows:[mutated]});
 assert.equal(blocked.settled,0);assert.equal(blocked.invalidReasons.ORIGINAL_FORECAST_MISMATCH_OR_UNAVAILABLE,1);
 const wrongHash=evaluateNcaabFrozenCalibration({frozenRows:[{...row,source_hash:'0'.repeat(64)}],
  finalRows:[finalFor(row)],originalRows:[prediction]});
 assert.equal(wrongHash.settled,0);
});
test('as-of results exclude later receipts and dates use Puerto Rico instead of UTC',()=>{
 const row=persisted(planNcaabCalibrationShadow({prediction,decisionAt:decision,history}).record);
 const final=finalFor(row);
 const earlier=evaluateNcaabFrozenCalibration({frozenRows:[row],finalRows:[final],asOf:row.scheduled_at});
 assert.equal(earlier.pending,1);assert.equal(earlier.settled,0);
 assert.equal(earlier.outcomesAfterCutoffExcluded,1);
 const scored=evaluateNcaabFrozenCalibration({frozenRows:[row],finalRows:[final]});
 assert.equal(scored.days[0].date,'2026-11-19');
 assert.equal(scored.timezone,'America/Puerto_Rico');
 assert.equal(scored.contextCoverage.homeLabelConfirmsPhysicalVenue,false);
 assert.equal(scored.contextCoverage.venue,'NOT_FROZEN_IN_THIS_LEDGER');
});
test('100 unique sequential games never become an untouched independent holdout',()=>{
 const originals=[],frozenRows=[],finalRows=[];
 for(let i=0;i<100;i++){
  const event_id='espn:'+(401902000+i),p={...prediction,id:'NCAAB_PRESEASON_V1:'+event_id,
   event_id,body:{...prediction.body,event_id}};
  const row=persisted(planNcaabCalibrationShadow({prediction:p,decisionAt:decision,history}).record);
  originals.push(p);frozenRows.push(row);finalRows.push(finalFor(row,i%3===0?90:60,80));
 }
 const score=evaluateNcaabFrozenCalibration({frozenRows,finalRows,originalRows:originals});
 assert.equal(score.settled,100);assert.equal(score.uniquePairedGames,100);
 assert.equal(score.minimumIndependentGames,100);assert.equal(score.sampleThresholdMet,true);
 assert.equal(score.status,'SEPARATE_HOLDOUT_PENDING');
 assert.equal(score.evaluationType,'PROSPECTIVE_SEQUENTIAL');
 assert.equal(score.separateHoldoutVerified,false);assert.equal(score.independentValidationPassed,false);
 assert.equal(score.modelPromotionAllowed,false);
 assert.equal(score.pairedUncertainty.uniqueGames,100);
 assert.equal(score.pairedUncertainty.localDays,1);
 assert.equal(score.pairedUncertainty.intervals.byPuertoRicoDay.interval95,null);
 assert.equal(score.pairedUncertainty.validationEvidence,false);
 const reverse=evaluateNcaabFrozenCalibration({frozenRows:[...frozenRows].reverse(),finalRows,originalRows:originals});
 assert.deepEqual(reverse.pairedUncertainty,score.pairedUncertainty);
});
test('new complete evidence is accepted; a forged cutoff or digest link is rejected',()=>{
 const row=persisted(planNcaabCalibrationShadow({prediction,decisionAt:decision,history,captureFullEvidence:true}).record);
 const score=evaluateNcaabFrozenCalibration({frozenRows:[row],finalRows:[finalFor(row)],originalRows:[prediction]});
 assert.equal(score.settled,1);assert.equal(score.trainingEvidence.completeInputDigestRows,1);
 for(const changes of [{trainingCutoffAt:decision},{latestResultObservedAt:issued},{fullSourceHash:'0'.repeat(64)}]){
  const bad={...row,history_evidence:{...row.history_evidence,...changes}};
  assert.equal(evaluateNcaabFrozenCalibration({frozenRows:[bad],finalRows:[finalFor(row)]}).settled,0);
 }
 const modified={...row,candidate:{...row.candidate,projected_margin_adjusted:5}};
 assert.equal(evaluateNcaabFrozenCalibration({frozenRows:[modified],finalRows:[finalFor(row)]}).settled,0);
});
test('bounded keyset pagination reads beyond250 without silently truncating and rejects overflow',async()=>{
 const source=Array.from({length:501},(_,i)=>({id:String(i).padStart(5,'0')}));
 let reads=0;
 const readPage=async({after,limit})=>{reads++;return {data:source.filter(x=>after===null||x.id>after).slice(0,limit)};};
 const ok=await readNcaabBoundedArchive({readPage,maxRows:501,pageSize:250});
 assert.equal(ok.status,'OK');assert.equal(ok.rows.length,501);assert.equal(reads,3);
 const capped=await readNcaabBoundedArchive({readPage,maxRows:500,pageSize:250});
 assert.equal(capped.status,'SOURCE_ARCHIVE_CAPPED');assert.deepEqual(capped.rows,[]);
 const repeated=await readNcaabBoundedArchive({readPage:async()=>({data:[{id:'a'},{id:'a'}]}),maxRows:3,pageSize:2});
 assert.equal(repeated.status,'READ_BOUNDARY_MISMATCH');assert.deepEqual(repeated.rows,[]);
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
