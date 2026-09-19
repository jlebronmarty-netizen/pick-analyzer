import { sha256 } from '../../../../../../scripts/mlb-data-02r-r2f-stage-contracts.mjs'

export const dynamic='force-dynamic'
export const runtime='nodejs'

const EXPECTED_BRANCH='ops/terminalize-stale-r6-run-20260919'
const TARGET_RUN='automation-884fdb346cfc5de32eae2b9b7362f6a24e8cd93e76abde08b770841b3d74aa39'

function reviewDigest(run:any) {
  return sha256({
    runId:run.run_id,
    packageSha:run.package_sha,
    runAsOf:new Date(run.run_as_of).toISOString(),
    revision:Number(run.revision),
    status:run.status,
    checkpoint:run.checkpoint,
    dml:run.dml_accounting,
    providers:[run.mlb_official_calls,run.statcast_calls,run.odds_calls],
  })
}

async function edge(command:any) {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(url!=='https://ynuocvexviorgdjrfthw.supabase.co'||!key)throw new Error('ONE_SHOT_ENV')
  const response=await fetch(url+'/functions/v1/mlb-runtime-state',{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
    body:JSON.stringify(command),
    redirect:'error',
    cache:'no-store',
    signal:AbortSignal.timeout(30000),
  })
  const body=await response.json().catch(()=>null)
  if(!response.ok||body?.status!=='PASS')throw new Error('ONE_SHOT_AUTHORITY_BLOCK')
  return body.result
}

export async function GET() {
  if(process.env.VERCEL!=='1'||process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!==EXPECTED_BRANCH)
    return Response.json({status:'BLOCKED',reason:'PREVIEW_BRANCH_ONLY'},{status:403})

  const before=await edge({op:'inspect'})
  const pending=before.rows.filter((r:any)=>r.state_kind==='RUN')
  if(pending.length===0)return Response.json({status:'REUSE_NO_OP',pendingRunsAfter:0})
  if(pending.length!==1)return Response.json({status:'BLOCKED',reason:'UNEXPECTED_PENDING_CARDINALITY',count:pending.length},{status:409})

  const run=pending[0]
  const safe=
    run.run_id===TARGET_RUN &&
    run.status==='FAILED' &&
    String(run.run_date).slice(0,10)==='2026-09-13' &&
    run.checkpoint?.stage==='SCOPE' &&
    run.checkpoint?.failure?.code==='DEPENDENCY_READ_FAILURE' &&
    run.checkpoint?.failure?.stage==='SCOPE' &&
    !run.checkpoint?.disposition &&
    Array.isArray(run.dml_accounting?.stages) &&
    run.dml_accounting.stages.length===0 &&
    Number(run.odds_calls)===0 &&
    Array.isArray(run.checkpoint?.scope) &&
    run.checkpoint.scope.length===14

  const lease=before.rows.find((r:any)=>r.state_kind==='LEASE')
  const activeLease=Boolean(lease?.lease_holder&&Date.parse(lease.lease_expires_at)>Date.now())
  if(!safe||activeLease)return Response.json({status:'BLOCKED',reason:'REVIEW_GUARD',safe,activeLease},{status:409})

  const disposed=await edge({
    op:'dispose',
    holder:'00000000-0000-4000-8000-000000000019',
    runId:run.run_id,
    expectedDigest:reviewDigest(run),
  })
  if(disposed.status!=='TERMINAL_PARTIAL_PRESERVED' ||
     disposed.run?.checkpoint?.disposition?.status!=='TERMINAL_PARTIAL_PRESERVED')
    return Response.json({status:'BLOCKED',reason:'DISPOSITION_READBACK'},{status:409})

  const after=await edge({op:'inspect'})
  const afterPending=after.rows.filter((r:any)=>r.state_kind==='RUN')
  if(afterPending.length!==0)return Response.json({status:'BLOCKED',reason:'PENDING_REMAINS',count:afterPending.length},{status:409})

  return Response.json({
    status:'PASS',
    runId:TARGET_RUN,
    priorFailure:run.checkpoint.failure.code,
    disposition:disposed.run.checkpoint.disposition,
    pendingRunsAfter:0,
    deletedRows:0,
    businessDml:0,
  })
}
