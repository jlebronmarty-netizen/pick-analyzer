import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createDurableWriteJournal,planDurableWriteBatches} from './mlb-operational-r6-write-journal.mjs'
import {sanitizedStageException} from './mlb-operational-r7-errors.mjs'
const rows=JSON.parse(fs.readFileSync(path.join(process.env.R2S_VALIDATION_DIR,'phase2-private-raw-batch.json')))
const table='pick2_raw_mlb_statcast_pitches',cap=rows.length
const oldBytes=Buffer.byteLength(JSON.stringify({table,rows,cap,operation:'INSERT',expectedOld:null}))
assert.ok(oldBytes>500000,'Production-shaped 100-row batch reproduces old limit')
const stored=new Map(),calls=[]
const runtime={locked:true,write:async write=>{
  assert.ok(Buffer.byteLength(JSON.stringify(write))<=400000)
  assert.ok(write.rows.length<=100&&write.cap===cap)
  calls.push(write)
  let inserted=0,reused=0
  for(const row of write.rows){if(stored.has(row.id)){assert.deepEqual(stored.get(row.id),row);reused++}else{stored.set(row.id,row);inserted++}}
  return {rows:write.rows,inserted,reused,updated:0}
}}
const journal=createDurableWriteJournal(runtime)
let result=await journal.perform({table,rows,cap})
assert.equal(result.inserted,rows.length);assert.deepEqual(result.rows,rows);assert.ok(calls.length>1)
result=await journal.perform({table,rows,cap})
assert.equal(result.inserted,0);assert.equal(result.reused,rows.length)
const before=calls.length
await assert.rejects(journal.perform({table,rows:[rows[0],{...rows[1],raw_payload:{oversized:'x'.repeat(500000)}}],cap}),e=>sanitizedStageException(e).code==='WRITE_PAYLOAD_SHAPE'&&e.name==='RangeError')
assert.equal(calls.length,before,'All row-size validation precedes any mutation')
const unicode=Array.from({length:100},(_,id)=>({id,raw_payload:'é'.repeat(3000)}))
assert.ok(planDurableWriteBatches({table,rows:unicode,cap:100}).length>1)
console.log(JSON.stringify({status:'PASS',oldRequestBytes:oldBytes,rows:rows.length,batches:calls.length/2,byteLimit:400000,idempotency:'PASS',oversizedRowNoPartialWrites:'PASS',unicodeBytes:'PASS',durableClassification:'WRITE_PAYLOAD_SHAPE',providers:0,productionDml:0,productionDdl:0}))
