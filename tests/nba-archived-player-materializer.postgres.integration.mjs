// Standalone against a fresh, disposable loopback PostgreSQL database only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {materializerFixture} from './fixtures/nba-archived-player-materializer.mjs';
import {prepareArchivedPlayerMaterialization,archivedPlayerPayload,PLAYER_MATERIALIZER_VERSION} from '../src/lib/nba/archived-player-materializer-core.mjs';
const {Client}=await import(process.env.NBA_MATERIALIZER_LOCAL_PG_MODULE??'pg');
const database=process.env.NBA_MATERIALIZER_LOCAL_DATABASE;
assert.ok(/^nba_materializer_test_[a-z0-9_]+$/.test(database??''),'Disposable database name required');
const config={host:'127.0.0.1',port:Number(process.env.NBA_MATERIALIZER_LOCAL_PORT??55437),user:'postgres',
 database,password:process.env.NBA_MATERIALIZER_LOCAL_PASSWORD};
const a=new Client(config),b=new Client(config);await Promise.all([a.connect(),b.connect()]);
const scalar=async(c,sql,args=[])=>Object.values((await c.query(sql,args)).rows[0])[0];
const results=[];
const check=async(name,fn)=>{await fn();results.push(name);};
const asOf=new Date().toISOString();
const slot=Math.floor(Date.parse(asOf)/1800000),hash=createHash('sha256').update(PLAYER_MATERIALIZER_VERSION+':'+slot).digest('hex');
const job=hash.slice(0,8)+'-'+hash.slice(8,12)+'-4'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32);
function prepared(f){
 const payloadText=archivedPlayerPayload(f.context),compressed=gzipSync(Buffer.from(payloadText),{level:9});
 const responseHash=createHash('sha256').update(payloadText).digest('hex'),g=f.schedule.payload.data.games[0];
 return {payloadText,compressed,manifest:{response_sha256:responseHash,
  storage_object_path:[g.season,f.context.provider_game_id,'player_stats',responseHash+'.json.gz'].join('/'),compressed_bytes:compressed.length}};
}
async function seed(f){
 const p=prepared(f);
 await a.query('insert into public.nba_game_context_v2(game_id,provider_game_id,provider,source_version,player_stats_captured_at,player_stats) values($1,$2,$3,$4,$5,$6)',
  [f.context.game_id,f.context.provider_game_id,f.context.provider,f.context.source_version,f.context.player_stats_captured_at,f.context.player_stats]);
 await a.query('insert into public.nba_market_schedules_v1(snapshot_id,source_received_at,recorded_at,date_local,payload) values($1,$2,$3,$4,$5)',
  [f.schedule.snapshot_id,f.schedule.source_received_at,f.schedule.recorded_at,f.schedule.date_local,f.schedule.payload]);
 await a.query('insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',
  ['nba-goat-2026-private',p.manifest.storage_object_path,{size:p.compressed.length}]);
 return p;
}
async function invoke(c,f,p=prepared(f),changes={}){
 const args={p_job_id:job,p_game_id:f.context.provider_game_id,p_source_captured_at:f.context.player_stats_captured_at,
  p_schedule_snapshot_id:f.schedule.snapshot_id,p_payload_text:p.payloadText,p_response_sha256:p.manifest.response_sha256,
  p_compressed_bytes:p.compressed.length,p_as_of:asOf,...changes};
 return scalar(c,'select public.materialize_nba_archived_player_game_v1('+Object.values(args).map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(args));
}
const snapshot=()=>scalar(a,"select jsonb_build_object('manifests',(select count(*) from public.nba_goat_season_archive_v1),'compacts',(select count(*) from public.nba_goat_player_game_research_v1),'jobs',(select jsonb_agg(to_jsonb(j)) from public.sports_sync_jobs j))");
async function rejectedFixture(name,mutate,expected){
 await check(name,async()=>{
  await a.query('begin');
  try{
   const f=materializerFixture(800001,asOf);mutate(f);const p=await seed(f),before=await snapshot();
   await a.query('savepoint attempt');await a.query('set local role service_role');
   await assert.rejects(invoke(a,f,p),expected);
   await a.query('rollback to attempt');assert.deepEqual(await snapshot(),before);
  }finally{await a.query('rollback');}
 });
}
try{
 assert.equal(await scalar(a,"select to_regclass('public.nba_game_context_v2')"),null);
 await a.query("do $$ begin if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls;end if;if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;end $$");
 await a.query(`
 create schema storage;
 create table storage.objects(bucket_id text not null,name text not null,metadata jsonb,primary key(bucket_id,name));
 create table public.nba_game_context_v2(game_id text primary key,provider_game_id bigint not null,projected_lineups jsonb,projected_captured_at timestamptz,actual_lineups jsonb,actual_lineups_captured_at timestamptz,player_stats jsonb,player_stats_captured_at timestamptz,provider text not null default 'balldontlie',source_version text not null default 'NBA_CAUSAL_CONTEXT_V2',updated_at timestamptz not null default now());
 create table public.nba_market_schedules_v1(snapshot_id text primary key,source_received_at timestamptz not null,recorded_at timestamptz not null,date_local date not null,payload jsonb not null);
 create table public.sports_sync_jobs(id uuid primary key,job_type text not null,sport_key text not null,league_key text,provider text not null,status text not null default 'running',started_at timestamptz not null default now(),completed_at timestamptz,records_inserted integer not null default 0,metadata jsonb not null default '{}');
 create table public.nba_goat_season_archive_v1(season integer not null check(season between 1946 and 2100),provider_game_id bigint not null,dataset_key text not null check(length(dataset_key) between 1 and 80),provider text not null default 'balldontlie',source_captured_at timestamptz not null default now(),game_date date,response_sha256 text not null check(response_sha256~'^[a-f0-9]{64}$'),data_count integer not null check(data_count>=0),storage_bucket text not null default 'nba-goat-2026-private' check(storage_bucket='nba-goat-2026-private'),storage_object_path text not null,compressed_bytes bigint not null check(compressed_bytes>0),json_bytes bigint not null check(json_bytes>0),primary key(season,provider_game_id,dataset_key));
 create table public.nba_goat_player_game_research_v1(season integer not null check(season between 1946 and 2100),provider_game_id bigint not null,player_id bigint not null,team_id bigint,opponent_team_id bigint,game_datetime timestamptz not null,source_captured_at timestamptz not null,source_sha256 text not null check(source_sha256~'^[a-f0-9]{64}$'),minutes_played numeric not null check(minutes_played between 0 and 80),pts smallint check(pts between 0 and 200),reb smallint check(reb between 0 and 100),ast smallint check(ast between 0 and 100),fg3m smallint check(fg3m between 0 and 100),stl smallint check(stl between 0 and 100),blk smallint check(blk between 0 and 100),turnover smallint check(turnover between 0 and 100),projection_eligible boolean not null default false,materialized_at timestamptz not null default now(),primary key(season,provider_game_id,player_id));
 alter table public.nba_goat_season_archive_v1 enable row level security;
 alter table public.nba_goat_player_game_research_v1 enable row level security;
 grant usage on schema public,storage to service_role;
 grant select,update on public.nba_game_context_v2 to service_role;
 grant select on public.nba_market_schedules_v1,storage.objects to service_role;
 grant select,update on public.sports_sync_jobs to service_role;
 `);
 await a.query(readFileSync(new URL('../supabase/migrations/20261123004359_nba_archived_player_materializer_v1.sql',import.meta.url),'utf8'));
 await a.query('insert into public.sports_sync_jobs(id,job_type,sport_key,league_key,provider,metadata) values($1,$2,$3,$4,$5,$6)',
  [job,'nba_archived_player_materialization_v1','basketball_nba','nba','balldontlie',{slot,materialized_games:[]}]);
 await check('anon/authenticated cannot execute or read compact history',async()=>{
  for(const role of ['anon','authenticated']){
   await a.query('set role '+role);
   await assert.rejects(invoke(a,materializerFixture(700001,asOf)),e=>e.code==='42501');
   await assert.rejects(a.query('select * from public.nba_goat_player_game_research_v1'),e=>e.code==='42501');
   await a.query('reset role');
  }
 });
 await rejectedFixture('server rejects wrong independent score with no writes',f=>f.schedule.payload.data.games[0].home_team_score=101,/SCORE_UNRECONCILED/);
 await rejectedFixture('server rejects incomplete team minutes with no writes',f=>f.context.player_stats.data[0].min='30:00',/TEAM_TOTALS_UNRECONCILED/);
 await rejectedFixture('server rejects missing raw stat, preserving absent values',f=>delete f.context.player_stats.data[0].blk,/STAT_MISSING/);
 await rejectedFixture('server rejects DNP nonzero stat',f=>f.context.player_stats.data[5].blk=1,/STAT_INVALID/);
 await rejectedFixture('server rejects contradictory original direct/nested IDs',f=>f.context.player_stats.data[0].game.home_team_id=3,/PLAYER_IDENTITY_INVALID/);
 await rejectedFixture('server rejects contradictory independent final IDs',f=>f.schedule.payload.data.games[0].home_team_id=3,/FINAL_IDENTITY_CONFLICT/);
 await rejectedFixture('server rejects blank source version',f=>f.context.source_version=' ',/SOURCE_CHANGED_OR_UNVERIFIED/);
 await rejectedFixture('server rejects missing final date',f=>delete f.schedule.payload.data.games[0].date,/FINAL_INVALID/);
 await rejectedFixture('server rejects pagination',f=>f.context.player_stats.meta.next_cursor=123,/SOURCE_CHANGED_OR_UNVERIFIED/);
 await check('digest, object, timestamp, and source race guards are atomic',async()=>{
  await a.query('begin');
  try{
   const f=materializerFixture(800002,asOf),p=await seed(f),before=await snapshot();
   for(const changes of [{p_response_sha256:'0'.repeat(64)},{p_payload_text:p.payloadText+' '},{p_compressed_bytes:p.compressed.length+1},
    {p_as_of:new Date(Date.now()+60000).toISOString()},{p_as_of:new Date(Date.now()-180000).toISOString()},
    {p_source_captured_at:new Date(Date.parse(f.context.player_stats_captured_at)+1).toISOString()}]){
    await a.query('savepoint attempt');await a.query('set local role service_role');
    await assert.rejects(invoke(a,f,p,changes));await a.query('rollback to attempt');assert.deepEqual(await snapshot(),before);
   }
  }finally{await a.query('rollback');}
 });
 await check('partial preexisting compact fails closed without completing or overwriting it',async()=>{
  await a.query('begin');try{
   const f=materializerFixture(800003,asOf),p=await seed(f),r=prepareArchivedPlayerMaterialization(f).rows[0];
   await a.query('insert into public.nba_goat_player_game_research_v1 select * from jsonb_populate_record(null::public.nba_goat_player_game_research_v1,$1)',[{...r,materialized_at:asOf}]);
   const before=await snapshot();await a.query('savepoint attempt');await a.query('set local role service_role');
   await assert.rejects(invoke(a,f,p),/EXISTING_PARTIAL_REQUIRES_REVIEW/);await a.query('rollback to attempt');assert.deepEqual(await snapshot(),before);
  }finally{await a.query('rollback');}
 });
 await check('late SQL insert failure rolls back manifest, all compact rows and job ledger',async()=>{
  await a.query('begin');try{
   const f=materializerFixture(800004,asOf),p=await seed(f);
   await a.query("create function public.test_materializer_failure() returns trigger language plpgsql as $$begin if new.player_id="+f.context.player_stats.data.at(-1).player.id+" then raise exception 'TEST_LATE_INSERT_FAILURE';end if;return new;end$$;create trigger test_fail before insert on public.nba_goat_player_game_research_v1 for each row execute function public.test_materializer_failure()");
   const before=await snapshot();await a.query('savepoint attempt');await a.query('set local role service_role');
   await assert.rejects(invoke(a,f,p),/TEST_LATE_INSERT_FAILURE/);await a.query('rollback to attempt');assert.deepEqual(await snapshot(),before);
  }finally{await a.query('rollback');}
 });
 // Optional audit fixtures are local evidence, never bundled or requested from providers.
 if(process.env.NBA_MATERIALIZER_ARCHIVE_FIXTURES){
  const dir=process.env.NBA_MATERIALIZER_ARCHIVE_FIXTURES;
  const contexts=JSON.parse(readFileSync(dir+'/raw-identifiers.json')),
   finals=JSON.parse(readFileSync(dir+'/independent-finals-with-snapshot.json'));
  for(const context of contexts)await check('archived original '+context.provider_game_id,async()=>{
   await a.query('begin');try{
    context.player_stats_captured_at=new Date(context.player_stats_captured_at).toISOString();
    const f=finals.find(x=>x.provider_game_id===context.provider_game_id);
    const fixture={context,schedule:{...f,source_received_at:new Date(f.source_received_at).toISOString(),recorded_at:new Date(f.recorded_at).toISOString(),payload:{data:{games:[f.game]}}},asOf};
    const p=await seed(fixture);await a.query('savepoint attempt');await a.query('set local role service_role');
    if([21718140,21718158].includes(context.provider_game_id))await assert.rejects(invoke(a,fixture,p),/TEAM_TOTALS_UNRECONCILED/);
    else {const result=await invoke(a,fixture,p);assert.equal(result.inserted_rows,context.player_stats.data.length);}
   }finally{await a.query('rollback');}
  });
 }
 const fixtures=[700001,700002,700003,700004].map(id=>materializerFixture(id,asOf));
 for(const f of fixtures)await seed(f);
 const sourceBefore=await scalar(a,"select md5(jsonb_agg(to_jsonb(c) order by game_id)::text) from public.nba_game_context_v2 c");
 await check('concurrent identical commits insert once and preserve server knowledge time',async()=>{
  await a.query('set role service_role');await b.query('set role service_role');
  const responses=await Promise.all([invoke(a,fixtures[0]),invoke(b,fixtures[0])]);
  assert.deepEqual(responses.map(r=>r.status).sort(),['ALREADY_MATERIALIZED','MATERIALIZED']);
  assert.equal(await scalar(a,'select count(*)::int from public.nba_goat_player_game_research_v1'),12);
  assert.equal(await scalar(a,'select count(*)::int from public.nba_goat_player_game_research_v1 where materialized_at<=$1',[asOf]),0);
  assert.equal(await scalar(a,'select count(*)::int from public.nba_goat_player_game_research_v1 where source_captured_at=$1',[fixtures[0].context.player_stats_captured_at]),12);
  assert.equal(await scalar(a,'select bool_and(not projection_eligible) from public.nba_goat_player_game_research_v1'),true);
 });
 await check('same job serializes concurrent distinct games and enforces maximum three',async()=>{
  await Promise.all([invoke(a,fixtures[1]),invoke(b,fixtures[2])]);
  await assert.rejects(invoke(a,fixtures[3]),/CYCLE_CAP/);
  assert.equal(await scalar(a,'select count(*)::int from public.nba_goat_season_archive_v1'),3);
  assert.equal(await scalar(a,'select count(*)::int from public.nba_goat_player_game_research_v1'),36);
  assert.equal(await scalar(a,'select records_inserted from public.sports_sync_jobs where id=$1',[job]),36);
  assert.equal(await scalar(a,"select jsonb_array_length(metadata->'materialized_games') from public.sports_sync_jobs where id=$1",[job]),3);
 });
 await check('idempotent retry after cap does not rewrite history or charge budget again',async()=>{
  const before=await scalar(a,"select md5(jsonb_agg(to_jsonb(c) order by provider_game_id,player_id)::text) from public.nba_goat_player_game_research_v1 c");
  assert.equal((await invoke(a,fixtures[0])).status,'ALREADY_MATERIALIZED');
  assert.equal(await scalar(a,"select md5(jsonb_agg(to_jsonb(c) order by provider_game_id,player_id)::text) from public.nba_goat_player_game_research_v1 c"),before);
  assert.equal(await scalar(a,'select records_inserted from public.sports_sync_jobs where id=$1',[job]),36);
 });
 await a.query('reset role');await b.query('reset role');
 assert.equal(await scalar(a,"select md5(jsonb_agg(to_jsonb(c) order by game_id)::text) from public.nba_game_context_v2 c"),sourceBefore);
 console.log(JSON.stringify({postgres:await scalar(a,'select version()'),checks:results.length,passed:results,providerCalls:0},null,2));
}finally{await Promise.all([a.end(),b.end()]);}
