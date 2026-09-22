import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate} from './evaluate_mlb_period_davidson_v1.mjs';
import {parseCsv} from './audit_mlb_public_snapshot_v1.mjs';
const rows=Array.from({length:680},(_,i)=>{const date=new Date(Date.UTC(2025,2,1+Math.floor(i/4))).toISOString().slice(0,10);return [2025,100000+i,date,i%3===0?1:0,i%5===0?2:0,'T'+i%4,'U'+i%4,new Date(Date.parse(date)-86400000).toISOString().slice(0,10),'STATCAST_RETROSHEET_EXACT_F1',true,'HISTORICAL_SEEN_DEVELOPMENT'];});
const probs=ps=>ps.map(({truth,...p})=>p);
test('daily batching prevents current-day/future outcomes changing earlier forecasts',()=>{
  const base=evaluate(rows,1),mut=structuredClone(rows),date=rows[520][2];
  for(const r of mut)if(r[2]===date){r[3]=9;r[4]=8;}
  const changed=evaluate(mut,1);
  assert.deepEqual(probs(base.predictions.filter(r=>r.game_date<=date)),probs(changed.predictions.filter(r=>r.game_date<=date)));
  assert.notDeepEqual(probs(base.predictions.filter(r=>r.game_date>date)),probs(changed.predictions.filter(r=>r.game_date>date)));
  assert.deepEqual(evaluate([...rows].reverse(),1),base);
});
test('duplicate, cutoff, period and external fail closed; seasons reset',()=>{
  assert.throws(()=>evaluate([...rows,rows[0]],1),/DUPLICATE/);
  assert.throws(()=>evaluate(rows,3),/LINEAGE/);
  const bad=structuredClone(rows);bad[0][7]=bad[0][2];assert.throws(()=>evaluate(bad,1),/CUTOFF/);
  bad[0][0]=2026;bad[0][2]='2026-09-20';assert.throws(()=>evaluate(bad,1),/DATE/);
  const next=[...rows[0]];next[0]=2026;next[1]=999999;next[2]='2026-03-25';next[7]='2026-03-24';
  assert.equal(evaluate([...rows,next],1).predictions.some(r=>r.game_pk===999999),false);
});
test('CSV commas, quoted newlines and escaped quotes remain in the correct fields',()=>{
  assert.deepEqual(parseCsv('a,b\r\n"x,y","line1\nline2"\r\n"a""b",z\r\n'),[{a:'x,y',b:'line1\nline2'},{a:'a"b',b:'z'}]);
  assert.throws(()=>parseCsv('a,b\nx,y,z\n'),/WIDTH/);
});
