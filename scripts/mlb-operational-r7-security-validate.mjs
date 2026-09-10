import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {assertEvidenceAccess,createEvidenceStorage,EVIDENCE_BUCKET,EVIDENCE_LIMIT} from '../supabase/functions/_shared/mlb-provider-evidence.mjs'
const checks=[]
const check=async(name,fn)=>{await fn();checks.push({name,status:'PASS'})}
await check('Evidence access requires RLS and no public/client object policies',async()=>{
  await assertEvidenceAccess(async()=>[{rls:true,policies:0}])
  for(const row of [{rls:false,policies:0},{rls:true,policies:1}])await assert.rejects(assertEvidenceAccess(async()=>[row]),/EVIDENCE_PUBLIC_ACCESS/)
})
await check('Storage preflight rejects public or unbounded buckets',async()=>{
  const correct={id:EVIDENCE_BUCKET,public:false,file_size_limit:EVIDENCE_LIMIT,allowed_mime_types:['application/json']}
  for(const patch of [{public:true},{file_size_limit:null},{allowed_mime_types:null}]){
    const store=createEvidenceStorage({url:'https://ynuocvexviorgdjrfthw.supabase.co',key:'ISOLATED_TEST_CREDENTIAL',fetchImpl:async()=>Response.json({...correct,...patch})})
    await assert.rejects(store.preflight(),/EVIDENCE_BUCKET_CONTRACT/)
  }
})
await check('Object transport forbids overwrite and arbitrary paths',async()=>{
  const calls=[]
  const store=createEvidenceStorage({url:'https://ynuocvexviorgdjrfthw.supabase.co',key:'ISOLATED_TEST_CREDENTIAL',fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json({})}})
  await store.create(`${'a'.repeat(40)}/fixture/odds.json`,{version:1})
  assert.equal(calls[0].options.method,'POST');assert.equal(calls[0].options.headers['x-upsert'],'false')
  await assert.rejects(store.create('../escape',{}),/EVIDENCE_PATH/)
  assert.equal(calls.length,1)
})
await check('Legacy MLB route blocks acquisitions before any planner or database access',async()=>{
  const source=fs.readFileSync('src/app/api/cron/operating-day/route.ts','utf8')
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
  const context=vm.createContext({exports:{},process:{env:{CRON_SECRET:'ISOLATED_CRON'}},Response,console,require:name=>{
    if(name==='@/lib/api-contract')return {requestId:()=> 'isolated-request',apiOk:(body,id)=>Response.json({...body,requestId:id}),apiError:({status})=>Response.json({status:'UNAUTHORIZED'},{status})}
    if(name==='@/config/mlb-operating-day-scheduler')return {MLB_OPERATING_DAY_SCHEDULER_GRACE_MINUTES:2,MLB_OPERATING_DAY_WRITE_SCHEDULER_INTERVAL_MINUTES:10}
    if(name==='@/lib/supabase-admin')return {supabaseAdmin:new Proxy({},{get(){throw Error('UNEXPECTED_DATABASE_ACCESS')}})}
    throw Error('UNEXPECTED_MODULE')
  }})
  vm.runInContext(code,context)
  for(const method of ['GET','POST']){
    const request={method,headers:new Headers({authorization:'Bearer ISOLATED_CRON'}),nextUrl:new URL('https://fixture.invalid/api/cron/operating-day?dryRun=false&scheduler=github-fallback')}
    const response=await context.exports[method](request),body=await response.json()
    assert.equal(response.status,200);assert.equal(body.mode,'MLB_LEGACY_WRITER_DISABLED');assert.equal(body.providerCallsMade,0);assert.equal(body.writes,0)
  }
})
console.log(JSON.stringify({status:'R7_SECURITY_PASS',checks,providerCalls:0,productionDml:0,productionDdl:0}))
