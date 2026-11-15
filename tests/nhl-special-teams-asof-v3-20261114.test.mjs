import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseNhlOfficialSpecialTeams,selectNhlSpecialTeamsAsOf,NHL_SPECIAL_TEAMS_VERSION} from '../src/lib/nhl-special-teams-asof-core.mjs';
import {planNhlFrozenSlate} from '../src/lib/nhl-challenger-freeze-core.mjs';
const at='2026-11-14T20:00:00Z',game={eventId:'nhl:2026020500',status:'SCHEDULED',
 scheduledAt:'2026-11-15T01:00:00Z',homeId:1,awayId:2,home:'Team 1',away:'Team 2'};
const directory=new Map(Array.from({length:32},(_,i)=>[i+1,{name:'Official Hockey Team '+(i+1)}]));
const payload={data:Array.from({length:32},(_,i)=>({teamFullName:'Official Hockey Team '+(i+1),
 seasonId:20262027,gameTypeId:2,gamesPlayed:12,powerPlayPct:.20+i/1000,penaltyKillPct:.82-i/1000}))};
const norm=parseNhlOfficialSpecialTeams({payload,directory,capturedAt:'2026-11-14T18:07:00Z'});
const snapshot={id:'sha',snapshot_day:'2026-11-14',captured_at:'2026-11-14T18:07:00Z',
 season_id:20262027,source_version:NHL_SPECIAL_TEAMS_VERSION,
 source_hash:'a'.repeat(64),teams:norm.teams};
