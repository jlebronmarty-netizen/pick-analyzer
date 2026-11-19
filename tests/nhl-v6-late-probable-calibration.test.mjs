import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildNhlV6LateCandidate,nhlV6RollingHomeBias,selectNhlV6CircaAsOf,NHL_LATE_V6} from '../src/lib/nhl-late-v6-core.mjs';
const hour=3600000,day=86400000,base=Date.parse('2026-10-05T20:00:00Z');
const now='2026-11-19T22:08:00Z';
const game={eventId:'nhl:2026020999',scheduledAt:'2026-11-20T00:00:00Z',status:'SCHEDULED',
 homeId:1,awayId:2,home:'New Jersey Devils',away:'Montreal Canadiens'};
const at=ms=>new Date(ms).toISOString();
const finals=Array.from({length:39},(_,i)=>{
 const start=base+i*day;
 return {eventId:'nhl:202602'+String(i).padStart(4,'0'),
  scheduledAt:at(start),capturedAt:at(start+5*hour),
  homeId:1,awayId:2,homeGoals:4,awayGoals:2};
});
const priorOutcomes=finals.map(x=>({event_id:x.eventId,observed_at:x.capturedAt,
 body:{eventId:x.eventId,scheduledAt:x.scheduledAt,homeId:x.homeId,awayId:x.awayId,
  homeScore:x.homeGoals,awayScore:x.awayGoals}}));
const q=(g,capturedAt,homeOdds=-120,awayOdds=110)=>({
 id:g.eventId+capturedAt,event_id:g.eventId,scheduled_at:g.scheduledAt,captured_at:capturedAt,
 body:{eventId:g.eventId,scheduledAt:g.scheduledAt,homeId:g.homeId,awayId:g.awayId,
  capturedAt,homeOdds,awayOdds,sportsbook:'CIRCA'}
});
const quoteRows=[...finals.map(x=>q(x,at(Date.parse(x.scheduledAt)-2*hour))),
 q(game,'2026-11-19T22:07:30Z')];
const goalieGame={eventId:game.eventId,scheduledAt:game.scheduledAt,
 homeTeamId:game.homeId,awayTeamId:game.awayId,homeName:game.home,awayName:game.away,
 homeProbable:{status:'PROBABLE_ONLY',displayName:'Goalie Home',sourceAthleteId:'123',sourceConfirmationVerified:false},
 awayProbable:{status:'PROBABLE_ONLY',displayName:'Goalie Away',sourceAthleteId:'234',sourceConfirmationVerified:false},
 confirmedHome:false,confirmedAway:false};
const snapshot={id:'g-1',captured_at:'2026-11-19T22:07:20Z',source_version:'NHL_ESPN_FREE_PROBABLE_V5',
 raw_sha256:'a'.repeat(64),games:[goalieGame]};
const dratingsRows=[{event_id:game.eventId,created_at:'2026-11-19T11:07:00Z',
 body:{eventId:game.eventId,scheduledAt:game.scheduledAt,homeId:1,awayId:2,
 homeProbability:0.54,awayProbability:0.46}}];
const input=()=>({game,decisionAt:now,sourceCompletedAt:'2026-11-19T22:07:10Z',finalScores:finals,
 probableSnapshots:[snapshot],ppPkSnapshots:[],dratingsRows,quoteRows,outcomeRows:priorOutcomes});
