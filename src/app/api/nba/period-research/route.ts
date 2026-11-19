import {readNbaPeriodResearch} from '@/services/nba-period-research.service';
export const dynamic='force-dynamic';
export const maxDuration=30;
export async function GET(request:Request){
  if(process.env.VERCEL_ENV!=='preview')
    return Response.json({status:'RESEARCH_PREVIEW_ONLY'},{status:404,headers:{'Cache-Control':'no-store'}});
  if(!request.headers.get('x-vercel-oidc-token'))
    return Response.json({status:'PRIVATE_VERCEL_AUTH_REQUIRED'},{status:401,headers:{'Cache-Control':'no-store'}});
  if(new URL(request.url).search)
    return Response.json({status:'NO_PARAMETERS_ALLOWED'},{status:400,headers:{'Cache-Control':'no-store'}});
  try {
    return Response.json(await readNbaPeriodResearch(),{headers:{'Cache-Control':'private, no-store'}});
  } catch {
    return Response.json({status:'NBA_PERIOD_RESEARCH_UNAVAILABLE',provider_calls:0,model_writes:0},
      {status:503,headers:{'Cache-Control':'private, no-store'}});
  }
}
