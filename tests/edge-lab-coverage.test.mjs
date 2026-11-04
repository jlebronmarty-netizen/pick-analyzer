import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {readTtPagination,normalizeTtResultPage,makeProviderPacer,multiOperationalState} from '../src/lib/edge-lab/tt-coverage.mjs';
const page={page:1,limit:20,total:65,totalPages:4,hasNextPage:true};
test('Root pagination is recognized',()=>{const p=readTtPagination(page,20,{expectedPage:1});assert.equal(p.verified,true);assert.equal(p.layout,'TOP_LEVEL');assert.equal(p.hasNextPage,true);assert.equal(p.limit,20);assert.equal(p.complete,false);});
test('Nested legacy pagination is recognized',()=>{const p=readTtPagination({pagination:page},20);assert.equal(p.layout,'NESTED');assert.equal(p.hasNextPage,true);});
test('Second page uses returned page identity',()=>assert.equal(readTtPagination({...page,page:2},20,{expectedPage:2}).page,2));
test('Last page completeness',()=>assert.equal(readTtPagination({...page,page:4,hasNextPage:false},5).complete,true));
test('Missing metadata never means all data recovered',()=>{const p=readTtPagination({},16);assert.equal(p.verified,false);assert.equal(p.complete,false);assert.equal(p.hasNextPage,null);});
test('Empty confirmed archive valid',()=>assert.equal(readTtPagination({page:1,limit:20,total:0,totalPages:0,hasNextPage:false},0).complete,true));
test('Unpaged league board requires matching total',()=>{const p=readTtPagination({total:73},73,{allowUnpaged:true});assert.equal(p.verified,true);assert.equal(p.complete,true);assert.equal(p.layout,'UNPAGED_TOTAL');});
test('Truncated unpaged board is not complete',()=>{const p=readTtPagination({total:74},73,{allowUnpaged:true});assert.equal(p.verified,false);assert.equal(p.complete,false);});
test('Unpaged declaration not accepted for paginated results',()=>assert.equal(readTtPagination({total:20},20).verified,false));
for(const [label,body,count,options] of [
 ['conflicting envelopes',{...page,pagination:{...page,hasNextPage:false}},20,{}],
 ['wrong response page',{...page,page:2},20,{expectedPage:1}],
 ['wrong boolean',{...page,hasNextPage:'true'},20,{}],
 ['bad limit',{...page,limit:0},20,{}],
 ['missing declared rows',{...page,limit:19},20,{}],
 ['impossible total',{...page,total:5},20,{}],
 ['false next despite more pages',{...page,hasNextPage:false},20,{}],
 ['next after final page',{...page,page:4},5,{}],
 ['negative total',{...page,total:-1},0,{}],
 ['unsafe page',{...page,page:Infinity},20,{}]
])test('Reject '+label,()=>assert.throws(()=>readTtPagination(body,count,options)));
test('Unknown nested boolean rejected',()=>assert.throws(()=>readTtPagination({pagination:{hasNextPage:null}},0)));
test('Normalized result keeps top-level coverage',()=>{const b={...page,results:[]};const r=normalizeTtResultPage(b,'2026-11-04T23:00:00Z',1);assert.equal(r.paginationVerified,true);assert.equal(r.hasNextPage,true);assert.equal(r.rows.length,0);});
test('Conflicting normalized pages fail before import',()=>assert.throws(()=>normalizeTtResultPage({...page,results:[]},'2026-11-04T23:00:00Z',2)));
test('Provider requests spaced without changing call count',async()=>{let now=0;const sleeps=[],calls=[];const paced=makeProviderPacer({clock:()=>now,sleep:async ms=>{sleeps.push(ms);now+=ms;}});for(let i=0;i<3;i++)await paced(async()=>{calls.push(now);now+=20;});assert.deepEqual(calls,[0,1220,2440]);assert.deepEqual(sleeps,[1200,1200]);});
test('Failed request also paced before next attempt',async()=>{let now=0;const delays=[];const paced=makeProviderPacer({clock:()=>now,sleep:async ms=>{delays.push(ms);now+=ms;}});await assert.rejects(()=>paced(async()=>{throw Error('TEST');}));await paced(async()=>true);assert.deepEqual(delays,[1200]);});
test('Enough elapsed time causes no extra delay',async()=>{let now=0;const delays=[];const paced=makeProviderPacer({clock:()=>now,sleep:async ms=>delays.push(ms)});await paced(async()=>true);now=1500;await paced(async()=>true);assert.equal(delays.length,0);});
const run={status:'PARTIAL',summary:{history_finals:16,status_counts:{FORECAST:0,PROJECTION:0,ABSTAIN:174}}};
test('Cold start distinguished from source failure',()=>{const s=multiOperationalState('TT',run,{next_due:'2026-11-05T07:10:00Z'},false);assert.equal(s.state,'WARMUP');assert.equal(s.coverage_status,'PARTIAL');assert.equal(s.history_finals,16);assert.equal(s.last_run,run);});
test('Failed process not mislabeled warmup',()=>assert.equal(multiOperationalState('TT',{...run,status:'FAILED'},null,false).state,'FAILED'));
test('MLB pause visible while preserving old successful run',()=>{const old={status:'SUCCESS'};const s=multiOperationalState('MLB',old,null,true);assert.equal(s.state,'OFFSEASON_PAUSED');assert.equal(s.last_run,old);});
test('Never-run explicit',()=>assert.equal(multiOperationalState('TT',null,null,false).state,'NOT_RUN'));
test('Existing budget and two result page ceiling preserved',()=>{const s=readFileSync(new URL('../src/services/edge-lab-multi.service.mjs',import.meta.url),'utf8');assert.match(s,/page<=2/);assert.match(s,/edge_lab_tt_claim_request_v1/);assert.match(s,/MLB_OFFSEASON_PAUSED==='true'/);assert.match(s,/await paced\(\(\)=>paidRead\(db,request,'prematch'/);});
