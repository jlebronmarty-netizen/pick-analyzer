import test from 'node:test';
import assert from 'node:assert/strict';
import {readNcaabManualRows,ncaabManualDate,validateNcaabManualDate} from '../src/services/ncaab-manual-data.service.ts';

test('Puerto Rico date remains previous day before 04:00 UTC',()=>{
 assert.equal(ncaabManualDate('2026-11-25T03:59:59Z'),'2026-11-24');
 assert.equal(ncaabManualDate('2026-11-25T04:00:00Z'),'2026-11-25');
 for(const value of ['2026-02-30','2026-13-01','11/24/2026','2026-1-01',''])assert.throws(()=>validateNcaabManualDate(value),/INVALID_DATE/);
});
test('complete keyset read retains all rows across pages with remaining exact counts',async()=>{
 const source=Array.from({length:7},(_,i)=>({id:String(i).padStart(2,'0'),value:i}));
 const rows=await readNcaabManualRows(async(after,limit)=>{
  const remaining=source.filter(r=>after===null||r.id>after);
  return {data:remaining.slice(0,limit),count:remaining.length,error:null};
 },{pageSize:3,cap:10});
 assert.deepEqual(rows,source);
});
test('changed count, incomplete pages, overlap and caps fail without a partial result',async()=>{
 let call=0;
 await assert.rejects(readNcaabManualRows(async()=>++call===1?
  {data:[{id:'a'}],count:2,error:null}:{data:[{id:'b'}],count:2,error:null},{pageSize:1}),/ARCHIVE_COUNT_CHANGED/);
 await assert.rejects(readNcaabManualRows(async()=>({data:[],count:1,error:null})),/INCOMPLETE_ARCHIVE/);
 call=0;
 await assert.rejects(readNcaabManualRows(async()=>({data:[{id:'a'}],count:++call===1?2:1,error:null}),{pageSize:1}),/ARCHIVE_PAGE_OVERLAP/);
 await assert.rejects(readNcaabManualRows(async()=>({data:[{id:'a'}],count:3,error:null}),{cap:2}),/ARCHIVE_READ_CAPPED/);
 await assert.rejects(readNcaabManualRows(async()=>({data:null,count:null,error:{message:'private backend message'}})),/ARCHIVE_READ_FAILED/);
});
test('empty archive is a verified complete zero-row read',async()=>{
 assert.deepEqual(await readNcaabManualRows(async()=>({data:[],count:0,error:null})),[]);
});
