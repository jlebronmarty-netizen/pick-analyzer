// Invoked only by the disposable PostgreSQL regression harness. No network.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createRuntimeStateAuthority,serializedBytes} from '../supabase/functions/_shared/mlb-runtime-state.mjs'
import {performFencedWrite} from '../supabase/functions/_shared/mlb-fenced-write.mjs'
import {createDurableRuntimeClient} from './mlb-operational-r6-state-client.mjs'
import {createDurableWriteJournal} from './mlb-operational-r6-write-journal.mjs'
import {createDurableRunStore} from './mlb-operational-r6-run-store.mjs'
import {createCanonicalCertificationBindings} from './mlb-data-02r-r2t-production-bindings.mjs'
import {createSupabaseProductionRepository,createCurrentSlateRunFreeze} from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
import {runR2BExecutableEntrypoint} from './mlb-data-02r-r2a-live-refresh-executor.mjs'

export async function validateDurableR2Resume({db,client,root,runContext,authorization,fetchImpl,check}) {
  assert.ok(process.env.R2S_VALIDATION_DIR && client.executionEnvironment==='DISPOSABLE_PGLITE')
  const at=new Date(Date.parse(runContext.run_as_of)+2000).toISOString()
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;')
  await db.exec(fs.readFileSync('supabase/migrations/20260909210219_mlb_r6_durable_runtime_state.sql','utf8'))
  const columnsByTable=JSON.parse(fs.readFileSync('supabase/functions/mlb-runtime-state/write-contract.json','utf8'))
  // Only this isolated SQL harness projects the archived evidence clock. No
  // caller-supplied clock exists in the production authority or Function.
  const transaction=fn=>db.transaction(tx=>fn(async(sql,p=[]) => (await tx.query(sql.replaceAll('clock_timestamp()',`'${at}'::timestamptz`),p)).rows))
  const makeAuthority=()=>createRuntimeStateAuthority({transaction,writeRows:args=>performFencedWrite({...args,columnsByTable})})
  let authority=makeAuthority()
  await authority({op:'initialize'})
  const originalFetch=globalThis.fetch
  globalThis.fetch=async(url,options)=>{
    assert.equal(url,'https://ynuocvexviorgdjrfthw.supabase.co/functions/v1/mlb-runtime-state')
    try {return Response.json({status:'PASS',protocol:'MLB_R6_FENCED_RUNTIME_V1',result:await authority(JSON.parse(options.body))})}
    catch(error){return Response.json({status:'BLOCKED',reason:error.message},{status:409})}
  }
  const makeClient=()=>createDurableRuntimeClient({url:'https://ynuocvexviorgdjrfthw.supabase.co',key:'ISOLATED_TEST_NOT_A_CREDENTIAL',packageSha:runContext.execution_package_sha})
  const configure=async(runtime,interrupt)=>{
    const row=runtime.run
    const freeze=createCurrentSlateRunFreeze({mode:'DRY_RUN',runId:row.run_id,executionPackageSha:row.package_sha,runDate:runContext.run_date,runAsOf:at})
    const store=createDurableRunStore({runtime,runContext:freeze,root})
    const journal=createDurableWriteJournal(runtime)
    const repository={...createSupabaseProductionRepository({client,writeJournal:journal}),executionEnvironment:'DISPOSABLE_PGLITE'}
    if(interrupt)repository.insertPredictions=async()=>{throw Error('FORCED_INTERRUPTION_AFTER_FEATURES')}
    const canonical=await createCanonicalCertificationBindings({client,repository,store,runContext:freeze,authorization,compactContexts:true,oddsApiKey:'ISOLATED_TEST_VALUE',fetchImpl,now:()=>new Date(at)})
    store.setCanonical(canonical)
    const execute=()=>runR2BExecutableEntrypoint({mode:'CERTIFICATION_SIMULATION',providers:{canonical},repository,authorization,runId:freeze.run_id,executionPackageSha:freeze.execution_package_sha,runDate:freeze.run_date,runAsOf:at,clock:at})
    return {execute,store,canonical}
  }
  let first,second
  try {
    first=makeClient()
    assert.equal((await first.acquire({runId:'r6-r2-durable-simulation',mode:'PREGAME'})).status,'ACQUIRED')
    const a=await configure(first,true)
    await assert.rejects(a.execute(),/FORCED_INTERRUPTION_AFTER_FEATURES/)
    assert.ok(first.run.checkpoint.completed.includes('FEATURES'))
    const saved=first.run
    assert.ok(saved.checkpoint.references.some(r=>r.kind==='persisted_features'))
    await first.release()
    authority=makeAuthority();second=makeClient()
    assert.equal((await second.acquire({runId:'r6-next-slot',mode:'PREGAME'})).status,'ACQUIRED')
    assert.equal(second.run.run_id,saved.run_id)
    assert.deepEqual(second.run.checkpoint,saved.checkpoint)
    const b=await configure(second,false)
    b.canonical.buildFeaturePlan=async()=>{throw Error('RAW_REBUILD_AFTER_FEATURES_FORBIDDEN')}
    const result=await b.execute()
    assert.equal(result.status,'CANONICAL_STAGES_READBACK_COMPLETE')
    assert.equal(result.features.writes.reduce((n,w)=>n+w.inserted,0),0)
    check('separate R2 runtime resumes after features using durable SQL references and no raw rebuild',true)
    const accounting=second.accounting(),before=second.run.checkpoint
    const again=await b.execute()
    assert.equal(again.insertedRows,0)
    assert.deepEqual(second.accounting(),accounting)
    assert.deepEqual(second.run.checkpoint,before)
    check('durable R2 repeat reuses features predictions markets values and picks without duplicate provider reservations',true)
    const cp={...second.run.checkpoint,stage:'COMPLETE',result:{status:result.status,predictions:result.predictions.rows.length,values:result.values.rows.length,picks:result.picks.rows.length,inserted:result.insertedRows,reused:0,conflicts:0,readback:'PASS'}}
    await second.complete('COMPLETE',cp,{stages:second.run.dml_accounting.stages})
    await second.release()
    const third=makeClient()
    assert.equal((await third.acquire({runId:saved.run_id,mode:'PREGAME'})).status,'REUSE_NO_OP')
    check('completed durable scheduled identity cannot repeat immutable work',true)
    return {status:'PASS',checkpointBytes:serializedBytes(cp),games:result.eligibleGamePks.length,providerCalls:0,productionDml:0,productionDdl:0}
  } finally {if(first?.locked)await first.release();if(second?.locked)await second.release();globalThis.fetch=originalFetch}
}
