#!/usr/bin/env node
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createDurableRuntimeClient } from '../../scripts/mlb-operational-r6-state-client.mjs'
import { reviewDigest } from '../../supabase/functions/_shared/mlb-runtime-state.mjs'

const EXPECTED_BRANCH='ops/terminalize-stale-r6-run-20260919'
const TARGET_RUN='automation-884fdb346cfc5de32eae2b9b7362f6a24e8cd93e76abde08b770841b3d74aa39'

if(process.env.VERCEL!=='1'||process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!==EXPECTED_BRANCH){
  console.log('R6_STALE_RUN_DISPOSITION=SKIP')
  process.exit(0)
}

const url=process.env.NEXT_PUBLIC_SUPABASE_URL
const key=process.env.SUPABASE_SERVICE_ROLE_KEY
const packageSha=process.env.VERCEL_GIT_COMMIT_SHA
assert.equal(url,'https://ynuocvexviorgdjrfthw.supabase.co')
assert.ok(typeof key==='string'&&key.length>20)
assert.match(packageSha,/^[a-f0-9]{40}$/)

const client=createDurableRuntimeClient({url,key,packageSha})
const before=await client.inspect()
const pending=before.rows.filter(r=>r.state_kind==='RUN')
assert.equal(pending.length,1)
const run=pending[0]
assert.equal(run.run_id,TARGET_RUN)
assert.equal(run.status,'FAILED')
assert.equal(String(run.run_date).slice(0,10),'2026-09-13')
assert.equal(run.checkpoint?.stage,'SCOPE')
assert.equal(run.checkpoint?.failure?.code,'DEPENDENCY_READ_FAILURE')
assert.equal(run.checkpoint?.failure?.stage,'SCOPE')
assert.equal(run.checkpoint?.disposition,undefined)
assert.deepEqual(run.dml_accounting?.stages,[])
assert.equal(Number(run.odds_calls),0)
assert.equal(run.checkpoint?.scope?.length,14)

const lease=before.rows.find(r=>r.state_kind==='LEASE')
assert.ok(!lease?.lease_holder || Date.parse(lease.lease_expires_at)<=Date.now())

const command={
  op:'dispose',
  holder:randomUUID(),
  runId:run.run_id,
  expectedDigest:reviewDigest(run),
}
const response=await fetch(url+'/functions/v1/mlb-runtime-state',{
  method:'POST',
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
  body:JSON.stringify(command),
  redirect:'error',
  signal:AbortSignal.timeout(30000),
})
const body=await response.json()
assert.equal(response.status,200,JSON.stringify(body))
assert.equal(body?.status,'PASS')
assert.equal(body?.result?.status,'TERMINAL_PARTIAL_PRESERVED')
assert.equal(body?.result?.run?.run_id,TARGET_RUN)
assert.equal(body?.result?.run?.status,'FAILED')
assert.equal(body?.result?.run?.checkpoint?.disposition?.status,'TERMINAL_PARTIAL_PRESERVED')
assert.equal(body?.result?.run?.checkpoint?.disposition?.reason,'EXPIRED_FREEZE_NO_RETROACTIVE_MARKETS')

const after=await client.inspect()
assert.equal(after.rows.filter(r=>r.state_kind==='RUN').length,0)
console.log('R6_STALE_RUN_DISPOSITION='+JSON.stringify({
  runId:TARGET_RUN,
  previousStatus:run.status,
  disposition:body.result.run.checkpoint.disposition,
  pendingRunsAfter:0,
  deletedRows:0,
  businessDml:0,
}))
