import {readNbaDecisionBoard} from '@/services/nba-decision-board.service';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=45;
export async function GET(request:Request){
  const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
  const allowed=process.env.VERCEL_ENV==='preview'||
   (process.env.VERCEL_ENV==='production'&&process.env.NBA_DECISION_BOARD_ENABLED==='true');
  if(!allowed)return response({status:'DECISION_BOARD_DISABLED'},404);
  if(process.env.VERCEL_ENV==='production'&&
     (!process.env.VERCEL_URL||request.headers.get('host')!==process.env.VERCEL_URL))
    return response({status:'PRIVATE_DEPLOYMENT_HOST_REQUIRED'},404);
  if(!request.headers.get('x-vercel-oidc-token'))return response({status:'PRIVATE_VERCEL_AUTH_REQUIRED'},401);
  if(new URL(request.url).search)return response({status:'NO_QUERY_PARAMETERS_ALLOWED'},400);
  try{return response(await readNbaDecisionBoard());}
  catch(e){console.warn('NBA_DECISION_BOARD_READ_ERROR',e instanceof Error?e.message:'UNKNOWN');
    return response({status:'NBA_DECISION_BOARD_READ_UNAVAILABLE',provider_calls:0,model_writes:0},503);}
}
