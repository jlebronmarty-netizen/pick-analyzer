import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseEspnNhlFreeProbables,selectEspnNhlProbablesAsOf,NHL_ESPN_GOALIE_VERSION}
 from '../src/lib/nhl-espn-free-goalie-probables-v5.mjs';
import {planNhlFrozenSlate} from '../src/lib/nhl-challenger-freeze-core.mjs';
const decision='2026-11-15T22:08:00Z';
const fixture={eventId:'nhl:2026020400',homeId:5,awayId:6,
 home:'Boston Bruins',away:'Philadelphia Flyers',scheduledAt:'2026-11-16T01:00:00Z',status:'SCHEDULED'};
const competitor=(side,name,id,goalieId,goalieName)=>({
 homeAway:side,team:{id,displayName:name},
 probables:[{name:'probableStartingGoalie',displayName:'Probable Starting Goalie',
  abbreviation:'SG',playerId:Number(goalieId),
  athlete:{id:goalieId,displayName:goalieName}}]
});
const payload={events:[{id:'401892900',date:'2026-11-16T01:00Z',
 status:{type:{name:'STATUS_SCHEDULED'}},competitions:[{competitors:[
  competitor('home','Boston Bruins','1','3042020','Tristan Jarry'),
  competitor('away','Philadelphia Flyers','2','3942459','Dan Vladar')]}]}]};
