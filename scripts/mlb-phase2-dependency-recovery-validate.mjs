// Offline replay of privately captured production-shaped reads; no live fetch.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {createClient} from '@supabase/supabase-js'
import {createPregameReadRepository} from './mlb-data-02r-r2t-r1-read-repository.mjs'
import {resolvePregameTarget,resolveStarterContext} from './mlb-data-02r-r2t-r1-pregame-contract.mjs'
import {streamR2NStatcastRowsForGames} from './mlb-data-02h-2026-current-foundation.mjs'
import {sanitizedStageException} from './mlb-operational-r7-errors.mjs'
import {createRuntimeStateAuthority,reviewDigest} from '../supabase/functions/_shared/mlb-runtime-state.mjs'
import {sha256} from './mlb-data-02r-r2f-stage-contracts.mjs'
const root=process.env.R2S_VALIDATION_DIR
assert.ok(root&&path.isAbsolute(root))
const cache=JSON.parse(fs.readFileSync(path.join(root,'phase2-dependency-read-cache.json')))
const checks=[],check=async(name,fn)=>{await fn();checks.push({name,status:'PASS'})}
const base='https://ynuocvexviorgdjrfthw.supabase.co'
const replay=createClient(base,'OFFLINE_REPLAY_ONLY',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,o={})=>{
  const e=cache.entries.find(e=>e.url===String(url).replace(base,'')&&e.method===(o.method??'GET'))
  assert.ok(e,'UNCAPTURED_READ_NO_NETWORK');return new Response(e.body||null,{status:e.status,headers:e.headers})
}}})
let plans
await check('Exact five-game production-shaped dependency inventory replays without providers',async()=>{
  const {data:games,error}=await replay.from('pick2_mlb_games').select('*').eq('game_date','2026-09-10').order('scheduled_at');assert.ok(!error)
  plans=[]
  for(const native of games){const target=resolvePregameTarget({native,runAsOf:'2026-09-10T14:30:10.243Z',eligibleGamePks:games.map(g=>g.game_pk)}),starters=resolveStarterContext(target)
    const p=await createPregameReadRepository(replay).readDependencies(target,starters,{inventoryMissing:true,inventoryOnly:true})
    plans.push({gamePk:native.game_pk,starters:{home:starters.home.mlbam_pitcher_id,away:starters.away.mlbam_pitcher_id},dependencyCount:p.dependencyGamePks.length,cachedRows:p.exactCounts.reduce((n,g)=>n+g.count,0),missing:p.missingGameDates})
  }
  assert.deepEqual(plans,cache.plans);assert.equal(plans.length,5)
})
const missing=[...new Map(plans.flatMap(p=>p.missing).map(g=>[g.gamePk,g])).values()]
const dates=[...new Set(missing.map(g=>g.gameDate))].sort()
const emptyDb={from(){return {select(){return this},eq(){return this},order(){return this},limit(){return Promise.resolve({data:[],error:null,count:0})}}}}
const args={eligibleGamePks:missing.map(g=>g.gamePk),dependencyDates:dates,runAsOf:'2026-09-10T14:30:10.243Z',db:emptyDb,teamMap:new Map([['HME','home'],['AWY','away']]),cacheDir:null,providerBudget:{STATCAST:{maxCalls:2}}}
const collect=async fetchImpl=>{const rows=[];for await(const batch of streamR2NStatcastRowsForGames({...args,fetchImpl}))rows.push(...batch);return rows}
await check('Injected shared-engine CSV yields exactly scoped games within two-date budget',async()=>{
  let calls=0
  const rows=await collect(async url=>{calls++;const date=new URL(url).searchParams.get('game_date_gt');return new Response('game_pk,game_date,pitcher,batter,at_bat_number,pitch_number,home_team,away_team\n'+missing.filter(g=>g.gameDate===date).map(g=>`${g.gamePk},${date},100001,100002,1,1,HME,AWY`).join('\n'))})
  assert.equal(calls,2);assert.equal(rows.length,6);assert.deepEqual(rows.map(r=>r.game_pk).sort(),missing.map(g=>g.gamePk).sort())
})
await check('Malformed provider success fails closed with a durable schema classification',async()=>{
  await assert.rejects(collect(async()=>new Response('<html>Unavailable</html>')),/R2N_CSV_SCHEMA/)
  await assert.rejects(collect(async()=>new Response('game_pk,game_date,pitcher,batter,at_bat_number,pitch_number,home_team,away_team\n1,2026-09-09')),/R2N_CSV_ROW_SHAPE/)
})
await check('HTTP and transport failures retain bounded useful codes without secret text',async()=>{
  for(const status of [403,429,503])await assert.rejects(collect(async()=>new Response('',{status})),e=>sanitizedStageException(e).code===`R2N_STATCAST_HTTP_${status}`)
  await assert.rejects(collect(async()=>{throw new DOMException('PRIVATE_TOKEN','TimeoutError')}),e=>sanitizedStageException(e).code==='R2N_STATCAST_TIMEOUT')
  assert.ok(!JSON.stringify(sanitizedStageException(new Error('PRIVATE_TOKEN'))).includes('PRIVATE_TOKEN'))
})
const {PGlite}=await import(pathToFileURL(process.env.R6_PGLITE_MODULE).href),db=new PGlite()
try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;')
  await db.exec(fs.readFileSync('supabase/migrations/20260909210219_mlb_r6_durable_runtime_state.sql','utf8'))
  await db.exec('CREATE TABLE pick2_mlb_games(game_pk bigint primary key,scheduled_at timestamptz); CREATE TABLE pick2_game_predictions(id uuid,game_pk bigint,predicted_at timestamptz);')
  const authority=createRuntimeStateAuthority({transaction:fn=>db.transaction(tx=>fn(async(q,p=[])=>(await tx.query(q,p)).rows))})
  await authority({op:'initialize'})
  const holder='00000000-0000-4000-8000-000000000001',acquired=await authority({op:'acquire',holder,runId:'dependency-disposable',packageSha:'a'.repeat(40),mode:'PREGAME'})
  const token={holder,runId:acquired.run.run_id,fence:Number(acquired.lease.fence)}
  await db.exec("INSERT INTO pick2_mlb_games VALUES(100001,clock_timestamp()+interval '2 hours')")
  let run=(await authority({...token,op:'checkpoint',revision:0,checkpoint:{...acquired.run.checkpoint,scope:[100001],dependencyScope:[100002],stage:'DEPENDENCY_SCOPE',completed:['SCOPE','DEPENDENCY_SCOPE'],references:[{kind:'schedule_evidence',identity:token.runId,digest:sha256('DISPOSABLE_ONLY'),count:1,asOf:new Date(acquired.run.run_as_of).toISOString()}]},dml:{stages:[]}})).run
  await check('Actual failure operation durably records the precise Statcast code',async()=>{run=(await authority({...token,op:'fail',failure:sanitizedStageException(new Error('R2N_STATCAST_HTTP_503'))})).run;assert.equal(run.checkpoint.failure.code,'R2N_STATCAST_HTTP_503');assert.equal(run.checkpoint.failure.stage,'DEPENDENCY_SCOPE')})
  await check('Disposition requires released lease and exact review; retains failed evidence/accounting',async()=>{
    await assert.rejects(authority({op:'disposeDependencyFailure',holder,runId:run.run_id,expectedDigest:reviewDigest(run)}),/DISPOSITION_REVIEW_REQUIRED/)
    await authority({...token,op:'release'})
    await assert.rejects(authority({op:'disposeDependencyFailure',holder,runId:run.run_id,expectedDigest:'b'.repeat(64)}),/DISPOSITION_STATE_CONFLICT/)
    const before=structuredClone(run);run=(await authority({op:'disposeDependencyFailure',holder,runId:run.run_id,expectedDigest:reviewDigest(run)})).run
    assert.equal(run.status,'FAILED');assert.equal(run.checkpoint.disposition.status,'TERMINAL_PARTIAL_PRESERVED');assert.deepEqual(run.checkpoint.failure,before.checkpoint.failure);assert.deepEqual(run.dml_accounting,before.dml_accounting)
    assert.equal((await authority({op:'acquire',holder,runId:'next-genuine-freeze',packageSha:'a'.repeat(40),mode:'PREGAME'})).status,'ACQUIRED')
  })
} finally {await db.close()}
console.log(JSON.stringify({status:'PASS',checks,targets:plans.length,missingGames:missing.length,dependencyDates:dates.length,providerCalls:0,productionDml:0,productionDdl:0}))
