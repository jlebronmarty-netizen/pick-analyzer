import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildNhlFreezeCandidate,planNhlFrozenSlate,gradeNhlFrozenSnapshots} from '../src/lib/nhl-challenger-freeze-core.mjs';
const DAY=86400000,BASE=Date.parse('2026-10-05T20:00:00Z');
const final=(n)=>({eventId:'nhl:'+(2026020000+n),status:'FINAL',
 scheduledAt:new Date(BASE+n*DAY).toISOString(),homeId:8,awayId:9,homeScore:4,awayScore:2});
const historical=Array.from({length:39},(_,i)=>({
 completed_at:new Date(BASE+i*DAY+5*3600000).toISOString(),games:[final(i)]
}));
const decisionAt='2026-11-15T20:00:00Z';
const game={eventId:'nhl:2026020500',status:'SCHEDULED',scheduledAt:'2026-11-16T01:00:00Z',
 homeId:8,awayId:9,home:'Home Example',away:'Away Example'};
const latest={completed_at:'2026-11-15T19:40:00Z',games:[game]};
const runs=[...historical,latest];
test('NHL planner freezes only at a genuinely pregame fresh official schedule snapshot',()=>{
 const x=planNhlFrozenSlate({runs,alreadyFrozen:[],decisionAt});
 assert.equal(x.status,'READY_TO_FREEZE');assert.equal(x.planned.length,1);
 const p=x.planned[0];assert.equal(p.id,'NHL_SCORES_POISSON_SHADOW_V1:nhl:2026020500');
 assert.equal(Date.parse(p.frozen_at),Date.parse(decisionAt));assert.equal(Date.parse(p.source_completed_at),Date.parse(latest.completed_at));
 assert.equal(p.source_final_games,39);assert.match(p.source_hash,/^[a-f0-9]{64}$/);
 assert.equal(p.status,'FROZEN_RESEARCH');assert.equal(p.official_pick,false);
 assert.equal(p.production_eligible,false);assert.equal(p.features.marketPrices,false);
 assert.equal(p.market_proxies.confirmedBookContract,false);
 assert.equal(p.market_proxies.fullGameOTSOResolved,false);
});
test('Re-running the same game cannot produce a duplicate row',()=>{
 const p=planNhlFrozenSlate({runs,alreadyFrozen:[],decisionAt}).planned[0];
 const again=planNhlFrozenSlate({runs,alreadyFrozen:[p.id],decisionAt});
 assert.equal(again.status,'NO_ELIGIBLE_MATCHUPS');assert.equal(again.planned.length,0);
});
test('Reject stale, post-start, unsupported, mismatched team, and missing actual history',()=>{
 const finals=historical.map(x=>({
  eventId:x.games[0].eventId,scheduledAt:x.games[0].scheduledAt,
  capturedAt:x.completed_at,homeId:8,awayId:9,homeGoals:4,awayGoals:2
 }));
 const fail=(g,source,at)=>buildNhlFreezeCandidate({game:g,runCompletedAt:source,decisionAt:at,finalScores:finals});
 assert.equal(fail(game,'2026-11-15T16:00:00Z',decisionAt).reason,'SOURCE_FRESHNESS_UNVERIFIED');
 assert.equal(fail(game,'2026-11-16T00:20:00Z','2026-11-16T00:30:00Z').reason,'PREGAME_FREEZE_WINDOW_UNAVAILABLE');
 assert.equal(fail({...game,eventId:'nhl:2026039999'},decisionAt,decisionAt).reason,'NHL_REGULAR_SEASON_EVENT_UNVERIFIED');
 assert.equal(fail({...game,awayId:8},decisionAt,decisionAt).reason,'TEAM_IDENTITY_UNVERIFIED');
 assert.equal(fail(game,decisionAt,decisionAt).status,'FROZEN_RESEARCH_CANDIDATE');
 assert.equal(buildNhlFreezeCandidate({game,runCompletedAt:decisionAt,decisionAt,
  finalScores:finals.slice(0,4)}).reason,'MODEL_FEATURE_GATE_FAILED');
});
test('Conflicting official finals block the entire batch, no retroactive repairs',()=>{
 const fake={completed_at:'2026-11-15T18:00:00Z',games:[{...final(0),homeScore:5}]};
 const x=planNhlFrozenSlate({runs:[...runs,fake],alreadyFrozen:[],decisionAt});
 assert.equal(x.status,'CONFLICTING_FINAL_SCORE_ARCHIVE');
 assert.equal(x.planned.length,0);
});
test('Postgame metrics use stored probabilities, not regenerated forecasts',()=>{
 const p=planNhlFrozenSlate({runs,alreadyFrozen:[],decisionAt}).planned[0];
 const truth={eventId:game.eventId,scheduledAt:game.scheduledAt,capturedAt:'2026-11-16T05:00:00Z',
 homeId:8,awayId:9,homeGoals:3,awayGoals:1};
 const r=gradeNhlFrozenSnapshots({frozenRows:[p],finalScores:[truth]});
 assert.equal(r.settled,1);assert.equal(r.pending,0);assert.equal(r.invalid,0);
 assert.ok(r.brier.moneyline!==null);assert.ok(r.mae.totalGoals>=0);
 assert.equal(r.marketScoringCertified,false);assert.equal(r.holdoutPassed,false);
 const invalid=gradeNhlFrozenSnapshots({frozenRows:[{...p,official_pick:true}],finalScores:[truth]});
 assert.equal(invalid.invalid,1);assert.equal(invalid.settled,0);
});
test('NHL shadow freeze is opt-in, additive and cannot modify current engines',()=>{
 const cron=fs.readFileSync('src/app/api/cron/nhl-free/route.ts','utf8');
 const writer=fs.readFileSync('src/services/nhl-challenger-freeze-writer.service.ts','utf8');
 assert.match(writer,/NHL_CHALLENGER_FREEZE_ENABLED/);
 assert.match(writer,/SLOT_HOURS=new Set/);
 assert.match(writer,/maxWrites:3/);
 assert.match(writer,/ignoreDuplicates:true/);
 assert.ok(cron.indexOf('const core=await runNhlFree()')<cron.indexOf('const learning=await runNhlCausalLearning()'));
 assert.ok(cron.indexOf('const researchHistory=await syncNhlMainMarketHistory()')<cron.indexOf('const challengerFreeze=await runNhlChallengerShadowFreeze()'));
 assert.equal((fs.readFileSync('vercel.json','utf8').match(/\/api\/cron\/nhl-free/g)||[]).length,1);
 assert.ok(!/savePrediction|model_weights|recommended_pick|the_odds_api/i.test(writer));
});
test('Migration is append-only for service role and fail-closed on official flags and timing',()=>{
 const sql=fs.readFileSync('supabase/migrations/20261115012000_nhl_challenger_shadow_v1.sql','utf8');
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/grant select,insert on public\.nhl_challenger_shadow_v1 to service_role/);
 assert.ok(!/grant\s+(?:update|delete|all).*service_role/i.test(sql));
 assert.match(sql,/nhl_shadow_never_official_check/);
 assert.match(sql,/nhl_shadow_freeze_time_check/);
 assert.match(sql,/unique\(event_id,model_version\)/);
});
test('Frozen audit route reads only; it cannot persist or promote models',()=>{
 const api=fs.readFileSync('src/app/api/nhl/frozen-shadow-audit/route.ts','utf8');
 const svc=fs.readFileSync('src/services/nhl-challenger-frozen-ledger-audit.service.ts','utf8');
 assert.ok(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(|fetch\(/i.test(api+svc));
 assert.match(svc,/gradeNhlFrozenSnapshots/);assert.match(api,/getNhlFrozenShadowAudit/);
});