test('Official season-to-date PP/PK report requires exact team identity and complete schema',()=>{
 assert.equal(norm.status,'VALIDATED_SOURCE_SCHEMA');assert.equal(norm.teams.length,32);
 assert.equal(norm.teams[0].teamId,1);assert.equal(norm.teams[0].powerPlayPct,.2);
 assert.equal(norm.teams[0].penaltyKillPct,.82);
 assert.equal(norm.modelApplied,false);
});
test('Fail-closed on duplicate, missing percentages, unknown team identity, wrong season or invalid values',()=>{
 const variants=[
  {data:[...payload.data.slice(0,31),payload.data[0]]},
  {data:payload.data.map((x,i)=>i===0?{...x,powerPlayPct:20}:x)},
  {data:payload.data.map((x,i)=>i===0?{...x,teamFullName:'Unrecognized Club'}:x)},
  {data:payload.data.map((x,i)=>i===0?{...x,penaltyKillPct:null}:x)},
  {data:payload.data.map((x,i)=>i===0?{...x,seasonId:20252026}:x)},
  {data:payload.data.slice(0,25)}
 ];
 for(const v of variants){
  const r=parseNhlOfficialSpecialTeams({payload:v,directory,capturedAt:at});
  assert.equal(r.status,'NOT_READY');
 }
});
test('As-of select accepts frozen pregame season aggregate but never rewrites older decisions',()=>{
 const r=selectNhlSpecialTeamsAsOf({snapshots:[snapshot],game,asOf:at});
 assert.equal(r.status,'ASOF_SPECIAL_TEAMS_EVIDENCE');
 assert.equal(r.home.teamId,1);assert.equal(r.away.teamId,2);
 assert.equal(r.home.powerPlayPct,.2);
 assert.equal(r.modelScoringAdjusted,false);assert.equal(r.confirmedStartingGoalie,false);
 assert.equal(selectNhlSpecialTeamsAsOf({snapshots:[snapshot],game,asOf:'2026-11-14T17:00:00Z'}).status,'NOT_READY');
 assert.equal(selectNhlSpecialTeamsAsOf({snapshots:[{...snapshot,captured_at:'2026-11-13T01:00:00Z'}],game,asOf:at}).status,'NOT_READY');
 assert.equal(selectNhlSpecialTeamsAsOf({snapshots:[snapshot],game,asOf:game.scheduledAt}).reason,'NOT_PREGAME_60M');
});
test('PP/PK research evidence never changes the V1 Poisson market probabilities or scoring',()=>{
 const day=86400000,base=Date.parse('2026-10-05T20:00:00Z');
 const final=(i)=>({eventId:'nhl:'+(2026020000+i),scheduledAt:new Date(base+i*day).toISOString(),
  homeId:1,awayId:2,status:'FINAL',homeScore:4,awayScore:2});
 const runs=Array.from({length:39},(_,i)=>({
  completed_at:new Date(base+i*day+5*3600000).toISOString(),games:[final(i)]
 }));
 runs.push({completed_at:'2026-11-14T19:45:00Z',games:[game]});
 const plain=planNhlFrozenSlate({runs,decisionAt:at});
 const extra=planNhlFrozenSlate({runs,decisionAt:at,specialTeamsSnapshots:[snapshot]});
 assert.equal(plain.status,'READY_TO_FREEZE');
 assert.equal(extra.status,'READY_TO_FREEZE');
 assert.deepEqual(extra.planned[0].market_proxies,plain.planned[0].market_proxies);
 assert.deepEqual(extra.planned[0].projection,plain.planned[0].projection);
 assert.equal(extra.planned[0].features.specialTeamsV3.status,'ASOF_SPECIAL_TEAMS_EVIDENCE');
 assert.equal(extra.planned[0].official_pick,false);
});
test('Collector is off by default, one daily source call, no retries, isolated from official models',()=>{
 const code=fs.readFileSync('src/services/nhl-special-teams-capture.service.ts','utf8');
 const cron=fs.readFileSync('src/app/api/cron/nhl-free/route.ts','utf8');
 assert.match(code,/NHL_SPECIAL_TEAMS_CAPTURE_ENABLED/);
 assert.match(code,/getUTCHours\(\)!==18/);
 assert.match(code,/ONE_ATTEMPT_PER_DAY_CAP/);
 assert.match(code,/providerCalls=1/);
 assert.match(code,/readNhlDirectoryCache/);
 assert.match(code,/OFFICIAL_TEAM_SOURCE_SCHEMA_UNVERIFIED/);
 assert.ok(!/savePrediction|official_picks|model_weights|the_odds_api/.test(code));
 assert.ok(cron.indexOf('const specialTeamsCapture=await syncNhlSpecialTeamsResearchSnapshot()')<
  cron.indexOf('const challengerFreeze=await runNhlChallengerShadowFreeze()'));
 assert.equal((fs.readFileSync('vercel.json','utf8').match(/\/api\/cron\/nhl-free/g)||[]).length,1);
});
test('Database is append-only, private and rejects unofficial model promotions',()=>{
 const code=fs.readFileSync('supabase/migrations/20261115023500_nhl_special_teams_asof_v1.sql','utf8');
 assert.match(code,/enable row level security/);
 assert.match(code,/revoke update,delete,truncate/);
 assert.match(code,/grant select,insert/);
 assert.match(code,/nhl_st_no_official_model/);
 assert.match(code,/source_url = 'https:\/\/api.nhle.com\/stats\/rest\/en\/team\/summary/);
});
test('Research audit is read-only; PP/PK is only historical evidence, not a new pick engine',()=>{
 const service=fs.readFileSync('src/services/nhl-special-teams-readiness.service.ts','utf8');
 const route=fs.readFileSync('src/app/api/nhl/special-teams-research/route.ts','utf8');
 const frozen=fs.readFileSync('src/services/nhl-challenger-frozen-ledger-audit.service.ts','utf8');
 assert.ok(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(|fetch\(/.test(service+route));
 assert.match(route,/getNhlSpecialTeamsResearchStatus/);
 assert.match(frozen,/sourceMustPredateFreeze:true/);
});

test('One-off NHL PP/PK source schema probe cannot run in production or write data',()=>{
 const probe=fs.readFileSync('src/app/api/nhl/special-teams-source-probe/route.ts','utf8');
 assert.match(probe,/process\.env\.VERCEL_ENV!=='preview'/);
 assert.match(probe,/providerCalls:1,databaseWrites:0/);
 assert.ok(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(probe));
 assert.match(probe,/parseNhlOfficialSpecialTeams/);
});
