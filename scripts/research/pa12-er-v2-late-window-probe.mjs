#!/usr/bin/env node
import assert from 'node:assert/strict'
const EXPECTED_BRANCH='research/pa12-er-v2-runtime-late-window-probe-20260918'
if(process.env.VERCEL!=='1'||process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!==EXPECTED_BRANCH){
  console.log('PA12_ER_V2_LATE_WINDOW_PROBE=SKIP')
  process.exit(0)
}
const { supabaseAdmin }=await import('../../src/lib/supabase-admin.ts')
const { freezePa12ErForwardShadowV2 }=await import('../../src/services/pa12-er-forward-shadow-v2-freeze.service.ts')

const targetDate='2026-09-18'
async function count(){
  const {count,error}=await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id',{count:'exact',head:true})
    .eq('job_type','pa12_er_forward_shadow_v2_freeze_v1')
    .eq('metadata->>targetDate',targetDate)
  if(error)throw new Error(error.message)
  return count??0
}
const before=await count()
const result=await freezePa12ErForwardShadowV2({targetDate})
const after=await count()
assert.equal(result.status,'BLOCK_FREEZE_WINDOW_MISSED')
assert.equal(result.writes,0)
assert.equal(after,before)
console.log('PA12_ER_V2_LATE_WINDOW_PROBE='+JSON.stringify({before,after,result}))
