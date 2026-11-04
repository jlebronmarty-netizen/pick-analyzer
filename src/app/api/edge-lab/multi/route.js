import {privateRequest} from '@/services/edge-lab.service.mjs';import {readMultiSports,checkTtSource} from '@/services/edge-lab-multi.service.mjs';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=60;
export async function GET(request){
 const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 if(!privateRequest(request))return reply({status:'PRIVATE_PRODUCTION_DEPLOYMENT_REQUIRED'},401);
 const q=new URL(request.url).searchParams;if([...q.keys()].some(k=>!['mode','_vercel_share'].includes(k))||q.getAll('mode').length>1||q.has('mode')&&!['status','source-health'].includes(q.get('mode')))return reply({status:'INVALID_QUERY'},400);
 try{return reply(q.get('mode')==='source-health'?await checkTtSource(request):await readMultiSports());}catch{return reply({status:'MULTISPORT_READ_UNAVAILABLE',warning:'Un fallo de lectura no es una jornada sin selecciones.'},503);}
}
