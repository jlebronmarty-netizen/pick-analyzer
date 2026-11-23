import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {materializerFixture} from './fixtures/nba-archived-player-materializer.mjs';
import {prepareArchivedPlayerMaterialization} from '../src/lib/nba/archived-player-materializer-core.mjs';

// Compile the real service; replace only module locations for standalone Node tests.
let source=readFileSync(new URL('../src/services/nba-archived-player-materialization.service.ts',import.meta.url),'utf8')
 .replace("import 'server-only';",'').replaceAll(/'@\/([^']+)'/g,(_,path)=>JSON.stringify(new URL('../src/'+path,import.meta.url).href))
 .replace("'@supabase/supabase-js'",JSON.stringify(import.meta.resolve('@supabase/supabase-js')));
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {materializeNbaArchivedPlayerHistory:run}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));

function transport(fixtures,{corrupt=false,partial=[],loseResponse=false,preexistingObject=false}={}){
 const tables={sports_sync_jobs:[],nba_game_context_v2:fixtures.map(f=>f.context),nba_goat_season_archive_v1:[],
  nba_market_schedules_v1:[fixtures[0]?.schedule].filter(Boolean).map(s=>({...s,payload:{data:{games:fixtures.map(f=>f.schedule.payload.data.games[0])}}})),
  nba_goat_player_game_research_v1:partial.map(id=>({season:2026,provider_game_id:id,player_id:1}))};
 const objects=new Map(),calls={queries:0,upload:0,download:0,rpc:0};
 if(preexistingObject)for(const f of fixtures){const p=prepareArchivedPlayerMaterialization(f);objects.set(p.manifest.storage_object_path,p.compressed);}
 class Query{
  constructor(table){this.table=table;this.filters=[];this.orders=[];this.max=Infinity;this.kind='select';}
  select(){return this;}insert(value){this.kind='insert';this.value=structuredClone(value);return this;}
  update(value){this.kind='update';this.value=structuredClone(value);return this;}
  eq(k,v){this.filters.push(r=>r[k]===v);return this;}neq(k,v){this.filters.push(r=>r[k]!==v);return this;}
  gte(k,v){this.filters.push(r=>r[k]>=v);return this;}lte(k,v){this.filters.push(r=>r[k]<=v);return this;}
  not(k,op,v){this.filters.push(r=>r[k]!==v);return this;}order(k,{ascending=true}={}){this.orders.push([k,ascending]);return this;}
  limit(n){this.max=n;return this;}single(){this.one=true;return this;}abortSignal(signal){assert.ok(signal);return this;}
  then(resolve,reject){return Promise.resolve().then(()=>{
   calls.queries++;const all=tables[this.table];assert.ok(all,this.table);
   if(this.kind==='insert'){
    if(all.some(r=>r.id===this.value.id))return {error:{code:'23505'}};
    all.push({...this.value,records_inserted:0});return {data:null,error:null};
   }
   let rows=all.filter(r=>this.filters.every(f=>f(r)));
   if(this.kind==='update'){for(const row of rows)Object.assign(row,this.value);return {error:null};}
   rows.sort((a,b)=>{for(const [key,asc] of this.orders){if(a[key]<b[key])return asc?-1:1;if(a[key]>b[key])return asc?1:-1;}return 0;});
   rows=rows.slice(0,this.max);return {data:structuredClone(this.one?rows[0]:rows),error:null};
  }).then(resolve,reject);}
 }
 const db={from:table=>new Query(table),storage:{from:bucket=>{
  assert.equal(bucket,'nba-goat-2026-private');return {
   upload:async(path,bytes,options)=>{calls.upload++;assert.equal(options.upsert,false);if(objects.has(path))return {error:{statusCode:'409'}};objects.set(path,Buffer.from(bytes));return {error:null};},
   download:async path=>{calls.download++;const bytes=Buffer.from(objects.get(path));if(corrupt)bytes[Math.floor(bytes.length/2)]^=1;return {data:new Blob([bytes]),error:null};}
  };
 }},rpc:(name,args)=>({abortSignal:async signal=>{
  calls.rpc++;assert.ok(signal);assert.equal(name,'materialize_nba_archived_player_game_v1');
  const job=tables.sports_sync_jobs.find(j=>j.id===args.p_job_id);
  if(job.metadata.materialized_games.length>=3)return {error:{message:'NBA_MATERIALIZER_CYCLE_CAP'}};
  const p=JSON.parse(args.p_payload_text),count=p.data.length;
  job.records_inserted+=count;job.metadata.materialized_games.push({provider_game_id:args.p_game_id,rows:count,source_sha256:args.p_response_sha256});
  tables.nba_goat_season_archive_v1.push({provider_game_id:args.p_game_id,season:p.data[0].game.season,dataset_key:'player_stats',game_date:p.data[0].game.date});
  return loseResponse?{error:{message:'NETWORK_LOST_AFTER_COMMIT'}}:{data:{status:'MATERIALIZED',inserted_rows:count},error:null};
 }})};
 return {db,tables,calls,objects};
}
const now=new Date('2026-11-23T00:00:00.000Z');
test('disabled or exhausted cron budget performs no I/O',async()=>{
 const port=transport([]);assert.equal((await run({db:port.db,enabled:false,now})).status,'DISABLED');
 assert.equal((await run({db:port.db,enabled:true,budgetMs:1000,now})).status,'DEFERRED_CRON_BUDGET');
 assert.deepEqual(port.calls,{queries:0,upload:0,download:0,rpc:0});
});
test('materializes validated archive, records invalid one, and does not claim a second invocation',async()=>{
 const good=materializerFixture(700001),bad=materializerFixture(700002);bad.context.player_stats.data[0].pts--;
 const port=transport([good,bad]);const result=await run({db:port.db,enabled:true,now});
 assert.equal(result.materializedGames,1);assert.equal(result.insertedRows,12);assert.equal(result.skipped.length,1);
 assert.equal(result.providerCalls,0);assert.equal(port.calls.rpc,1);assert.equal(port.tables.sports_sync_jobs[0].status,'partial');
 assert.equal((await run({db:port.db,enabled:true,now})).status,'ALREADY_CLAIMED');assert.equal(port.calls.rpc,1);
});
test('partial existing compact is never repaired implicitly',async()=>{
 const port=transport([materializerFixture()],{partial:[700001]});const result=await run({db:port.db,enabled:true,now});
 assert.equal(result.materializedGames,0);assert.match(result.skipped[0].reason,/EXISTING_PARTIAL/);
 assert.equal(port.calls.upload,0);assert.equal(port.calls.rpc,0);
});
test('corrupt stored object blocks the RPC even when byte count is unchanged',async()=>{
 const port=transport([materializerFixture()],{corrupt:true,preexistingObject:true});const result=await run({db:port.db,enabled:true,now});
 assert.equal(result.materializedGames,0);assert.equal(port.calls.download,1);assert.equal(port.calls.rpc,0);
 assert.match(result.skipped[0].reason,/OBJECT_READBACK_FAILED/);
});
test('existing immutable object is verified and reused after a prior interrupted upload',async()=>{
 const port=transport([materializerFixture()],{preexistingObject:true});const before=Buffer.from([...port.objects.values()][0]);
 const result=await run({db:port.db,enabled:true,now});assert.equal(result.materializedGames,1);
 assert.deepEqual([...port.objects.values()][0],before);assert.equal(port.calls.download,1);
});
test('server ledger wins after lost RPC responses, preserving the cap and durable counts',async()=>{
 const port=transport([700001,700002,700003,700004].map(id=>materializerFixture(id)),{loseResponse:true});
 const result=await run({db:port.db,enabled:true,now});assert.equal(result.materializedGames,3);assert.equal(result.insertedRows,36);
 assert.equal(result.remainingArchivedContexts,1);assert.equal(port.tables.sports_sync_jobs[0].records_inserted,36);
});
test('bounded scanning rotates past invalid records instead of starving later archived games',async()=>{
 const fixtures=Array.from({length:13},(_,i)=>materializerFixture(700001+i));
 for(const f of fixtures.slice(0,12))f.context.player_stats.data[0].pts--;
 const port=transport(fixtures),first=await run({db:port.db,enabled:true,now});
 assert.equal(first.considered,12);assert.equal(first.materializedGames,0);
 const second=await run({db:port.db,enabled:true,now:new Date(now.getTime()+1800000)});
 assert.equal(second.materializedGames,1);assert.equal(second.insertedRows,12);assert.ok(second.considered<=12);
});
