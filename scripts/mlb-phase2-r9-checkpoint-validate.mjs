// Replays the exact private partial-market state in disposable PostgreSQL.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {createRuntimeStateAuthority,marketReadbackDigest,reviewDigest,serializedBytes} from '../supabase/functions/_shared/mlb-runtime-state.mjs'
import {performFencedWrite} from '../supabase/functions/_shared/mlb-fenced-write.mjs'
import {evidenceEnvelope,persistOrRecoverEvidence} from '../supabase/functions/_shared/mlb-provider-evidence.mjs'
import {sanitizedStageException} from './mlb-operational-r7-errors.mjs'
const root=process.env.R2S_VALIDATION_DIR
assert.ok(root && path.isAbsolute(root))
const c=JSON.parse(fs.readFileSync(path.join(root,'r9-post-market-private.json')))
const schema=JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_OPERATIONAL_DOWNSTREAM_SCHEMA_REVIEW.json'))
const columnsByTable=JSON.parse(fs.readFileSync('supabase/functions/mlb-runtime-state/write-contract.json'))
const {PGlite}=await import(pathToFileURL(process.env.R6_PGLITE_MODULE).href),db=new PGlite()
const at=c.reference.evaluatedAt,holder='00000000-0000-4000-8000-000000000009'
const storage={preflight:async()=>{},read:async()=>evidenceEnvelope(c.run,'odds',c.evidence),create:async()=>{throw Error('REACQUISITION')}}
const transaction=fn=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE service_role');return fn(async(q,p=[])=>q.startsWith('WITH frozen AS MATERIALIZED')?[{at,date:at.slice(0,10)}]:(await tx.query(q.replace('scheduled_at <= clock_timestamp()',`scheduled_at <= '${at}'::timestamptz`),p)).rows)})
const authority=createRuntimeStateAuthority({transaction,evidenceStorage:storage,writeRows:args=>performFencedWrite({...args,columnsByTable})})
const checks=[]
try {
  await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;')
  await db.exec(fs.readFileSync('supabase/migrations/20260909210219_mlb_r6_durable_runtime_state.sql','utf8'))
  await db.exec('CREATE TABLE pick2_mlb_games(game_pk bigint PRIMARY KEY,scheduled_at timestamptz,official_status text)')
  for(const g of c.games)await db.query('INSERT INTO pick2_mlb_games VALUES($1,$2,$3)',[g.game_pk,g.scheduled_at,g.official_status])
  for(const s of schema.schema){await db.exec(`CREATE TABLE ${s.table_name} (${s.columns.map(col=>`${col.column} ${col.physical_type??col.type}${col.default?' DEFAULT '+col.default:''}${col.nullable==='NO'?' NOT NULL':''}`).join(',')})`);await db.exec(`ALTER TABLE ${s.table_name} ADD PRIMARY KEY(id)`)}
  for(const constraint of schema.constraints.filter(x=>x.contype!=='p' && x.contype!=='f'))await db.exec(`ALTER TABLE ${constraint.table_name} ADD CONSTRAINT ${constraint.conname} ${constraint.definition}`)
  for(const [table,rows] of [['pick2_game_predictions',c.predictions],['pick2_mlb_market_event_mappings',c.mappings],['pick2_mlb_market_price_observations',c.observations]])await db.query(`INSERT INTO ${table} SELECT * FROM jsonb_populate_recordset(NULL::${table},$1::jsonb)`,[JSON.stringify(rows)])
  await db.query('INSERT INTO pick2_mlb_runtime_state SELECT * FROM jsonb_populate_record(NULL::pick2_mlb_runtime_state,$1::jsonb)',[JSON.stringify(c.run)])
  await db.exec("INSERT INTO pick2_mlb_runtime_state(scope_key,state_kind) VALUES('MLB_OPERATIONAL_GLOBAL','LEASE');INSERT INTO pick2_mlb_runtime_state(scope_key,state_kind,mission_odds_calls) VALUES('MLB_OPERATIONAL_MISSION','MISSION',5)")
  await db.exec('GRANT SELECT,INSERT,UPDATE ON pick2_mlb_games,pick2_game_predictions,pick2_mlb_market_event_mappings TO service_role;GRANT SELECT,INSERT ON pick2_mlb_market_price_observations,pick2_mlb_market_value_evaluations,pick2_mlb_official_picks TO service_role;')
  const paid=await persistOrRecoverEvidence({run:c.run,kind:'odds',storage})
  const cmd={op:'resumeMarketCheckpoint',holder,runId:c.run.run_id,packageSha:c.run.package_sha,executorPackageSha:'a'.repeat(40),expectedDigest:reviewDigest(c.run),marketReadbackDigest:marketReadbackDigest({...c,oddsReference:paid.reference})}
  await assert.rejects(authority({...cmd,marketReadbackDigest:'0'.repeat(64)}),/READBACK_DRIFT/)
  const acquired=await authority(cmd),token={holder,runId:c.run.run_id,fence:Number(acquired.lease.fence)}
  let run=acquired.run
  assert.equal(acquired.readback.observations,286);assert.deepEqual(run.dml_accounting,c.run.dml_accounting)
  assert.equal(run.checkpoint.marketRecoveries.length,3);assert.deepEqual(run.checkpoint.marketRecoveries[2].priorFailure,c.run.checkpoint.failure)
  checks.push('Exact partial observation resume preserves 286 rows and complete history/accounting')
  const checkpoint={...run.checkpoint,stage:'MARKETS',completed:[...run.checkpoint.completed,'MARKETS'],marketReference:c.reference}
  assert.ok(serializedBytes(checkpoint)>28000)
  assert.ok(serializedBytes({...checkpoint,failure:null})+16500<=48000)
  run=(await authority({...token,op:'checkpoint',revision:Number(run.revision),checkpoint,dml:{stages:run.dml_accounting.stages}})).run
  assert.equal(run.checkpoint.marketReference.observationCount,286)
  checks.push('Exact market checkpoint exceeds obsolete threshold but retains full bounded failure reserve')
  const references=[...run.checkpoint.references,...Array.from({length:100},(_,i)=>({kind:'test',identity:'overflow'+i,digest:'f'.repeat(64),count:0,asOf:at}))]
  await assert.rejects(authority({...token,op:'checkpoint',revision:Number(run.revision),checkpoint:{...run.checkpoint,references},dml:{stages:run.dml_accounting.stages}}),/FAILURE_RECORD_HEADROOM|CHECKPOINT_SIZE/)
  const failure=sanitizedStageException(new Error('R6_STATE:FAILURE_RECORD_HEADROOM'))
  assert.equal(failure.code,'FAILURE_RECORD_HEADROOM')
  const failed=await authority({...token,op:'fail',failure})
  assert.equal(failed.run.checkpoint.failure.code,'FAILURE_RECORD_HEADROOM');assert.ok(serializedBytes(failed.run.checkpoint)<=48000)
  assert.deepEqual(failed.run.dml_accounting,c.run.dml_accounting)
  checks.push('Oversized future checkpoints reject and known exception remains durably classified within unchanged limits')
  assert.equal((await db.query('SELECT count(*)::int AS n FROM pick2_mlb_market_price_observations')).rows[0].n,286)
  fs.writeFileSync(path.join(root,'r9-checkpoint-validation.json'),JSON.stringify({status:'PASS',checks,oldCheckpointBytes:serializedBytes(checkpoint),ceiling:48000,reserve:16500,providers:0,productionDml:0,productionDdl:0},null,2)+'\n')
  console.log(JSON.stringify({status:'PASS',checks:checks.length,marketRows:286,oldCheckpointBytes:serializedBytes(checkpoint),unchangedCeiling:48000,providers:0,productionDml:0,productionDdl:0}))
} finally {await db.close()}
