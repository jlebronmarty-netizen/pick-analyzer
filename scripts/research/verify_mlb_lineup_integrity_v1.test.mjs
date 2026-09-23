import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {reconcile} from './reconcile_mlb_lineup_v1.mjs';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const load=s=>zlib.gunzipSync(fs.readFileSync(`artifacts/research/mlb_lineup_integrity_v1.${s}.json.gz`));
test('full independent raw replay reproduces every projected record and preserves blocked as-published gate',()=>{
 const pb=load('projected'),rb=load('raw'),full=load('records'),s=JSON.parse(fs.readFileSync('artifacts/research/mlb_lineup_integrity_v1.json'));
 assert.equal(hash(pb),s.input_sha256.projected);assert.equal(hash(rb),s.input_sha256.raw);assert.equal(hash(full),s.full_result_sha256);
 const computed=reconcile(JSON.parse(pb),JSON.parse(rb)),saved=JSON.parse(full);computed.input_sha256=s.input_sha256;assert.deepEqual(computed,saved);
 assert.equal(computed.records.length,35802);assert.equal(computed.affected_unique_records,372);assert.equal(computed.unexplained_rebuilt_records,0);
 for(const r of computed.records){assert(r.source_max_date<r.game_date);assert.equal(r.remaining_mismatches.length,0);}
 assert.equal(computed.as_published_certificate,false);assert.equal(computed.status,'BLOCKED_LINEUP_FEATURE_LINEAGE');
});
test('reconciliation rejects duplicate IDs and raw/source game membership substitution',()=>{
 const p=JSON.parse(load('projected')),r=JSON.parse(load('raw'));p.rows=p.rows.slice(0,1);
 const duplicated={...p,rows:[p.rows[0],p.rows[0]]};assert.throws(()=>reconcile(duplicated,r),/DUPLICATE_PROJECTION/);
 const mutated=structuredClone(p);mutated.rows[0][9]=[999999];assert.throws(()=>reconcile(mutated,r),/SOURCE_GAME_MEMBERSHIP/);
});
test('every projected member, selection rank and prior21-day feature reconciles without target-day data',()=>{
 const s=JSON.parse(load('selection'));assert.equal(s.rows.length,35802);const seen=new Set();
 for(const r of s.rows){const k=`${r[0]}:${r[2]}:${r[3]}`;assert(!seen.has(k));seen.add(k);assert.equal(r[4],r[5]);assert.equal(r[6],r[7]);assert(Math.abs(r[8]-r[9])<1e-9);assert.equal(r[10],r[11]);assert(r[11]<r[1]);assert(r[12]>=new Date(Date.parse(r[1])-21*86400000).toISOString().slice(0,10));assert.equal(r[13].length,r[7]);assert(!r[13].includes(r[0]));}
});
