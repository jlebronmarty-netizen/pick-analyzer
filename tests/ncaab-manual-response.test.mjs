import test from 'node:test';
import assert from 'node:assert/strict';
import {ncaabManualJsonResponse} from '../src/lib/ncaab-manual-response.ts';
import {unavailableNcaabManualDataReport} from '../src/lib/ncaab-manual-data.ts';

const unavailable=()=>unavailableNcaabManualDataReport({date:'2026-11-24',readAt:'2026-11-24T12:22:15Z',reason:'ARCHIVE_READ_FAILED'});

test('JSON larger than the buffered platform boundary streams in bounded UTF-8 chunks without changing the contract',async()=>{
 const report={...unavailable(),status:'PARTIAL',warnings:['á🏀'.repeat(900_000)]};
 const expected=JSON.stringify(report);
 assert.ok(Buffer.byteLength(expected)>4.5*1024*1024);
 const response=ncaabManualJsonResponse(report);
 assert.equal(response.status,200);
 assert.equal(response.headers.get('content-length'),null);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.match(response.headers.get('content-type'),/^application\/json/);
 const reader=response.body.getReader();
 const decoder=new TextDecoder('utf-8',{fatal:true});
 let actual='',chunks=0;
 while(true){
  const {value,done}=await reader.read();
  if(done)break;
  assert.ok(value.byteLength>0&&value.byteLength<=64*1024);
  actual+=decoder.decode(value,{stream:true});chunks++;
 }
 actual+=decoder.decode();
 assert.ok(chunks>1);
 assert.equal(actual,expected);
 assert.deepEqual(JSON.parse(actual),report);
});

test('unavailable stream retains HTTP 503 and all explicit absence and read-only fields',async()=>{
 const report=unavailable();
 const response=ncaabManualJsonResponse(report);
 assert.equal(response.status,503);
 assert.deepEqual(await response.json(),report);
});
