/* Standalone. Requires a fresh disposable loopback PostgreSQL cluster, never a production connection. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {runDaily,refreshReport} from '../scripts/research/nba-v2/daily/runner.mjs';
import {supabasePort} from '../scripts/research/nba-v2/daily/supabase-port.mjs';
import {ledgerReview} from '../scripts/research/nba-v2/daily/review.mjs';
import {makeBoard,model,at} from './fixtures/nba-v2-cycle.mjs';
const {Client}=await import(process.env.V2_LOCAL_PG_MODULE??'pg');
const cfg={host:'127.0.0.1',port:Number(process.env.V2_LOCAL_TEST_PORT??31873),user:'v2_test_owner',database:'postgres'};
const a=new Client(cfg),b=new Client(cfg);
await Promise.all([a.connect(),b.connect()]);
const scalar=async(c,s,args=[])=>Object.values((await c.query(s,args)).rows[0])[0];
const events=[];
function portFor(c){
  // Same RPC names/argument objects as PostgREST, transported via two independent SQL sessions.
  return supabasePort({rpc:(name,args)=>({abortSignal:async()=>{
    const names={'nba_v2_shadow_commit':1,'nba_v2_shadow_due':1,'nba_v2_shadow_page':1,'nba_v2_shadow_cutoff':1,
      'nba_v2_shadow_report':1,'nba_v2_shadow_existing':1,'nba_v2_shadow_review':1};
    assert.ok(names[name]);events.push(name);
    const params=Object.values(args).map(v=>typeof v==='object'?JSON.stringify(v):v);
    const q=await c.query('select public.'+name+'('+params.map((_,i)=>'$'+(i+1)).join(',')+') val',params);
    return {data:['nba_v2_shadow_due','nba_v2_shadow_page'].includes(name)?q.rows.map(x=>x.val):q.rows[0]?.val};
  }})});
}
try{
  const version=await scalar(a,'select version()');
  assert.equal(await scalar(a,"select to_regnamespace('nba_v2_shadow')"),null);
  await a.query('create role anon;create role authenticated;create role service_role');
  await a.query(readFileSync('scripts/research/nba-v2/daily/storage-proposal.sql','utf8'));
  const seed=execFileSync(process.execPath,['scripts/research/nba-v2/daily/seed-proposal.mjs'],{encoding:'utf8',maxBuffer:1048576});
  await a.query(seed);await a.query(seed);
  assert.equal(await scalar(a,'select count(*)::int from nba_v2_shadow.forecasts'),40);
  assert.equal(await scalar(a,'select count(*)::int from nba_v2_shadow.judgments'),15);
  assert.equal(await scalar(a,"select count(*)::int from nba_v2_shadow.forecasts where record ? 'benchmark'"),0);
  for(const role of ['anon','authenticated']){
    await a.query('set role '+role);
    await assert.rejects(a.query("select public.nba_v2_shadow_due('x',now())"),e=>e.code==='42501');
    await assert.rejects(a.query("select public.nba_v2_shadow_review('x')"),e=>e.code==='42501');
    await assert.rejects(a.query('select * from nba_v2_shadow.forecasts'),e=>e.code==='42501');
    await a.query('reset role');
  }
  // Test clock exists only in this disposable cluster; the proposed production function uses clock_timestamp().
  await a.query("CREATE OR REPLACE FUNCTION nba_v2_shadow.clock_time() RETURNS timestamptz LANGUAGE sql VOLATILE SET search_path='' AS $$ SELECT current_setting('test.v2clock')::timestamptz $$");
  for(const c of [a,b]){await c.query('set role service_role');await c.query("select set_config('test.v2clock',$1,false)",[at]);}
  const p=portFor(a),q=portFor(b),board=makeBoard(),dry=await runDaily({kind:'freeze',clock:()=>at,model,board});
  const hash=dry.batch.modelHash;
  const empty=await p.commit('settle','2026-11-22T12:15:00Z',{...dry.batch,at:'2026-11-22T12:15:01Z',records:[]}).then(()=>null,err=>err);
  assert.ok(empty instanceof Error);
  assert.ok(await p.cutoff(await scalar(a,"select id from nba_v2_shadow.cycles where diagnostics->>'seedFile'='outcomes-20261120'")));
  assert.equal((await p.due(hash,'2026-11-21T20:00:30Z')).length,3);
  await assert.rejects(a.query('update nba_v2_shadow.forecasts set record=record'),e=>e.code==='42501');
  await assert.rejects(a.query('delete from nba_v2_shadow.judgments'),e=>e.code==='42501');
  const bad=structuredClone(dry.batch);bad.records.push({...bad.records[0],qualityStatus:'PARTIAL'});
  await assert.rejects(p.commit('freeze',dry.slot,bad),/INVALID_V2_FORECAST/);
  assert.equal(await scalar(a,'select count(*)::int from nba_v2_shadow.forecasts'),40);
  assert.equal(await p.existing(dry.batch.modelHash,'freeze',dry.slot),null);
  const expired=structuredClone(dry.batch);
  expired.records[0].expiresAt=dry.batch.at;
  await assert.rejects(p.commit('freeze',dry.slot,expired),/INVALID_V2_FORECAST/);
  assert.equal(await p.existing(hash,'freeze',dry.slot),null);
  const [one,two]=await Promise.all([p.commit('freeze',dry.slot,dry.batch),q.commit('freeze',dry.slot,dry.batch)]);
  assert.equal(one,two);
  assert.equal(await scalar(a,'select count(*)::int from nba_v2_shadow.forecasts'),41);
  const retry=await runDaily({kind:'freeze',clock:()=>at,model,port:p,write:true});assert.equal(retry.reused,true);
  const later='2026-11-22T23:35:10.000Z';
  await a.query("select set_config('test.v2clock',$1,false)",[later]);
  const repeat={...dry.batch,at:later,records:dry.batch.records.map(f=>({...f,expiresAt:f.gameStartAt,
    frozenAt:later,decisionAt:later,featuresAsOf:later,quoteAt:later,capturedAt:later,projection:200}))};
  await p.commit('freeze','2026-11-22T23:35:00Z',repeat);
  assert.equal(await scalar(a,"select (record->>'projection')::float from nba_v2_shadow.forecasts where id=$1",[repeat.records[0].forecastId]),57.12);
  // Intentionally no finals in this second simulation. Seeded settlements are evaluated separately at their original cutoff.
  const initialId=await scalar(a,"select id from nba_v2_shadow.cycles where diagnostics->>'seedFile'='outcomes-20261120'");
  const [initial,parallelReport]=await Promise.all([refreshReport(p,model,initialId),refreshReport(q,model,initialId)]);
  assert.deepEqual(initial,parallelReport);
  const summary=initial.scopes.at(-1);
  assert.equal(summary.metrics.wins,6);assert.equal(summary.metrics.losses,9);assert.equal(summary.settledIndependentGames,3);
  assert.equal(summary.metrics.pairedBinaryGames,3);
  assert.equal(initial.recentContracts.filter(c=>c.status==='win').length,6);
  assert.equal(initial.recentContracts.filter(c=>c.status==='loss').length,9);
  const archive=JSON.parse(readFileSync('docs/research/nba-v2/operations/prospective-report.json'));
  const snapshot=await p.review(hash),dashboard=ledgerReview(snapshot,archive);
  assert.equal(dashboard.contracts.length,26);
  assert.equal(dashboard.pendingAfterReport,26);
  assert.deepEqual([...new Set(dashboard.contracts.map(c=>c.day))].sort(),['2026-11-21','2026-11-22']);
  assert.equal(dashboard.contracts.find(c=>c.game===999050).matchup,'A @ H');
  assert.equal(dashboard.report.at(-1).settledIndependentGames,3);
  const morning='2026-11-23T12:15:02.000Z';
  await a.query("select set_config('test.v2clock',$1,false)",[morning]);
  const live={...p,schedule:async()=>[],playerEvidence:async()=>({})};
  // Commit succeeds, publication fails, retry repairs only the missing report.
  await assert.rejects(runDaily({kind:'settle',model,clock:()=>morning,port:{...live,saveReport:async()=>{throw Error('SIMULATED_REPORT_FAILURE');}},write:true}),/SIMULATED_REPORT_FAILURE/);
  const prior=await scalar(a,'select count(*)::int from nba_v2_shadow.judgments');
  const repaired=await runDaily({kind:'settle',model,clock:()=>morning,port:live,write:true});
  assert.ok(repaired.reused);assert.equal(await scalar(a,'select count(*)::int from nba_v2_shadow.judgments'),prior);
  assert.equal(await scalar(a,'select count(*)::int from nba_v2_shadow.reports'),2);
  const late={...dry.batch,at:morning};
  await assert.rejects(p.commit('freeze','2026-11-23T15:35:00Z',late),/INVALID_V2_BATCH_OR_CLOCK/);
  await a.query('reset role');
  await a.query(readFileSync('scripts/research/nba-v2/daily/observe-only.sql','utf8'));
  const sha='a'.repeat(40),host='pick-analyzer-test.vercel.app';
  await a.query("insert into nba_v2_shadow.observation_window(deployment_sha,hostname,expires_at) values($1,$2,now()+interval '5 min')",[sha,host]);
  await a.query('set role service_role');
  assert.equal(await scalar(a,'select public.nba_v2_shadow_observe_allowed($1,$2)',[sha,host]),true);
  assert.equal(await scalar(a,'select public.nba_v2_shadow_observe_allowed($1,$2)',[sha,'other.vercel.app']),false);
  await assert.rejects(a.query('update nba_v2_shadow.observation_window set closed_at=now()'),e=>e.code==='42501');
  await assert.rejects(a.query("select public.nba_v2_shadow_commit(null,null,null)"),e=>e.code==='42501');
  await assert.rejects(a.query("select public.nba_v2_shadow_report(null,null)"),e=>e.code==='42501');
  await assert.rejects(a.query("insert into nba_v2_shadow.judgments default values"),e=>e.code==='42501');
  await a.query('reset role');
  await a.query('update nba_v2_shadow.observation_window set closed_at=now() where deployment_sha=$1',[sha]);
  assert.equal(await scalar(a,'select public.nba_v2_shadow_observe_allowed($1,$2)',[sha,host]),false);
  console.log(JSON.stringify({observationClosed:true,automaticWritesDenied:true,version,seedForecasts:40,seedResults:15,concurrentConnections:2,
    firstFreezePreserved:true,rollback:true,reportRetry:true,publicRolesDenied:true,rpcsTested:[...new Set(events)]}));
}finally{await Promise.all([a.end(),b.end()]);}
