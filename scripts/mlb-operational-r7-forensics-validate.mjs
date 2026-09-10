// Reproduce the recovered R6 failure mechanisms in disposable SQL only.
// Passing diagnostics do NOT certify the R7 repair or production recovery.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {createRuntimeStateAuthority} from '../supabase/functions/_shared/mlb-runtime-state.mjs'
import {createDurableRunStore} from './mlb-operational-r6-run-store.mjs'
import {operatingDate} from './mlb-data-02r-r2t-r1-pregame-contract.mjs'
import {sha256} from './mlb-data-02r-r2f-stage-contracts.mjs'

assert.ok(process.env.R6_PGLITE_MODULE, 'Disposable PostgreSQL required')
const {PGlite}=await import(pathToFileURL(process.env.R6_PGLITE_MODULE).href)
const db=new PGlite(),checks=[]
let at='2026-09-09T23:59:00.000Z'
// Only this disposable adapter overrides the DB clock. Production accepts no clock input.
const transaction=fn=>db.transaction(tx=>fn(async(sql,p=[])=>sql.startsWith('WITH frozen AS MATERIALIZED')?[{at,date:operatingDate(at)}]:(await tx.query(sql,p)).rows))
const authority=createRuntimeStateAuthority({transaction})
const check=async(name,fn)=>{await fn();checks.push({name,status:'PASS'})}
const request={op:'acquire',holder:'00000000-0000-4000-8000-000000000007',runId:'r7-disposable-frozen',packageSha:'a'.repeat(40),mode:'PREGAME'}
try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;')
  await db.exec(fs.readFileSync('supabase/migrations/20260909210219_mlb_r6_durable_runtime_state.sql','utf8'))
  await authority({op:'initialize'})
  let acquired=await authority(request),run=acquired.run
  let token={holder:request.holder,fence:Number(acquired.lease.fence),runId:run.run_id}
  await check('UTC midnight retains Puerto Rico operating date',()=>{
    assert.equal(operatingDate(at),'2026-09-09')
    assert.equal(operatingDate('2026-09-10T00:01:00.000Z'),'2026-09-09')
  })
  const reservationId=createHash('sha256').update(`${run.run_id}:THE_ODDS_API:1`).digest('hex')
  run=(await authority({...token,op:'reserve',provider:'THE_ODDS_API',reservationId})).run
  const context={run_id:run.run_id,run_date:'2026-09-09',run_as_of:at,execution_package_sha:request.packageSha}
  const runtime={get run(){return run},ledger:{read:p=>p==='THE_ODDS_API'?run.odds_calls:0}}
  const evidence={payload:{events:[]},acquiredAt:at,responseDigest:sha256({events:[]})}
  await check('Original provider store loses evidence across instances',async()=>{
    const first=createDurableRunStore({runtime,runContext:context})
    await first.save(`odds-${run.run_id}`,evidence)
    assert.deepEqual(await first.load(`odds-${run.run_id}`),evidence)
    const second=createDurableRunStore({runtime,runContext:context})
    await assert.rejects(second.load(`odds-${run.run_id}`),/^Error: R6_CHECKPOINT:ODDS_OUTCOME_UNCERTAIN$/)
    assert.equal(run.odds_calls,1)
  })
  await authority({...token,op:'release'})
  at='2026-09-10T00:01:00.000Z'
  await check('Pending run wins over next Cron identity across UTC midnight',async()=>{
    acquired=await authority({...request,runId:'r7-next-slot'})
    assert.equal(acquired.run.run_id,run.run_id)
    assert.equal(new Date(acquired.run.run_as_of).toISOString(),context.run_as_of)
    assert.equal(acquired.run.odds_calls,1)
    assert.equal(acquired.missionOddsCalls,3)
    token={...token,fence:Number(acquired.lease.fence)}
    await authority({...token,op:'release'})
  })
  await check('New deployment cannot silently switch pending execution package',async()=>{
    await assert.rejects(authority({...request,packageSha:'b'.repeat(40)}),/FROZEN_PACKAGE_CONFLICT/)
  })
  at='2026-09-10T04:01:00.000Z'
  await check('Puerto Rico midnight requires explicit stale-run disposition',async()=>{
    await assert.rejects(authority(request),/STALE_PENDING_RUN_REQUIRES_REVIEW/)
  })
  await check('Failed attempts preserve reservation and release state',async()=>{
    const rows=(await authority({op:'inspect'})).rows
    const frozen=rows.find(r=>r.state_kind==='RUN')
    assert.equal(frozen.odds_calls,1)
    assert.deepEqual(frozen.dml_accounting.providerReservations,[reservationId])
    assert.equal(rows.find(r=>r.state_kind==='MISSION').mission_odds_calls,3)
    assert.equal(rows.find(r=>r.state_kind==='LEASE').lease_holder,null)
  })
  console.log(JSON.stringify({status:'DIAGNOSTIC_REPRODUCTION_PASS',repairCertified:false,checks,providerCalls:0,productionDml:0,productionDdl:0},null,2))
} finally {await db.close()}
