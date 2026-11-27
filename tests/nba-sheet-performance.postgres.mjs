// Run on a disposable, empty loopback Postgres. All test objects are rolled back.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {Client}=(await import(process.env.NBA_SHEET_TEST_PG_MODULE??'pg')).default;
const db=new Client({host:'127.0.0.1',port:Number(process.env.NBA_SHEET_TEST_PORT??55438),user:'postgres',database:'postgres'});
await db.connect();const sql=(s,v)=>db.query(s,v);
const rel='nba_sheet_performance_v1';
try{
 assert.equal((await sql("select to_regclass('public.nba_cheat_snapshots_v1') t")).rows[0].t,null);
 await sql('begin;create role anon;create role authenticated;create role service_role bypassrls');
 for(const f of ['202611240901_nba_cheat_snapshots.sql','202611260901_nba_sheet_tracker_guard.sql','202611260902_nba_sheet_performance.sql'])
  await sql(fs.readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 await sql('set local role service_role');
 const start=new Date(Date.now()+1600).toISOString(),captured=new Date(Date.now()-5000).toISOString();
 const cards=Array.from({length:10},(_,i)=>({quoteId:'q'+i,gameId:1,playerId:i+1,statistic:'points',period:'FT',book:'FanDuel',side:i%2?'under':'over',ot:'INCLUDES_OT',line:10,odds:[200,-120,-150,-180,-110,-100,-200,-200,110,-120][i],
  start,captured,expires:start,original:i===0?{recordedAt:captured,odds:-150}:null}));
 const insert=async(id,method,rows)=>sql("insert into nba_cheat_snapshots_v1(snapshot_id,day_local,expires_at,payload) values($1,current_date,$2,$3) on conflict do nothing",[id.repeat(64),start,{version:'NBA_SHEET_LAB_V1',method,scope:'general',band:'-250',cards:rows}]);
 await insert('a','rate',cards);await insert('a','rate',cards);
 await insert('b','rate',cards.toReversed().map(c=>({...c,odds:105,quoteId:c.quoteId+'revision'})));
 await insert('c','gap',cards);assert.equal((await sql('select count(*) n from nba_sheet_entries_v1')).rows[0].n,'20');
 const first=(await sql("select position,odds from nba_sheet_entries_v1 where methodology='rate' and quote_id='q0'")).rows[0];
 assert.deepEqual(first,{position:1,odds:200});
 await new Promise(r=>setTimeout(r,Math.max(0,Date.parse(start)-Date.now()+30)));
 for(const [i,result] of ['win','loss','push','dnp','void',null,'win','loss','win','loss'].entries())if(result)await sql('insert into nba_sheet_grades_v1(snapshot_id,quote_id,result,value,pick_result) values($1,$2,$3,$4,$5)',['a'.repeat(64),'q'+i,result,['win','loss','push'].includes(result)?10:null,i===0?'loss':null]);
 const result=async(type,n,grain='all',extra='market is null and period is null and side is null')=>(await sql('select * from '+rel+" where methodology='rate' and scope='general' and band=-250 and rank_type=$1 and rank_n=$2 and grain=$3 and "+extra,[type,n,grain])).rows[0];
 for(const grain of ['day','week','month','all']){
  for(const n of [1,3,5,7,10])assert.equal(Number((await result('top',n,grain)).contracts),n);
  for(let n=1;n<=10;n++)assert.equal(Number((await result('position',n,grain)).contracts),1);
  const top=await result('top',10,grain);assert.equal(+top.decided,6);assert.equal(+top.stake_units,7);assert.equal(+top.won_units,3.6);assert.equal(+top.lost_units,3);assert.equal(+top.net_units,.6);assert.ok(Math.abs(+top.roi-.6/7)<1e-12);
  assert.equal(+top.pairs,1);assert.equal(+top.paired_sheet_accuracy,1);assert.equal(+top.paired_pick_accuracy,0);assert.equal(+top.paired_sheet_roi,2);assert.equal(+top.paired_pick_roi,-1);
  assert.equal(+(await result('top',10,grain,"market='points' and period='FT' and side='under'")).contracts,5);
 }
 assert.equal(Number((await sql('select count(*) n from nba_sheet_pending_v1')).rows[0].n),11);
 for(const role of ['authenticated','anon']){
  await sql('reset role;set local role '+role+';savepoint access_test');
  await assert.rejects(sql('select * from '+rel),/permission denied/);await sql('rollback to access_test');
 }
 console.log('PASS positions 1–10, overlapping tiers, four time windows, separate strategies, revised prices, stake, units, pairs, RLS');
}finally{await sql('rollback');await db.end();}
