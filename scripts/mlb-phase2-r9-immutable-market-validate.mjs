// Private production-shaped input, disposable PostgreSQL only. No providers.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {persistCanonicalMarkets,buildCanonicalValues,buildCanonicalOfficialPicks} from './mlb-data-02r-r2t-market-binding.mjs'
import {createRuntimeStateAuthority,reviewDigest,marketReadbackDigest} from '../supabase/functions/_shared/mlb-runtime-state.mjs'
import {performFencedWrite} from '../supabase/functions/_shared/mlb-fenced-write.mjs'
import {evidenceEnvelope,persistOrRecoverEvidence} from '../supabase/functions/_shared/mlb-provider-evidence.mjs'
import {planDurableWriteBatches} from './mlb-operational-r6-write-journal.mjs'
import {sha256} from './mlb-data-02r-r2f-stage-contracts.mjs'
import {normalizeDownstreamPayload,persistDownstreamRows} from './mlb-data-02r-r2t-downstream-persistence.mjs'
const root=process.env.R2S_VALIDATION_DIR
assert.ok(root && path.isAbsolute(root))
const c=JSON.parse(fs.readFileSync(path.join(root,'r9-private-inventory.json')))
const columnsByTable=JSON.parse(fs.readFileSync('supabase/functions/mlb-runtime-state/write-contract.json'))
const schema=JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_OPERATIONAL_DOWNSTREAM_SCHEMA_REVIEW.json'))
const {PGlite}=await import(pathToFileURL(process.env.R6_PGLITE_MODULE).href)
const checks=[],check=async(name,fn)=>{await fn();checks.push({name,status:'PASS'})}
const table='pick2_mlb_market_price_observations',holder='00000000-0000-4000-8000-000000000001'
let at='2026-09-11T16:05:00.000Z',planned
const storage={preflight:async()=>{},read:async()=>evidenceEnvelope(c.run,'odds',c.evidence),create:async()=>{throw Error('PROVIDER_EVIDENCE_REACQUISITION')}}
await check('Exact paid evidence reconstructs 286 observations without new acquisition',async()=>{
  assert.equal(sha256(c.evidence.payload),c.evidence.responseDigest)
  await assert.rejects(persistCanonicalMarkets({evidence:c.evidence,nativeGames:c.run.checkpoint.marketGames,eligibleGamePks:c.run.checkpoint.marketGames.map(g=>g.game_pk),beforeWrite:async()=>{},repository:{readMarketMappingsByGames:async()=>c.mappings,readMarketMappings:async()=>c.mappings,readMarketObservations:async()=>[],insertMarketObservations:async rows=>{planned=rows;throw Error('CAPTURE_ONLY')}}}),/CAPTURE_ONLY/)
  assert.equal(planned.length,286);assert.equal(sha256(planned),sha256(c.planned))
  assert.equal(new Set(planned.map(r=>r.observation_identity)).size,286)
})
const db=new PGlite()
const readRun=async()=> (await db.query("SELECT * FROM pick2_mlb_runtime_state WHERE state_kind='RUN'")).rows[0]
const query=async(q,p=[])=>{
  if(q.startsWith('WITH frozen AS MATERIALIZED'))return [{at,date:at.slice(0,10)}]
  if(q.includes('scheduled_at <= clock_timestamp()'))q=q.replace('clock_timestamp()',`'${at}'::timestamptz`)
  return (await db.query(q,p)).rows
}
const transaction=fn=>db.transaction(async tx=>{
  await tx.exec('SET LOCAL ROLE service_role')
  return fn(async(q,p=[])=>q.startsWith('WITH frozen AS MATERIALIZED')?[{at,date:at.slice(0,10)}]:(await tx.query(q.replace('scheduled_at <= clock_timestamp()',`scheduled_at <= '${at}'::timestamptz`),p)).rows)
})
const make=()=>createRuntimeStateAuthority({transaction,evidenceStorage:storage,writeRows:args=>performFencedWrite({...args,columnsByTable})})
try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;')
  await db.exec(fs.readFileSync('supabase/migrations/20260909210219_mlb_r6_durable_runtime_state.sql','utf8'))
  await db.exec('CREATE TABLE pick2_mlb_games(game_pk bigint PRIMARY KEY,scheduled_at timestamptz,game_date date,official_status text)')
  for(const g of c.games)await db.query('INSERT INTO pick2_mlb_games VALUES($1,$2,$3,$4)',[g.game_pk,g.scheduled_at,g.game_date,g.official_status])
  for(const [t,k] of [['pick2_model_versions','model_version_id'],['pick2_feature_snapshots','feature_snapshot_id']]) {
    await db.exec(`CREATE TABLE ${t}(id uuid PRIMARY KEY)`)
    for(const id of new Set(c.predictions.map(p=>p[k])))await db.query(`INSERT INTO ${t} VALUES($1)`,[id])
  }
  for(const s of schema.schema){await db.exec(`CREATE TABLE ${s.table_name} (${s.columns.map(col=>`${col.column} ${col.physical_type??col.type}${col.default?' DEFAULT '+col.default:''}${col.nullable==='NO'?' NOT NULL':''}`).join(',')})`);await db.exec(`ALTER TABLE ${s.table_name} ADD PRIMARY KEY(id)`)}
  for(const constraint of schema.constraints.filter(x=>x.contype!=='p' && (x.contype!=='f'||['pick2_mlb_market_price_observations','pick2_mlb_market_value_evaluations','pick2_mlb_official_picks'].includes(x.table_name))))await db.exec(`ALTER TABLE ${constraint.table_name} ADD CONSTRAINT ${constraint.conname} ${constraint.definition}`)
  for(const [t,rows] of [['pick2_game_predictions',c.predictions],['pick2_mlb_market_event_mappings',c.mappings]])await db.query(`INSERT INTO ${t} SELECT * FROM jsonb_populate_recordset(NULL::${t},$1::jsonb)`,[JSON.stringify(rows)])
  await db.query('INSERT INTO pick2_mlb_runtime_state SELECT * FROM jsonb_populate_record(NULL::pick2_mlb_runtime_state,$1::jsonb)',[JSON.stringify(c.run)])
  await db.exec("INSERT INTO pick2_mlb_runtime_state(scope_key,state_kind) VALUES('MLB_OPERATIONAL_GLOBAL','LEASE'); INSERT INTO pick2_mlb_runtime_state(scope_key,state_kind,mission_odds_calls) VALUES('MLB_OPERATIONAL_MISSION','MISSION',5)")
  await db.exec('GRANT SELECT,INSERT,UPDATE ON pick2_mlb_games,pick2_game_predictions,pick2_mlb_market_event_mappings TO service_role; GRANT SELECT,INSERT ON pick2_mlb_market_price_observations,pick2_mlb_market_value_evaluations,pick2_mlb_official_picks TO service_role;')
  const recovered=await persistOrRecoverEvidence({run:c.run,kind:'odds',storage})
  const command={op:'resumeMarket',holder,runId:c.run.run_id,packageSha:c.run.package_sha,executorPackageSha:'e'.repeat(40),expectedDigest:reviewDigest(c.run),marketReadbackDigest:marketReadbackDigest({...c,oddsReference:recovered.reference})}
  await check('Production-equivalent immutable SELECT/INSERT grants, UPDATE/DELETE denied',async()=>{
    const acl=await query("SELECT has_table_privilege('service_role','pick2_mlb_market_price_observations','SELECT') AS s,has_table_privilege('service_role','pick2_mlb_market_price_observations','INSERT') AS i,has_table_privilege('service_role','pick2_mlb_market_price_observations','UPDATE') AS u,has_table_privilege('service_role','pick2_mlb_market_price_observations','DELETE') AS d")
    assert.deepEqual(acl,[{s:true,i:true,u:false,d:false}])
    await assert.rejects(transaction(q=>q(`SELECT * FROM ${table} FOR UPDATE`)),e=>e.code==='42501')
  })
  await check('Wrong review/readback/package, reservations and downstream state fail without mutation',async()=>{
    for(const [k,v] of [['expectedDigest','0'.repeat(64)],['marketReadbackDigest','0'.repeat(64)],['packageSha','0'.repeat(40)]])await assert.rejects(make()({...command,[k]:v}),/MARKET_RESUME/)
    for(const change of [{odds_calls:0},{checkpoint:{...c.run.checkpoint,stage:'VALUES'}},{checkpoint:{...c.run.checkpoint,failure:{...c.run.checkpoint.failure,code:'BLOCK_CONFLICT'}}},{dml_accounting:{...c.run.dml_accounting,providerReservations:[]}}]) {
      const changed={...c.run,...change};await db.query('UPDATE pick2_mlb_runtime_state SET odds_calls=$1,checkpoint=$2::jsonb,dml_accounting=$3::jsonb WHERE state_kind=\'RUN\'',[changed.odds_calls,JSON.stringify(changed.checkpoint),JSON.stringify(changed.dml_accounting)])
      await assert.rejects(make()({...command,expectedDigest:reviewDigest(await readRun())}),/MARKET_RESUME/)
    }
    await db.query('UPDATE pick2_mlb_runtime_state SET odds_calls=1,checkpoint=$1::jsonb,dml_accounting=$2::jsonb WHERE state_kind=\'RUN\'',[JSON.stringify(c.run.checkpoint),JSON.stringify(c.run.dml_accounting)])
    assert.equal(reviewDigest(await readRun()),command.expectedDigest)
  })
  await check('Started target and missing/corrupt paid evidence reject before resume',async()=>{
    at='2026-09-11T18:20:00.000Z';await assert.rejects(make()(command),/STARTED_TARGET/);at='2026-09-11T16:05:00.000Z'
    const original=storage.read;storage.read=async()=>null;await assert.rejects(make()(command),/ODDS_DRIFT/)
    storage.read=async()=>({...evidenceEnvelope(c.run,'odds',c.evidence),runId:'wrong'});await assert.rejects(make()(command),/EVIDENCE_FREEZE_DRIFT/);storage.read=original
  })
  let authority=make(),acquired=await authority(command),run=acquired.run
  let token={holder,fence:Number(acquired.lease.fence),runId:run.run_id}
  await check('Guarded resume preserves original freeze, rows, reservations, counters and failure',async()=>{
    assert.equal(Number(run.revision),51);assert.equal(run.package_sha,c.run.package_sha);assert.equal(new Date(run.run_as_of).toISOString(),new Date(c.run.run_as_of).toISOString());assert.deepEqual(run.dml_accounting,c.run.dml_accounting);assert.deepEqual(run.checkpoint.marketRecoveries[0].priorFailure,c.run.checkpoint.failure)
    await assert.rejects(authority(command),/REVIEW_REQUIRED/)
    await assert.rejects(authority({...token,op:'checkpoint',revision:51,checkpoint:{...run.checkpoint,marketRecoveries:undefined},dml:{stages:run.dml_accounting.stages}}),/REVIEW_METADATA_IMMUTABLE/)
    await assert.rejects(authority({...token,op:'write',revision:50,write:{table,rows:planned.slice(0,1),cap:286}}),/REVISION_CONFLICT/)
    await assert.rejects(authority({...token,fence:0,op:'write',revision:51,write:{table,rows:planned.slice(0,1),cap:286}}),/STALE_FENCE_OR_LEASE/)
  })
  const persist=async(table,rows,cap)=>{
    let inserted=0,reused=0
    for(const batch of planDurableWriteBatches({table,rows,cap})) {const r=await authority({...token,op:'write',revision:Number(run.revision),write:{table,rows:batch,cap}});run=r.run;inserted+=r.result.inserted;reused+=r.result.reused}
    return {inserted,reused}
  }
  await check('Actual runtime writer inserts 286 rows under production grants and a new instance reuses all',async()=>{
    assert.deepEqual(await persist(table,planned,286),{inserted:286,reused:0});const prior=run.dml_accounting
    authority=make();assert.deepEqual(await persist(table,planned,286),{inserted:0,reused:286});assert.deepEqual(run.dml_accounting,prior)
    assert.equal((await query(`SELECT count(*)::int AS n FROM ${table}`))[0].n,286)
    await assert.rejects(persist(table,[{...planned[0],american_odds:planned[0].american_odds+1}],286),/BLOCK_CONFLICT/)
  })
  await check('Real value and Policy V1 persistence/reuse under the same immutable grants',async()=>{
    const observations=(await query(`SELECT to_jsonb(t) AS row FROM ${table} t`)).map(r=>r.row)
    const values=buildCanonicalValues({predictions:c.predictions,observations,evaluatedAt:at}).map(r=>normalizeDownstreamPayload('values',r))
    assert.ok(values.length>0);assert.equal((await persist('pick2_mlb_market_value_evaluations',values,values.length)).inserted,values.length)
    const stored=(await query('SELECT to_jsonb(t) AS row FROM pick2_mlb_market_value_evaluations t')).map(r=>r.row)
    const picks=buildCanonicalOfficialPicks({values:stored,decisionAt:at,scheduledByGame:new Map(c.games.map(g=>[g.game_pk,g.scheduled_at]))})
    picks.rows=picks.rows.map(r=>normalizeDownstreamPayload('officialPicks',r))
    if(picks.rows.length){await persist('pick2_mlb_official_picks',picks.rows,picks.rows.length);assert.equal((await persist('pick2_mlb_official_picks',picks.rows,picks.rows.length)).inserted,0)}
    assert.equal((await persist('pick2_mlb_market_value_evaluations',values,values.length)).inserted,0)
  })
  await check('R2 persistence accepts a raced canonical reuse and reports zero inserts',async()=>{
    let reads=0
    const result=await persistDownstreamRows({domain:'marketObservations',rows:[planned[0]],eligibleGamePks:c.games.map(g=>g.game_pk),cap:1,beforeWrite:async()=>{},repository:{
      readMarketObservations:async()=>++reads===1?[]:(await query(`SELECT to_jsonb(t) AS row FROM ${table} t WHERE observation_identity=$1`,[planned[0].observation_identity])).map(r=>r.row),
      insertMarketObservations:async rows=>{const r=await authority({...token,op:'write',revision:Number(run.revision),write:{table,rows,cap:286}});run=r.run;return r.result},
    }})
    assert.equal(result.inserted,0);assert.equal(result.readback.reuseNoOp,1)
  })
  await check('Two interleaved writer instances: one winner, matching loser rereads, mismatch blocks',async()=>{
    // PGlite serializes SQL statements. A barrier forces both actual writers to
    // observe absence before competing INSERTs, reproducing the race window.
    await db.exec('SET ROLE service_role')
    for(const mismatch of [false,true]) {
      const rows=[{...planned[0],observation_identity:sha256('R9_DISPOSABLE_RACE_'+mismatch)}]
      let arrivals=0,release;const barrier=new Promise(resolve=>{release=resolve})
      const q=async(sql,p=[])=>{const result=await query(sql,p);if(sql.startsWith('SELECT to_jsonb(t)') && sql.includes(table) && arrivals<2){arrivals++;if(arrivals===2)release();await barrier}return result}
      const raceRun={...c.run,dml_accounting:{stages:[]}}
      const invoke=rows=>performFencedWrite({query:q,run:raceRun,write:{table,rows,cap:1},columnsByTable,clock:{at,date:at.slice(0,10)}})
      const results=await Promise.allSettled([invoke(rows),invoke(mismatch?[{...rows[0],american_odds:rows[0].american_odds+1}]:rows)])
      assert.equal(results.filter(r=>r.status==='fulfilled'&&r.value.result.inserted===1).length,1)
      if(mismatch)assert.match(results.find(r=>r.status==='rejected').reason.message,/BLOCK_CONFLICT/)
      else assert.equal(results.filter(r=>r.status==='fulfilled'&&r.value.result.reused===1).length,1)
    }
    await db.exec('RESET ROLE')
  })
  fs.writeFileSync(path.join(root,'r9-local-validation.json'),JSON.stringify({status:'PASS',checks,marketPlanCount:planned.length,planDigest:sha256(planned),providerCalls:0,productionDml:0,productionDdl:0},null,2)+'\n')
  console.log(JSON.stringify({status:'PASS',checks:checks.length,marketPlanCount:planned.length,providers:0,productionDml:0,productionDdl:0}))
} finally {await db.close()}
