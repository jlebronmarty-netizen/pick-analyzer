import type {NcaabManualDataReport} from '@/types/ncaab-manual-data';

const CHUNK_BYTES=64*1024;

/** Stream the unchanged JSON contract: Vercel's buffered response limit is 4.5 MB. */
export function ncaabManualJsonResponse(report:NcaabManualDataReport):Response {
  // Serialize before sending headers so serialization cannot create a partial success.
  const bytes=new TextEncoder().encode(JSON.stringify(report));
  let offset=0;
  const body=new ReadableStream<Uint8Array>({
    pull(controller) {
      if(offset>=bytes.length){controller.close();return;}
      const end=Math.min(offset+CHUNK_BYTES,bytes.length);
      controller.enqueue(bytes.subarray(offset,end));
      offset=end;
    },
    cancel(){offset=bytes.length;},
  });
  return new Response(body,{
    status:report.status==='UNAVAILABLE'?503:200,
    headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},
  });
}
