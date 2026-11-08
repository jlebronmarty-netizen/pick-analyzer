import {NextRequest} from 'next/server';
import {apiError,apiOk,requestId} from '@/lib/api-contract';
import {getNbaGoatRuntimeStatus,runNbaGoatShadowScheduler} from '@/services/nba-goat-runtime.service';
import {syncNbaGoatTeamStatsIfStale} from '@/services/nba-goat-team-stats.service';
import {reconcileNbaGoatShadowResults} from '@/services/nba-goat-results.service';
import {runSharedNbaArchive} from '@/services/nba-shared-storage.service';
export const dynamic='force-dynamic';export const revalidate=0;export const maxDuration=300;
function authorized(r:NextRequest){const s=process.env.CRON_SECRET;return Boolean(s)&&(r.headers.get('authorization')==='Bearer '+s||r.nextUrl.searchParams.get('secret')===s);}
const safe=async<T>(fn:()=>Promise<T>,failure:string)=>{try{return await fn();}catch{return {status:'FAILED',error:failure} as const;}};
async function handle(r:NextRequest){const id=requestId(r);if(!authorized(r))return apiError({id,code:'UNAUTHORIZED',message:'Unauthorized',status:401});try{if(r.nextUrl.searchParams.get('mode')==='status'||r.nextUrl.searchParams.get('status')==='precheck')return apiOk(await getNbaGoatRuntimeStatus(),id);const marketDataArchive=await runSharedNbaArchive(r.headers.get('x-vercel-oidc-token')??'','cron');const [teamStats,results]=await Promise.all([safe(()=>syncNbaGoatTeamStatsIfStale(),'NBA_GOAT_TEAM_STATS_FAILED'),safe(()=>reconcileNbaGoatShadowResults(),'NBA_GOAT_RESULT_RECONCILIATION_FAILED')]);const shadow=await safe(()=>runNbaGoatShado¶»§q«^