import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {evaluate} from './evaluate_mlb_nrfi_analog_v1.mjs';
const source=()=>Array.from({length:500},(_,i)=>{
  const date=new Date(Date.UTC(2025,0,1+Math.floor(i/5))).toISOString().slice(0,10);
  return [2025,i+1,date,i%4===0?1:0,i%7===0?1:0,100,200,'HOME','AWAY','2024-12-31','F1_CERTIFIED',true,'HISTORICAL_SEEN_DEVELOPMENT'];
});
test('NRFI analog: current date and future labels cannot affect forecasts or neighbors',()=>{
  const rows=source(),a=evaluate(rows),date=a.predictions[5].game_date;
  const b=evaluate(rows.map(r=>r[2]>=date?r.map((v,i)=>[3,4].includes(i)?9:v):r));
  const forecasts=x=>x.predictions.filter(r=>r.game_date<=date).map(({truth_nrfi,correct,...r})=>r);
  assert.deepEqual(forecasts(a),forecasts(b));
  for(const p of a.predictions){assert(p.latest_neighbor_date<p.game_date);assert.equal(p.neighbor_game_pks.length,100);assert.equal(new Set(p.neighbor_game_pks).size,100);assert.equal(p.p_nrfi,(p.neighbor_nrfi+1)/102);}
});
test('NRFI analog: home-away swap symmetry and same-season reset',()=>{
  const rows=source(),a=evaluate(rows),b=evaluate(rows.map(r=>[r[0],r[1],r[2],r[4],r[3],r[6],r[5],r[8],r[7],...r.slice(9)]));
  assert.deepEqual(a.predictions,b.predictions);
  const next=rows.slice(0,20).map(r=>[2026,r[1]+1000,r[2].replace('2025','2026'),...r.slice(3)]);
  assert.deepEqual(evaluate([...rows,...next]).predictions,a.predictions);
});
test('NRFI analog: duplicate, future, uncertified and contemporaneous cutoff fail closed',()=>{
  const rows=source();assert.throws(()=>evaluate([...rows,rows[0]]),/DUPLICATE/);
  for(const [idx,value,pattern]of [[2,'2026-09-20',/DATE/],[11,false,/SOURCE_CLASS/],[9,rows[0][2],/STRICT_PRIOR/]]){
    const bad=structuredClone(rows);bad[0][idx]=value;assert.throws(()=>evaluate(bad),pattern);
  }
});
test('NRFI analog: preserved full artifact arithmetic',()=>{
  const p=new URL('../../artifacts/research/mlb_nrfi_analog_v1_result.json.gz',import.meta.url);
  assert(fs.existsSync(p),'PRESERVED_ARTIFACT_REQUIRED');
  const full=JSON.parse(zlib.gunzipSync(fs.readFileSync(p))),selected=full.predictions.filter(x=>x.side);
  assert.equal(full.selected,selected.length);assert.equal(full.wins,selected.filter(x=>x.correct).length);
  assert.equal(full.losses,full.selected-full.wins);assert.equal(full.source_rows,full.eligible+full.excluded_insufficient_prior+full.excluded_insufficient_analogs);
  assert.equal(full.accuracy,full.selected?full.wins/full.selected:null);
  assert.equal(full.coverage,full.eligible?full.selected/full.eligible:null);
  assert.equal(Object.values(full.monthly).reduce((n,x)=>n+x.n,0),full.selected);
  assert.equal(full.external_opened,false);
  for(const row of full.predictions)assert(row.latest_neighbor_date<row.game_date);
});