test('one late V6 freezes independent probabilities and goalie probable only',()=>{
 const result=buildNhlV6LateCandidate(input());
 assert.equal(result.status,'LATE_RESEARCH_CANDIDATE');
 const row=result.record;
 assert.equal(row.id,NHL_LATE_V6+':'+game.eventId);
 assert.equal(row.goalie_evidence.status,'PREGAME_PROBABLE_SOURCE_ONLY');
 assert.equal(row.goalie_evidence.isConfirmedStarter,false);
 assert.equal(row.goalie_evidence.goalieAdjustmentApplied,false);
 assert.equal(row.official_pick,false);assert.equal(row.production_eligible,false);
 assert.equal(row.calibration.status,'PROSPECTIVE_TEST_ONLY');
 assert.equal(row.calibration.rolling.priorGames,39);
 assert.equal(row.calibration.circaPrice.bookmaker,'CIRCA');
 assert.ok(row.calibration.candidateHome>row.calibration.circaPrice.homeNoVig);
 assert.match(row.source_hash,/^[0-9a-f]{64}$/);
 assert.equal(row.market_proxies.marketOddsAvailable,false);
});
test('no market quote from future or another team/fixture can influence a late decision',()=>{
 const bad=q(game,'2026-11-19T22:09:00Z');
 const mismatched=q({...game,homeId:99},'2026-11-19T22:07:30Z');
 assert.equal(selectNhlV6CircaAsOf({game,decisionAt:now,quotes:[bad,mismatched]}).status,'NOT_READY');
 const fresh=selectNhlV6CircaAsOf({game,decisionAt:now,quotes:quoteRows});
 assert.equal(fresh.status,'CIRCA_PREGAME_RESEARCH_ONLY');
 assert.ok(fresh.homeNoVig>.5);
 const late=buildNhlV6LateCandidate({...input(),quoteRows:[bad]});
 assert.equal(late.status,'LATE_RESEARCH_CANDIDATE');
 assert.equal(late.record.calibration.candidateHome,null);
});
test('missing or late goalie observation does not retrofit original early frozen research',()=>{
 const tooLate={...snapshot,captured_at:'2026-11-19T22:09:00Z'};
 const bad=buildNhlV6LateCandidate({...input(),probableSnapshots:[tooLate]});
 assert.equal(bad.status,'NOT_READY');
 assert.equal(bad.reason,'NO_PREGAME_PAIRED_GOALIE_PROBABLES');
 const early=buildNhlV6LateCandidate({...input(),decisionAt:'2026-11-19T18:00:00Z',
  sourceCompletedAt:'2026-11-19T17:59:00Z'});
 assert.equal(early.status,'NOT_READY');
});
test('outcomes not known by decision time cannot train bias',()=>{
 const later=priorOutcomes.map(x=>({...x,observed_at:'2026-11-19T23:00:00Z'}));
 const bias=nhlV6RollingHomeBias({decisionsAt:now,priorGames:later,quoteRows});
 assert.equal(bias.priorGames,0);
 assert.equal(bias.status,'INSUFFICIENT_EARLIER_RESULTS');
 const result=buildNhlV6LateCandidate({...input(),outcomeRows:later});
 assert.equal(result.record.calibration.candidateHome,null);
});
test('a quote observed after a historical puckdrop cannot train retrospective bias',()=>{
 const altered=quoteRows.map(x=>x.event_id===finals[0].eventId?
  q(finals[0],at(Date.parse(finals[0].scheduledAt)+hour)):x);
 const bias=nhlV6RollingHomeBias({decisionsAt:now,priorGames:priorOutcomes,quoteRows:altered});
 assert.equal(bias.priorGames,38);
});
test('disputed duplicate outcome IDs do not train the calibrator',()=>{
 const twice=[...priorOutcomes,{...priorOutcomes[0]}];
 const result=nhlV6RollingHomeBias({decisionsAt:now,priorGames:twice,quoteRows});
 assert.equal(result.priorGames,38);
});
test('reject not-yet-pregame, stale source, wrong identity and insufficient goalie evidence',()=>{
 const tooClose=buildNhlV6LateCandidate({...input(),decisionAt:'2026-11-19T23:15:00Z',
  sourceCompletedAt:'2026-11-19T23:14:00Z'});
 assert.equal(tooClose.reason,'LATE_PREGAME_OR_SOURCE_FRESHNESS_FAILED');
 const wrong=buildNhlV6LateCandidate({...input(),game:{...game,awayId:1}});
 assert.equal(wrong.reason,'LATE_EVENT_IDENTITY_INVALID');
 const oneSide=buildNhlV6LateCandidate({...input(),probableSnapshots:[{...snapshot,games:[{
  ...goalieGame,awayProbable:null}]}]});
 assert.equal(oneSide.reason,'NO_PREGAME_PAIRED_GOALIE_PROBABLES');
});
test('write path is opt-in, after ESPN V5 and never changes early NHL models',()=>{
 const writer=fs.readFileSync('src/services/nhl-late-v6-freeze-writer.service.ts','utf8');
 const cron=fs.readFileSync('src/app/api/cron/nhl-free/route.ts','utf8');
 assert.match(writer,/NHL_LATE_V6_SHADOW_ENABLED/);
 assert.match(writer,/hour!==22/);
 assert.match(writer,/MAX_WRITES=16/);
 assert.match(writer,/ignoreDuplicates:true/);
 assert.ok(!/\bfetch\(|the_odds_api|savePrediction|updateModel|official_pick.*true/i.test(writer));
 assert.ok(cron.indexOf('const espnGoalies=await captureNhlFreeEspnProbableGoalies()')<
  cron.indexOf('const lateV6=await runNhlLateV6ShadowFreeze()'));
 assert.ok(cron.indexOf('const challengerFreeze=await runNhlChallengerShadowFreeze()')<
  cron.indexOf('const lateV6=await runNhlLateV6ShadowFreeze()'));
 const migration=fs.readFileSync('supabase/migrations/20261119230700_nhl_late_shadow_v6.sql','utf8');
 assert.match(migration,/enable row level security/i);
 assert.match(migration,/revoke update,delete,truncate/i);
 assert.match(migration,/grant select,insert/i);
 assert.match(migration,/nhl_late_v6_never_official/i);
 assert.match(migration,/isConfirmedStarter/i);
});
test('late readout never fetches external data, rewrites predictions, or promotes model',()=>{
 const r=fs.readFileSync('src/services/nhl-late-v6-readiness.service.ts','utf8');
 assert.ok(!/\.upsert\(|\.insert\(|\.update\(|\.delete\(|\bfetch\(/.test(r));
 assert.match(r,/minimumInitialHoldout:30/);
 assert.match(r,/calibratedModelPromoted:false/);
});
