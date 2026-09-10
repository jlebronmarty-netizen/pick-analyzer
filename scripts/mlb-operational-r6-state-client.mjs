import { randomUUID, createHash } from 'node:crypto'
const ensure = (ok, reason) => { if (!ok) throw Error(`R6_CLIENT:${reason}`) }
const columns = {MLB_OFFICIAL:'mlb_official_calls',STATCAST:'statcast_calls',THE_ODDS_API:'odds_calls'}
const providerCaps = {MLB_OFFICIAL:50,STATCAST:100,THE_ODDS_API:1}

// State is always read/reserved through the authenticated shared authority.
// In-memory fields are fenced handles, never a substitute for DB authorization.
export function createDurableRuntimeClient({url,key,packageSha,deadline=Infinity}) {
  ensure(url === 'https://ynuocvexviorgdjrfthw.supabase.co' && typeof key === 'string' && key.length > 20,'SERVER_CREDENTIALS')
  ensure(/^[a-f0-9]{40}$/.test(packageSha),'PACKAGE')
  const holder=randomUUID()
  let lease=null,run=null,missionOddsCalls=null
  let queue=Promise.resolve()
  const serial = fn => { const result=queue.then(fn);queue=result.catch(()=>{});return result }
  async function call(command) {
    if(['reserve','write'].includes(command.op))ensure(Date.now()<deadline,'INVOCATION_BUDGET_YIELD')
    const response=await fetch(`${url}/functions/v1/mlb-runtime-state`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify(command),signal:AbortSignal.timeout(30000),redirect:'error'})
    const body=await response.json()
    if(!response.ok && typeof body.reason==='string' && /^R6_STATE:[A-Z_]+$/.test(body.reason))throw Error(body.reason)
    ensure(response.ok && body.status === 'PASS' && body.protocol==='MLB_R6_FENCED_RUNTIME_V1' && body.result,'STATE_COMMAND_FAILED')
    return body.result
  }
  function token() {
    ensure(lease && run,'LEASE_REQUIRED')
    return {holder,fence:Number(lease.fence),runId:run.run_id}
  }
  function providerSnapshot() { return Object.fromEntries(Object.entries(columns).map(([provider,column])=>[provider,Number(run?.[column] ?? 0)])) }
  return {
    inspect:()=>call({op:'inspect'}),
    get run() { return run ? structuredClone(run) : null },
    get locked() { return lease !== null },
    refresh:()=>serial(async()=>{
      const result=await call({op:'inspect'}),current=result.rows.find(r=>r.state_kind==='RUN' && r.run_id===run?.run_id)
      const active=result.rows.find(r=>r.state_kind==='LEASE'),mission=result.rows.find(r=>r.state_kind==='MISSION')
      ensure(current && active?.lease_holder===holder && Number(active.fence)===Number(lease?.fence),'REFRESH_FENCE')
      run=current;lease=active;missionOddsCalls=mission?.mission_odds_calls;return structuredClone(run)
    }),
    async acquire({runId,mode}) {
      ensure(!lease,'ALREADY_HELD')
      const result=await call({op:'acquire',holder,runId,packageSha,mode})
      if(result.status === 'ACQUIRED') {lease=result.lease;run=result.run;missionOddsCalls=result.missionOddsCalls}
      return result
    },
    renew:()=>serial(async()=>{const result=await call({...token(),op:'renew'});lease=result.lease;return result}),
    release:()=>serial(async()=>{if(!lease)return;const result=await call({...token(),op:'release'});lease=null;return result}),
    checkpoint:(checkpoint,dml)=>serial(async()=>{
      const result=await call({...token(),op:'checkpoint',revision:Number(run.revision),checkpoint,dml});run=result.run;return structuredClone(run)
    }),
    complete:(status,checkpoint,dml)=>serial(async()=>{
      const result=await call({...token(),op:'complete',status,revision:Number(run.revision),checkpoint,dml});run=result.run;return structuredClone(run)
    }),
    evidence:(kind,evidence)=>serial(async()=>{
      const result=await call({...token(),op:'evidence',kind,...(evidence?{evidence}:{})});run=result.run;return result.evidence
    }),
    fail:failure=>serial(async()=>{
      const result=await call({...token(),op:'fail',failure});run=result.run;return structuredClone(run)
    }),
    write:write=>serial(async()=>{
      ensure(Buffer.byteLength(JSON.stringify(write))<=500000,'WRITE_REQUEST_SIZE')
      const result=await call({...token(),op:'write',revision:Number(run.revision),write});run=result.run;return result.result
    }),
    ledger:{
      consume:(provider,count=1)=>serial(async()=>{
        ensure(Object.hasOwn(columns,provider) && count===1,'PROVIDER_OR_COUNT')
        const current=Number(run?.[columns[provider]] ?? 0)
        ensure(current < providerCaps[provider],'PROVIDER_CAP')
        const reservationId=createHash('sha256').update(`${run?.run_id}:${provider}:${current+1}`).digest('hex')
        const result=await call({...token(),op:'reserve',provider,reservationId})
        run=result.run;missionOddsCalls=result.missionOddsCalls
        return {provider,calls:1,consumed:Number(run[columns[provider]])}
      }),
      read:provider=>Number(run?.[columns[provider]] ?? 0),
      total:()=>Object.values(providerSnapshot()).reduce((a,b)=>a+b,0),
      snapshot:providerSnapshot,
      missionOddsConsumed:()=>missionOddsCalls,
    },
    accounting:()=>({providers:providerSnapshot(),missionOddsCalls,dml:structuredClone(run?.dml_accounting ?? {})}),
  }
}
