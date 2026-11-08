import {privateHost} from '@/lib/nba-production-feed.mjs';
import {syncNbaGoatTeamStatsIfStale} from '@/services/nba-goat-team-stats.service';
import {reconcileNbaGoatShadowResults} from '@/services/nba-goat-results.service';
import {runNbaGoatShadowScheduler,getNbaGoatRuntimeStatus,previewNbaGoatShadowMatches} from '@/services/nba-goat-runtime.service';
export const dynamic='force-dynamic';export const maxDuration=120;
const allowed=new Set(['status','stats','reconcile','preview','shadow','all']);
function access(r:Request){return privateHost(r,process.env)&&Boolean(r.headers.get('x-vercel-oidc-token'));}
export async function GET(r:Request){if(!access(r))return Response.json({status:'PRIVATE_PRODUCTION_REQUIRED'},{status:401});try{return Response.json(await getNbaGoatRuntimeStatus(),{headers:{'Cache-Control':'private, no-store'}});}catch{return Response.json({status:'NBA_GOAT_READ_UNAVAILABLE'},{status:503});}}
export async function POST(r:Request){
 if(!access(r))return Response.json({status:'PRIVATE_PRODUCTION_REQUIRED'},{status:401});
 const action=new URL(r.url).searchParams.get('action')??'status';if(!allowed.has(action))return Response.json({status:'INVALID_ACTION'},{status:400});
 try{
  if(action==='status')return Response.json(await getNbaGoatRuntimeStatus());
  if(action==='stats')return Response.json(await syncNbaGoatTeamStatsIfStale({force:true}));
  if(action==='reconcile')return Response.json(await reconcileNbaGoatShadowResults());
  if(action==='preview')return Response.json(await previewNbaGoatShadowMatches());
  if(action==='shadow')return Response.json(await runNbaGoatShadowScheduler());
  const teamStats=await syncNbaGoatTeamStatsIfStale();const results=await reconcileNbaGoatShadowResults();const shadow=await runNbaGoatShadowScheduler();
  return Response.json({status:'COMPLETE',teamStats,results,shadow});
 }catch{return Response.json({status:'NBA_GOAT_OPERATION_FAILED'},{status:500});}
}
