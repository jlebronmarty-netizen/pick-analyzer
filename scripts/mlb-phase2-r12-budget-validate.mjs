// Offline disposable SQL only. Never imports a production client or credentials.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
import {timingSafeEqual} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {createRuntimeStateAuthority,reviewDigest} from '../supabase/functions/_shared/mlb-runtime-state.mjs'
import {sanitizedStageException} from './mlb-operational-r7-errors.mjs'
import {withMissionOddsBudget} from './mlb-operational-budget-exhaustion.mjs'
import {proposedOddsPolicy,proposedBudgetDay,planProposedOddsAcquisition,projectProposedHealth} from './mlb-operational-budget-proposal.mjs'
import {sha256} from './mlb-data-02r-r2f-stage-contracts.mjs'
globalThis.fetch=async()=>{throw Error('NETWORK_FORBIDDEN')}
const {PGlite}=await import(pathToFileURL(process.env.R6_PGLITE_MODULE).href)
const db=new PGlite(),checks=[]
const check=async(name,fn)=>{await fn();checks.push({name,status:'PASS'})}
let at='2026-09-12T15:45:11.135Z'
const holder='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',pkg='a'.repeat(40)
const make=()=>createRuntimeStateAuthority({transaction:fn=>db.transaction(tx=>fn(async(sql,p=[])=>sql.startsWith('WITH frozen AS MATERIALIZED')?[{at,date:proposedBudgetDay(at)}]:(await tx.query(sql.replaceAll('clock_timestamp()',`'${at}'::timestamptz`),p)).rows))})
const authority=make(),second=make()
const mission=async()=>(await db.query("SELECT mission_odds_calls FROM pick2_mlb_runtime_state WHERE state_kind='MISSION'")).rows[0].mission_odds_calls
let run,token
try {
  await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;')
  await db.exec(fs.readFileSync('supabase/migrations/20260909210219_mlb_r6_durable_runtime_state.sql','utf8'))
  await db.exec('CREATE TABLE pick2_mlb_games(game_pk bigint primary key,scheduled_at timestamptz);CREATE TABLE pick2_game_predictions(id text primary key,game_pk bigint,predicted_at timestamptz);')
  await authority({op:'initialize'})
  // Test fixture establishes the already-consumed production-shaped baseline.
  await db.exec("UPDATE pick2_mlb_runtime_state SET mission_odds_calls=20 WHERE state_kind='MISSION'")
  const acquired=await authority({op:'acquire',holder,runId:'r12-preserved-fixture',packageSha:pkg,mode:'PREGAME'})
  run=acquired.run;token={holder,fence:Number(acquired.lease.fence),runId:run.run_id}
  for(let n=1;n<=15;n++){await db.query('INSERT INTO pick2_mlb_games VALUES($1,$2)',[n,'2026-09-13T01:40:00Z']);if(n<=13)await db.query('INSERT INTO pick2_game_predictions VALUES($1,$2,$3)',['fixture-'+n,n,at])}
  const receipt={stage:'PERSISTENCE',target:'pick2_game_predictions',planned:13,cap:15,inserted:13,updated:0,reused:0,conflicts:0,readback:'PASS',digest:sha256('13-preserved-fixtures')}
  run=(await authority({...token,op:'checkpoint',revision:Number(run.revision),checkpoint:{...run.checkpoint,stage:'ODDS_ACQUISITION',scope:Array.from({length:15},(_,i)=>i+1),completed:['SCOPE','DEPENDENCY_SCOPE','CONTEXTS','FEATURES']},dml:{stages:[receipt]}})).run
  await check('Exact cap and provider-budget diagnostics are retained, arbitrary text withheld',async()=>{
    for(const code of ['MISSION_ODDS_CAP','PROVIDER_CAP','MISSION_LEDGER','RESERVATION_ALREADY_CONSUMED','OPERATIONAL_ODDS_DAILY_CAP'])assert.equal(sanitizedStageException(Error('R6_STATE:'+code)).code,code)
    assert.equal(sanitizedStageException(Error('https://private.invalid/secret')).code,'UNCLASSIFIED_STAGE_EXCEPTION')
    await assert.rejects(authority({...token,op:'reserve',provider:'THE_ODDS_API',reservationId:sha256('rejected')}),/MISSION_ODDS_CAP/)
    assert.equal(await mission(),20)
  })
  const snapshot=(await db.query('SELECT * FROM pick2_game_predictions ORDER BY id')).rows
  await check('In-flight cap becomes explicit terminal result preserving 13 predictions and no downstream fabrication',async()=>{
    let refreshed=0
    const runtime={get run(){return structuredClone(run)},ledger:{missionOddsConsumed:()=>refreshed?20:19},refresh:async()=>{refreshed++}}
    const result=await withMissionOddsBudget({runtime,mode:'PREGAME',execute:async()=>{throw Error('R6_STATE:MISSION_ODDS_CAP')}})
    assert.equal(refreshed,1);assert.equal(result.status,'ODDS_BUDGET_EXHAUSTED');assert.equal(result.predictions,13);assert.equal(result.values,0);assert.equal(result.officialPicks,0)
    assert.deepEqual((await db.query('SELECT * FROM pick2_game_predictions ORDER BY id')).rows,snapshot)
  })
  run=(await authority({...token,op:'fail',failure:{code:'UNCLASSIFIED_STAGE_EXCEPTION',exceptionClass:'Error',message:'Stage failed; untrusted exception text withheld.'}})).run
  await authority({...token,op:'release'})
  await check('Historical disposition rejects early/stale review and preserves failure, freeze, all rows and mission 20',async()=>{
    const old=structuredClone(run)
    await assert.rejects(authority({op:'dispose',holder,runId:run.run_id,expectedDigest:reviewDigest(run)}),/DISPOSITION_NOT_EXPIRED/)
    at='2026-09-13T02:00:00.000Z'
    await assert.rejects(authority({op:'dispose',holder,runId:run.run_id,expectedDigest:'b'.repeat(64)}),/DISPOSITION_STATE_CONFLICT/)
    run=(await authority({op:'dispose',holder,runId:run.run_id,expectedDigest:reviewDigest(run)})).run
    assert.equal(run.checkpoint.disposition.status,'TERMINAL_PARTIAL_PRESERVED');assert.equal(run.checkpoint.disposition.predictionCount,13)
    assert.deepEqual(run.checkpoint.failure,old.checkpoint.failure);assert.deepEqual(run.dml_accounting,old.dml_accounting);assert.deepEqual(run.run_as_of,old.run_as_of);assert.equal(run.package_sha,old.package_sha)
    assert.deepEqual((await db.query('SELECT * FROM pick2_game_predictions ORDER BY id')).rows,snapshot);assert.equal(await mission(),20)
  })
  await check('Independent instances execute all safe modes after exhausted pregame and release the shared lease',async()=>{
    const executed=[]
    for(const mode of ['PREGAME','INCREMENTAL','POSTGAME','OVERNIGHT']){
      const a=await authority({op:'acquire',holder,runId:'r12-'+mode,packageSha:pkg,mode});let r=a.run
      assert.equal((await second({op:'acquire',holder:other,runId:'overlap-'+mode,packageSha:pkg,mode})).status,'DEFER_ACTIVE_LEASE')
      const t={holder,fence:Number(a.lease.fence),runId:r.run_id}
      const runtime={get run(){return structuredClone(r)},ledger:{missionOddsConsumed:()=>20},refresh:async()=>{}}
      const result=await withMissionOddsBudget({runtime,mode,execute:async()=>{executed.push(mode);return {status:'SAFE_MODE_READBACK',predictions:0,values:0,officialPicks:0}}})
      r=(await authority({...t,op:'complete',revision:Number(r.revision),status:'COMPLETE',checkpoint:{...r.checkpoint,stage:result.status,result:{status:result.status,predictions:result.predictions,values:0,picks:0,inserted:0,reused:0,conflicts:0,readback:'PASS'}},dml:{stages:[]}})).run
      await authority({...t,op:'release'})
      assert.equal((await second({op:'acquire',holder:other,runId:r.run_id,packageSha:pkg,mode})).status,'REUSE_NO_OP')
    }
    assert.deepEqual(executed,['INCREMENTAL','POSTGAME','OVERNIGHT']);assert.equal(await mission(),20)
    const inspected=await authority({op:'inspect'});assert.equal(inspected.rows.filter(r=>r.state_kind==='RUN').length,0)
  })
  await check('Previously paid evidence can resume at mission cap; other failures remain fail-closed',async()=>{
    const runtime={run:{status:'RUNNING',odds_calls:1},ledger:{missionOddsConsumed:()=>20}}
    assert.equal(await withMissionOddsBudget({runtime,mode:'PREGAME',execute:async()=>'PAID_EVIDENCE_RESUME'}),'PAID_EVIDENCE_RESUME')
    await assert.rejects(withMissionOddsBudget({runtime,mode:'PREGAME',execute:async()=>{throw Error('R6_STATE:BLOCK_CONFLICT')}}),/BLOCK_CONFLICT/)
    await assert.rejects(withMissionOddsBudget({runtime:{...runtime,ledger:{missionOddsConsumed:()=>21}},mode:'PREGAME',execute:async()=>{}}),/MISSION_LEDGER/)
  })
  await check('Recurring proposal remains inactive and PR midnight does not mean UTC midnight',async()=>{
    assert.equal(proposedOddsPolicy.activation,'PROPOSED_NOT_ACTIVE');assert.equal(proposedBudgetDay('2026-09-13T03:59:59Z'),'2026-09-12');assert.equal(proposedBudgetDay('2026-09-13T04:00:00Z'),'2026-09-13')
    const input={at:'2026-09-12T12:00:00Z',eligibleStarts:['2026-09-12T17:00:00Z']}
    assert.equal(planProposedOddsAcquisition(input).intervalMinutes,60)
    assert.equal(planProposedOddsAcquisition({...input,eligibleStarts:['2026-09-12T14:00:00Z']}).intervalMinutes,30)
    assert.equal(planProposedOddsAcquisition({...input,eligibleStarts:['2026-09-12T12:45:00Z']}).intervalMinutes,15)
    assert.equal(planProposedOddsAcquisition({...input,dailyConsumed:48}).decision,'DAILY_CAP')
    assert.equal(planProposedOddsAcquisition({...input,runConsumed:1}).decision,'RUN_CAP')
    assert.equal(planProposedOddsAcquisition({...input,lastAcquisitionAt:'2026-09-12T11:55:00Z'}).decision,'REUSE_IF_LINKAGE_VALID')
    assert.equal(planProposedOddsAcquisition({...input,lastAcquisitionAt:'2026-09-12T11:40:00Z'}).decision,'DEFER_STALE_NOT_ACTIONABLE')
    assert.equal(planProposedOddsAcquisition({...input,lastReservationAt:'2026-09-12T11:55:00Z'}).decision,'MIN_INTERVAL')
    assert.equal(planProposedOddsAcquisition({...input,eligibleStarts:['2026-09-12T12:04:00Z']}).decision,'NO_ELIGIBLE_PREGAME_SCOPE')
  })
  await check('Data Health contract separates deployment, frozen run, configuration and observed health',async()=>{
    const health=projectProposedHealth({webSha:'b'.repeat(40),edgeVersion:13,currentRun:run,configurationEnabled:true,latestInvocationOk:false,missionConsumed:20})
    assert.equal(health.schedulerConfiguration,'ENABLED');assert.equal(health.schedulerHealth,'DEGRADED_ODDS_BUDGET_EXHAUSTED');assert.notEqual(health.webDeploymentSha,health.frozenRunPackageSha);assert.equal(health.operationalBudget.activation,'NOT_ACTIVE');assert.equal(health.historicalMissionBudget.consumed,20)
    assert.equal(projectProposedHealth({currentRun:{...run,checkpoint:{}},configurationEnabled:true,missionConsumed:20}).schedulerHealth,'BLOCKED_FAILED_RUN')
    assert.match(fs.readFileSync('src/services/mlb-decision-board.service.ts','utf8'),/shadow\/informational/)
  })
  await check('Production host uses guarded wrapper without importing the proposed recurring policy',async()=>{
    const host=fs.readFileSync('scripts/mlb-operational-r6-vercel-runtime.mjs','utf8');assert.match(host,/withMissionOddsBudget\(\{runtime,mode,execute:\(\)=>executeDailyJob/);assert.match(host,/finally \{clearInterval\(heartbeat\);await runtime.release\(\)\}/);assert.ok(!host.includes('budget-proposal'))
  })
  await check('Actual Vercel host loop continues three non-Odds modes with injected transports after exhausted pregame',async()=>{
    const safeModes=[],completed=[],released=[],runtimePath='scripts/mlb-operational-r6-vercel-runtime.mjs'
    const activation={runtimeHost:{verified:true,type:'VERCEL_PRODUCTION_FUNCTION'},settlementAutomation:'DISABLED'}
    const readiness={automation:{status:'DRY_CERTIFIED'},sourceHashes:{[runtimePath]:'fixture-digest'}}
    const context=vm.createContext({Buffer,Date,Set,Error,JSON,Number,String,Object,process:{env:{VERCEL:'1',VERCEL_ENV:'production',VERCEL_GIT_COMMIT_SHA:pkg}},fs:{readFileSync:p=>JSON.stringify(p.includes('ACTIVATION')?activation:readiness)},requireCanonicalR3Readiness:()=>{},assertAutomationActivation:()=>{},normalizedFileDigest:()=> 'fixture-digest',runMlbOperationalSchemaPreflight:async()=>{},operatingDate:proposedBudgetDay,automationIdentity:({mode})=>mode,sha256,setInterval:()=>1,clearInterval:()=>{},withMissionOddsBudget,console,
      executeDailyJob:async()=>{throw Error('EXHAUSTED_DAILY_EXECUTOR_MUST_NOT_RUN')},
      createDurableRuntimeClient:()=>{let local;return {get run(){return structuredClone(local)},inspect:async()=>({rows:[]}),acquire:async({runId,mode})=>{local={run_id:runId,run_date:'2026-09-12',run_as_of:'2026-09-12T15:45:11.135Z',package_sha:pkg,status:'RUNNING',odds_calls:0,checkpoint:{version:1,mode,stage:'PENDING',scope:[],completed:[],references:[],blocked:[]},dml_accounting:{stages:[]}};return {status:'ACQUIRED'}},ledger:{missionOddsConsumed:()=>20,read:()=>0,snapshot:()=>({THE_ODDS_API:0})},checkpoint:async(cp,dml)=>{local.checkpoint=cp;local.dml_accounting=dml},complete:async(status,cp,dml)=>{local.status=status;local.checkpoint=cp;local.dml_accounting=dml;completed.push({mode:cp.mode,status:cp.result.status})},release:async()=>released.push(local.checkpoint.mode),renew:async()=>{},fail:async()=>{throw Error('UNEXPECTED_FAILED_STATE')}}},
      createMlbOfficialLiveClient:()=>({getSchedule:async()=>({dates:[{games:[{gamePk:1,status:{abstractGameState:'Live'}},{gamePk:2,status:{abstractGameState:'Final'}}]}]})}),
      createClient:()=>({from:()=>({select:()=>({in:(_column,scope)=>({limit:async()=>({data:scope.map(game_pk=>({game_pk})),error:null})})})})}),
      createDurableWriteJournal:()=>({summary:()=>[]}),createSupabaseProductionRepository:()=>({}),reconcileAutomatedPitches:async({job})=>{safeModes.push(job.mode);assert.equal(job.gamePks.length,1);return {readback:'PASS'}}})
    const host=fs.readFileSync(runtimePath,'utf8').replace(/^import .*\r?\n/gm,'').replaceAll('export ','')
    vm.runInContext(host,context);vm.runInContext("scheduledModes=()=>['PREGAME','INCREMENTAL','POSTGAME','OVERNIGHT']",context)
    const result=await vm.runInContext(`executeVercelProductionTick({packageSha:'${pkg}'})`,context)
    assert.equal(result.status,'COMPLETE');assert.equal(completed[0].status,'ODDS_BUDGET_EXHAUSTED');assert.deepEqual(safeModes,['INCREMENTAL','POSTGAME','OVERNIGHT']);assert.equal(released.length,4)
  })
  await check('Exact candidate Edge handler rejects missing/wrong/public credentials before any database connection',async()=>{
    let handler,connections=0,operations=0
    const env={SUPABASE_SERVICE_ROLE_KEY:'ISOLATED_SERVER_CREDENTIAL',SUPABASE_URL:'https://ynuocvexviorgdjrfthw.supabase.co',SUPABASE_DB_URL:'ISOLATED_DATABASE',SUPABASE_SECRET_KEYS:'{}'}
    const context=vm.createContext({Response,URL,TextEncoder,TextDecoder,timingSafeEqual,EVIDENCE_LIMIT:4194304,columnsByTable:{},Deno:{env:{get:k=>env[k]},serve:fn=>{handler=fn}},postgres:()=>{connections++;return {end:async()=>{}}},createEvidenceStorage:()=>({}),assertEvidenceAccess:async()=>{},assertRuntimeSchema:async()=>{},performFencedWrite:()=>{throw Error('UNEXPECTED_WRITE')},createRuntimeStateAuthority:()=>async command=>{operations++;assert.equal(command.op,'inspect');return {rows:[]}}})
    const source=fs.readFileSync('supabase/functions/mlb-runtime-state/index.ts','utf8').replace(/^import .*\r?\n/gm,'')
    vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,context)
    const request=auth=>new Request('https://fixture.invalid',{method:'POST',headers:{'content-type':'application/json',...(auth?{authorization:auth}:{})},body:JSON.stringify({op:'inspect'})})
    for(const auth of [null,'Bearer wrong','Bearer ISOLATED_PUBLIC_KEY']){assert.equal((await handler(request(auth))).status,401);assert.equal(connections,0);assert.equal(operations,0)}
    const valid=await handler(request('Bearer ISOLATED_SERVER_CREDENTIAL'));assert.equal(valid.status,200);assert.equal(operations,1);assert.ok(!(await valid.text()).includes('ISOLATED_SERVER_CREDENTIAL'))
  })
  console.log(JSON.stringify({status:'R12_LOCAL_CONTRACTS_PASS',checks,providerCalls:0,productionDml:0,productionDdl:0,operationalBudgetActivated:false}))
}finally{await db.close()}
