// Private read-only inventory is input to disposable SQL only. No live fetch.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {createRuntimeStateAuthority,dependencyRawReadback,reviewDigest} from '../supabase/functions/_shared/mlb-runtime-state.mjs'
import {performFencedWrite} from '../supabase/functions/_shared/mlb-fenced-write.mjs'
import {sha256} from './mlb-data-02r-r2f-stage-contracts.mjs'
import {sanitizedStageException} from './mlb-operational-r7-errors.mjs'
import {streamR2NStatcastRowsForGames} from './mlb-data-02h-2026-current-foundation.mjs'
import {planDurableWriteBatches} from './mlb-operational-r6-write-journal.mjs'
const root=process.env.R2S_VALIDATION_DIR
assert.ok(root && path.isAbsolute(root))
const inventory=JSON.parse(fs.readFileSync(path.join(root,'r8-private-inventory.json')))
const {PGlite}=await import(pathToFileURL(process.env.R6_PGLITE_MODULE).href)
const columns=JSON.parse(fs.readFileSync('supabase/functions/mlb-runtime-state/write-contract.json'))
const rawSchema=JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_OPERATIONAL_RAW_SCHEMA_REVIEW.json'))
const checks=[]
const check=async(name,fn)=>{await fn();checks.push({name,status:'PASS'})}
const db=new PGlite(),holderA='00000000-0000-4000-8000-000000000001',holderB='00000000-0000-4000-8000-000000000002'
let at='2026-09-11T13:00:00.000Z'
const transaction=fn=>db.transaction(tx=>fn(async(q,p=[])=>q.startsWith('WITH frozen AS MATERIALIZED')?[{at,date:at.slice(0,10)}]:(await tx.query(q,p)).rows))
const make=()=>createRuntimeStateAuthority({transaction,writeRows:args=>performFencedWrite({...args,columnsByTable:columns})})
const a=make(),b=make()
const raw='pick2_raw_mlb_statcast_pitches'
try {
  await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;')
  await db.exec(fs.readFileSync('supabase/migrations/20260909210219_mlb_r6_durable_runtime_state.sql','utf8'))
  await db.exec(`CREATE TABLE ${raw} (${rawSchema.columns.map(c=>`${c.column} ${c.type}${c.default?' DEFAULT '+c.default:''}`).join(',')},PRIMARY KEY(id))`)
  await db.exec('CREATE TABLE pick2_mlb_games(game_pk bigint primary key,scheduled_at timestamptz,official_status text)')
  const downstream=Object.keys(columns).filter(t=>![raw,'pick2_mlb_games','pick2_mlb_players'].includes(t))
  for(const t of downstream)await db.exec(`CREATE TABLE ${t}(game_pk bigint)`)
  await a({op:'initialize'})
  const original=inventory.run
  await db.query("UPDATE pick2_mlb_runtime_state SET mission_odds_calls=4 WHERE state_kind='MISSION'")
  await db.query("INSERT INTO pick2_mlb_runtime_state SELECT * FROM jsonb_populate_record(NULL::pick2_mlb_runtime_state,$1::jsonb)",[JSON.stringify(original)])
  for(const g of inventory.games)await db.query('INSERT INTO pick2_mlb_games VALUES($1,$2,$3)',[g.game_pk,g.scheduled_at,g.official_status])
  for(let i=0;i<inventory.rows.length;i+=100)await db.query(`INSERT INTO ${raw} SELECT * FROM jsonb_populate_recordset(NULL::${raw},$1::jsonb)`,[JSON.stringify(inventory.rows.slice(i,i+100))])
  const readRaw=async()=> (await db.query(`SELECT *,game_date::text AS game_date FROM ${raw} ORDER BY id`)).rows
  const readRun=async()=> (await db.query("SELECT * FROM pick2_mlb_runtime_state WHERE state_kind='RUN'")).rows[0]
  let readback
  await check('Independent 3795-row identity/scope/source-digest readback',async()=>{
    readback=dependencyRawReadback(await readRaw(),original)
    assert.equal(readback.committed,3795)
    assert.equal(readback.coverage.filter(g=>g.classification==='SATISFIED_REUSE').length,13)
    assert.equal(readback.coverage.filter(g=>g.classification==='MISSING_FETCH_REQUIRED').length,2)
  })
  const command={op:'resumeDependency',holder:holderB,runId:original.run_id,packageSha:original.package_sha,executorPackageSha:'b'.repeat(40),expectedDigest:reviewDigest(original),rawReadbackDigest:readback.digest}
  await check('Wrong review, readback, or package fails without writes',async()=>{
    for(const [field,value] of [['expectedDigest','0'.repeat(64)],['rawReadbackDigest','0'.repeat(64)],['packageSha','0'.repeat(40)]])await assert.rejects(b({...command,[field]:value}),/DEPENDENCY_RESUME/)
    assert.equal(reviewDigest(await readRun()),reviewDigest(original))
  })
  await check('Ineligible failure, accounting and receipt states reject',async()=>{
    const variants=[{odds_calls:1},{statcast_calls:100},{checkpoint:{...original.checkpoint,stage:'MARKET_PERSISTENCE'}},{checkpoint:{...original.checkpoint,failure:{...original.checkpoint.failure,code:'BLOCK_CONFLICT'}}},{dml_accounting:{...original.dml_accounting,providerReservations:[]}},{dml_accounting:{...original.dml_accounting,stages:original.dml_accounting.stages.map(s=>({...s,readback:'PENDING'}))}},{dml_accounting:{...original.dml_accounting,stages:original.dml_accounting.stages.map(s=>({...s,conflicts:1}))}}]
    for(const change of variants) {
      const altered={...original,...change}
      await db.query("UPDATE pick2_mlb_runtime_state SET odds_calls=$2,statcast_calls=$3,checkpoint=$4::jsonb,dml_accounting=$5::jsonb WHERE scope_key=$1",[original.scope_key,altered.odds_calls,altered.statcast_calls,JSON.stringify(altered.checkpoint),JSON.stringify(altered.dml_accounting)])
      await assert.rejects(b({...command,expectedDigest:reviewDigest(await readRun())}),/DEPENDENCY_RESUME/)
    }
    await db.query("UPDATE pick2_mlb_runtime_state SET odds_calls=$2,statcast_calls=$3,checkpoint=$4::jsonb,dml_accounting=$5::jsonb WHERE scope_key=$1",[original.scope_key,original.odds_calls,original.statcast_calls,JSON.stringify(original.checkpoint),JSON.stringify(original.dml_accounting)])
  })
  await check('Source payload tampering fails closed',async()=>{
    const row=inventory.rows[0]
    await db.query(`UPDATE ${raw} SET raw_payload=jsonb_set(raw_payload,'{balls}','"999"') WHERE id=$1`,[row.id])
    await assert.rejects(b(command),/DEPENDENCY_RAW_SOURCE_DIGEST/)
    await db.query(`UPDATE ${raw} SET raw_payload=$2::jsonb WHERE id=$1`,[row.id,JSON.stringify(row.raw_payload)])
  })
  await check('Any downstream row prevents partial dependency resume',async()=>{
    await db.query('INSERT INTO pick2_game_predictions VALUES($1)',[original.checkpoint.scope[0]])
    await assert.rejects(b(command),/DEPENDENCY_RESUME_DOWNSTREAM_ROWS/)
    // Disposable fixture cleanup, never production SQL.
    await db.exec('TRUNCATE pick2_game_predictions')
  })
  let resumed,token
  await check('New isolated authority preserves freeze, receipts, counters and original failure',async()=>{
    resumed=await b(command);token={holder:holderB,fence:Number(resumed.lease.fence),runId:original.run_id}
    assert.equal(resumed.status,'ACQUIRED');assert.equal(Number(resumed.run.revision),160)
    for(const k of ['run_id','package_sha','run_date','run_as_of','dml_accounting','mlb_official_calls','statcast_calls','odds_calls'])assert.deepEqual(resumed.run[k],(await db.query('SELECT * FROM jsonb_populate_record(NULL::pick2_mlb_runtime_state,$1::jsonb)',[JSON.stringify(original)])).rows[0][k])
    assert.deepEqual(resumed.run.checkpoint.dependencyRecoveries[0].priorFailure,original.checkpoint.failure)
    assert.equal(resumed.missionOddsCalls,4)
  })
  await check('Active lease and repeated recovery cannot double-acquire',async()=>{
    await assert.rejects(a(command),/DEPENDENCY_RESUME_REVIEW_REQUIRED/)
    await b({...token,op:'release'})
    await assert.rejects(a(command),/DEPENDENCY_RESUME_STATE_CONFLICT/)
    await assert.rejects(a({op:'acquire',holder:holderA,runId:'next-slot',packageSha:'c'.repeat(40),mode:'PREGAME'}),/FROZEN_PACKAGE_CONFLICT/)
    resumed=await a({op:'acquire',holder:holderA,runId:'next-slot',packageSha:'b'.repeat(40),mode:'PREGAME'})
    token={holder:holderA,fence:Number(resumed.lease.fence),runId:original.run_id}
    assert.equal(resumed.run.run_id,original.run_id);assert.equal(resumed.run.package_sha,original.package_sha)
  })
  await check('Second-pass reuse leaves every raw row and DML receipt unchanged',async()=>{
    const before=await readRaw();let run=await readRun(),reused=0
    for(const batch of planDurableWriteBatches({table:raw,rows:inventory.rows.map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>columns[raw].includes(k)))),cap:15000})) {
      const reply=await a({...token,op:'write',revision:Number(run.revision),write:{table:raw,rows:batch,cap:15000}})
      reused+=reply.result.reused;assert.equal(reply.result.inserted,0);run=reply.run
    }
    assert.equal(reused,3795);assert.deepEqual(await readRaw(),before)
    assert.deepEqual(run.dml_accounting,original.dml_accounting)
    await assert.rejects(a({...token,op:'checkpoint',revision:Number(run.revision),checkpoint:{...run.checkpoint,dependencyRecoveries:undefined},dml:{stages:run.dml_accounting.stages}}),/REVIEW_METADATA_IMMUTABLE/)
    const failed=(await a({...token,op:'fail',failure:sanitizedStageException(new Error('R2N_STATCAST_NETWORK_FAILURE'))})).run
    assert.deepEqual(failed.checkpoint.dependencyRecoveries[0].priorFailure,original.checkpoint.failure)
    assert.ok(failed.revision>original.revision)
    await a({...token,op:'release'})
  })
  // A second isolated database reproduces the acquisition boundary using the
  // actual shared stream parser, fixed writer and runtime authority below.
  await check('Frozen readback rejects duplicate identities and out-of-scope dates',async()=>{
    assert.throws(()=>dependencyRawReadback([...inventory.rows,inventory.rows[0]],original),/DEPENDENCY_RAW_DUPLICATE/)
    assert.throws(()=>dependencyRawReadback([{...inventory.rows[0],game_date:'2026-09-11'},...inventory.rows.slice(1)],original),/DEPENDENCY_RAW_DATE/)
  })
  await check('Shared Statcast stream: committed batches, network failure, isolated missing-only resume',networkReplay)
  fs.writeFileSync(path.join(root,'r8-local-readback-results.json'),JSON.stringify({checks,readback,providers:0,productionDml:0,productionDdl:0},null,2))
  console.log(JSON.stringify({status:'PASS',checks,rawRows:3795,satisfied:13,missing:2,providerCalls:0,productionDml:0,productionDdl:0}))
} finally {await db.close()}

