import {makeHandler} from '../../../../lib/nba-production-feed.mjs';
import {archiveEnabled,archiveEnvelope} from '@/services/nba-shared-storage.service';
export const dynamic='force-dynamic';
export const maxDuration=60;
const read=makeHandler();
export async function GET(request){
 const response=await read(request);
 if(!response.ok||!archiveEnabled())return response;
 const body=await response.json();
 try{body.meta.persistence=await archiveEnvelope(body);}
 catch{body.meta.persistence={status:'FAILED',durable:false};body.meta.warnings=[...(body.meta.warnings||[]),'DURABLE_ARCHIVE_WRITE_FAILED'];}
 return Response.json(body,{status:response.status,headers:{'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'}});
}
