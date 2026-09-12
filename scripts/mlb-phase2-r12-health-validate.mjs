import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import ts from 'typescript'
const fixed=Date.parse('2026-09-12T16:00:00Z'),checks=[]
async function evaluate({status='COMPLETE',budget=null,edgeVersion=14,unavailable=false}) {
  const run={run_id:'isolated-run',package_sha:'a'.repeat(40),run_date:'2026-09-12',run_as_of:'2026-09-12T15:50:00Z',updated_at:'2026-09-12T15:59:00Z',status,dml:[],scope:[],blocked:[],result:{status:'COMPLETE'},mlb_official_calls:1,statcast_calls:0,odds_calls:0}
  const source=fs.readFileSync('src/services/pick2-mlb-health.service.ts','utf8').replace(/^import .*\r?\n/gm,'').replace('export async function','async function')
  let requests=0
  const context=vm.createContext({Date:class extends Date{static now(){return fixed}},JSON,Number,Array,Object,AbortSignal,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://isolated.invalid',SUPABASE_SERVICE_ROLE_KEY:'ISOLATED_SERVER_ONLY',VERCEL_GIT_COMMIT_SHA:'b'.repeat(40)}},MLB_CHAMPION:'UNCHANGED_CHAMPION',MLB_POLICY:'UNCHANGED_POLICY',MLB_OPERATIONAL_JOB_TYPE:'job',getMlbOperationalView:async()=>({date:'2026-09-12',games:[],board:{rows:[]},warnings:[]}),getMlbOfficialPerformance:async()=>({status:'NO_SETTLED_SAMPLE'}),fs:{readFile:async p=>JSON.stringify(p.includes('MISSION_STATUS')?{providerAccounting:{runs:[]}}:{activation:'ENABLED'})},supabaseAdmin:{from:table=>{
    let selected='';const chain={select:()=>chain,eq:(_k,v)=>{selected=v;return chain},order:()=>chain,limit:async()=>({data:table==='sports_sync_jobs'?[]:selected==='MLB_OPERATIONAL_MISSION'?[{mission_odds_calls:20}]:selected==='MLB_OPERATIONAL_GLOBAL'?[{lease_expires_at:null}]:[run],error:null})};return chain
  }},fetch:async(url,options)=>{
    requests++;assert.equal(url,'https://isolated.invalid/functions/v1/mlb-runtime-state');assert.deepEqual(JSON.parse(options.body),{op:'inspect'})
    if(unavailable)throw Error('ISOLATED_UNAVAILABLE')
    return {ok:true,json:async()=>({status:'PASS',protocol:'MLB_R6_FENCED_RUNTIME_V1',result:{edgeVersion,operationalBudget:budget,rows:[{private:'MUST_NOT_LEAK'}]}})}
  }})
  vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,context)
  const result=await vm.runInContext('getMlbOperationalHealth()',context)
  assert.equal(requests,1);assert.ok(!JSON.stringify(result).includes('ISOLATED_SERVER_ONLY'));assert.ok(!JSON.stringify(result).includes('MUST_NOT_LEAK'))
  return result
}
const budget={version:'MLB_ODDS_OPERATIONAL_BUDGET_V1',activation:'ACTIVE',day:'2026-09-12',timezone:'America/Puerto_Rico',cap:48,perRunCap:1,consumed:2,remaining:46,observedCredits:null,unknownCreditRequests:2}
let result=await evaluate({budget})
assert.equal(result.budgets.historicalCertification.consumed,20);assert.equal(result.budgets.operationalDaily.consumed,2);assert.equal(result.budgets.operationalDaily.observedCredits,null)
assert.equal(result.deployment.webDeploymentSha,'b'.repeat(40));assert.equal(result.deployment.frozenExecutionPackageSha,'a'.repeat(40));assert.equal(result.deployment.edgeVersion,14)
assert.equal(result.automation.observedHealth,'OBSERVED_RECENT_COMPLETION');checks.push('Distinct runtime/web SHAs and historical/daily accounting; unknown credits stay unknown')
result=await evaluate({status:'FAILED',budget});assert.equal(result.automation.activation,'ENABLED');assert.equal(result.automation.observedHealth,'BLOCKED_FAILED_RUN');checks.push('Configured ENABLED never conceals a failed current run')
assert.equal((await evaluate({budget:{...budget,consumed:48,remaining:0}})).automation.observedHealth,'DEGRADED_ODDS_BUDGET_EXHAUSTED');checks.push('Daily exhaustion is degraded even after a successful unrelated mode')
result=await evaluate({unavailable:true});assert.equal(result.automation.observedHealth,'RUNTIME_UNAVAILABLE');assert.equal(result.deployment.edgeVersion,null);assert.equal(result.budgets.operationalDaily.activation,'UNVERIFIED');checks.push('Unavailable runtime never invents Edge version or active counters')
console.log(JSON.stringify({status:'R12_HEALTH_PASS',checks,providerCalls:0,productionDml:0,productionDdl:0}))
