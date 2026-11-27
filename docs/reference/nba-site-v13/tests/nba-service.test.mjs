import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createNbaService} from '../src/nba-service.mjs';
const origin='https://private.example',now='2026-11-24T16:00:00Z';
const digest=s=>createHash('sha256').update(s).digest('hex');
const svc=()=>createNbaService({hash:digest,serviceAuthorized:async r=>r.headers.get('test-service')==='yes'});
const fixture={id:123,home:{name:'Casa'},away:{name:'Visita'},state:'scheduled',scheduledAt:'2026-11-24T23:00:00Z'};
const report={schemaVersion:'NBA_MANUAL_DATA_V1',sport:'NBA',timezone:'America/Puerto_Rico',date:'2026-11-24',readAt:now,source:{scheduleCapturedAt:now},status:'PARTIAL',readOnly:true,providerCalls:0,databaseWrites:0,modelPromoted:false,predictionAdjustment:false,fixtures:[fixture],finals:[],teams:[],players:[],warnings:[],periods:[],injuries:[],lineups:[],matchups:[],coverage:{fixtures:1,observedFinals:0,players:0,periodGames:0,injuries:0,lineups:0,matchupRows:0}};
function memory(){
 const values=new Map();return {get:async k=>{const s=values.get(k);return s?{etag:digest(s),json:async()=>JSON.parse(s)}:null;},
 put:async(k,s,{onlyIf:c})=>{const old=values.get(k);if(c.etagDoesNotMatch==='*'?old:(!old||digest(old)!==c.etagMatches))return null;values.set(k,s);return {etag:digest(s)};}};
}
const call=(env,p,data,h={},time=now)=>svc()(new Request(origin+'/api/nba/'+p,{method:data?'POST':'GET',headers:{'content-type':'application/json',...h},body:data?JSON.stringify(data):undefined}),env,time);
const user={origin,'oai-authenticated-user-id':'persona'},service={'test-service':'yes'};
test('ingest, readback, private tracker across clients, settlement and retries',async()=>{
 const env={BUCKET:memory()};
 assert.equal((await call(env,'refresh',report)).status,403);
 assert.equal((await call(env,'refresh',{...report,providerCalls:1},service)).status,422);
 const receipt=await (await call(env,'refresh',report,service)).json();assert.equal(receipt.readback,'VERIFIED');
 assert.equal((await (await call(env,'refresh',report,service)).json()).sha256,receipt.sha256);
 const pick={gameId:'123',market:'spread',side:'away',line:3.5,sha:receipt.sha256};
 assert.equal((await call(env,'tracker',pick)).status,401);
 assert.equal((await call(env,'tracker',pick,{...user,origin:'https://other.example'})).status,403);
 assert.equal((await call(env,'tracker',{...pick,sha:'old'},user)).status,409);
 for(let i=0;i<2;i++)assert.equal((await call(env,'tracker',pick,user)).status,200);
 assert.equal((await call(env,'tracker',{...pick,side:'home'},user)).status,409);
 assert.equal((await call(env,'tracker',{...pick,market:'ml',line:null},user,fixture.scheduledAt)).status,409);
 const before=await (await call(env,'tracker',null,user)).json();assert.equal(before.records.length,1);assert.equal(before.accuracy,null);
 const other=await (await call(env,'tracker',null,{'oai-authenticated-user-id':'otra'})).json();assert.equal(other.records.length,0);
 const next='2026-11-25T16:00:00Z';
 const later={...report,date:next.slice(0,10),readAt:next,fixtures:[],finals:[{gameId:'123',home:'Casa',away:'Visita',scheduledAt:fixture.scheduledAt,homeScore:98,awayScore:96}],coverage:{...report.coverage,fixtures:0,observedFinals:1}};
 assert.equal((await call(env,'refresh',later,service,next)).status,200);
 const after=await (await call(env,'tracker',null,user,next)).json();assert.equal(after.accuracy,1);assert.equal(after.records[0].result,'Acierto');
 assert.equal((await (await call(env,'snapshot?date=2026-11-24',null,user,next)).json()).sha256,receipt.sha256);
});
test('push, loss and pending keep their denominators across independent requests',async()=>{
 const env={BUCKET:memory()};
 const snap=await (await call(env,'refresh',report,service)).json();
 for(const [market,side,line] of [['spread','away',2],['total','under',194],['ml','away',null]]){
  assert.equal((await call(env,'tracker',{gameId:'123',market,side,line,sha:snap.sha256},user)).status,200);
 }
 assert.equal((await (await call(env,'tracker',null,user)).json()).records.every(r=>r.result==='Pendiente'),true);
 const later='2026-11-25T16:00:00Z',final={gameId:'123',scheduledAt:fixture.scheduledAt,home:'Casa',away:'Visita',homeScore:98,awayScore:96};
 assert.equal((await call(env,'refresh',{...report,date:'2026-11-25',readAt:later,fixtures:[],finals:[final],coverage:{...report.coverage,fixtures:0,observedFinals:1}},service,later)).status,200);
 const settled=await (await call(env,'tracker',null,user,later)).json();
 assert.deepEqual(settled.records.map(r=>r.result).sort(),['Fallo','Push','Push']);assert.equal(settled.accuracy,0);
});
