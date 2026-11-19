import {readNbaDecisionBoard} from '@/services/nba-decision-board.service';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=45;
export async function GET(request:Request){
  const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
  if(process.env.VERCEL_ENV!=='preview')return response({status:'PREVIEW_RESEARCH_ONLY'},404);
  if(!request.headers.get('x-vercel-oidc-token'))return response({status:'PRIVATE_VERCEL_AUTH_REQUIRED'},401);
  if(new URL(request.url).search)return response({status:'NO_QUERY_PARAMETERS_ALLOWED'},400);
  try{return response(await readNbaDecisionBoard());}
  catch(e){console.warn('NBA_DECISION_BOARD_READ_ERROR',e instanceof Error?e.message:'UNKNOWN');
    return response({status:'NBA_DECISION_BOARD_READ_UNAVAILABLE',provider_calls:0,model_writes:0},503);}
}
