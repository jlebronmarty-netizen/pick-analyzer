// Disposable PG17 database. Reproduce the production default ACL and a membership grant.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {Client}=(await import(process.env.NBA_SHEET_TEST_PG_MODULE??'pg')).default;
const db=new Client({host:'127.0.0.1',port:Number(process.env.NBA_SHEET_TEST_PORT??55438),user:'postgres',database:'postgres'});
const sql=(s,p)=>db.query(s,p);
const migration=name=>fs.readFileSync(new URL('../supabase/migrations/'+name+'.sql',import.meta.url),'utf8');
const views=['nba_sheet_accuracy_v1','nba_sheet_performance_v1','nba_sheet_pending_v1','nba_sheet_pending_games_v1'];
const fix=migration('202611260903_nba_sheet_view_acl');
await db.connect();
try{
 assert.equal((await sql("select to_regclass('public.nba_cheat_snapshots_v1') t")).rows[0].t,null);
 await sql('begin;create role anon;create role authenticated;create role service_role bypassrls;create role inherited_test');
 await sql('alter default privileges in schema public grant truncate,references,trigger,maintain on tables to service_role,anon,authenticated');
 for(const name of ['202611240901_nba_cheat_snapshots','202611260901_nba_sheet_tracker_guard','202611260902_nba_sheet_performance'])await sql(migration(name));
 for(const v of views)assert.equal((await sql("select has_table_privilege('service_role',$1,'TRIGGER') extra",[v])).rows[0].extra,true);
 await sql('grant inherited_test to service_role;grant trigger on nba_sheet_pending_v1 to inherited_test;savepoint inherited');
 await assert.rejects(sql(fix),/Unexpected table privilege/);await sql('rollback to inherited;revoke trigger on nba_sheet_pending_v1 from inherited_test');
 await sql('grant select on nba_sheet_performance_v1 to service_role with grant option');
 await sql(fix);await sql(fix);
 for(const role of ['service_role','anon','authenticated']){
  await sql('set local role '+role);
  for(const v of views){
   if(role==='service_role')assert.equal((await sql('select * from '+v+' limit 1')).rowCount,0);
   else {await sql('savepoint denied');await assert.rejects(sql('select * from '+v),/permission denied/);await sql('rollback to denied');}
  }
  await sql('reset role');
 }
 const tables=(await sql("select relname,relrowsecurity from pg_class where oid in ('nba_cheat_snapshots_v1'::regclass,'nba_sheet_grades_v1'::regclass,'nba_sheet_entries_v1'::regclass)")).rows;
 assert.equal(tables.length,3);assert.ok(tables.every(t=>t.relrowsecurity));
 console.log('PASS four invoker views, inherited privilege rejection, no grant option, private roles and repeated migration');
}finally{await sql('rollback');await db.end();}
