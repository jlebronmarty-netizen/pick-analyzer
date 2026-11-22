// Keyset paging with an explicit row cap and no vendor/HTTP calls of its own.
// readPage must apply a fixed as-of cutoff and order id ascending.
export async function readNcaabBoundedArchive({readPage,maxRows=2000,pageSize=250}){
 if(typeof readPage!=='function'||!Number.isSafeInteger(maxRows)||maxRows<1||
  !Number.isSafeInteger(pageSize)||pageSize<1||pageSize>500)
  return {status:'INVALID_READ_BUDGET',rows:[],readCalls:0};
 const rows=[];let after=null,readCalls=0;
 while(rows.length<=maxRows){
  const limit=Math.min(pageSize,maxRows-rows.length+1);
  let result;
  try{readCalls++;result=await readPage({after,limit});}
  catch{return {status:'READ_FAILED',rows:[],readCalls};}
  if(result?.error||!Array.isArray(result?.data))return {status:'READ_FAILED',rows:[],readCalls};
  const page=result.data;
  if(page.length>limit)return {status:'READ_BOUNDARY_MISMATCH',rows:[],readCalls};
  for(const row of page){
   if(typeof row?.id!=='string'||!row.id||(after!==null&&row.id<=after))
    return {status:'READ_BOUNDARY_MISMATCH',rows:[],readCalls};
   after=row.id;rows.push(row);
  }
  if(rows.length>maxRows)return {status:'SOURCE_ARCHIVE_CAPPED',rows:[],readCalls};
  if(page.length<limit)return {status:'OK',rows,readCalls};
 }
 return {status:'SOURCE_ARCHIVE_CAPPED',rows:[],readCalls};
}
