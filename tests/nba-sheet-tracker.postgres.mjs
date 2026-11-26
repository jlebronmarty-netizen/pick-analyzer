// Execute in a fresh, isolated database. The fixture schema is rolled back.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {Client}=(await import(process.env.NBA_SHEET_TEST_PG_MODULE??'pg')).default;
const client=new Client({host:'127.0.0.1',port:Number(process.env.NBA_SHEET_TEST_PORT??55438),user:'postgres',database:'postgres'});
await client.connect();
const query=(s,p)=>client.query(s,p),base='public.nba_cheat_snapshots_v1';
async function rejects(sql,values=[],pattern){
 await query('savepoint attempt');await assert.rejects(query(sql,values),pattern);await query('rollback to attempt');await query('release attempt');
}
try{
 assert.equal((await query("select to_regclass('public.nba_cheat_snapshots_v1') x")).rows[0].x,null);
 await query('begin');await query('create role service_role bypassrls;create role authenticated;create role anon;');
 for(const file of ['202611240901_nba_cheat_snapshots.sql','202611260901_nba_sheet_tracker_guard.sql'])await query(fs.readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 await query('set local role service_role');
 const future=new Date(Date.now()+1600).toISOString(),old=new Date(Date.now()-3600000).toISOString(),id='a'.repeat(64);
 const card={quoteId:'q',statistic:'points',period:'FT',start:future,expires:future,captured:old};
 const payload={version:'NBA_SHEET_LAB_V1',method:'rate',band:'-250',scope:'general',cards:[card]};
 const insert='insert into '+base+'(snapshot_id,day_local,captured_at,expires_at,payload) values($1,current_date,$2,$3,$4) on conflict(snapshot_id) do nothing returning captured_at';
 const args=[id,old,future,payload];const first=await query(insert,args);assert.ok(+first.rows[0].captured_at>Date.parse(old));assert.equal((await query(insert,args)).rowCount,0);
 await rejects(insert,['b'.repeat(64),old,future,{...payload,cards:[{...card,start:old}]}],/pregame only/);
 await rejects('update '+base+' set day_local=current_date',[],/permission|immutable/);await rejects('delete from '+base,[],/permission|immutable/);
 await rejects("insert into nba_sheet_grades_v1 values($1,'q','win',10,null)",[id],/unstarted contract/);
 for(const role of ['anon','authenticated']){
  await query('reset role;set local role '+role);
  for(const rel of [base,'nba_sheet_grades_v1','nba_sheet_accuracy_v1'])await rejects('select * from '+rel,[],/permission denied/);
 }
 await query('reset role');
 await query('reset role;set local role service_role');
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,Date.parse(future)-Date.now()+50)));
 await query("insert into nba_sheet_grades_v1(snapshot_id,quote_id,result,value) values($1,'q','win',10)",[id]);
 await rejects("insert into nba_sheet_grades_v1(snapshot_id,quote_id,result,value) values($1,'q','win',10)",[id],/duplicate/);
 await rejects("insert into nba_sheet_grades_v1(snapshot_id,quote_id,result,value) values($1,'other','win',10)",[id],/unmatched/);
 const row=(await query('select * from nba_sheet_accuracy_v1')).rows[0];assert.equal(Number(row.accuracy),1);assert.equal(Number(row.pairs),0);assert.equal(Number(row.decided),1);
 console.log('PASS PostgreSQL: cutoff, server clock, idempotence, append-only, private roles, grade identity, accuracy and empty pairs');
}finally{await query('rollback');await client.end();}
