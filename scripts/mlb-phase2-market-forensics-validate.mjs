// Exact preserved evidence is private local input; no network or production DML.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {timingSafeEqual} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import ts from 'typescript'
import {persistCanonicalMarkets} from './mlb-data-02r-r2t-market-binding.mjs'
import {createRuntimeStateAuthority} from '../supabase/functions/_shared/mlb-runtime-state.mjs'
import {performFencedWrite} from '../supabase/functions/_shared/mlb-fenced-write.mjs'
import {planDurableWriteBatches} from './mlb-operational-r6-write-journal.mjs'
import {sha256} from './mlb-data-02r-r2f-stage-contracts.mjs'
import {runtimeResponseFailure,sanitizedStageException} from './mlb-operational-r7-errors.mjs'
import {createDurableRuntimeClient} from './mlb-operational-r6-state-client.mjs'
const root=process.env.R2S_VALIDATION_DIR
assert.ok(root&&path.isAbsolute(root))
const c=JSON.parse(fs.readFileSync(path.join(root,'phase2-private-market-failure.json')))
assert.equal(sha256(c.evidence.payload),c.evidence.responseDigest)
const schema=JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_OPERATIONAL_DOWNSTREAM_SCHEMA_REVIEW.json'))
const columnsByTable=JSON.parse(fs.readFileSync('supabase/functions/mlb-runtime-state/write-contract.json'))
let planned
await assert.rejects(persistCanonicalMarkets({evidence:c.evidence,nativeGames:c.run.checkpoint.marketGames,eligibleGamePks:c.run.checkpoint.marketGames.map(g=>g.game_pk),beforeWrite:async()=>{},repository:{
  readMarketMappingsByGames:async()=>c.mappings,readMarketMappings:async()=>c.mappings,readMarketObservations:async()=>[],
  insertMarketObservations:async rows=>{planned=rows;throw Error('CAPTURE_ONLY')},
}}),/CAPTURE_ONLY/)
assert.equal(planned.length,88)
const table='pick2_mlb_market_price_observations',cap=planned.length
const batches=planDurableWriteBatches({table,rows:planned,cap})
const {PGlite}=await import(pathToFileURL(process.env.R6_PGLITE_MODULE).href)
const db=new PGlite()
const checks=[]
try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;')
  await db.exec(fs.readFileSync('supabase/migrations/20260909210219_mlb_r6_durable_runtime_state.sql','utf8'))
  await db.exec('create table pick2_mlb_games(game_pk bigint primary key,scheduled_at timestamptz,game_date date,official_status text)')
  for(const g of c.run.checkpoint.marketGames)await db.query("insert into pick2_mlb_games values($1,$2,'2026-09-10','Scheduled')",[g.game_pk,g.scheduled_at])
  for(const name of ['pick2_mlb_market_event_mappings',table]) {
    const spec=schema.schema.find(s=>s.table_name===name)
    await db.exec(`create table ${name} (${spec.columns.map(col=>`${col.column} ${col.physical_type??col.type}${col.default?' default '+col.default:''}${col.nullable==='NO'?' not null':''}`).join(',')})`)
    await db.exec(`alter table ${name} add primary key(id)`)
  }
  for(const constraint of schema.constraints.filter(x=>x.table_name===table&&x.contype!=='p'))await db.exec(`alter table ${table} add constraint ${constraint.conname} ${constraint.definition}`)
  await db.query('insert into pick2_mlb_market_event_mappings select * from jsonb_populate_recordset(null::pick2_mlb_market_event_mappings,$1::jsonb)',[JSON.stringify(c.mappings)])
  // Recreate the pre-failure state in disposable SQL only. Historical clock is
  // injected into authority clock reads; it never affects production clocks.
  const holder='00000000-0000-4000-8000-000000000001'
  const fence=Number(process.env.MARKET_REPLAY_FENCE??1)
  assert.ok(Number.isSafeInteger(fence)&&fence>0)
  const checkpoint={...c.run.checkpoint};delete checkpoint.failure
  await db.query("insert into pick2_mlb_runtime_state(scope_key,state_kind,run_id,package_sha,run_date,run_as_of,status,checkpoint,dml_accounting,revision,mlb_official_calls,statcast_calls,odds_calls) values($1,'RUN',$2,$3,$4,$5,'RUNNING',$6::jsonb,$7::jsonb,42,2,1,1)",[c.run.scope_key,c.run.run_id,c.run.package_sha,c.run.run_date,c.run.run_as_of,JSON.stringify(checkpoint),JSON.stringify(c.run.dml_accounting)])
  await db.query("insert into pick2_mlb_runtime_state(scope_key,state_kind,lease_holder,lease_acquired_at,lease_expires_at,run_id,package_sha,fence) values('MLB_OPERATIONAL_GLOBAL','LEASE',$1,$2,$2::timestamptz+interval '5 minutes',$3,$4,$5)",[holder,c.evidence.acquiredAt,c.run.run_id,c.run.package_sha,fence])
  await db.query("insert into pick2_mlb_runtime_state(scope_key,state_kind,mission_odds_calls) values('MLB_OPERATIONAL_MISSION','MISSION',4)")
  await db.exec('grant select,insert,update on all tables in schema public to service_role')
  let handler
  const source=fs.readFileSync('supabase/functions/mlb-runtime-state/index.ts','utf8').replace(/^import .*\r?\n/gm,'')
  const frozenClock=c.evidence.acquiredAt
  const postgres=()=>({end:async()=>{},begin:fn=>db.transaction(async tx=>{
    const sql=async strings=>tx.exec(strings.join(''))
    sql.unsafe=async(q,p=[])=>{
      if(q.startsWith('WITH frozen AS MATERIALIZED'))return [{at:frozenClock,date:'2026-09-10'}]
      if(q.includes('scheduled_at <= clock_timestamp()'))q=q.replace('clock_timestamp()',`'${frozenClock}'::timestamptz`)
      return (await tx.query(q,p)).rows
    }
    return fn(sql)
  })})
  const env={SUPABASE_SERVICE_ROLE_KEY:'DISPOSABLE_ONLY_SERVER_KEY',SUPABASE_SECRET_KEYS:'{}',SUPABASE_DB_URL:'DISPOSABLE_DATABASE'}
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,{Response,URL,TextEncoder,TextDecoder,timingSafeEqual,postgres,columnsByTable,createRuntimeStateAuthority,performFencedWrite,EVIDENCE_LIMIT:4194304,createEvidenceStorage:()=>({}),assertRuntimeSchema:async()=>{},assertEvidenceAccess:async()=>{},Deno:{env:{get:k=>env[k]},serve:fn=>{handler=fn}}})
  let revision=42,maxBytes=0
  for(let pass=0;pass<2;pass++) {
    let inserted=0,reused=0
    for(const batch of batches) {
      const command={op:'write',holder,fence,runId:c.run.run_id,revision,write:{table,rows:batch,cap,operation:'INSERT',expectedOld:null}}
      const body=JSON.stringify(command);maxBytes=Math.max(maxBytes,Buffer.byteLength(body))
      const response=await handler(new Request('https://disposable.invalid',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY},body}))
      const result=await response.json()
      assert.equal(response.status,200,JSON.stringify(result))
      revision=Number(result.result.run.revision);inserted+=result.result.result.inserted;reused+=result.result.result.reused
    }
    assert.equal(inserted,pass===0?88:0);assert.equal(reused,pass===0?0:88)
    checks.push({pass,inserted,reused})
  }
  assert.ok(maxBytes<500000)
  const rows=(await db.query(`select * from ${table}`)).rows
  assert.equal(rows.length,88)
  for(const row of planned){const stored=rows.find(x=>x.observation_identity===row.observation_identity);assert.equal(Number(stored.american_odds),row.american_odds);for(const key of ['provider_last_update','acquired_at','commence_time'])assert.equal(new Date(stored[key]).toISOString(),new Date(row[key]).toISOString())}
  for(const [status,body,expected] of [[409,{code:'23503',message:'PRIVATE_UNTRUSTED'},'RUNTIME_SQLSTATE_23503_HTTP_409'],[413,{message:'PRIVATE_UNTRUSTED'},'RUNTIME_HTTP_413'],[546,null,'RUNTIME_HTTP_546'],[200,{},'RUNTIME_RESPONSE_CONTRACT']]) {
    const failure=sanitizedStageException(new Error(runtimeResponseFailure(status,body)))
    assert.equal(failure.code,expected);assert.ok(!JSON.stringify(failure).includes('PRIVATE_UNTRUSTED'))
    assert.deepEqual(sanitizedStageException({name:failure.exceptionClass,message:`R6_STATE:${failure.code}`}),failure)
  }
  const authority=createRuntimeStateAuthority({transaction:fn=>db.transaction(tx=>fn(async(q,p=[])=>(await tx.query(q,p)).rows))})
  const failure=sanitizedStageException(new Error(runtimeResponseFailure(409,{code:'23503'})))
  const failed=await authority({op:'fail',holder,fence,runId:c.run.run_id,failure})
  assert.equal(failed.run.checkpoint.failure.code,'RUNTIME_SQLSTATE_23503_HTTP_409')
  const oldSource=execFileSync('git',['show','bd87727f9072369349096d62a361b8439ab31f9c:scripts/mlb-operational-r6-state-client.mjs'],{encoding:'utf8'})
  const old=await import(`data:text/javascript;base64,${Buffer.from(oldSource).toString('base64')}`)
  const originalFetch=globalThis.fetch
  try {
    for(const [status,body,code] of [[409,{code:'23503',message:'PRIVATE_UNTRUSTED'},'RUNTIME_SQLSTATE_23503_HTTP_409'],[413,{},'RUNTIME_HTTP_413'],[546,{},'RUNTIME_HTTP_546']]) {
      globalThis.fetch=async()=>new Response(JSON.stringify(body),{status})
      const options={url:'https://ynuocvexviorgdjrfthw.supabase.co',key:'DISPOSABLE_ONLY_SERVER_KEY',packageSha:c.run.package_sha}
      await assert.rejects(old.createDurableRuntimeClient(options).inspect(),/R6_CLIENT:STATE_COMMAND_FAILED/)
      await assert.rejects(createDurableRuntimeClient(options).inspect(),e=>sanitizedStageException(e).code===code&&!e.message.includes('PRIVATE_UNTRUSTED'))
    }
  } finally {globalThis.fetch=originalFetch}
  console.log(JSON.stringify({status:'PASS',planRows:88,planDigest:sha256(planned),requestBytes:maxBytes,batches:batches.length,checks,actualHandler:true,actualAuthority:true,physicalConstraints:true,historicalClock:'DISPOSABLE_ONLY',schemaPreflight:'SEPARATELY_VALIDATED',providerCalls:0,productionDml:0,productionDdl:0}))
} finally {await db.close()}
