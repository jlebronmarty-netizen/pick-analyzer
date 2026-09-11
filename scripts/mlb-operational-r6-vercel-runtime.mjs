// Runtime adapter for the existing coordinator. Business stages remain in R2.
import fs from 'node:fs'
import {createClient} from '@supabase/supabase-js'
import {createDurableRuntimeClient} from './mlb-operational-r6-state-client.mjs'
import {createDurableWriteJournal} from './mlb-operational-r6-write-journal.mjs'
import {createSupabaseProductionRepository,createMlbOfficialLiveClient} from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
import {executeDailyJob,reconcileAutomatedPitches,assertAutomationActivation,automationIdentity} from './mlb-operational-automation.mjs'
import {requireCanonicalR3Readiness,normalizedFileDigest} from './mlb-data-02r-r2t-r3-readiness.mjs'
import {operatingDate} from './mlb-data-02r-r2t-r1-pregame-contract.mjs'
import {sha256} from './mlb-data-02r-r2f-stage-contracts.mjs'
import {sanitizedStageException} from './mlb-operational-r7-errors.mjs'
import {runMlbOperationalSchemaPreflight} from '../src/services/pick2-mlb-unattended-preflight.ts'
const ensure=(ok,why)=>{if(!ok)throw Error(`R6_HOST:${why}`)}
const activationPath='docs/CERTIFICATION/MLB_OPERATIONAL_AUTOMATION_ACTIVATION.json'

export function scheduledModes(at) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Puerto_Rico',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(at)).map(p=>[p.type,p.value]))
  const hour=Number(parts.hour),minute=Number(parts.minute)
  if(hour===4 && minute<15)return ['OVERNIGHT']
  return [...(hour>=8?[hour===8 && minute<15?'INITIALIZE':'PREGAME']:[]),'INCREMENTAL',...(minute<15?['POSTGAME']:[])]
}

