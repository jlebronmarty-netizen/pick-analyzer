// Optional real PostgreSQL integration. Needs embedded-postgres in a separate test runtime.
// Set NHL_MANUAL_TEST_EMBEDDED_MODULE to its file: module URL; never a remote database URL.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {manualFeature} from './fixtures/nhl-manual-features.mjs';
import {nhlManualFeatureDate} from '../src/lib/nhl-manual-features.mjs';

const moduleUrl=process.env.NHL_MANUAL_TEST_EMBEDDED_MODULE;
if(!moduleUrl?.startsWith('file:'))throw new Error('Set NHL_MANUAL_TEST_EMBEDDED_MODULE to local embedded-postgres module; this test only creates an isolated local cluster.');
const {default:EmbeddedPostgres}=await import(moduleUrl);
const socket=net.createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));
const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'nhl-manual-features-pg-'));
const server=new EmbeddedPostgres({databaseDir:directory,user:'postgres',password:'isolated-test-only',port,persistent:true,
  postgresFlags:['-h','127.0.0.1','-c','unix_socket_directories='],onLog:()=>{},onError:()=>{}});
const checks=[];
await server.initialise();await server.start();
const db=server.getPgClient('postgres','127.0.0.1');
try {
  await db.connect();
  await db.query('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.query(await fs.readFile(new URL('../supabase/migrations/20261123210507_nhl_manual_feature_snapshots_v1.sql',import.meta.url),'utf8'));
  const sql=await fs.readFile(new URL('../scripts/nhl-manual-feature-writer.sql',import.meta.url),'utf8');
  const now=Date.now(),scheduled=new Date(now+86400000).toISOString(),generated=new Date(now-60000).toISOString();
  const f=manualFeature({scheduled,generated,date:nhlManualFeatureDate(scheduled)}),hash='a'.repeat(64);
  const write=(run,features,digest=hash)=>db.query(sql,[run,digest,JSON.stringify(features)]);
  async function rejected(promise,code){await assert.rejects(promise,e=>e.code===code);}
  const first=(await write('test-run-001',[f])).rows[0];
  assert.equal(first.status,'INSERTED');assert.ok(first.available_as_of.getTime()>=now);assert.deepEqual(first.available_as_of,first.inserted_at);
  const stored=(await db.query('select feature_payload from public.nhl_manual_feature_snapshots_v1')).rows[0].feature_payload;
  assert.deepEqual(stored,f);checks.push('source preserved; availability and insertion assigned by database');
  const retry=(await write('test-run-001',[f])).rows[0];
  assert.equal(retry.status,'ALREADY_STORED');assert.deepEqual(retry.available_as_of,first.available_as_of);
  await rejected(write('test-run-001',[{...f,note:'changed'}]),'23505');
  await rejected(write('test-run-001',[f],'b'.repeat(64)),'23505');checks.push('identical retry stable; payload/hash divergence rejected');
  const second=(await write('test-run-002',[f])).rows[0];assert.equal(second.status,'INSERTED');
  assert.equal((await db.query('select count(*)::int n from public.nhl_manual_feature_snapshots_v1')).rows[0].n,2);checks.push('later run appends without replacing original');
  await rejected(db.query('update public.nhl_manual_feature_snapshots_v1 set source_run_id=source_run_id'),'55000');
  await rejected(db.query('delete from public.nhl_manual_feature_snapshots_v1'),'55000');
  await rejected(db.query('truncate public.nhl_manual_feature_snapshots_v1'),'55000');checks.push('owner update/delete/truncate rejected');
  for(const role of ['anon','authenticated','service_role']) {
    await db.query(`set role ${role}`);
    try {
      if(role==='service_role')assert.equal((await db.query('select count(*)::int n from public.nhl_manual_feature_snapshots_v1')).rows[0].n,2);
      else await rejected(db.query('select * from public.nhl_manual_feature_snapshots_v1'),'42501');
      await rejected(write('forbidden-role',[f]),'42501');
      await rejected(db.query('insert into public.nhl_manual_feature_snapshots_v1(event_id) values ($1)',[f.event_id]),'42501');
      await rejected(db.query('update public.nhl_manual_feature_snapshots_v1 set source_run_id=source_run_id'),'42501');
      await rejected(db.query('delete from public.nhl_manual_feature_snapshots_v1'),'42501');
      await rejected(db.query('truncate public.nhl_manual_feature_snapshots_v1'),'42501');
    } finally {await db.query('reset role');}
  }
  assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.nhl_manual_feature_snapshots_v1'::regclass")).rows[0].relrowsecurity,true);
  checks.push('RLS enabled; anon/auth blocked; service SELECT only; writer inaccessible to application roles');
  const started=manualFeature({eventId:'nhl:2026020991',generated,scheduled:new Date(now-1000).toISOString(),date:nhlManualFeatureDate(new Date(now-1000).toISOString())});
  assert.equal((await write('started-run',[started])).rows[0].status,'SKIPPED_STARTED');
  const direct='insert into public.nhl_manual_feature_snapshots_v1(event_id,scheduled_at,source_snapshot_sha256,source_run_id,feature_payload,available_as_of,inserted_at) values($1,$2,$3,$4,$5,$6,$6) returning available_as_of,inserted_at';
  await rejected(db.query(direct,[started.event_id,started.scheduled_at,hash,'backdated-started',JSON.stringify(started),generated]),'23514');
  const tampered=manualFeature({eventId:'nhl:2026020992',generated,scheduled,date:nhlManualFeatureDate(scheduled)});
  const real=(await db.query(direct,[tampered.event_id,scheduled,hash,'timestamp-attempt',JSON.stringify(tampered),'2020-01-01T00:00:00Z'])).rows[0];
  assert.ok(real.available_as_of.getTime()>=now);assert.deepEqual(real.available_as_of,real.inserted_at);
  checks.push('started games omitted; direct post-start insert rejected; supplied backdated clocks ignored');
  await rejected(write('future-source',[{...f,available_as_of:new Date(now+60000).toISOString()}]),'23514');
  for(const bad of [{...f,official_pick:true},{...f,model_promoted:true},{...f,forecast_probability:.7},{...f,event_id:null},{...f,teams:null}]) {
    await assert.rejects(write('invalid-feature',[bad]));
  }
  await rejected(write('duplicate-batch',[f,f]),'22023');
  await rejected(write('oversized-batch',Array.from({length:33},(_,i)=>({...f,event_id:`nhl:202602${String(9000+i).padStart(4,'0')}`}))),'22023');
  checks.push('future source captures, prediction flags, missing identity, duplicate and oversized batches rejected');
  const before=(await db.query('select count(*)::int n from public.nhl_manual_feature_snapshots_v1')).rows[0].n;
  await assert.rejects(write('atomic-batch',[{...f,event_id:'nhl:2026020993'},{...f,event_id:'nhl:2026020994',official_pick:true}]));
  assert.equal((await db.query('select count(*)::int n from public.nhl_manual_feature_snapshots_v1')).rows[0].n,before);
  checks.push('invalid batch rolls back every new row');
  const parallel=server.getPgClient('postgres','127.0.0.1');await parallel.connect();
  try {
    const batch=[{...f,event_id:'nhl:2026020995'},{...f,event_id:'nhl:2026020996'}];
    await db.query("set statement_timeout='5s'");await parallel.query("set statement_timeout='5s'");
    const result=await Promise.all([
      db.query(sql,['concurrent-run',hash,JSON.stringify(batch)]),
      parallel.query(sql,['concurrent-run',hash,JSON.stringify([...batch].reverse())]),
    ]);
    assert.equal(result.flatMap(r=>r.rows).filter(r=>r.status==='INSERTED').length,2);
    assert.equal(result.flatMap(r=>r.rows).filter(r=>r.status==='ALREADY_STORED').length,2);
    assert.equal((await db.query("select count(*)::int n from public.nhl_manual_feature_snapshots_v1 where source_run_id='concurrent-run'")).rows[0].n,2);
    checks.push('concurrent reverse-order retries append once per event without deadlock');
  } finally {await parallel.end();}
  console.log(JSON.stringify({status:'PASS',engine:(await db.query('select version()')).rows[0].version,checks,remoteDatabaseWrites:0},null,2));
} finally {await db.end();await server.stop();}
