// Disposable PostgreSQL and injected HTTP only. Never loads production credentials.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {createRuntimeStateAuthority} from '../supabase/functions/_shared/mlb-runtime-state.mjs'
import {oddsSchemaQuery,assertOddsBudgetSchema} from '../supabase/functions/_shared/mlb-odds-budget-schema.mjs'
import {sha256} from './mlb-data-02r-r2f-stage-contracts.mjs'
import {withMissionOddsBudget} from './mlb-operational-budget-exhaustion.mjs'
import {createTheOddsApiLiveClient} from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
globalThis.fetch=async()=>{throw Error('NETWORK_FORBIDDEN')}
const {PGlite}=await import(pathToFileURL(process.env.R6_PGLITE_MODULE))
const db=new PGlite(),checks=[]
let at='2026-09-14T04:00:00.000Z'
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at))
const holder='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',pkg='a'.repeat(40)
const make=()=>createRuntimeStateAuthority({operationalOdds:true,transaction:fn=>db.transaction(tx=>fn(async(sql,p=[])=>sql.startsWith('WITH frozen AS MATERIALIZED')?[{at,date:day()}]:(await tx.query(sql.replaceAll('clock_timestamp()',`'${at}'::timestamptz`),p)).rows))})
const authority=make(),second=make()
const check=async(name,fn)=>{await fn();checks.push({name,status:'PASS'})}
let run,token
async function acquire(id,minutes=30) {
  const result=await authority({op:'acquire',holder,runId:id,packageSha:pkg,mode:'PREGAME'})
  run=result.run;token={holder,fence:Number(result.lease.fence),runId:id}
  const cp={...run.checkpoint,stage:'ODDS_ACQUISITION',scope:[1],completed:['SCOPE','CONTEXTS','FEATURES'],marketGames:[{game_pk:1,scheduled_at:new Date(Date.parse(at)+minutes*60000).toISOString(),home_team_name:'Isolated Home',away_team_name:'Isolated Away'}]}
  run=(await authority({...token,op:'checkpoint',revision:Number(run.revision),checkpoint:cp,dml:{stages:[]}})).run
}
const reserve=()=>authority({...token,op:'reserve',provider:'THE_ODDS_API',reservationId:sha256(`${run.run_id}:THE_ODDS_API:1`)})
async function finish() {
  run=(await db.query('SELECT * FROM pick2_mlb_runtime_state WHERE scope_key=$1',[run.scope_key])).rows[0]
  const cp={...run.checkpoint,stage:'COMPLETE',result:{status:'ISOLATED_VALIDATION',predictions:0,values:0,picks:0,inserted:0,reused:0,conflicts:0,readback:'PASS'}}
  await authority({...token,op:'complete',revision:Number(run.revision),checkpoint:cp,dml:{stages:[]},status:'COMPLETE'})
  await authority({...token,op:'release'})
}
try {
  await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;')
  await db.exec(fs.readFileSync('supabase/migrations/20260909210219_mlb_r6_durable_runtime_state.sql','utf8'))
  await db.exec(fs.readFileSync('supabase/migrations/20260912203030_mlb_r12_operational_odds_budget.sql','utf8'))
  if(process.argv.includes('--generate-schema')) {
    fs.writeFileSync('supabase/functions/mlb-runtime-state/odds-budget-schema-contract.json',JSON.stringify((await db.query(oddsSchemaQuery)).rows[0].contract,null,2)+'\n')
    console.log('DISPOSABLE_SCHEMA_GENERATED')
  } else {
    await check('Exact catalog, RLS, client denial and service column-only updates',async()=>{
      await assertOddsBudgetSchema(async(sql,p)=>(await db.query(sql,p)).rows)
      for(const role of ['anon','authenticated'])await assert.rejects(db.transaction(async tx=>{await tx.exec(`SET LOCAL ROLE ${role}`);await tx.query('SELECT * FROM pick2_mlb_odds_operational_requests')}),/permission denied/)
      for(const sql of ['DELETE FROM pick2_mlb_odds_operational_requests','UPDATE pick2_mlb_odds_operational_requests SET daily_slot=1'])await assert.rejects(db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE service_role');await tx.exec(sql)}),/permission denied/)
      await db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE service_role');await tx.exec('UPDATE pick2_mlb_odds_operational_requests SET credits_last=1 WHERE false')})
    })
    await authority({op:'initialize'})
    await db.exec("UPDATE pick2_mlb_runtime_state SET mission_odds_calls=20 WHERE state_kind='MISSION'")
    const historical=sha256((await db.query("SELECT * FROM pick2_mlb_runtime_state WHERE state_kind='MISSION'")).rows)
    await check('48/day independent of historical 20; uncertain attempts count, retries and competing leases denied',async()=>{
      for(let i=0;i<48;i++) {
        at=new Date(Date.parse('2026-09-14T04:00:00Z')+i*15*60000).toISOString()
        await acquire(`operational-${i}`)
        assert.equal((await second({op:'acquire',holder:other,runId:'competing',packageSha:pkg,mode:'PREGAME'})).status,'DEFER_ACTIVE_LEASE')
        const result=await reserve();run=result.run
        assert.equal(result.missionOddsCalls,20);assert.equal(result.operationalBudget.consumed,i+1)
        await assert.rejects(reserve(),/RESERVATION_ALREADY_CONSUMED/)
        if(i===0) {
          const credits={httpStatus:200,last:0,used:42,remaining:958}
          assert.equal((await authority({...token,op:'oddsCredits',credits})).status,'CREDITS_RECORDED')
          assert.equal((await authority({...token,op:'oddsCredits',credits})).status,'REUSE_NO_OP')
          await assert.rejects(authority({...token,op:'oddsCredits',credits:{...credits,last:1}}),/ODDS_CREDIT_CONFLICT/)
        }
        await finish()
      }
      at='2026-09-14T16:00:00Z';await acquire('cap-rejected')
      await assert.rejects(reserve(),/OPERATIONAL_ODDS_DAILY_CAP/)
      await assert.rejects(db.query('INSERT INTO pick2_mlb_odds_operational_requests(run_scope_key,reservation_id,operational_day,daily_slot,reserved_at) VALUES($1,$2,$3,49,$4)',[run.scope_key,'e'.repeat(64),day(),at]),e=>e.code==='23514')
      await assert.rejects(db.query('UPDATE pick2_mlb_odds_operational_requests SET response_at=$1,http_status=NULL WHERE run_scope_key=$2',[at,'RUN:operational-1']),e=>e.code==='23514')
      const inspected=await authority({op:'inspect'});assert.equal(inspected.operationalBudget.consumed,48);assert.equal(inspected.operationalBudget.unknownCreditRequests,47)
      assert.equal(inspected.operationalBudget.observedCredits,0)
      const runtime={get run(){return run},ledger:{missionOddsConsumed:()=>20,operationalBudget:()=>inspected.operationalBudget},refresh:async()=>{}}
      const result=await withMissionOddsBudget({runtime,mode:'PREGAME',execute:async()=>{throw Error('MUST_NOT_EXECUTE')}})
      assert.equal(result.status,'ODDS_BUDGET_EXHAUSTED')
      for(const mode of ['INCREMENTAL','POSTGAME','OVERNIGHT'])assert.equal(await withMissionOddsBudget({runtime,mode,execute:async()=>mode}),mode)
      await finish()
      assert.equal(sha256((await db.query("SELECT * FROM pick2_mlb_runtime_state WHERE state_kind='MISSION'")).rows),historical)
    })
    await check('PR reset creates new day; cadence survives midnight and obeys 60/30/15 boundaries',async()=>{
      at='2026-09-15T03:55:00Z';await acquire('still-yesterday');await assert.rejects(reserve(),/OPERATIONAL_ODDS_DAILY_CAP/);await finish()
      at='2026-09-15T04:00:00Z';await acquire('new-day',240);assert.equal((await reserve()).operationalBudget.consumed,1);await finish()
      at='2026-09-15T04:15:00Z';await acquire('far-deferred',240);await assert.rejects(reserve(),/ODDS_MIN_INTERVAL/);await finish()
      at='2026-09-15T04:30:00Z';await acquire('mid-allowed',180);await reserve();await finish()
      at='2026-09-15T04:45:00Z';await acquire('near-allowed',60);await reserve();await finish()
      at='2026-09-16T03:55:00Z';await acquire('before-midnight');await reserve();await finish()
      at='2026-09-16T04:01:00Z';await acquire('after-midnight');assert.equal((await authority({op:'inspect'})).operationalBudget.consumed,0);await assert.rejects(reserve(),/ODDS_MIN_INTERVAL/);await finish()
      at='2026-09-16T04:10:00Z';await acquire('interval-passed');await reserve();await finish()
    })
    await check('Empty, started, near-start and durable veto scope cannot acquire',async()=>{
      for(const minutes of [-1,0,5]){at='2026-09-16T06:00:00Z';await acquire('guard-'+String(minutes).replace('-','minus'),minutes);await assert.rejects(reserve(),/NO_ELIGIBLE_PREGAME_SCOPE/);await finish()}
      await acquire('vetoed');run=(await authority({...token,op:'checkpoint',revision:Number(run.revision),checkpoint:{...run.checkpoint,blocked:[{gamePk:1,reason:'STARTER_MISSING'}]},dml:{stages:[]}})).run
      await assert.rejects(reserve(),/NO_ELIGIBLE_PREGAME_SCOPE/);await finish()
    })
    await check('Response credits are observed, never inferred; uncertain HTTP attempts are reserved once',async()=>{
      let consumed=0,reported
      const ledger={consume:async()=>{if(consumed)throw Error('RUN_CAP');consumed++},operationalBudget:()=>({activation:'ACTIVE'}),recordOddsCredits:async c=>{reported=c}}
      const client=createTheOddsApiLiveClient({apiKey:'ISOLATED_NOT_A_KEY',ledger,fetchImpl:async()=>new Response('[]',{status:200,headers:{'x-requests-last':'0','x-requests-used':'13','x-requests-remaining':'invalid'}})})
      assert.deepEqual(await client.getMoneylineOdds(),{events:[]});assert.deepEqual(reported,{httpStatus:200,last:0,used:13,remaining:null});await assert.rejects(client.getMoneylineOdds(),/RUN_CAP/)
      let attempts=0
      const uncertain=createTheOddsApiLiveClient({apiKey:'ISOLATED_NOT_A_KEY',ledger:{consume:async()=>{if(attempts)throw Error('RUN_CAP');attempts++}},fetchImpl:async()=>{throw Error('INJECTED_TIMEOUT')}})
      await assert.rejects(uncertain.getMoneylineOdds(),/INJECTED_TIMEOUT/);await assert.rejects(uncertain.getMoneylineOdds(),/RUN_CAP/);assert.equal(attempts,1)
    })
    await check('Missing schema and catalog drift fail closed; no history mutation',async()=>{
      await assert.rejects(db.transaction(async tx=>{await tx.exec('ALTER TABLE pick2_mlb_odds_operational_requests DISABLE ROW LEVEL SECURITY');await assertOddsBudgetSchema(async(sql,p)=>(await tx.query(sql,p)).rows)}),/OPERATIONAL_BUDGET_SCHEMA/)
      assert.equal(sha256((await db.query("SELECT * FROM pick2_mlb_runtime_state WHERE state_kind='MISSION'")).rows),historical)
      assert.equal((await authority({op:'inspect'})).rows.filter(r=>r.state_kind==='RUN').length,0)
    })
    console.log(JSON.stringify({status:'R12_OPERATIONAL_DISPOSABLE_PASS',checks,providerCalls:0,productionDml:0,productionDdl:0}))
  }
} finally {await db.close()}
