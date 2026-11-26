// Exercise the scheduled settler and the actual ledger, pending queue and reporting views.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {settlePending} from '../src/lib/nba/sheet-lab/scheduler.mjs';
import {evidence} from './fixtures/nba-sheet-settlement.mjs';
const {Client}=(await import(process.env.NBA_SHEET_TEST_PG_MODULE??'pg')).default;
const db=new Client({host:'127.0.0.1',port:Number(process.env.NBA_SHEET_TEST_PORT??55438),user:'postgres',database:'postgres'});
await db.connect();
const sql=(q,p)=>db.query(q,p);
const ledger={from(table){
 if(table==='nba_sheet_grades_v1')return {async upsert(rows,options){
  assert.deepEqual(options,{onConflict:'snapshot_id,quote_id',ignoreDuplicates:true});
  for(const r of rows)await sql('insert into nba_sheet_grades_v1(snapshot_id,quote_id,result,value,pick_result) values($1,$2,$3,$4,$5) on conflict do nothing',
   [r.snapshot_id,r.quote_id,r.result,r.value,r.pick_result]);
  return {error:null};
 }};
 assert.ok(['nba_sheet_pending_games_v1','nba_sheet_pending_v1'].includes(table));
 let game;
 return {select(){return this},order(){return this},eq(key,id){assert.equal(key,'game_id');game=id;return this},
  async range(start,end){
   const r=table==='nba_sheet_pending_games_v1'
    ?await sql('select game_id,day_local from nba_sheet_pending_games_v1 order by game_id limit $1 offset $2',[end-start+1,start])
    :await sql('select snapshot_id,quote_id,recorded_at,card from nba_sheet_pending_v1 where game_id=$1 order by snapshot_id,quote_id limit $2 offset $3',[game,end-start+1,start]);
   return {data:r.rows.map(e=>e.recorded_at?{...e,recorded_at:e.recorded_at.toISOString()}:e)};
  }};
}};
try{
 assert.equal((await sql("select to_regclass('public.nba_cheat_snapshots_v1') t")).rows[0].t,null);
 await sql('begin;create role anon;create role authenticated;create role service_role bypassrls');
 for(const f of ['202611240901_nba_cheat_snapshots.sql','202611260901_nba_sheet_tracker_guard.sql','202611260902_nba_sheet_performance.sql'])
  await sql(fs.readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 await sql('set local role service_role');
 const start=new Date(Date.now()+1500).toISOString(),captured=new Date(Date.now()-5000).toISOString();
 const card={quoteId:'q',gameId:1,playerId:1,statistic:'rebounds',period:'FT',book:'FanDuel',side:'under',ot:'INCLUDES_OT',line:4.5,odds:-200,
  start,captured,expires:start,original:{recordedAt:captured,quoteId:'pick',side:'over',odds:110}};
 await sql("insert into nba_cheat_snapshots_v1(snapshot_id,day_local,expires_at,payload) values($1,current_date,$2,$3)",['c'.repeat(64),start,{version:'NBA_SHEET_LAB_V1',method:'rate',scope:'general',band:'-250',cards:[card]}]);
 await new Promise(r=>setTimeout(r,Math.max(0,Date.parse(start)-Date.now()+30)));
 const ev=evidence(start,new Date().toISOString()),player=ev.context.player_stats.data[0];
 const tick=()=>settlePending(ledger,new Date(),async()=>ev);
 const report=async()=>(await sql("select * from nba_sheet_performance_v1 where rank_type='position' and rank_n=1 and grain='all' and market is null and period is null and side is null")).rows[0];
 player.reb=-1;assert.equal((await tick()).attempted,0);
 assert.equal((await sql('select count(*) n from nba_sheet_grades_v1')).rows[0].n,'0');
 let row=await report();assert.equal(+row.contracts,1);assert.equal(+row.pending,1);
 for(const field of ['wins','losses','decided','stake_units','pairs','priced_pairs'])assert.equal(+row[field],0,field);
 for(const field of ['accuracy','roi','won_units','lost_units','net_units','paired_sheet_accuracy','paired_pick_accuracy','paired_sheet_roi','paired_pick_roi'])assert.equal(row[field],null,field);
 player.reb=4;ev.context.player_stats_captured_at=new Date().toISOString();
 assert.equal((await tick()).attempted,1);assert.equal((await tick()).attempted,0);
 row=await report();assert.equal(+row.contracts,1);assert.equal(+row.pending,0);assert.equal(+row.decided,1);assert.equal(+row.accuracy,1);
 assert.equal(+row.stake_units,1);assert.equal(+row.net_units,.5);assert.equal(+row.roi,.5);
 assert.equal(+row.pairs,1);assert.equal(+row.priced_pairs,1);assert.equal(+row.paired_pick_accuracy,0);assert.equal(+row.paired_pick_roi,-1);
 console.log('PASS pending -> corrected evidence -> one grade; no pending units, decisions or pairs');
}finally{await sql('rollback');await db.end();}
