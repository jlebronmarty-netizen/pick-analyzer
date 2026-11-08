import {getNbaGoatRuntimeStatus} from '@/services/nba-goat-runtime.service';
import {privateHost} from '@/lib/nba-production-feed.mjs';
export const dynamic='force-dynamic';export const maxDuration=60;
export async function GET(r:Request){const reply=(x:unknown,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 if(!privateHost(r,process.env)||!r.headers.get('x-vercel-oidc-token'))return reply({status:'PRIVATE_PRODUCTION_REQUIRED'},401);
 try{return reply(await getNbaGoatRuntimeStatus());}catch{return reply({status:'NBA_GOAT_READ_UNAVAILABLE',warning:'Lectura fallida no significa ausencia de cuotas ni selecciones.'},503);}}
