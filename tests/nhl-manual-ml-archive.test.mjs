import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {manualFeature,manualRow} from './fixtures/nhl-manual-features.mjs';
import {normalizeNhlManualMlArchive,buildNhlManualMlResearch,readNhlManualMlArchive,NHL_MANUAL_ML_TABLES,NHL_MANUAL_ML_INPUT_KEYS} from '../src/lib/nhl-manual-ml-archive.mjs';

const cutoff='2026-11-25T12:00:00.000Z';
const event='nhl:2026020350', originalAt='2026-11-23T10:00:00.000Z', freeze='2026-11-23T22:00:00.000Z', start='2026-11-24T00:00:00.000Z';
function archive() {
  const bytes=JSON.stringify({data:[{id:54,fullName:'Vegas Golden Knights',triCode:'VGK'},{id:30,fullName:'Minnesota Wild',triCode:'MIN'}]});
  const directory={id:'directory-test',captured_at:'2026-11-23T09:00:00.000Z',source_url:'https://api.nhle.com/stats/rest/en/team',
    body:{http_status:200,encoding:'gzip/base64',raw:gzipSync(bytes).toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex'),error:null,access_denied:false}};
  const prediction={id:`DRATINGS_PUBLIC_ARGMAX_V1:${event}`,event_id:event,source_id:'source-test',scheduled_at:start,created_at:originalAt,
    body:{id:`DRATINGS_PUBLIC_ARGMAX_V1:${event}`,model:'DRATINGS_PUBLIC_V1',eventId:event,scheduledAt:start,capturedAt:originalAt,
      homeId:54,awayId:30,home:'Vegas Golden Knights',away:'Minnesota Wild',homeProbability:.6,awayProbability:.4,directorySourceId:directory.id}};
  const late={id:`NHL_LATE_PROBABLE_CALIBRATION_SHADOW_V6:${event}`,event_id:event,model_version:'NHL_LATE_PROBABLE_CALIBRATION_SHADOW_V6',
    status:'FROZEN_RESEARCH',home_team_id:54,away_team_id:30,scheduled_at:start,frozen_at:freeze,created_at:'2026-11-23T22:00:01.508621Z',
    source_completed_at:'2026-11-23T21:59:00.000Z',source_hash:'a'.repeat(64),official_pick:false,production_eligible:false,goalie_snapshot_id:'goalie-test',
    goalie_evidence:{status:'PREGAME_PROBABLE_SOURCE_ONLY',observedAt:'2026-11-23T21:59:20.000Z',sourceSnapshotId:'goalie-test',
      home:{displayName:'Test Home'},away:{displayName:'Test Away'},isConfirmedStarter:false,goalieAdjustmentApplied:false},
    calibration:{status:'PROSPECTIVE_TEST_ONLY',holdoutPassed:false,officialPromotion:false,expectedValue:null,originalDratingsHome:.6,dratingsOriginalObservedAt:originalAt,
      candidateHome:.56,candidateAway:.44,rolling:{status:'FROZEN_CANDIDATE_ELIGIBLE',priorGames:40},
      circaPrice:{status:'CIRCA_PREGAME_RESEARCH_ONLY',eventId:event,capturedAt:'2026-11-23T21:59:40.000Z',marketRuleVerified:false,
        bookmaker:'CIRCA',observationId:'quote-test',homeNoVig:.53875,awayNoVig:.46125,homeOdds:-124,awayOdds:111}},
    market_proxies:{homeMoneylineProxy:.52,awayMoneylineProxy:.48}};
  const outcome={id:'final-test',event_id:event,source_id:'final-source',observed_at:'2026-11-24T03:00:00.000Z',
    body:{eventId:event,scheduledAt:start,capturedAt:'2026-11-24T03:00:00.000Z',homeId:54,awayId:30,homeScore:4,awayScore:3}};
  return {cutoff,manual:[manualRow({feature:manualFeature({eventId:event,scheduled:start})})],predictions:[prediction],outcomes:[outcome],
    early:[],late:[late],directories:[directory],readEvidence:{complete:true,cutoff}};
}
const normalize=data=>normalizeNhlManualMlArchive(data);
const hasReason=(value,reason)=>value.exclusions.some(row=>row.reason===reason);

test('adapter preserves originals, verifies archived IDs, and separates late anchors from original forecasts',()=>{
  const data=archive(), before=JSON.stringify(data), result=normalize(data);
  assert.equal(JSON.stringify(data),before);
  assert.equal(result.strictDecisions.length,1);
  assert.equal(result.lateDecisions.length,1);
  const original=result.strictDecisions[0], late=result.lateDecisions[0];
  assert.equal(original.forecastAt,originalAt);
  assert.equal(late.forecastAt,freeze);
  assert.equal(late.originalForecastAt,originalAt);
  assert.equal(late.homeProbability,.6);
  assert.equal(late.identityVerified,true);
  assert.equal(late.identitySourceId,'directory-test');
  assert.deepEqual(late.comparators.map(row=>row.id),['circaNoVig','poisson','v6']);
  assert.equal(result.outcomes[0].settlementContract,'OFFICIAL_FINAL_INCLUDES_OT_SO');
});

test('directory corruption, changed URL, future availability or missing receipt cannot invent team identity',()=>{
  for(const mutate of [
    a=>a.directories[0].body.sha256='0'.repeat(64),
    a=>a.directories[0].body.raw='not-gzip',
    a=>a.directories[0].source_url='https://example.test/team',
    a=>a.directories[0].captured_at='2026-11-23T10:00:00.001Z',
    a=>a.directories=[],
    a=>a.predictions[0].body.home='Minnesota Wild',
    a=>a.predictions[0].body.homeId=30,
    a=>a.predictions[0].body.directorySourceId=null,
  ]) {
    const data=archive();mutate(data);
    const result=normalize(data);
    assert.equal(result.strictDecisions.length,0);
    assert.equal(result.lateDecisions.length,0);
    assert.ok(result.exclusions.length>0);
  }
});

test('conflicting archived directory IDs are quarantined instead of last-write-wins',()=>{
  const data=archive();data.directories.push({...structuredClone(data.directories[0]),captured_at:'2026-11-23T09:30:00.000Z'});
  const result=normalize(data);
  assert.equal(result.strictDecisions.length,0);
  assert.ok(hasReason(result,'DIRECTORY_CONFLICT'));
});

test('later persistence is allowed within the existing pregame contract but not after start, cutoff, or five-minute bound',()=>{
  assert.equal(normalize(archive()).lateDecisions.length,1);
  for(const stored of [start,'2026-11-23T21:59:59.999Z','2026-11-23T22:05:00.001Z','2026-11-26T00:00:00Z']) {
    const data=archive();data.late[0].created_at=stored;
    assert.equal(normalize(data).lateDecisions.length,0);
  }
  const data=archive();data.cutoff=freeze;
  assert.equal(normalize(data).lateDecisions.length,0,'nominal freeze is insufficient before its storage evidence');
});

test('late anchors retain source guards and the exact frozen DRatings provenance',()=>{
  for(const mutate of [
    a=>a.late[0].calibration.originalDratingsHome=.61,
    a=>a.late[0].calibration.dratingsOriginalObservedAt='2026-11-23T10:00:01Z',
    a=>a.late[0].home_team_id=30,
    a=>a.late[0].source_completed_at='2026-11-23T22:01:00Z',
    a=>a.late[0].goalie_evidence.observedAt='2026-11-23T22:01:00Z',
    a=>a.late[0].official_pick=true,
    a=>a.late[0].source_hash='invalid',
    a=>a.late[0].status='NEW',
  ]) {
    const data=archive();mutate(data);
    assert.equal(normalize(data).lateDecisions.length,0);
  }
});

test('inconsistent Circa arithmetic excludes market and V6 comparator without moving the fixed anchor',()=>{
  const data=archive();data.late[0].calibration.circaPrice.homeOdds=-200;
  const result=normalize(data);
  assert.equal(result.lateDecisions.length,1);
  assert.deepEqual(result.lateDecisions[0].comparators.map(row=>row.id),['poisson']);
  assert.ok(hasReason(result,'FROZEN_CIRCA_PRICE_PAIR_INCONSISTENT'));
});

test('both OT and SO final winners are full-game labels; tied, negative, wrong-team, early and future finals are rejected',()=>{
  for(const scores of [[4,3],[3,4]]) {
    const data=archive();[data.outcomes[0].body.homeScore,data.outcomes[0].body.awayScore]=scores;
    assert.equal(normalize(data).outcomes.length,1);
  }
  for(const mutate of [
    a=>a.outcomes[0].body.awayScore=4,
    a=>a.outcomes[0].body.awayScore=-1,
    a=>a.outcomes[0].body.homeId=1,
    a=>a.outcomes[0].body.eventId='nhl:2026020351',
    a=>a.outcomes[0].observed_at=start,
    a=>a.outcomes[0].observed_at='2026-11-26T03:00:00Z',
    a=>a.outcomes[0].source_id=null,
  ]) {
    const data=archive();mutate(data);
    assert.equal(normalize(data).outcomes.length,0);
  }
});

test('identical repeated rows count once; conflicting original decisions are quarantined',()=>{
  const data=archive();data.predictions.push(structuredClone(data.predictions[0]));data.outcomes.push(structuredClone(data.outcomes[0]));
  assert.equal(normalize(data).strictDecisions.length,1);
  assert.equal(normalize(data).outcomes.length,1);
  data.predictions[1].body.homeProbability=.65;
  assert.equal(normalize(data).strictDecisions.length,0);
});

test('outcome corrections remain versioned so a later conflict cannot erase earlier training evidence',()=>{
  const data=archive(), original=structuredClone(data.outcomes[0]);
  const correction=structuredClone(original);correction.id='correction';correction.observed_at='2026-11-25T10:00:00.000Z';
  correction.body.capturedAt=correction.observed_at;correction.body.homeScore=2;
  data.outcomes.push(correction);
  const result=normalize(data);
  assert.equal(result.outcomes.length,2);
  assert.equal(result.outcomes[0].observedAt,original.observed_at);
  assert.equal(result.outcomes[0].homeScore,4);
  assert.equal(result.outcomes[1].observedAt,correction.observed_at);
  assert.equal(result.outcomes[1].homeScore,2);
  assert.equal(hasReason(result,'CONFLICTING_DUPLICATE_EVENT'),false);
  const report=buildNhlManualMlResearch(data);
  assert.equal(report.joinCoverage.manualGamesWithFinal,0);
  assert.equal(report.joinCoverage.manualGamesWithConflictingFinals,1);
  data.cutoff='2026-11-25T09:00:00Z';
  assert.equal(normalize(data).outcomes.length,1);
});

test('microsecond boundaries and report cutoff are preserved without millisecond truncation',()=>{
  const data=archive();data.cutoff='2026-11-23T22:00:01.508620Z';
  assert.equal(normalize(data).lateDecisions.length,0);
  data.cutoff='2026-11-23T22:00:01.508621Z';
  assert.equal(normalize(data).lateDecisions.length,1);
  data.readEvidence.cutoff=data.cutoff;
  assert.equal(buildNhlManualMlResearch(data).cutoff,data.cutoff);
});

test('source, goalie and market clocks one microsecond after the V6 freeze are rejected',()=>{
  for(const mutate of [
    a=>a.late[0].source_completed_at='2026-11-23T22:00:00.000001Z',
    a=>a.late[0].goalie_evidence.observedAt='2026-11-23T22:00:00.000001Z',
    a=>a.late[0].calibration.circaPrice.capturedAt='2026-11-23T22:00:00.000001Z',
  ]) {
    const data=archive();mutate(data);
    assert.equal(normalize(data).lateDecisions.length,0);
  }
});

test('future conflicting records cannot change the earlier normalized report',()=>{
  const data=archive(), original=normalize(data);
  const later=structuredClone(data.predictions[0]);later.created_at='2026-11-26T12:00:00Z';later.body.homeProbability=.9;
  data.predictions.push(later);
  assert.deepEqual(normalize(data).strictDecisions,original.strictDecisions);
  assert.deepEqual(normalize(data).lateDecisions,original.lateDecisions);
});

test('report distinguishes missing archives from verified empty, and temporal coverage from feature eligibility',()=>{
  const data=archive();data.outcomes=[];
  const result=buildNhlManualMlResearch(data);
  assert.equal(result.joinCoverage.uniqueGames,1);
  assert.equal(result.joinCoverage.manualAvailableAtOriginal,0);
  assert.equal(result.joinCoverage.manualAvailableAtLate,1);
  assert.equal(result.joinCoverage.manualGamesWithFinal,0);
  assert.equal(result.historicalContext.manualFeatureEffectEvaluated,false);
  assert.equal(result.modelPromoted,false);
  for(const mutate of [a=>delete a.manual,a=>delete a.directories,a=>a.readEvidence.complete=false,a=>a.readEvidence.cutoff='2026-11-26T00:00:00Z']) {
    const missing=archive();mutate(missing);
    assert.equal(buildNhlManualMlResearch(missing).status,'READ_UNAVAILABLE');
  }
  const empty={cutoff,readEvidence:{complete:true,cutoff},...Object.fromEntries(NHL_MANUAL_ML_INPUT_KEYS.map(key=>[key,[]]))};
  assert.notEqual(buildNhlManualMlResearch(empty).status,'READ_UNAVAILABLE');
  assert.equal(buildNhlManualMlResearch(empty).joinCoverage.uniqueGames,0);
});

function fakeDb(respond) {
  const calls=[];
  return {calls,from(table) {
    const request={table,filters:[],order:[]};
    const query={select(value,options){request.select=value;request.options=options;return query;},
      lte(column,value){request.filters.push(['lte',column,value]);return query;},
      in(column,values){request.filters.push(['in',column,values]);return query;},
      order(column){request.order.push(column);return query;},range(first,last){request.range=[first,last];return query;},
      abortSignal(signal){request.signal=signal;return query;},then(resolve,reject){calls.push(request);return Promise.resolve().then(()=>respond(request)).then(resolve,reject);}};
    return query;
  }};
}

test('archive reader reuses stable pagination and selects only referenced directory IDs at one cutoff',async()=>{
  const input=archive();
  const lookup=Object.fromEntries(NHL_MANUAL_ML_TABLES.map(spec=>[spec.table,input[spec.key]]));
  lookup.nhl_free_source_v1=input.directories;
  const db=fakeDb(req=>({data:lookup[req.table].slice(req.range[0],req.range[1]+1),count:lookup[req.table].length,error:null}));
  const result=await readNhlManualMlArchive(db,{cutoff});
  assert.equal(result.readEvidence.complete,true);
  assert.deepEqual(result.directories,input.directories);
  assert.equal(db.calls.length,6);
  for(const call of db.calls) {assert.equal(call.filters[0][2],cutoff);assert.deepEqual(call.options,{count:'exact'});}
  assert.deepEqual(db.calls.at(-1).filters[1],['in','id',['directory-test']]);
  const manual=db.calls.find(row=>row.table==='nhl_manual_feature_snapshots_v1');
  assert.deepEqual(manual.order,['event_id','available_as_of']);
  assert.deepEqual(manual.filters,[['lte','inserted_at',cutoff]],'read all dates; never use today-only presentation projection');
});

test('a failed, incomplete or capped source prevents a partial archive from being certified',async()=>{
  for(const response of [{data:null,count:null,error:{code:'PGRST205'}},{data:[],count:null},{data:[],count:20001}]) {
    const db=fakeDb(req=>req.table==='nhl_manual_feature_snapshots_v1'?response:{data:[],count:0});
    await assert.rejects(readNhlManualMlArchive(db,{cutoff}));
  }
  const controller=new AbortController();controller.abort();
  await assert.rejects(readNhlManualMlArchive(fakeDb(()=>({data:[],count:0})),{cutoff,signal:controller.signal}));
});

test('offline CLI verifies all six hashes and rejects tampering before writing metrics',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'nhl-manual-ml-'));
  try {
    const data=archive(), files={};
    for(const key of NHL_MANUAL_ML_INPUT_KEYS) {
      const bytes=JSON.stringify(data[key]);await writeFile(path.join(directory,key+'.json'),bytes);
      files[key]={rows:data[key].length,sha256:createHash('sha256').update(bytes).digest('hex')};
    }
    await writeFile(path.join(directory,'manifest.json'),JSON.stringify({cutoff,complete:true,files}));
    const output=path.join(directory,'report.json');
    const run=()=>spawnSync(process.execPath,['scripts/nhl-manual-ml-research.mjs','--input',directory,'--output',output],{encoding:'utf8'});
    const valid=run();assert.equal(valid.status,0,valid.stderr);
    const report=JSON.parse(await readFile(output,'utf8'));assert.equal(report.databaseWrites,0);
    const shifted=spawnSync(process.execPath,['scripts/nhl-manual-ml-research.mjs','--input',directory,'--output',output,'--cutoff',cutoff.replace('.000Z','.000001Z')],{encoding:'utf8'});
    assert.notEqual(shifted.status,0);assert.match(shifted.stderr,/Cutoff must match/);
    await writeFile(path.join(directory,'directories.json'),'[]');
    const invalid=run();assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/Export integrity mismatch: directories/);
  } finally {await rm(directory,{recursive:true,force:true});}
});
