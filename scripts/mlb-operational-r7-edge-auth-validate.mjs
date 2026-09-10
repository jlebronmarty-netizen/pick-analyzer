// Verify the published candidate's actual auth handler with disposable adapters.
import vm from 'node:vm'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {timingSafeEqual} from 'node:crypto'
import ts from 'typescript'
const packageSha='be19887e3eb9f9f60359e89a81ee34e490c9ffe1'
const source=execFileSync('git',['show',`${packageSha}:supabase/functions/mlb-runtime-state/index.ts`],{encoding:'utf8'}).replace(/^import .*\n/gm,'')
let handler,connections=0,operations=0
const env={SUPABASE_SERVICE_ROLE_KEY:'ISOLATED_SERVER_CREDENTIAL',SUPABASE_URL:'https://ynuocvexviorgdjrfthw.supabase.co',SUPABASE_DB_URL:'ISOLATED_DATABASE',SUPABASE_SECRET_KEYS:'{}'}
const context=vm.createContext({Response,URL,TextEncoder,TextDecoder,timingSafeEqual,EVIDENCE_LIMIT:4194304,columnsByTable:{},Deno:{env:{get:k=>env[k]},serve:fn=>{handler=fn}},postgres:()=>{connections++;return {end:async()=>{}}},createEvidenceStorage:()=>({}),assertEvidenceAccess:async()=>{},assertRuntimeSchema:async()=>{},performFencedWrite:()=>{throw Error('UNEXPECTED_WRITE')},createRuntimeStateAuthority:()=>async command=>{operations++;assert.equal(command.op,'inspect');return {rows:[]}}})
vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,context)
const request=auth=>new Request('https://fixture.invalid',{method:'POST',headers:{'content-type':'application/json',...(auth?{authorization:auth}:{})},body:JSON.stringify({op:'inspect'})})
for(const auth of [null,'Bearer wrong','Bearer ISOLATED_PUBLIC_KEY']){
  assert.equal((await handler(request(auth))).status,401)
  assert.equal(connections,0);assert.equal(operations,0)
}
const valid=await handler(request('Bearer ISOLATED_SERVER_CREDENTIAL'))
assert.equal(valid.status,200);assert.equal(operations,1)
const body=await valid.text();assert.ok(!body.includes('ISOLATED_SERVER_CREDENTIAL'));assert.ok(!body.includes('ISOLATED_DATABASE'))
console.log(JSON.stringify({status:'PUBLISHED_R7_EDGE_AUTH_PASS',packageSha,missingToken:401,wrongToken:401,publicKey:401,serverOnlyInspect:200,unauthorizedDatabaseConnections:0,providerCalls:0,productionDml:0,productionDdl:0}))
