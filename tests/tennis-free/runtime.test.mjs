import test from 'node:test';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {runTennisSourcePreflight,getTennisSourceHealth,safeSourceError,keyHeaderIssue} from '../../src/services/tennis-source-preflight.service.mjs';
const store={rows:[],requests:0,body:null,status:200};
function reset(){store.rows=[];store.requests=0;store.status=200;store.body={hasNextPage:false,matches:[]};process.env.TENNIS_RAPIDAPI_KEY='isolated-fixture-value';process.env.VERCEL_DEPLOYMENT_ID='test-deployment';}
globalThis.__tennisPreflightDb={
 from(){
  return {select(){return {eq(){return this;},order(){return this;},limit(){return this;},async maybeSingle(){const r=store.rows.at(-1);return {data:r?{evidence:r.evidence,slot:r.slot,observed_at:r.observed_at,state:r.state}:null,error:null};}}},
   insert(row){return {select(){return {async single(){if(store.rows.some(x=>x.slot===row.slot))return {data:null,error:{code:'23505'}};const r={...row,id:store.rows.length+1};store.rows.push(r);return {data:{id:r.id},error:null};}};}};}};
 },
 async rpc(_name,params){
  assert.deepEqual(params.p_forecasts,[]);assert.deepEqual(params.p_results,[]);
  const r=store.rows.find(x=>x.id===params.p_run);Object.assign(r,{state:params.p_state,observed_at:params.p_observed,evidence:params.p_evidence});
  return {error:null,data:0};
 }
};
globalThis.fetch=async (url,options)=>{
 store.requests++;assert.equal(new URL(url).hostname,'tennis-api-atp-wta-itf.p.rapidapi.com');
 assert.equal(options.headers['X-RapidAPI-Key'],'isolated-fixture-value');assert.equal(options.redirect,'manual');
 assert.equal(store.rows.length,1); // Budget receipt precedes the external call.
 return new Response(JSON.stringify(store.body),{status:store.status,headers:{'content-type':'application/json'}});
};
test('missing credentials perform no database claim or provider call',async()=>{
 reset();delete process.env.TENNIS_RAPIDAPI_KEY;const r=await runTennisSourcePreflight();assert.equal(r.state,'KEY_REQUIRED');assert.equal(store.rows.length,0);assert.equal(store.requests,0);
});
test('one capture per UTC day, snapshot replay, no forecasts or secret in health',async()=>{
 reset();const r=await runTennisSourcePreflight();assert.equal(r.state,'SOURCE_CAPTURED_MODEL_DISABLED');assert.equal(r.schema,'CANDIDATE_SCHEMA_PASS');
 assert.equal((await runTennisSourcePreflight()).state,'PREFLIGHT_ALREADY_CLAIMED_TODAY');assert.equal(store.requests,1);
 const e=store.rows[0].evidence;
 assert.deepEqual(JSON.parse(gunzipSync(Buffer.from(e.payloadGzip,'base64'))),store.body);
 const h=await getTennisSourceHealth();assert.equal(h.modelActive,false);assert.equal(h.providerCalls,0);assert.ok(!JSON.stringify(h).includes('isolated-fixture-value'));assert.ok(!JSON.stringify(h).includes('payloadGzip'));
});
test('access denial stops further calls in the same deployment',async()=>{
 reset();store.status=403;
 assert.equal((await runTennisSourcePreflight()).state,'SOURCE_REVIEW_REQUIRED');
 assert.equal((await runTennisSourcePreflight()).state,'ACCESS_REVIEW_REQUIRED');
 assert.equal(store.requests,1);assert.equal(store.rows[0].state,'ERROR');
});
test('schema errors preserve source evidence but cannot activate a model',async()=>{
 reset();store.body={matches:[],hasNextPage:true};
 const r=await runTennisSourcePreflight();
 assert.equal(r.schema,'SOURCE_SCHEMA_OR_PAGE_INCOMPLETE');assert.equal(r.forecastsIssued,0);
 assert.equal((await getTennisSourceHealth()).status,'SOURCE_REVIEW_REQUIRED');assert.ok(store.rows[0].evidence.sha256);
});

test('safe diagnostics classify causes without revealing error messages',()=>{
 const sensitive='https://provider.invalid?key=do-not-store';
 assert.equal(safeSourceError(Object.assign(new Error(sensitive),{cause:{code:'ENOTFOUND'}})),'SOURCE_ENOTFOUND');
 assert.equal(safeSourceError(Object.assign(new Error(sensitive),{name:'TimeoutError'})),'SOURCE_TIMEOUT');
 assert.equal(safeSourceError(new TypeError(sensitive)),'SOURCE_TRANSPORT_ERROR');
});
test('malformed keys are identified without any provider call',async()=>{
 reset();process.env.TENNIS_RAPIDAPI_KEY='invalid key with newline\nvalue';
 assert.equal((await runTennisSourcePreflight()).state,'KEY_HEADER_INVALID');
 assert.equal(store.requests,0);assert.equal(store.rows.length,0);
 assert.equal((await getTennisSourceHealth()).keyFormatValid,false);
});
test('exactly one extra diagnostic preserves the failed V1 receipt',async()=>{
 reset();
 const day=new Date().toISOString().slice(0,10);
 const original={id:1,slot:day+'T00:00:00.000Z',evidence:{code:'SOURCE_FAILED',httpStatus:null,sourceVersion:'TENNIS_RAPIDAPI_PREFLIGHT_V1'}};
 store.rows.push(original);
 const savedFetch=globalThis.fetch;
 globalThis.fetch=async()=>{store.requests++;assert.equal(store.rows.length,2);return new Response(JSON.stringify(store.body),{status:200});};
 try{
  assert.equal((await runTennisSourcePreflight()).state,'SOURCE_CAPTURED_MODEL_DISABLED');
  assert.equal((await runTennisSourcePreflight()).state,'PREFLIGHT_ALREADY_CLAIMED_TODAY');
  assert.equal(store.requests,1);assert.equal(store.rows.length,2);assert.equal(store.rows[0],original);
 }finally{globalThis.fetch=savedFetch;}
});

test('header validation does not invent provider key syntax or expose characters',()=>{
 assert.equal(keyHeaderIssue('abc.def+ghi/='),null);
 assert.equal(keyHeaderIssue('short'),null);
 assert.equal(keyHeaderIssue('value with spaces'),null);
 assert.equal(keyHeaderIssue('line1\nline2'),'LINE_BREAK_IN_VALUE');
 assert.equal(keyHeaderIssue('non-http-😀'),'UNSUPPORTED_HTTP_HEADER_CHARACTER');
});