const sample=parseEspnNhlFreeProbables({payload,officialSchedule:[fixture],capturedAt:decision});
test('Free ESPN scoreboard gives timestamped PROBABLE goalie observations only',()=>{
 assert.equal(sample.status,'FREE_PREGAME_PROBABLES_OBSERVED');
 assert.equal(sample.games.length,1);assert.equal(sample.games[0].homeProbable.displayName,'Tristan Jarry');
 assert.equal(sample.games[0].homeProbable.sourceAthleteId,'3042020');
 assert.equal(sample.games[0].homeProbable.sourceAthleteIdIsNhlPlayerId,false);
 assert.equal(sample.games[0].confirmedHome,false);
 assert.equal(sample.probableIsConfirmed,false);assert.equal(sample.modelAdjusted,false);
});
test('Fail closed on live ESPN, late observations, team identity and incomplete NHL schedules',()=>{
 for(const [p,g,at] of [
  [{...payload,events:[{...payload.events[0],status:{type:{name:'STATUS_IN_PROGRESS'}}}]},[fixture],decision],
  [payload,[fixture],'2026-11-16T00:45:00Z'],
  [payload,[{...fixture,home:'Unknown Team'}],decision],
  [payload,[],decision]
 ]){
  const r=parseEspnNhlFreeProbables({payload:p,officialSchedule:g,capturedAt:at});
  assert.equal(r.status,'NO_ELIGIBLE_PREGAME_PROBABLES');
 }
});
test('No ESPN probable evidence is relabeled as confirmed from athlete or source names',()=>{
 const p={events:[{...payload.events[0],competitions:[{competitors:[
  {...competitor('home',fixture.home,1,'3042020','Tristan Jarry'),probables:[{
   name:'confirmedStartingGoalie',abbreviation:'SG',
   athlete:{id:'3042020',displayName:'Tristan Jarry'}}]},
  competitor('away',fixture.away,2,'3942459','Dan Vladar')
 ]}]}]};
 const r=parseEspnNhlFreeProbables({payload:p,officialSchedule:[fixture],capturedAt:decision});
 assert.equal(r.games[0].homeProbable,null);
 assert.equal(r.games[0].awayProbable.status,'PROBABLE_ONLY');
});
test('As-of snapshot never time-travels into older NHL pregame decisions',()=>{
 const snap={id:'snapshot',source_version:NHL_ESPN_GOALIE_VERSION,
  raw_sha256:'a'.repeat(64),captured_at:decision,games:sample.games};
 const later=selectEspnNhlProbablesAsOf({snapshots:[snap],game:fixture,decisionAt:'2026-11-15T21:00:00Z'});
 assert.equal(later.status,'NOT_READY');
 const accepted=selectEspnNhlProbablesAsOf({snapshots:[snap],game:fixture,decisionAt:'2026-11-15T22:09:00Z'});
 assert.equal(accepted.status,'PREGAME_PROBABLE_SOURCE_ONLY');
 assert.equal(accepted.confirmedHome,false);assert.equal(accepted.goalieNhlIdentityCrosswalkVerified,false);
 assert.equal(selectEspnNhlProbablesAsOf({snapshots:[snap],game:{...fixture,awayId:7},decisionAt:'2026-11-15T22:09:00Z'}).status,'NOT_READY');
 assert.equal(selectEspnNhlProbablesAsOf({snapshots:[snap],game:fixture,decisionAt:'2026-11-16T00:45:00Z'}).status,'NOT_READY');
});
test('Attaching probable source does not modify V1 market Poisson projections or official picks',()=>{
 const epoch=Date.parse('2026-10-05T20:00:00Z'),day=86400000;
 const runs=Array.from({length:38},(_,i)=>{
  const t=epoch+i*day;
  return {completed_at:new Date(t+5*3600000).toISOString(),games:[{
   eventId:'nhl:'+(2026020000+i),scheduledAt:new Date(t).toISOString(),
   homeId:5,awayId:6,homeScore:4,awayScore:2,status:'FINAL'
  }]};
 });
 runs.push({completed_at:'2026-11-15T22:06:00Z',games:[fixture]});
 const previous=planNhlFrozenSlate({runs,decisionAt:'2026-11-15T22:10:00Z'});
 const next=planNhlFrozenSlate({runs,decisionAt:'2026-11-15T22:10:00Z',
  espnGoalieSnapshots:[{id:'s',source_version:NHL_ESPN_GOALIE_VERSION,
   raw_sha256:'a'.repeat(64),captured_at:decision,games:sample.games}]});
 assert.equal(next.planned.length,1);
 assert.deepEqual(next.planned[0].projection,previous.planned[0].projection);
 assert.deepEqual(next.planned[0].market_proxies,previous.planned[0].market_proxies);
 assert.equal(next.planned[0].features.goalieProbablesV5.status,'PREGAME_PROBABLE_SOURCE_ONLY');
 assert.equal(next.planned[0].official_pick,false);
});
test('Free single-call collector reuses NHL cron and blocks paid provider or Official Picks',()=>{
 const writer=fs.readFileSync('src/services/nhl-espn-goalie-probables-capture.service.ts','utf8');
 const cron=fs.readFileSync('src/app/api/cron/nhl-free/route.ts','utf8');
 const dbSql=fs.readFileSync('supabase/migrations/20261116004500_nhl_espn_goalie_probables_v1.sql','utf8');
 assert.match(writer,/NHL_ESPN_GOALIE_CAPTURE_ENABLED/);
 assert.match(writer,/getUTCHours\(\)!==22/);
 assert.match(writer,/DAILY_ATTEMPT_ALREADY_CLAIMED/);
 assert.match(writer,/providerCalls=1/);
 assert.ok(!/the_odds_api|fanduel|model_weights|savePrediction/i.test(writer));
 assert.match(cron,/captureNhlFreeEspnProbableGoalies/);
 assert.match(dbSql,/enable row level security/);
 assert.match(dbSql,/revoke update,delete,truncate/);
 assert.match(dbSql,/nhl_espn_nopromotion/);
});
test('NHL probable audit GET is read-only and never advertises confirmation',()=>{
 const api=fs.readFileSync('src/app/api/nhl/espn-goalie-readiness/route.ts','utf8');
 const service=fs.readFileSync('src/services/nhl-espn-free-goalie-readiness.service.ts','utf8');
 assert.ok(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(api+service));
 assert.match(service,/confirmedStartingGoalies:0/);
 assert.match(api,/getNhlEspnFreeGoalieReadiness/);
});
