// Disposable SQL integration checks. No production client or provider imports.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { createRuntimeStateAuthority, validateCheckpoint, validateDml, serializedBytes } from '../supabase/functions/_shared/mlb-runtime-state.mjs'
const { PGlite } = await import(pathToFileURL(process.env.R6_PGLITE_MODULE).href)
const db = new PGlite()
const checks = []
const check = async (name, fn) => { await fn(); checks.push({name,status:'PASS'}) }
const sha = x => createHash('sha256').update(x).digest('hex')
const transaction = fn => db.transaction(tx => fn(async (sql,p=[]) => (await tx.query(sql,p)).rows))
const a = createRuntimeStateAuthority({transaction}), b = createRuntimeStateAuthority({transaction})
const holderA = '00000000-0000-4000-8000-000000000001', holderB = '00000000-0000-4000-8000-000000000002'
const request = {op:'acquire',holder:holderA,runId:'r6-disposable-run',packageSha:'a'.repeat(40),mode:'HOST_DRY'}
let acquired, token, checkpoint
try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;')
  const sql = fs.readFileSync('supabase/migrations/20260909210219_mlb_r6_durable_runtime_state.sql','utf8').replace(/\r\n/g,'\n')
  assert.equal(sha(sql),'b8e140c04fdb20404380d368e7ed27ba592934d369072aea3be1785df5331036')
  await db.exec(sql)
  await check('Missing durable state fails closed', () => assert.rejects(a(request), /NOT_INITIALIZED/))
  await check('Initialization retains mission usage two', async () => assert.equal((await a({op:'initialize'})).missionOddsCalls,2))
  await check('First authority acquires lease', async () => {
    acquired = await a(request); assert.equal(acquired.status,'ACQUIRED')
    token = {holder:holderA,fence:Number(acquired.lease.fence),runId:acquired.run.run_id}
    checkpoint = acquired.run.checkpoint
  })
  await check('Independent authority defers same and different run', async () => {
    for (const runId of [request.runId,'different-run']) assert.equal((await b({...request,holder:holderB,runId})).status,'DEFER_ACTIVE_LEASE')
  })
  await check('Wrong holder cannot write or reserve', async () => {
    for (const op of ['renew','release','checkpoint','reserve']) await assert.rejects(b({...token,holder:holderB,op}), /STALE_FENCE_OR_LEASE/)
  })
  await check('Metadata rejects raw payloads and model output', () => {
    for (const k of ['raw','rows','predictions','payload','authorization']) assert.throws(() => validateCheckpoint({...checkpoint,[k]:[]}), /METADATA_FIELDS/)
  })
  await check('Scope and compact evidence checkpoint persists', async () => {
    checkpoint = {...checkpoint,stage:'NATIVE',scope:[100001],completed:['NATIVE'],references:[{kind:'native',identity:'100001',digest:'b'.repeat(64),count:1,asOf:new Date().toISOString()}]}
    const result = await a({...token,op:'checkpoint',revision:0,checkpoint,dml:{stages:[]}})
    assert.equal(result.run.revision,1)
  })
  await check('Stale checkpoint revision rejects', () => assert.rejects(a({...token,op:'checkpoint',revision:0,checkpoint,dml:{stages:[]}}), /REVISION_CONFLICT/))
  await check('Lease renewal retains fence', async () => assert.equal(Number((await a({...token,op:'renew'})).lease.fence),token.fence))
  await check('Two simultaneous Odds reservations permit exactly one', async () => {
    const results = await Promise.allSettled([a({...token,op:'reserve',provider:'THE_ODDS_API',reservationId:sha('odds-A')}),b({...token,op:'reserve',provider:'THE_ODDS_API',reservationId:sha('odds-B')})])
    assert.equal(results.filter(x => x.status === 'fulfilled').length,1)
    assert.match(results.find(x => x.status === 'rejected').reason.message,/PROVIDER_CAP/)
    const mission = (await a({op:'inspect'})).rows.find(r => r.state_kind === 'MISSION')
    assert.equal(mission.mission_odds_calls,3)
  })
  await check('Consumed reservation cannot issue a second request', () => assert.rejects(a({...token,op:'reserve',provider:'THE_ODDS_API',reservationId:sha('odds-A')}), /RESERVATION_ALREADY_CONSUMED/))
  await check('Excluded providers cannot reserve', async () => {
    for (const provider of ['BALLDONTLIE','SPORTSDATAIO','OTHER']) await assert.rejects(a({...token,op:'reserve',provider,reservationId:sha(provider)}), /PROVIDER_NOT_AUTHORIZED/)
  })
  await check('Repeated initialization never resets consumed mission budget', async () => assert.equal((await b({op:'initialize'})).missionOddsCalls,3))
  await check('Release then independent authority resumes frozen state', async () => {
    await a({...token,op:'release'})
    const resumed = await b({...request,holder:holderB,runId:'next-schedule-slot'})
    assert.equal(resumed.run.run_id,request.runId)
    assert.deepEqual(resumed.run.checkpoint,checkpoint)
    assert.equal(resumed.run.odds_calls,1)
    assert.equal(new Date(resumed.run.run_as_of).toISOString(),new Date(acquired.run.run_as_of).toISOString())
    assert.ok(Number(resumed.lease.fence) > token.fence)
    await assert.rejects(a({...token,op:'renew'}),/STALE_FENCE_OR_LEASE/)
    token = {holder:holderB,fence:Number(resumed.lease.fence),runId:resumed.run.run_id}
  })
  await check('Expired lease rejects owner and allows fenced recovery', async () => {
    // Test fixture alone changes timestamps; runtime accepts no caller clock.
    await db.exec("UPDATE pick2_mlb_runtime_state SET lease_acquired_at=now()-interval '6 minutes',lease_expires_at=now()-interval '1 minute' WHERE state_kind='LEASE'")
    await assert.rejects(b({...token,op:'renew'}),/STALE_FENCE_OR_LEASE/)
    const resumed = await a(request)
    assert.ok(Number(resumed.lease.fence) > token.fence)
    token = {holder:holderA,fence:Number(resumed.lease.fence),runId:resumed.run.run_id}
  })
  await check('Scope and completed stages cannot regress', async () => {
    const run = (await a({op:'inspect'})).rows.find(r => r.state_kind === 'RUN')
    for (const [change,reason] of [[{scope:[100002]},/SCOPE_DRIFT/],[{completed:[]},/CHECKPOINT_REGRESSION/]]) await assert.rejects(a({...token,op:'checkpoint',revision:Number(run.revision),checkpoint:{...checkpoint,...change},dml:{stages:[]}}),reason)
  })
  await check('DML conflicts, excessive caps, unexpected payload rejected', () => {
    const r = {stage:'FEATURES',target:'pick2_feature_snapshots',planned:1,cap:1,inserted:1,updated:0,reused:0,conflicts:0,readback:'PASS',digest:'c'.repeat(64)}
    for (const change of [{conflicts:1},{inserted:2},{cap:0},{rows:[]}]) assert.throws(() => validateDml({stages:[{...r,...change}]}))
  })
  await check('Completion requires readback', async () => {
    const run = (await a({op:'inspect'})).rows.find(r => r.state_kind === 'RUN')
    await assert.rejects(a({...token,op:'complete',status:'COMPLETE',revision:Number(run.revision),checkpoint,dml:{stages:[]}}), /READBACK_REQUIRED/)
    const result = {status:'HOST_DRY_COMPLETE',predictions:0,values:0,picks:0,inserted:0,reused:0,conflicts:0,readback:'PASS'}
    await a({...token,op:'complete',status:'COMPLETE',revision:Number(run.revision),checkpoint:{...checkpoint,stage:'COMPLETE',result},dml:{stages:[]}})
    await a({...token,op:'release'})
    assert.equal((await b({...request,holder:holderB})).status,'REUSE_NO_OP')
  })
  await check('Mission cap race is atomic across separate run reservations', async () => {
    await db.exec("UPDATE pick2_mlb_runtime_state SET mission_odds_calls=19 WHERE state_kind='MISSION'")
    const next = await a({...request,runId:'cap-race'})
    const t = {holder:holderA,fence:Number(next.lease.fence),runId:next.run.run_id,op:'reserve',provider:'THE_ODDS_API'}
    const results = await Promise.allSettled([a({...t,reservationId:sha('last-A')}),b({...t,reservationId:sha('last-B')})])
    assert.equal(results.filter(x => x.status === 'fulfilled').length,1)
    assert.equal((await a({op:'inspect'})).rows.find(r => r.state_kind === 'MISSION').mission_odds_calls,20)
  })
  await check('Large compact checkpoint fails before database write', () => {
    const references = Array.from({length:500},(_,i) => ({kind:'canonical',identity:`id-${i}`,digest:'d'.repeat(64),count:1000,asOf:new Date().toISOString()}))
    assert.ok(serializedBytes({...checkpoint,references}) > 48000)
    assert.throws(() => validateCheckpoint({...checkpoint,references}),/CHECKPOINT_SIZE/)
  })
  console.log(JSON.stringify({status:'PASS',scope:'DURABLE_STATE_OPERATIONS_ONLY',checks,productionDml:0,productionDdl:0,providerCalls:0,realCrossProcessDatabaseRace:'PENDING_EXTERNAL_POSTGRES_TEST',r2BusinessResume:'PENDING',activation:'DISABLED'}))
} finally { await db.close() }
