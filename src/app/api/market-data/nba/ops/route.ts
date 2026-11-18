import {privateHost} from '@/lib/nba-production-feed.mjs';
import {syncNbaGoatTeamStatsIfStale} from '@/services/nba-goat-team-stats.service';
import {reconcileNbaGoatShadowResults} from '@/services/nba-goat-results.service';
import {runNbaGoatShadowScheduler,getNbaGoatRuntimeStatus,previewNbaGoatShadowMatches} from '@/services/nba-goat-runtime.service';
import {captureNbaResearchData,getNbaResearchCaptureStatus} from '@/services/nba-goat-research-capture.service';
export const dynamic='force-dynamic';export const maxDuration=120;
const allowed=new Set(['status','stats','reconcile','preview','shadow','all','capture-research']);
function access(r:Request){return privateHost(r,process.env)&&Boolean(r.headers.get('x-vercel-oidc-token'));}
export async function GET(r:Request){if(!access(r))return Response.json({status:'PRIVATE_PRODUCTION_REQUIRED'},{status:401});try{return Response.json(new URL(r.url).searchParams.get('action')==='capture-status'?await getNbaResearchCaptureStatus():await getNbaGoatRuntimeStatus(),{headers:{'Cache-Control':'private, no-store'}});}catch{return Response.json({status:'NBA_GOAT_READ_UNAVAILABLE'},{status:503});}}
export async function POST(r:Request){
 if(!access(r))return Response.json({status:'PRIVATE_PRODUCTION_REQUIRED'},{status:401});
 const action=new URL(r.url).searchParams.get('action')??'status';if(!allowed.has(action))return Response.json({status:'INVALID_ACTION'},{status:400});
 try{
  if(action==='capture-research'){
   if(r.headers.get('origin')!==new URL(r.url).origin||r.headers.get('sec-fetch-site')!=='same-origin'||!r.headers.get('content-type')?.startsWith('application/json'))return Response.json({status:'SAME_ORIGIN_REQUIRED'},{status:403});
   const body=await r.json();
   if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['mode','startDate','endDate','gameIds'].includes(k)))return Response.json({status:'INVALID_CAPTURE_PARAMETERS'},{status:400});
   return Response.json(await captureNbaResearchData(body),{headers:{'Cache-Control':'private, no-store'}});
  }
  if(action==='status')return Response.json(await getNbaGoatRuntimeStatus());
  if(action==='stats')return Response.json(await syncNbaGoatTeamStatsIfStale({force:true}));
  if(action==='reconcile')return Response.json(await reconcileNbaGoatShadowResults());
  if(action==='preview')return Response.json(await previewNbaGoatShadowMatches());
  if(action==='shadow')return Response.json(await runNbaGoatShadowScheduler());
  const teamStats=await syncNbaGoatTeamStatsIfStale();const results=await reconcileNbaGoatShadowResults();const shadow=await runNbaGoatShadowScheduler();
  return Response.json({status:'COMPLETE',teamStats,results,shadow});
 }catch{return Response.json({status:'NBA_GOAT_OPERATION_FAILED'},{status:500});}
}