export async function executeVercelProductionTick({packageSha,hostDry=false}) {
  ensure(process.env.VERCEL==='1' && process.env.VERCEL_ENV==='production' && process.env.VERCEL_GIT_COMMIT_SHA===packageSha && /^[a-f0-9]{40}$/.test(packageSha),'FROZEN_DEPLOYMENT')
  ensure(!process.env.R2S_VALIDATION_DIR,'CERTIFICATION_ENVIRONMENT')
  requireCanonicalR3Readiness()
  const activation=JSON.parse(fs.readFileSync(activationPath,'utf8'))
  if(!hostDry){assertAutomationActivation(activation);ensure(activation.runtimeHost?.verified===true && activation.runtimeHost?.type==='VERCEL_PRODUCTION_FUNCTION','HOST_CERTIFICATION')}
  const readiness=JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_PRE_NONEMPTY_LIVE_READINESS.json','utf8'))
  ensure(readiness.automation?.status==='DRY_CERTIFIED' && Object.hasOwn(readiness.sourceHashes??{},'scripts/mlb-operational-r6-vercel-runtime.mjs'),'RUNTIME_SOURCE_CERTIFICATION')
  for(const [file,digest] of Object.entries(readiness.sourceHashes))ensure(normalizedFileDigest(file)===digest,'RUNTIME_SOURCE_DRIFT')
  await runMlbOperationalSchemaPreflight()
  const started=Date.now(),at=new Date(started).toISOString(),date=operatingDate(at),results=[]
  const deadline=started+700000
  const newClient=()=>createDurableRuntimeClient({url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,packageSha,deadline})
  const inventory=await newClient().inspect(),pending=inventory.rows.filter(r=>r.state_kind==='RUN' && r.status!=='COMPLETE')
  ensure(pending.length<=1,'AMBIGUOUS_PENDING_RUN')
  if(hostDry)ensure(!pending.length || pending[0].checkpoint.mode==='HOST_DRY','LIVE_RUN_PENDING')
  const modes=hostDry?['HOST_DRY']:[...new Set([...(pending.length?[pending[0].checkpoint.mode]:[]),...scheduledModes(at)])]
  for(const mode of modes) {
    if(Date.now()>=deadline)return {status:'YIELDED',packageSha,results}
    const runtime=newClient()
    const runId=mode==='HOST_DRY'?`host-dry-${sha256({packageSha,slot:Math.floor(started/900000)})}`:`automation-${automationIdentity({date,mode,at})}`
    const acquired=await runtime.acquire({runId,mode})
    if(acquired.status==='DEFER_ACTIVE_LEASE')return {status:'DEFER_ACTIVE_LEASE',packageSha,results}
    if(acquired.status==='REUSE_NO_OP'){results.push({mode,status:'REUSE_NO_OP',runId:acquired.run.run_id});continue}
    let heartbeatError=null
    const heartbeat=setInterval(()=>{runtime.renew().catch(error=>{heartbeatError=error})},60000)
    const checkpoint=async(stage,data)=>{
      if(heartbeatError)throw heartbeatError
      const cp=runtime.run.checkpoint
      const refs=data?[...cp.references,{kind:stage.toLowerCase(),identity:runtime.run.run_id,digest:data.digest??sha256(data),count:data.count??0,asOf:new Date(runtime.run.run_as_of).toISOString()}]:cp.references
      await runtime.checkpoint({...cp,stage,completed:[...new Set([...cp.completed,stage])],references:refs},{stages:runtime.run.dml_accounting.stages})
    }
    try {
      let result
      // An explicitly reviewed dependency recovery may use compatible repaired
      // runtime code. The original execution package remains part of the freeze.
      const row=runtime.run,job={date:String(row.run_date).slice(0,10),mode,at:new Date(row.run_as_of).toISOString(),packageSha:row.package_sha}
      if(hostDry) {
        await checkpoint('HOST_DRY',{count:0,digest:sha256({packageSha,contract:'R6_REAL_HOST_PREFLIGHT_ONLY'})})
        result={status:'HOST_DRY_PASS',predictions:0,values:0,officialPicks:0,dml:[]}
      } else if(['INITIALIZE','PREGAME','STARTER_CHANGE','ODDS_FRESHNESS'].includes(mode))result=await executeDailyJob({job,durableRuntime:runtime})
      else {
        ensure(activation.settlementAutomation==='DISABLED','SETTLEMENT_BOUNDARY')
        const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
        if(!row.checkpoint.completed.includes('PITCH_SCOPE')) {
          ensure(runtime.ledger.read('MLB_OFFICIAL')===0,'INCOMPLETE_PITCH_SCOPE')
          const checkedFetch=(url,options)=>{const u=new URL(url);ensure(u.protocol==='https:' && u.hostname==='statsapi.mlb.com','PROVIDER_HOST');return fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(60000)})}
          const official=createMlbOfficialLiveClient({ledger:runtime.ledger,fetchImpl:checkedFetch})
          const scopeDate=mode==='OVERNIGHT'?new Date(Date.parse(`${job.date}T12:00:00Z`)-86400000).toISOString().slice(0,10):job.date
          const schedule=await official.getSchedule({runDate:scopeDate}),games=schedule.dates.flatMap(d=>d.games)
          ensure(games.length<=50,'SCHEDULE_CAP')
          const scope=games.filter(g=>mode==='INCREMENTAL'?g.status.abstractGameState==='Live':g.status.abstractGameState==='Final').map(g=>g.gamePk)
          const native=scope.length?await client.from('pick2_mlb_games').select('game_pk').in('game_pk',scope).limit(51):{data:[],error:null}
          ensure(!native.error && native.data.length===scope.length,'NATIVE_IDENTITY_REQUIRED')
          await runtime.checkpoint({...runtime.run.checkpoint,scope,dependencyScope:scope,stage:'PITCH_SCOPE',completed:['PITCH_SCOPE'],references:[{kind:'pitch_date',identity:scopeDate,digest:sha256(scope),count:scope.length,asOf:job.at}]},{stages:runtime.run.dml_accounting.stages})
        }
        const cp=runtime.run.checkpoint,journal=createDurableWriteJournal(runtime)
        if(!cp.scope.length)result={status:'NO_SCOPED_GAMES',dml:journal.summary()}
        else if(cp.completed.includes('RAW_READBACK'))result={status:'COMPLETE',dml:journal.summary()}
        else {
          const repository=createSupabaseProductionRepository({client,writeJournal:journal})
          const pitches=await reconcileAutomatedPitches({job:{...job,gamePks:cp.scope,dates:[cp.references.find(r=>r.kind==='pitch_date').identity],targetGamePks:[]},state:{providerAccounting:runtime.ledger.snapshot(),checkpoints:[]},checkpoint,store:{locked:true,referenceOnly:true,providerLedger:runtime.ledger},repository,client})
          result={status:'COMPLETE',pitches,dml:journal.summary()}
        }
      }
      if(heartbeatError)throw heartbeatError
      const cp=runtime.run.checkpoint,dml=runtime.run.dml_accounting
      await runtime.complete('COMPLETE',{...cp,stage:'COMPLETE',result:{status:result.status,predictions:result.predictions??0,values:result.values??0,picks:result.officialPicks??0,inserted:dml.stages.reduce((n,s)=>n+s.inserted,0),reused:dml.stages.reduce((n,s)=>n+s.reused,0),conflicts:0,readback:'PASS'}},{stages:dml.stages})
      results.push({...result,runId:runtime.run.run_id,mode,providers:runtime.ledger.snapshot(),missionOddsCalls:runtime.ledger.missionOddsConsumed(),checkpointBytes:Buffer.byteLength(JSON.stringify(runtime.run.checkpoint)),readback:'PASS'})
    } catch(error) {
      if(error.message==='R6_CLIENT:INVOCATION_BUDGET_YIELD')return {status:'YIELDED',packageSha,results}
      // Persist only bounded sanitized diagnostics. The authority supplies the
      // actual stage, revision, lease and accounting atomically with FAILED.
      try {await runtime.fail(sanitizedStageException(error))}
      catch(recordError) {
        console.error(JSON.stringify({event:'MLB_DURABLE_FAILURE_RECORD_UNAVAILABLE',runId:runtime.run.run_id,stage:runtime.run.checkpoint.stage,checkpointRevision:runtime.run.revision,exception:sanitizedStageException(error),recordingException:sanitizedStageException(recordError)}))
        throw recordError
      }
      throw error
    } finally {clearInterval(heartbeat);await runtime.release()}
  }
  return {status:hostDry?'HOST_DRY_PASS':'COMPLETE',packageSha,results,productionDdl:0,syntheticProductionPaths:0}
}
