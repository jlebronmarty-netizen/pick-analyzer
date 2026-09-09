import fs from 'node:fs'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {createRuntimeStateAuthority} from '../supabase/functions/_shared/mlb-runtime-state.mjs'
import {performFencedWrite} from '../supabase/functions/_shared/mlb-fenced-write.mjs'
const {PGlite}=await import(pathToFileURL(process.env.R6_PGLITE_MODULE).href)
const db=new PGlite(),checks=[]
const check=async(name,fn)=>{await fn();checks.push({name,status:'PASS'})}
const columnsByTable={pick2_mlb_players:['mlbam_person_id','source','metadata'],pick2_mlb_games:['game_pk','scheduled_at','game_date','official_status']}
const transaction=fn=>db.transaction(tx=>fn(async(sql,p=[]) => (await tx.query(sql,p)).rows))
const authority=createRuntimeStateAuthority({transaction,writeRows:args=>performFencedWrite({...args,columnsByTable})})
const holder='00000000-0000-4000-8000-000000000007'
let run,token
const write=async payload=>{const result=await authority({...token,op:'write',revision:Number(run.revision),write:payload});run=result.run;return result.result}
const player=id=>({mlbam_person_id:id,source:'ISOLATED_TEST',metadata:{source_game_pk:100001}})
try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;')
  await db.exec(fs.readFileSync('supabase/migrations/20260909210219_mlb_r6_durable_runtime_state.sql','utf8'))
  await db.exec('CREATE TABLE pick2_mlb_games(game_pk bigint primary key,scheduled_at timestamptz,game_date date,official_status text); CREATE TABLE pick2_mlb_players(mlbam_person_id bigint primary key,source text,metadata jsonb);')
  await db.exec("INSERT INTO pick2_mlb_games VALUES(100001,clock_timestamp()+interval '2 hours',(clock_timestamp() AT TIME ZONE 'America/Puerto_Rico')::date,'Scheduled')")
  await authority({op:'initialize'})
  const acquired=await authority({op:'acquire',holder,runId:'fenced-write-local',packageSha:'a'.repeat(40),mode:'PREGAME'})
  run=acquired.run;token={holder,fence:Number(acquired.lease.fence),runId:run.run_id}
  run=(await authority({...token,op:'checkpoint',revision:Number(run.revision),checkpoint:{...run.checkpoint,scope:[100001]},dml:{stages:[]}})).run
  await check('Atomic insert and runtime accounting commit together',async()=>{
    const result=await write({table:'pick2_mlb_players',rows:[player(900001)],cap:1})
    assert.equal(result.inserted,1);assert.equal(run.dml_accounting.stages[0].inserted,1)
  })
  await check('Lost response retry reads canonical row without duplicate count',async()=>{
    const accounting=structuredClone(run.dml_accounting)
    const result=await write({table:'pick2_mlb_players',rows:[player(900001)],cap:1})
    assert.equal(result.inserted,0);assert.equal(result.reused,1);assert.deepEqual(run.dml_accounting,accounting)
  })
  await check('Immutable conflict rolls back all state and business DML',async()=>{
    const before=await db.query('SELECT * FROM pick2_mlb_runtime_state ORDER BY scope_key')
    await assert.rejects(write({table:'pick2_mlb_players',rows:[{...player(900001),source:'DRIFT'}],cap:1}),/BLOCK_CONFLICT/)
    assert.deepEqual((await db.query('SELECT * FROM pick2_mlb_runtime_state ORDER BY scope_key')).rows,before.rows)
  })
  await check('Unexpected target, shape and scope reject before mutation',async()=>{
    for(const payload of [{table:'sports_sync_jobs',rows:[player(900002)],cap:1},{table:'pick2_mlb_players',rows:[{...player(900002),unapproved:'x'}],cap:1},{table:'pick2_mlb_players',rows:[{...player(900002),metadata:{source_game_pk:100002}}],cap:1}]) await assert.rejects(write(payload),/WRITE_TARGET|WRITE_PAYLOAD_SHAPE|WRITE_SCOPE_ESCAPE/)
    assert.equal((await db.query('SELECT count(*)::int n FROM pick2_mlb_players')).rows[0].n,1)
  })
  await check('Dynamic cumulative player cap checked before insert',async()=>{
    await write({table:'pick2_mlb_players',rows:[player(900002)],cap:1})
    await assert.rejects(write({table:'pick2_mlb_players',rows:[player(900003)],cap:1}),/CUMULATIVE_DML_CAP/)
    assert.equal((await db.query('SELECT count(*)::int n FROM pick2_mlb_players')).rows[0].n,2)
  })
  await check('Expired and wrong-owner requests cannot reach business DML',async()=>{
    await assert.rejects(authority({...token,holder:'00000000-0000-4000-8000-000000000008',op:'write',revision:Number(run.revision),write:{table:'pick2_mlb_players',rows:[player(900003)],cap:1}}),/STALE_FENCE_OR_LEASE/)
    await db.exec("UPDATE pick2_mlb_runtime_state SET lease_acquired_at=now()-interval '6 minutes',lease_expires_at=now()-interval '1 minute' WHERE state_kind='LEASE'")
    await assert.rejects(write({table:'pick2_mlb_players',rows:[player(900003)],cap:1}),/STALE_FENCE_OR_LEASE/)
  })
  const resumed=await authority({op:'acquire',holder,runId:'fenced-write-local',packageSha:'a'.repeat(40),mode:'PREGAME'});run=resumed.run;token.fence=Number(resumed.lease.fence)
  await check('Exact old-value native update succeeds and drift rejects',async()=>{
    const prior=(await db.query('SELECT to_jsonb(g) row FROM pick2_mlb_games g')).rows[0].row
    await assert.rejects(write({table:'pick2_mlb_games',rows:[{...prior,official_status:'Warmup'}],cap:1,operation:'UPDATE',expectedOld:{...prior,official_status:'CHANGED'}}),/BLOCK_CONFLICT/)
    const result=await write({table:'pick2_mlb_games',rows:[{...prior,official_status:'Warmup'}],cap:1,operation:'UPDATE',expectedOld:prior})
    assert.equal(result.updated,1)
  })
  await check('Started-game guard rolls back even an otherwise reusable row',async()=>{
    await db.exec("UPDATE pick2_mlb_games SET scheduled_at=now()-interval '1 minute'")
    await assert.rejects(write({table:'pick2_mlb_players',rows:[player(900001)],cap:1}),/STARTED_GAME_WRITE/)
  })
  console.log(JSON.stringify({status:'PASS',checks,scope:'DISPOSABLE_FENCED_BUSINESS_TRANSACTIONS',providerCalls:0,productionDml:0,productionDdl:0,productionDeployment:'NOT_ENABLED'}))
} finally {await db.close()}
