import assert from 'node:assert/strict';
import fs from 'node:fs';
const {Client}=(await import(process.env.NBA_SHEET_TEST_PG_MODULE??'pg')).default;
const db=new Client({host:'127.0.0.1',port:Number(process.env.NBA_SHEET_TEST_PORT??55438),user:'postgres',database:'postgres'});
await db.connect();
const run=async q=>(await db.query(q)).rows;
try {
 await run('begin; create role anon; create role authenticated; create role service_role bypassrls');
 await run(fs.readFileSync(new URL('../research/nhl-sheet-tracker/lab.sql',import.meta.url),'utf8'));
 const insert=`insert into nhl_sheet_lab.entries(event_id,subject,method,market,period,side,line,book,rule_id,band,odds,position,quoted_at,starts_at)
 values('g','team','frequency','total','REG','over',5,'test','test',-250,-125,1,now(),now()+interval '1.5 seconds') on conflict do nothing`;
 await run(insert); await run(insert);
 assert.equal((await run('select count(*) as n from nhl_sheet_lab.entries'))[0].n,'1');
 assert.equal((await run("select bool_and(relrowsecurity) ok from pg_class where oid in ('nhl_sheet_lab.entries'::regclass,'nhl_sheet_lab.grades'::regclass)"))[0].ok,true);
 for(const table of ['entries','grades','pick_receipts','performance']){
  for(const role of ['anon','authenticated','service_role']){
   for(const priv of ['SELECT','UPDATE','INSERT','DELETE','TRUNCATE','REFERENCES','TRIGGER','SELECT WITH GRANT OPTION'])
    assert.equal((await run(`select has_table_privilege('${role}','nhl_sheet_lab.${table}','${priv}') ok`))[0].ok,role==='service_role'&&priv==='SELECT');
  }
 }
 const perf="select * from nhl_sheet_lab.performance where rank_type='top' order by rank_n";
 const pending=await run(perf);
 assert.equal(pending.length,5); assert.equal(pending[0].accuracy,null);assert.equal(Number(pending[0].stake_units),0);
 await run("insert into nhl_sheet_lab.pick_receipts(event_id,subject,market,period,side,line,book,rule_id,odds,starts_at) select event_id,subject,market,period,side,line,book,rule_id,-110,starts_at from nhl_sheet_lab.entries");
 await run('savepoint early');
 await assert.rejects(run("insert into nhl_sheet_lab.grades values(1,'win','early')"),/has not started/);
 await run('rollback to early');await run('select pg_sleep(1.55)');
 await run("insert into nhl_sheet_lab.grades values(1,'win','offline-fixture')");
 const win=(await run(perf))[0];
 assert.deepEqual([win.accuracy,win.roi,win.stake_units,win.net_units,win.equivalent_decisions].map(Number),[1,.8,1,.8,1]);
 await run('savepoint immutable'); await assert.rejects(run('delete from nhl_sheet_lab.entries'),/immutable/);await run('rollback to immutable');
 console.log('NHL isolated enrollment, ACL, RLS, immutability and duplicate checks passed');
} finally {await run('rollback');await db.end();}
