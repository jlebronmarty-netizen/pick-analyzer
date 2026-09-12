// Invoked by the disposable physical-schema harness. Never a production runner.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createPgliteClient } from './mlb-data-02r-r2t-pglite-client.mjs'
import { createRuntimeStateAuthority, validateCheckpoint } from '../supabase/functions/_shared/mlb-runtime-state.mjs'
import { performFencedWrite } from '../supabase/functions/_shared/mlb-fenced-write.mjs'
import { createDurableRuntimeClient } from './mlb-operational-r6-state-client.mjs'
import { createDurableWriteJournal } from './mlb-operational-r6-write-journal.mjs'
import { createDurableRunStore } from './mlb-operational-r6-run-store.mjs'
import { createCanonicalCertificationBindings } from './mlb-data-02r-r2t-production-bindings.mjs'
import { createSupabaseProductionRepository, createCurrentSlateRunFreeze, R2I_LIVE_TARGETS } from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
import { runR2BExecutableEntrypoint } from './mlb-data-02r-r2a-live-refresh-executor.mjs'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
import { FEATURE_TABLES } from './mlb-data-02r-r2t-real-feature-champion.mjs'
import { gameVetoClassification } from './mlb-operational-game-veto.mjs'

export async function validatePartialSlate({db,root,operationalOdds=false}) {
  const client=createPgliteClient(db),checks=[]
  const pass=name=>checks.push({name,status:'PASS'})
  const inventory=JSON.parse(fs.readFileSync(path.join(root,'r11-inventory-private.json')))
  const replay=JSON.parse(fs.readFileSync(path.join(root,'r11-replay-private.json')))
  const contexts=replay.contexts,scope=inventory.run.checkpoint.scope
  assert.equal(contexts.length,13)
  // All inserts below target this explicitly supplied in-memory SQL instance.
  const seed=async(table,rows)=>{
    const columns=(await db.query('select column_name from information_schema.columns where table_schema=$1 and table_name=$2',['public',table])).rows.map(r=>r.column_name)
    for(const row of rows) {
      const names=Object.keys(row).filter(k=>columns.includes(k))
      await db.query(`insert into public.${table} (${names.join(',')}) select ${names.join(',')} from jsonb_populate_record(null::public.${table},$1::jsonb) on conflict do nothing`,[JSON.stringify(row)])
    }
  }
  await seed('sports_teams',[...new Set(inventory.games.flatMap(g=>[g.home_team_id,g.away_team_id]))].map(id=>({id,sport_key:'baseball_mlb'})))
  await seed('pick2_mlb_games',inventory.games)
  await seed('pick2_feature_snapshots',replay.generated.rows.snapshots)
  for(const [domain,table] of Object.entries(FEATURE_TABLES).filter(([d])=>d!=='snapshots'))await seed(table,Object.values(replay.pinned).flatMap(rows=>rows[domain]))
  let at=new Date(inventory.run.run_as_of).toISOString()
  const transaction=fn=>db.transaction(tx=>fn(async(sql,p=[]) => (await tx.query(sql.replaceAll('clock_timestamp()',`'${at}'::timestamptz`),p)).rows))
  const columnsByTable=JSON.parse(fs.readFileSync('supabase/functions/mlb-runtime-state/write-contract.json'))
  const objects=new (db.constructor)()
  await objects.exec('create table evidence(key text primary key,body jsonb)')
  const evidenceStorage={preflight:async()=>{},read:async key=>(await objects.query('select body from evidence where key=$1',[key])).rows[0]?.body??null,create:async(key,body)=>objects.query('insert into evidence values($1,$2::jsonb)',[key,JSON.stringify(body)])}
  if(operationalOdds) {
    await db.exec(fs.readFileSync('supabase/migrations/20260912203030_mlb_r12_operational_odds_budget.sql','utf8'))
    await db.exec("UPDATE pick2_mlb_runtime_state SET mission_odds_calls=20 WHERE state_kind='MISSION'")
  }
  const makeAuthority=()=>createRuntimeStateAuthority({operationalOdds,transaction,evidenceStorage,writeRows:args=>performFencedWrite({...args,columnsByTable})})
  let authority=makeAuthority(),runtime
  const savedFetch=globalThis.fetch
  globalThis.fetch=async(url,options)=>{
    assert.equal(url,'https://ynuocvexviorgdjrfthw.supabase.co/functions/v1/mlb-runtime-state')
    try{return Response.json({status:'PASS',protocol:'MLB_R6_FENCED_RUNTIME_V1',result:await authority(JSON.parse(options.body))})}
    catch(error){return Response.json({status:'BLOCKED',reason:error.message},{status:409})}
  }
  const packageSha='a'.repeat(40),runId='r11-r1-disposable-partial'
  const newClient=()=>createDurableRuntimeClient({url:'https://ynuocvexviorgdjrfthw.supabase.co',key:'ISOLATED_TEST_NOT_A_CREDENTIAL',packageSha})
  const freeze=createCurrentSlateRunFreeze({mode:'DRY_RUN',runId,executionPackageSha:packageSha,runDate:inventory.run.run_date,runAsOf:at})
  const authorization={authorized:true,execution_package_sha:packageSha,authorizedDmlTargets:Object.values(R2I_LIVE_TARGETS),providerCaps:{MLB_OFFICIAL:{allowed:true,maxCalls:50},STATCAST:{allowed:false,maxCalls:0},THE_ODDS_API:{allowed:true,maxCalls:1}}}
  const bad=contexts.slice(0,5).map(c=>c.target.gamePk),expected=['STARTER_MISSING','CURRENT_STARTER_CHANGE_VETO','CURRENT_STARTED_GAME_VETO','CURRENT_GAME_IDENTITY_VETO','NEW_CANONICAL_EVIDENCE_AFTER_RUN_FREEZE']
  const payload=structuredClone(inventory.schedule.evidence.payload)
  const sourceGame=pk=>payload.dates.flatMap(d=>d.games).find(g=>g.gamePk===pk)
  sourceGame(bad[0]).teams.home.probablePitcher=null
  sourceGame(bad[1]).teams.home.probablePitcher.id=900000001
  sourceGame(bad[2]).status.abstractGameState='Live'
  sourceGame(bad[3]).gameDate=new Date(Date.parse(sourceGame(bad[3]).gameDate)+60000).toISOString()
  let providerRequests=0,oddsRequests=0,injectPostFreeze=false
  const fetchImpl=async url=>{
    const host=new URL(url).hostname
    if(host==='statsapi.mlb.com'){providerRequests++;return {ok:true,json:async()=>payload}}
    assert.equal(host,'api.the-odds-api.com');oddsRequests++
    return {ok:true,status:200,json:async()=>contexts.map(c=>{const g=sourceGame(c.target.gamePk);return {id:`r11-market-${g.gamePk}`,sport_key:'baseball_mlb',commence_time:c.target.scheduledAt,home_team:g.teams.home.team.name,away_team:g.teams.away.team.name,bookmakers:[{key:'isolated_book',title:'Isolated Book',last_update:at,markets:[{key:'h2h',last_update:at,outcomes:[{name:g.teams.home.team.name,price:-110},{name:g.teams.away.team.name,price:100}]}]}]}})}
  }
  const configure=async(interrupt=false)=>{
    const store=createDurableRunStore({runtime,runContext:freeze,root})
    const journal=createDurableWriteJournal(runtime)
    const repository={...createSupabaseProductionRepository({client,writeJournal:journal}),executionEnvironment:'DISPOSABLE_PGLITE'}
    const nativeRead=repository.readNativeGames
    repository.readNativeGames=async ids=>(await nativeRead(ids)).map(g=>injectPostFreeze&&g.game_pk===bad[4]?{...g,updated_at:at}:g)
    if(interrupt)repository.insertPredictions=async()=>{throw Error('INJECTED_LOSS_AFTER_DURABLE_VETO')}
    const canonical=await createCanonicalCertificationBindings({client,repository,store,runContext:freeze,authorization,compactContexts:true,oddsApiKey:'ISOLATED_TEST_VALUE',fetchImpl,now:()=>new Date(at)})
    const classify=canonical.classifyCurrentGames
    canonical.classifyCurrentGames=async args=>{injectPostFreeze=true;try{return await classify(args)}finally{injectPostFreeze=false}}
    store.setCanonical(canonical)
    const execute=()=>runR2BExecutableEntrypoint({mode:'CERTIFICATION_SIMULATION',providers:{canonical},repository,authorization,runId,executionPackageSha:packageSha,runDate:freeze.run_date,runAsOf:freeze.run_as_of,clock:()=>new Date(at)})
    return {store,execute,repository}
  }
  try {
    runtime=newClient();assert.equal((await runtime.acquire({runId,mode:'PREGAME'})).status,'ACQUIRED')
    const first=await configure(true)
    await first.store.freezeScope(scope);await first.store.freezeDependencyScope([])
    const evidence={contexts,nativeGames:inventory.run.checkpoint.marketGames,blockedGames:inventory.run.checkpoint.blocked}
    await first.store.save(runId,{frozenDigest:sha256(freeze),evidence,evidenceDigest:sha256(evidence),featureReferences:inventory.run.checkpoint.references.filter(r=>r.kind==='persisted_features')})
    at=new Date(Date.parse(freeze.run_as_of)+2000).toISOString()
    await assert.rejects(first.execute(),/INJECTED_LOSS_AFTER_DURABLE_VETO/)
    const preserved=runtime.run.checkpoint
    assert.equal(preserved.gameVetoes.length,5)
    for(let i=0;i<bad.length;i++)assert.equal(preserved.gameVetoes.find(r=>r.gamePk===bad[i]).reason,expected[i])
    assert.deepEqual(preserved.scope,scope)
    pass('Mixed slate durably blocks missing/changed starter, started, wrong identity and post-freeze evidence before predictions')
    const count=async table=>Number((await db.query(`select count(*)::int n from ${table} where game_pk=any($1::bigint[])`,[scope])).rows[0].n)
    assert.equal(await count('pick2_game_predictions'),0)
    await runtime.release();authority=makeAuthority();runtime=newClient()
    assert.equal((await runtime.acquire({runId:'r11-r1-next-instance',mode:'PREGAME'})).status,'ACQUIRED')
    assert.equal(runtime.run.run_id,runId)
    const second=await configure()
    const result=await second.execute()
    assert.equal(result.predictions.rows.length,8)
    assert.equal(result.predictions.inserted,8)
    assert.equal(result.markets.mappings.rows.length,8)
    assert.equal(result.markets.observations.rows.length,16)
    assert.equal(result.values.rows.length,16)
    for(const rows of [result.predictions.rows,result.markets.mappings.rows,result.markets.observations.rows,result.values.rows,result.picks.rows])assert.ok(rows.every(r=>!bad.includes(r.game_pk)&&scope.includes(r.game_pk)))
    assert.equal(oddsRequests,1)
    pass('Independent runtime resumes eight valid games through predictions, mappings, observations, values and unchanged Policy V1')
    const accounting=runtime.accounting(),calls=providerRequests,cp=runtime.run.checkpoint
    const again=await second.execute()
    assert.equal(again.insertedRows,0)
    assert.deepEqual(runtime.accounting(),accounting)
    assert.deepEqual(runtime.run.checkpoint,cp)
    assert.equal(providerRequests,calls);assert.equal(oddsRequests,1)
    pass('Second pass reuses deterministic rows with zero additional provider requests or inserts')
    assert.ok(preserved.references.every(ref=>runtime.run.checkpoint.references.some(current=>sha256(current)===sha256(ref))))
    pass('Frozen scope and all original evidence references survive per-game exclusion and cross-instance resume')
    const malicious={...runtime.run.checkpoint,gameVetoes:[]}
    await assert.rejects(()=>runtime.checkpoint(malicious,{stages:runtime.run.dml_accounting.stages}),/GAME_VETO_REGRESSION/)
    assert.throws(()=>validateCheckpoint({...cp,gameVetoes:[{...cp.gameVetoes[0],gamePk:900000000}]}),/GAME_VETO_SHAPE/)
    for(const table of ['pick2_game_predictions','pick2_mlb_market_event_mappings','pick2_mlb_market_price_observations','pick2_mlb_market_value_evaluations','pick2_mlb_official_picks']) {
      const example=table==='pick2_game_predictions'?replay.predictions[0]:table==='pick2_mlb_market_event_mappings'?result.markets.mappings.rows[0]:table==='pick2_mlb_market_price_observations'?result.markets.observations.rows[0]:table==='pick2_mlb_market_value_evaluations'?result.values.rows[0]:result.picks.rows[0]
      const identity=table==='pick2_game_predictions'?'deterministic_identity':table==='pick2_mlb_market_event_mappings'?'provider_event_id':table==='pick2_mlb_market_price_observations'?'observation_identity':table==='pick2_mlb_market_value_evaluations'?'value_identity':'official_pick_identity'
      const row=example?Object.fromEntries(Object.entries({...example,game_pk:bad[0]}).filter(([k])=>!['id','created_at'].includes(k))):{[identity]:'isolated-blocked-pick',game_pk:bad[0]}
      await assert.rejects(()=>performFencedWrite({query:async()=>{throw Error('SQL_BEFORE_VETO')},run:runtime.run,write:{table,rows:[row],cap:1},columnsByTable,clock:{at,date:freeze.run_date}}),/GAME_VETO_WRITE_BLOCKED/)
    }
    pass('Edge transaction authority rejects veto removal, scope escape and every downstream write target before SQL')
    // A later veto preserves existing market evidence but prevents that target
    // from re-entering values/policy after another instance restores the run.
    const remaining=contexts.filter(c=>!bad.includes(c.target.gamePk)).map(c=>c.target.gamePk)
    const late=pk=>({gamePk:pk,reason:'CURRENT_STARTER_CHANGE_VETO',stage:'values',at,evidenceDigest:sha256('ISOLATED_LATE_VETO')})
    await second.store.recordGameVetoes([late(remaining[0])])
    const beforeLate=runtime.accounting(),callsBeforeLate=providerRequests
    await runtime.release();authority=makeAuthority();runtime=newClient();await runtime.acquire({runId:'r11-r1-late-instance',mode:'PREGAME'})
    const third=await configure(),lateResult=await third.execute()
    assert.equal(lateResult.predictions.rows.length,7);assert.equal(lateResult.values.rows.length,14)
    assert.equal(lateResult.insertedRows,0);assert.deepEqual(runtime.accounting(),beforeLate)
    assert.equal(providerRequests,callsBeforeLate);assert.equal(oddsRequests,1)
    assert.equal(await count('pick2_game_predictions'),8)
    assert.equal(await count('pick2_mlb_market_value_evaluations'),16)
    pass('Later durable veto excludes one target on cross-instance market restore without deleting committed predictions or values')
    await third.store.recordGameVetoes(remaining.slice(1).map(late))
    const empty=await third.execute()
    assert.equal(empty.status,'NO_VALID_PREGAME_SLATE')
    assert.equal(empty.blockedGames.length,15)
    assert.equal(providerRequests,callsBeforeLate);assert.equal(oddsRequests,1)
    pass('All targets vetoed terminate cleanly without reacquisition or new downstream writes')
    for(const c of contexts)assert.ok(Date.parse(c.target.observationTimestamp)<=Date.parse(freeze.run_as_of))
    for(const snapshot of replay.generated.rows.snapshots)assert.ok(Date.parse(snapshot.created_at)<=Date.parse(freeze.run_as_of)&&Date.parse(snapshot.as_of_timestamp)<=Date.parse(freeze.run_as_of))
    pass('Frozen matrix uses only pre-freeze native and snapshot evidence; missing historical veto remains unknown')
    assert.equal(gameVetoClassification('R2TR1_BLOCK:STARTER_MISSING'),'BLOCK_MISSING_STARTER')
    assert.equal(gameVetoClassification('NEW_CANONICAL_EVIDENCE_AFTER_RUN_FREEZE'),'BLOCK_POST_FREEZE_EVIDENCE')
    const report={status:'PASS',checks,eligible:8,durableVetoes:5,initialExcluded:2,predictions:8,mappings:8,observations:16,values:16,picks:result.picks.rows.length,secondPassInserts:0,providerCalls:0,productionDml:0,productionDdl:0,injectedOfficialRequests:providerRequests,injectedOddsRequests:oddsRequests,historicalVeto:'UNRECOVERABLE_HISTORICAL_VETO_DETAIL'}
    if(operationalOdds) {
      assert.equal((await authority({op:'inspect'})).operationalBudget.consumed,1)
      assert.equal((await db.query("SELECT mission_odds_calls FROM pick2_mlb_runtime_state WHERE state_kind='MISSION'")).rows[0].mission_odds_calls,20)
      pass('R12 operational ledger owns the single injected acquisition; historical 20 remains unchanged through real R2 partial-slate resume')
    }
    fs.writeFileSync(path.join(root,operationalOdds?'r12-partial-slate-validation.json':'r11-r1-local-validation.json'),JSON.stringify(report,null,2))
    console.log(JSON.stringify(report))
    return report
  } finally {if(runtime?.locked)await runtime.release();globalThis.fetch=savedFetch;await objects.close()}
}
