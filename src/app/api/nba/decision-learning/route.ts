import {readNbaDecisionLearningStatus} from '@/services/nba-decision-learning.service';
export const dynamic='force-dynamic';
export const maxDuration=30;
export async function GET(request:Request){
 const response=(x:unknown,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'private, no-store'}});
 const allowed=process.env.VERCEL_ENV==='preview'||
   (process.env.VERCEL_ENV==='production'&&process.env.NBA_DECISION_BOARD_ENABLED==='true');
 if(!allowed)return response({status:'DECISION_BOARD_DISABLED'},404);
 if(process.env.VERCEL_ENV==='production'&&
    (!process.env.VERCEL_URL||request.headers.get('host')!==process.env.VERCEL_URL))
   return response({status:'PRIVATE_DEPLOYMENT_HOST_REQUIRED'},404);
 if(!request.headers.get('x-vercel-oidc-token'))return response({status:'PRIVATE_VERCEL_AUTH_REQUIRED'},401);
 if(new URL(request.url).search)return response({status:'NO_QUERY_PARAMETERS_ALLOWED'},400);
 try{return response(await readNbaDecisionLearningStatus());}
 catch{return response({status:'LEARNING_STATUS_UNAVAILABLE',provider_calls:0},503);}
}
