// SQL integration for UTC midnight, durable object recovery and failure state.
// Invented market fixture only; no network or production credentials.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {createRuntimeStateAuthority,reviewDigest} from '../supabase/functions/_shared/mlb-runtime-state.mjs'
import {performFencedWrite} from '../supabase/functions/_shared/mlb-fenced-write.mjs'
import {evidenceIdentity,evidenceEnvelope} from '../supabase/functions/_shared/mlb-provider-evidence.mjs'
import {sanitizedStageException} from './mlb-operational-r7-errors.mjs'
import {sha256} from './mlb-data-02r-r2f-stage-contracts.mjs'
import {operatingDate} from './mlb-data-02r-r2t-r1-pregame-contract.mjs'
import {persistCanonicalMarkets,canonicalMarketReference} from './mlb-data-02r-r2t-market-binding.mjs'
const {PGlite}=await import(pathToFileURL(process.env.R6_PGLITE_MODULE).href)
const db=new PGlite(),objects=new PGlite(),checks=[]
const check=async(name,fn)=>{await fn();checks.push({name,status:'PASS'})}
let at='2026-09-09T23:59:00.000Z',run,token,authority
const holderA='00000000-0000-4000-8000-000000000001',holderB='00000000-0000-4000-8000-000000000002'
const storage={preflight:async()=>{},read:async key=>(await objects.query('SELECT body FROM evidence WHERE key=$1',[key])).rows[0]?.body??null,create:async(key,body)=>{await objects.query('INSERT INTO evidence VALUES($1,$2::jsonb)',[key,JSON.stringify(body)])}}
const columns=JSON.parse(fs.readFileSync('supabase/functions/mlb-runtime-state/write-contract.json','utf8'))
const make=()=>createRuntimeStateAuthority({evidenceStorage:storage,transaction:fn=>db.transaction(tx=>fn(async(sql,p=[])=>sql.startsWith('WITH frozen AS MATERIALIZED')?[{at,date:operatingDate(at)}]:(await tx.query(sql.replaceAll('clock_timestamp()',`'${at}'::timestamptz`),p)).rows)),writeRows:args=>performFencedWrite({...args,columnsByTable:columns})})
const request=()=>({op:'acquire',holder:holderA,runId:'r7-midnight-fixture',packageSha:'a'.repeat(40),mode:'PREGAME'})
const write=async(table,rows,cap)=>{const r=await authority({...token,op:'write',revision:Number(run.revision),write:{table,rows,cap}});run=r.run;return r.result}
try {
  await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;')
  await db.exec(fs.readFileSync('supabase/migrations/20260909210219_mlb_r6_durable_runtime_state.sql','utf8'))
  await db.exec('CREATE TABLE pick2_mlb_games(game_pk bigint primary key,scheduled_at timestamptz,game_date date,official_status text);CREATE TABLE pick2_game_predictions(id uuid default gen_random_uuid(),deterministic_identity text unique,game_pk bigint,predicted_at timestamptz);')
  await db.query('INSERT INTO pick2_mlb_games VALUES(100001,$1,$2,$3)',['2026-09-10T02:00:00Z','2026-09-09','Scheduled'])
  const schema=JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_OPERATIONAL_DOWNSTREAM_SCHEMA_REVIEW.json','utf8'))
  for(const table of schema.schema.filter(s=>['pick2_mlb_market_event_mappings','pick2_mlb_market_price_observations'].includes(s.table_name))){await db.exec(`CREATE TABLE ${table.table_name} (${table.columns.map(c=>`${c.column} ${c.physical_type??c.type}${c.default?` DEFAULT ${c.default}`:''}${c.nullable==='NO'?' NOT NULL':''}`).join(',')})`);for(const c of schema.constraints.filter(c=>c.table_name===table.table_name && ['p','u','c'].includes(c.contype)))await db.exec(`ALTER TABLE ${c.table_name} ADD CONSTRAINT ${c.conname} ${c.definition}`)}
  await objects.exec('CREATE TABLE evidence(key text primary key,body jsonb not null)')
  authority=make();await authority({op:'initialize'})
  const acquired=await authority(request());run=acquired.run;token={holder:holderA,runId:run.run_id,fence:Number(acquired.lease.fence)}
  run=(await authority({...token,op:'checkpoint',revision:Number(run.revision),checkpoint:{...run.checkpoint,scope:[100001]},dml:{stages:[]}})).run
  await write('pick2_game_predictions',[{deterministic_identity:'ISOLATED_PREDICTION',game_pk:100001,predicted_at:at}],1)
  run=(await authority({...token,op:'reserve',provider:'THE_ODDS_API',reservationId:sha256(`${run.run_id}:THE_ODDS_API:1`)})).run
  const payload={events:[{id:'isolated-event',sport_key:'baseball_mlb',home_team:'Fixture Home',away_team:'Fixture Away',commence_time:'2026-09-10T02:00:00Z',bookmakers:[{key:'fixture',title:'Fixture',markets:[{key:'h2h',last_update:at,outcomes:[{name:'Fixture Home',price:-120},{name:'Fixture Away',price:110}]}]}]}]}
  const evidence={payload,acquiredAt:at,responseDigest:sha256(payload)}
  await check('Object commit survives loss before runtime reference checkpoint',async()=>{
    await storage.create(evidenceIdentity(run,'odds').key,evidenceEnvelope(run,'odds',evidence))
    assert.equal(run.checkpoint.references.length,0)
    await authority({...token,op:'release'})
    at='2026-09-10T00:01:00.000Z';authority=make()
    const recovered=await authority({...request(),holder:holderB,runId:'r7-next-slot'});run=recovered.run;token={holder:holderB,runId:run.run_id,fence:Number(recovered.lease.fence)}
    const result=await authority({...token,op:'evidence',kind:'odds'});run=result.run
    assert.deepEqual(result.evidence,evidence);assert.equal(run.odds_calls,1);assert.equal(recovered.missionOddsCalls,3)
    assert.equal(operatingDate(at),'2026-09-09');assert.equal(run.run_id,'r7-midnight-fixture')
  })
  await check('Immutable response drift rejects without resetting paid reservation',async()=>{
    const other={payload:{events:[]},acquiredAt:evidence.acquiredAt,responseDigest:sha256({events:[]})}
    await assert.rejects(authority({...token,op:'evidence',kind:'odds',evidence:other}),/EVIDENCE_IMMUTABLE_CONFLICT/)
    await assert.rejects(authority({...token,op:'reserve',provider:'THE_ODDS_API',reservationId:sha256('second')}),/PROVIDER_CAP/)
  })
  const read=async(table,column,ids)=>(await db.query(`SELECT to_jsonb(t) AS row FROM ${table} t WHERE ${column}::text=ANY($1::text[])`,[ids.map(String)])).rows.map(r=>r.row)
  const repository={readMarketMappingsByGames:ids=>read('pick2_mlb_market_event_mappings','game_pk',ids),readMarketMappings:ids=>read('pick2_mlb_market_event_mappings','provider_event_id',ids),insertMarketMappings:(rows,cap)=>write('pick2_mlb_market_event_mappings',rows,cap),readMarketObservations:ids=>read('pick2_mlb_market_price_observations','observation_identity',ids),insertMarketObservations:(rows,cap)=>write('pick2_mlb_market_price_observations',rows,cap)}
  await check('Canonical market persistence and zero-write repeat survive UTC midnight',async()=>{
    const args={evidence,nativeGames:[{game_pk:100001,scheduled_at:'2026-09-10T02:00:00Z',home_team_name:'Fixture Home',away_team_name:'Fixture Away'}],eligibleGamePks:[100001],repository,beforeWrite:async()=>{}}
    const markets=await persistCanonicalMarkets(args)
    const again=await persistCanonicalMarkets({...args,limits:{marketMappings:0,marketObservations:0}})
    assert.equal(markets.observations.inserted,2);assert.equal(again.observations.inserted,0);assert.equal(again.mappings.inserted,0)
    const reference=canonicalMarketReference({markets,evidence,evaluatedAt:at})
    run=(await authority({...token,op:'checkpoint',revision:Number(run.revision),checkpoint:{...run.checkpoint,stage:'MARKETS',completed:['MARKETS'],marketReference:reference},dml:{stages:run.dml_accounting.stages}})).run
    assert.equal(run.odds_calls,1)
    assert.equal((await db.query('SELECT count(*)::int n FROM pick2_game_predictions')).rows[0].n,1)
  })
  await check('Future failure atomically retains sanitized exception and authoritative accounting',async()=>{
    const before=structuredClone(run),failure=sanitizedStageException(new Error('secret value https://private.invalid/?token=PRIVATE'))
    run=(await authority({...token,op:'fail',failure})).run
    assert.equal(run.status,'FAILED');assert.equal(run.checkpoint.failure.stage,'MARKETS')
    assert.equal(run.checkpoint.failure.checkpointRevision,Number(before.revision));assert.equal(run.checkpoint.failure.leaseHolder,holderB)
    assert.deepEqual(run.checkpoint.failure.dml,before.dml_accounting);assert.equal(run.checkpoint.failure.providers.THE_ODDS_API,1)
    assert.ok(!JSON.stringify(run.checkpoint.failure).includes('PRIVATE'));assert.equal(run.checkpoint.failure.runId,run.run_id)
    await authority({...token,op:'release'})
  })
  await check('Expired disposition preserves rows and accounting; stale review rejects',async()=>{
    const before=structuredClone(run),snapshot=await db.query('SELECT * FROM pick2_game_predictions')
    await assert.rejects(authority({op:'dispose',holder:holderA,runId:run.run_id,expectedDigest:reviewDigest(run)}),/DISPOSITION_NOT_EXPIRED/)
    at='2026-09-10T04:01:00.000Z'
    await assert.rejects(authority({op:'dispose',holder:holderA,runId:run.run_id,expectedDigest:'b'.repeat(64)}),/DISPOSITION_STATE_CONFLICT/)
    run=(await authority({op:'dispose',holder:holderA,runId:run.run_id,expectedDigest:reviewDigest(run)})).run
    assert.equal(run.status,'FAILED');assert.equal(run.checkpoint.disposition.status,'TERMINAL_PARTIAL_PRESERVED')
    assert.deepEqual(run.dml_accounting,before.dml_accounting);assert.equal(run.odds_calls,1)
    assert.deepEqual((await db.query('SELECT * FROM pick2_game_predictions')).rows,snapshot.rows)
    assert.equal((await authority(request())).status,'TERMINAL_PARTIAL_PRESERVED')
    assert.equal((await authority({...request(),runId:'genuinely-new-run'})).status,'ACQUIRED')
  })
  console.log(JSON.stringify({status:'R7_RUNTIME_REPAIR_PASS',checks,providerCalls:0,productionDml:0,productionDdl:0}))
} finally {await db.close();await objects.close()}
