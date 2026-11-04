import {privateRequest,readEdgeLab,previewSoccer} from '@/services/edge-lab.service.mjs';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=180;
export async function GET(request){
 const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 if(!privateRequest(request))return reply({status:'PRIVATE_PRODUCTION_DEPLOYMENT_REQUIRED'},401);
 const q=new URL(request.url).searchParams;if([...q.keys()].some(k=>!['mode','_vercel_share'].includes(k))||q.getAll('mode').length>1)return reply({status:'INVALID_QUERY'},400);
 if(q.has('mode')&&!['status','preview'].includes(q.get('mode')))return reply({status:'INVALID_MODE'},400);
 try{return reply(q.get('mode')==='preview'?await previewSoccer():await readEdgeLab());}catch{return reply({status:'EDGE_LAB_UNAVAILABLE',warning:'No se sustituyen los fallos de lectura con ceros ni predicciones.'},503);}
}
