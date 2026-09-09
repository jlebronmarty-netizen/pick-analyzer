// Offline HTTP/host wiring validation. No credentials or production transport.
import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import {timingSafeEqual} from 'node:crypto'
import ts from 'typescript'
const checks=[]
const check=async(name,fn)=>{await fn();checks.push({name,status:'PASS'})}
let calls=[]
const env={CRON_SECRET:'ISOLATED_CRON_TEST',VERCEL_GIT_COMMIT_SHA:'a'.repeat(40)}
const route=fs.readFileSync('src/app/api/cron/mlb-operational/route.ts','utf8').replace(/^import .*\n/gm,'').replaceAll('export ','')
const context=vm.createContext({Buffer,Response,URL,process:{env},timingSafeEqual,executeProductionTick:async args=>{calls.push(args);return {status:args.hostDry?'HOST_DRY_PASS':'COMPLETE'}}})
vm.runInContext(ts.transpileModule(route,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,context)
const get=vm.runInContext('GET',context),post=vm.runInContext('POST',context)
const request=(method='GET',path='',auth='Bearer ISOLATED_CRON_TEST',body)=>new Request(`https://production.invalid/api/cron/mlb-operational${path}`,{method,headers:{authorization:auth},...(body?{body}: {})})
await check('Missing and incorrect Cron credentials reject without executor calls',async()=>{
  for(const value of ['', 'Bearer wrong'])assert.equal((await get(request('GET','',value))).status,401)
  assert.equal(calls.length,0)
})
await check('Caller-selected scope, dates or request payload reject',async()=>{
  assert.equal((await get(request('GET','?game_pk=1'))).status,400)
  assert.equal((await post(request('POST','','Bearer ISOLATED_CRON_TEST','{}'))).status,400)
  assert.equal(calls.length,0)
})
await check('Cron GET invokes the sole coordinator with deployed package only',async()=>{
  assert.equal((await get(request())).status,200)
  assert.equal(calls[0].packageSha,env.VERCEL_GIT_COMMIT_SHA);assert.equal(calls[0].hostDry,false)
})
await check('Authenticated dry POST selects provider-free host probe',async()=>{
  const response=await post(request('POST'));assert.equal((await response.json()).status,'HOST_DRY_PASS');assert.equal(calls[1].hostDry,true)
})
await check('Production empty POST stream invokes dry host; nonempty stream rejects',async()=>{
  const make=bytes=>new Request('https://production.invalid/api/cron/mlb-operational',{method:'POST',headers:{authorization:'Bearer ISOLATED_CRON_TEST'},body:new ReadableStream({start(controller){if(bytes)controller.enqueue(new Uint8Array([1]));controller.close()}}),duplex:'half'})
  const before=calls.length
  assert.equal((await post(make(false))).status,200)
  assert.equal(calls.length,before+1)
  assert.equal(calls.at(-1).hostDry,true)
  assert.equal((await post(make(true))).status,400)
  assert.equal(calls.length,before+1)
})
await check('Unexpected errors cannot expose credentials or raw evidence',async()=>{
  context.executeProductionTick=async()=>{throw Error('ISOLATED_PRIVATE_VALUE')}
  const response=await get(request());assert.equal(response.status,503);assert.equal((await response.json()).reason,'MLB_OPERATIONAL_EXECUTION_BLOCKED')
})
const host=fs.readFileSync('scripts/mlb-operational-r6-vercel-runtime.mjs','utf8').replace(/^import .*\n/gm,'').replaceAll('export ','')
const hostContext=vm.createContext({Intl,Date,process:{env:{VERCEL:'1',VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_SHA:'a'.repeat(40)}}})
vm.runInContext(host,hostContext)
const execute=vm.runInContext('executeVercelProductionTick',hostContext),modes=vm.runInContext('scheduledModes',hostContext)
await check('Preview and package mismatch cannot reach schema/provider/database work',async()=>{
  await assert.rejects(execute({packageSha:'a'.repeat(40),hostDry:true}),/FROZEN_DEPLOYMENT/)
  hostContext.process.env.VERCEL_ENV='production'
  await assert.rejects(execute({packageSha:'b'.repeat(40),hostDry:true}),/FROZEN_DEPLOYMENT/)
})
await check('Puerto Rico cadence preserves initialization pregame incremental postgame overnight modes',()=>{
  assert.deepEqual([...modes('2026-09-10T08:00:00Z')],['OVERNIGHT'])
  assert.deepEqual([...modes('2026-09-10T12:00:00Z')],['INITIALIZE','INCREMENTAL','POSTGAME'])
  assert.deepEqual([...modes('2026-09-10T12:15:00Z')],['PREGAME','INCREMENTAL'])
})
const result={status:'PASS',checks,providerCalls:0,productionDml:0,productionDdl:0,productionHostInvocation:'PENDING_EDGE_DEPLOYMENT_APPROVAL'}
if(process.env.R2S_VALIDATION_DIR)fs.writeFileSync(`${process.env.R2S_VALIDATION_DIR}/r6-host-validation.json`,JSON.stringify(result,null,2))
console.log(JSON.stringify(result))