async function networkReplay() {
  const sql=new PGlite()
  let clock='2026-09-11T13:00:00.000Z',run,token,authority
  const create=()=>createRuntimeStateAuthority({transaction:fn=>sql.transaction(tx=>fn(async(q,p=[])=>q.startsWith('WITH frozen AS MATERIALIZED')?[{at:clock,date:'2026-09-11'}]:(await tx.query(q,p)).rows)),writeRows:args=>performFencedWrite({...args,columnsByTable:columns})})
  const gameIds=[823251,823413],source=inventory.rows.filter(r=>gameIds.includes(r.game_pk))
  const header=JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-01a-2025-raw-statcast-validation.json')).schema.columns.map((k,i)=>i?k:'pitch_type')
  const csv=date=>[header.join(','),...source.filter(r=>r.game_date===date).map(r=>header.map(k=>'"'+String(r.raw_payload[k]??'').replaceAll('"','""')+'"').join(','))].join('\n')
  const request={op:'acquire',holder:holderA,runId:'r8-network-isolated',packageSha:'a'.repeat(40),mode:'PREGAME'}
  const reserve=async provider=>{run=(await authority({...token,op:'reserve',provider,reservationId:sha256(`${run.run_id}:${provider}:${Number(run[provider==='STATCAST'?'statcast_calls':'mlb_official_calls'])+1}`)})).run}
  const write=async rows=>{for(const batch of planDurableWriteBatches({table:raw,rows,cap:2000}))run=(await authority({...token,op:'write',revision:Number(run.revision),write:{table:raw,rows:batch,cap:2000}})).run}
  const read=async()=> (await sql.query(`SELECT *,game_date::text AS game_date FROM ${raw} ORDER BY id`)).rows
  const dbAdapter={from(table){assert.equal(table,raw);let game,fields;return {select(selection){fields=selection.split(',');return this},eq(k,v){game=v;return this},order(){return this},async limit(){const rows=(await read()).filter(r=>r.game_pk===game).map(r=>Object.fromEntries(fields.map(k=>[k,r[k]])));return {data:JSON.parse(JSON.stringify(rows)),count:rows.length,error:null}}}}}
  const teams=new Map(source.flatMap(r=>[[r.raw_payload.home_team,r.canonical_home_team_id],[r.raw_payload.away_team,r.canonical_away_team_id]]))
  const fetchDates=[]
  const stream=(ids,dates,fail)=>streamR2NStatcastRowsForGames({eligibleGamePks:ids,dependencyDates:dates,runAsOf:new Date(run.run_as_of).toISOString(),db:dbAdapter,teamMap:teams,cacheDir:null,providerBudget:{STATCAST:{maxCalls:100-run.statcast_calls}},fetchImpl:async url=>{
    const date=new URL(url).searchParams.get('game_date_gt');fetchDates.push(date);await reserve('STATCAST')
    if(fail && date==='2026-09-10')throw new TypeError('INJECTED_NETWORK_FAILURE')
    return new Response(csv(date),{status:200})
  }})
  try {
    await sql.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;')
    await sql.exec(fs.readFileSync('supabase/migrations/20260909210219_mlb_r6_durable_runtime_state.sql','utf8'))
    await sql.exec(`CREATE TABLE ${raw} (${rawSchema.columns.map(c=>`${c.column} ${c.type}${c.default?' DEFAULT '+c.default:''}`).join(',')},PRIMARY KEY(id))`)
    await sql.exec(`ALTER TABLE ${raw} ALTER COLUMN created_at SET DEFAULT '2026-09-11T13:00:01Z'::timestamptz`)
    for(const t of Object.keys(columns).filter(t=>![raw,'pick2_mlb_games','pick2_mlb_players'].includes(t)))await sql.exec(`CREATE TABLE ${t}(game_pk bigint)`)
    await sql.exec("CREATE TABLE pick2_mlb_games(game_pk bigint primary key,scheduled_at timestamptz,official_status text);INSERT INTO pick2_mlb_games VALUES(900001,'2026-09-11T18:00Z','Scheduled'),(900002,'2026-09-11T19:00Z','Scheduled')")
    authority=create();await authority({op:'initialize'})
    const acquired=await authority(request);run=acquired.run;token={holder:holderA,fence:Number(acquired.lease.fence),runId:run.run_id}
    await reserve('MLB_OFFICIAL')
    run=(await authority({...token,op:'checkpoint',revision:Number(run.revision),checkpoint:{...run.checkpoint,stage:'DEPENDENCY_SCOPE',scope:[900001,900002],dependencyScope:gameIds,completed:['SCOPE','DEPENDENCY_SCOPE'],references:[{kind:'schedule_evidence',identity:'schedule',digest:'d'.repeat(64),count:2,asOf:clock}]},dml:{stages:[]}})).run
    clock='2026-09-11T13:00:02.000Z'
    await assert.rejects(async()=>{for await(const rows of stream(gameIds,['2026-09-09','2026-09-10'],true))await write(rows)},/R2N_STATCAST_NETWORK_FAILURE/)
    assert.equal((await read()).length,311);assert.equal(run.statcast_calls,2)
    run=(await authority({...token,op:'fail',failure:sanitizedStageException(new Error('R2N_STATCAST_NETWORK_FAILURE'))})).run
    const failure=structuredClone(run.checkpoint.failure),dml=structuredClone(run.dml_accounting)
    await authority({...token,op:'release'})
    authority=create()
    const resume=await authority({op:'resumeDependency',holder:holderB,runId:run.run_id,packageSha:run.package_sha,executorPackageSha:'b'.repeat(40),expectedDigest:reviewDigest(run),rawReadbackDigest:dependencyRawReadback(await read(),run).digest})
    run=resume.run;token={holder:holderB,fence:Number(resume.lease.fence),runId:run.run_id}
    assert.deepEqual(run.dml_accounting,dml);assert.deepEqual(run.checkpoint.dependencyRecoveries[0].priorFailure,failure)
    const missing=resume.readback.coverage.filter(g=>g.classification==='MISSING_FETCH_REQUIRED').map(g=>g.gamePk)
    assert.deepEqual(missing,[823413])
    for await(const rows of stream(missing,['2026-09-10'],false))await write(rows)
    assert.equal((await read()).length,569);assert.equal(run.statcast_calls,3)
    assert.deepEqual(fetchDates,['2026-09-09','2026-09-10','2026-09-10'])
    assert.equal(new Set(run.dml_accounting.providerReservations).size,4)
    const stable=structuredClone(run.dml_accounting),before=await read()
    await authority({...token,op:'release'})
    authority=create();const again=await authority({...request,holder:holderA,packageSha:'b'.repeat(40)})
    run=again.run;token={holder:holderA,fence:Number(again.lease.fence),runId:run.run_id}
    // Entire scope is now cached; a second independent executor spends zero calls.
    for await(const rows of stream(gameIds,['2026-09-09','2026-09-10'],false))await write(rows)
    assert.equal(fetchDates.length,3);assert.deepEqual(run.dml_accounting,stable);assert.deepEqual(await read(),before)
    assert.equal(run.dml_accounting.stages[0].inserted,569)
    await authority({...token,op:'release'})
  } finally {await sql.close()}
}
