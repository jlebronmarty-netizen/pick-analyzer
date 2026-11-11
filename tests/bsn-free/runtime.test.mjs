import test from 'node:test';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {runBsnArchive,getBsnArchiveHealth} from '../../src/services/bsn-archive.service.mjs';
import {BASE,BATCH_SOURCE} from '../../scripts/bsn-free/archive-contract.mjs';
const store={rows:[],calls:0,status:200,providerError:false};
function reset(){store.rows=[];store.calls=0;store.status=200;store.providerError=false;process.env.BSN_APISPORTS_KEY='isolated-bsn-test-key';}
globalThis.__bsnDb={
 from(){
  return {select(){let id=null;return {eq(k,v){if(k==='id')id=v;return this;},order(){return this;},async range(){return {error:null,data:store.rows.map(r=>({...r,code:r.evidence?.code}))};},async single(){return {error:null,data:store.rows.find(r=>r.id===id)};}};},
   insert(row){return {select(){return {async single(){if(store.rows.some(x=>x.slot===row.slot))return {error:{code:'23505'}};const r={...row,id:store.rows.length+1,state:'RUNNING'};store.rows.push(r);return {error:null,data:r};}};}};}};
 },
 async rpc(_,p){assert.deepEqual(p.p_forecasts,[]);assert.deepEqual(p.p_results,[]);Object.assign(store.rows.find(x=>x.id===p.p_run),{state:p.p_state,evidence:p.p_evidence});return {error:null};}
};
globalThis.fetch=async(url,options)=>{
 store.calls++;assert.equal(options.redirect,'manual');assert.equal(options.headers['x-apisports-key'],'isolated-bsn-test-key');
 assert.equal(store.rows.at(-1).state,'RUNNING');assert.equal(store.rows.at(-1).source,url);
 const response=url.includes('/leagues?')?[{id:76,country:{code:'PR'},seasons:Array.from({length:12},(_,i)=>({season:2015+i}))}]:[];
 return new Response(JSON.stringify({errors:store.providerError?{plan:'unavailable'}:[],results:response.length,response}),{status:store.status});
};
const opts={clock:new Date('2026-11-11T02:00:00Z'),pause:async()=>{}};
test('missing key has no claims or calls',async()=>{reset();delete process.env.BSN_APISPORTS_KEY;assert.equal((await runBsnArchive(opts)).status,'MISSING');assert.equal(store.rows.length,0);});
test('resumable catalogue/season captures retain replayable bodies and no secrets in health',async()=>{
 reset();const r=await runBsnArchive(opts);assert.equal(r.providerCalls,4);assert.equal(store.calls,4);
 assert.equal((await runBsnArchive(opts)).providerCalls,0);
 const row=store.rows.find(x=>x.source===BASE+'/leagues?id=76');
 assert.equal(JSON.parse(gunzipSync(Buffer.from(row.evidence.payloadGzip,'base64'))).response[0].id,76);
 const h=await getBsnArchiveHealth();assert.equal(h.modelActive,false);assert.equal(h.reservedToday,20);
 assert.ok(!JSON.stringify(h).includes('isolated-bsn-test-key'));assert.ok(!JSON.stringify(h).includes('payloadGzip'));
});
test('denials halt with no subsequent retry and no prediction writes',async()=>{
 reset();store.status=403;assert.equal((await runBsnArchive(opts)).providerCalls,1);
 assert.equal((await runBsnArchive({...opts,clock:new Date('2026-11-12T02:00:00Z')})).status,'SOURCE_OR_QUOTA_REVIEW_REQUIRED');assert.equal(store.calls,1);
});
test('200 provider error preserves raw and halts; crash requires review',async()=>{
 reset();store.providerError=true;const r=await runBsnArchive(opts);assert.equal(r.failures,1);assert.ok(store.rows[1].evidence.payloadGzip);
 reset();store.rows.push({id:1,state:'RUNNING',source:BATCH_SOURCE,slot:opts.clock.toISOString()});
 assert.equal((await runBsnArchive(opts)).status,'INTERRUPTED_RECEIPT_REQUIRES_REVIEW');assert.equal(store.calls,0);
});
test('three slots bound daily budget even if queues remain',async()=>{
 reset();
 // Failed historical tasks remain preserved; never erase receipts to retry.
 store.rows.push({id:1,state:'OK',source:BATCH_SOURCE,slot:'2026-11-11T00:00:00.000Z'});
 assert.equal((await runBsnArchive(opts)).status,'BATCH_ALREADY_CLAIMED');assert.equal(store.calls,0);
});
test('large archived queue stops at 20 per batch and 60 per day without refetching successful tasks',async()=>{
 reset();
 function seed(source,body){
  const bytes=Buffer.from(JSON.stringify({errors:[],results:body.length,response:body}));
  store.rows.push({id:store.rows.length+1,source,state:'OK',slot:'2026-11-10T00:00:00.00'+store.rows.length+'Z',evidence:{sha256:createHash('sha256').update(bytes).digest('hex'),payloadGzip:gzipSync(bytes).toString('base64')}});
 }
 seed(BASE+'/leagues?id=76',[{id:76,country:{code:'PR'},seasons:[{season:2024}]}]);
 const games=Array.from({length:740},(_,i)=>({id:i+1,date:'2024-04-04T00:00:00Z',timestamp:1712188800,league:{id:76,season:2024},status:{short:'FT'},teams:{home:{id:1,name:'A'},away:{id:2,name:'B'}},scores:{home:{total:90},away:{total:80}}}));
 seed(BASE+'/games?league=76&season=2024',games);
 for(const hour of ['02','10','18']){
  const r=await runBsnArchive({...opts,clock:new Date('2026-11-11T'+hour+':00:00Z')});assert.equal(r.providerCalls,20);
 }
 assert.equal(store.calls,60);
 assert.equal((await runBsnArchive({...opts,clock:new Date('2026-11-11T23:00:00Z')})).providerCalls,0);
 assert.equal(store.calls,60);
 const urls=store.rows.filter(r=>r.source!==BATCH_SOURCE).map(r=>r.source);
 assert.equal(new Set(urls).size,urls.length);
});
test('verified V1 season denial narrows the queue without rewriting receipts or retrying blocked years',async()=>{
 reset();
 const root={id:1,slot:'2026-11-11T00:00:00.000Z',source:BATCH_SOURCE,state:'ERROR',evidence:{code:'PROVIDER_REPORTED_ERRORS'}};
 function receipt(id,source,body,code=null){
  const bytes=Buffer.from(JSON.stringify(body));
  return {id,slot:new Date(Date.parse(root.slot)+id-1).toISOString(),source,state:code?'ERROR':'OK',evidence:{code,sha256:createHash('sha256').update(bytes).digest('hex'),payloadGzip:gzipSync(bytes).toString('base64')}};
 }
 const old=[root,
  receipt(2,BASE+'/leagues?id=76',{errors:[],results:1,response:[{id:76,country:{code:'PR'},seasons:Array.from({length:12},(_,i)=>({season:2015+i}))}]}),
  receipt(3,BASE+'/games?league=76&season=2024',{errors:[],results:0,response:[]}),
  receipt(4,BASE+'/games?league=76&season=2025',{parameters:{league:'76',season:'2025'},errors:{plan:'Free plans do not have access to this season, try from 2022 to 2024.'},results:0,response:[]},'PROVIDER_REPORTED_ERRORS')];
 store.rows.push(...structuredClone(old));
 const h=await getBsnArchiveHealth();assert.deepEqual(h.accessibleSeasons,[2022,2023,2024]);assert.deepEqual(h.targetSeasons,[2022,2023,2024]);assert.deepEqual(h.planExcludedSeasons,[]);assert.equal(h.planDeniedRequests,1);assert.equal(h.remainingTasks,2);assert.equal(h.games,0);
 const r=await runBsnArchive({...opts,clock:new Date('2026-11-11T10:00:00Z')});assert.equal(r.providerCalls,2);assert.equal(r.status,'BATCH_CAPTURED');
 assert.deepEqual(store.rows.slice(0,4),old);
 assert.deepEqual(store.rows.slice(5).map(r=>r.source),[2023,2022].map(y=>BASE+'/games?league=76&season='+y));
});
