import {NextRequest} from 'next/server';
import {apiError,apiOk,requestId} from '@/lib/api-contract';
import {getNbaGoatRuntimeStatus,runNbaGoatShadowScheduler} from '@/services/nba-goat-runtime.service';
import {syncNbaGoatTeamStatsIfStale} from '@/services/nba-goat-team-stats.service';
import {reconcileNbaGoatShadowResults} from '@/services/nba-goat-results.service';
import {runSharedNbaArchive} from '@/services/nba-shared-storage.service';
import {runNbaCausalDiagnostics,syncNbaCausalPbpForSettled} from '@/services/nba-causal-learning.service';
import {syncNbaCausalV2Context} from '@/services/nba-causal-v2-context.service';
import {syncNbaCausalV3Matchups} from '@/services/nba-causal-v3-matchup.service';
import {syncNbaGoatPregameContext} from '@/services/nba-goat-pregame-context.service';
import {syncNbaPropsPlayerHistory} from '@/services/nba-goat-props-history-backfill.service';
export const dynamic='force-dynamic';export const revalidate=0;export const maxDuration=300;
function authorized(r:NextRequest){const s=process.env.CRON_SECRET;return Boolean(s)&&(r.headers.get('authorization')==='Bearer '+s||r.nextUrl.searchParams.get('secret')===s);}
const safe=async<T>(fn:()=>Promise<T>,failure:string)=>{try{return await fn();}catch{return {status:'FAILED',error:failure} as const;}};
async function handle(r:NextRequest){
 const id=requestId(r);if(!authorized(r))return apiError({id,code:'UNAUTHORIZED',message:'Unauthorized',status:401});
 try{
  if(r.nextUrl.searchParams.get('mode')==='status'||r.nextUrl.searchParams.get('status')==='precheck')return apiOk(await getNbaGoatRuntimeStatus(),id);
  const marketDataArchive=await runSharedNbaArchive(r.headers.get('x-vercel-oidc-token')??'','cron');
  const pregameContext=await safe(()=>syncNbaGoatPregameContext(),'NBA_GOAT_PREGAME_CONTEXT_FAILED');
  const [teamStats,results]=await Promise.all([
   safe(()=>syncNbaGoatTeamStatsIfStale(),'NBA_GOAT_TEAM_STATS_FAILED'),
   safe(()=>reconcileNbaGoatShadowResults(),'NBA_GOAT_RESULT_RECONCILIATION_FAILED'),
  ]);
  const [pbp,v2Context]=await Promise.all([
   safe(()=>syncNbaCausalPbpForSettled({cap:3}),'NBA_CAUSAL_PBP_FAILED'),
   safe(()=>syncNbaCausalV2Context({cap:3}),'NBA_CAUSAL_V2_CONTEXT_FAILED'),
  ]);
  const v3Matchups=await safe(()=>syncNbaCausalV3Matchups({cap:1}),'NBA_CAUSAL_V3_MATCHUPS_FAILED');
  const causal=await safe(()=>runNbaCausalDiagnostics(),'NBA_CAUSAL_DIAGNOSTICS_FAILED');
  const shadow=await safe(()=>runNbaGoatShadowScheduler(),'NBA_GOAT_SHADOW_FAILED');
  // Opt-in-only research backfill; the existing NBA pipeline and models run first.
  const propsHistory=await safe(()=>syncNbaPropsPlayerHistory(),'NBA_PROPS_HISTORY_FAILED');
  console.log('NBA_GOAT_PIPELINE',JSON.stringify({marketStatus:(marketDataArchive as any).status,pregameContextStatus:(pregameContext as any).status,pregameContextCalls:(pregameContext as any).provider_calls??0,teamStatsStatus:(teamStats as any).status,resultStatus:(results as any).status,pbpStatus:(pbp as any).status,pbpCalls:(pbp as any).provider_calls??0,v2ContextStatus:(v2Context as any).status,v2ContextCalls:(v2Context as any).provider_calls??0,v3MatchupStatus:(v3Matchups as any).status,v3MatchupCalls:(v3Matchups as any).provider_calls??0,causalStatus:(causal as any).status,shadowStatus:(shadow as any).finalClassification??(shadow as any).status,propsHistoryStatus:(propsHistory as any).status,propsHistoryCalls:(propsHistory as any).providerCalls??0,legacyOddsApiCalls:0}));
  return apiOk({marketDataArchive,pregameContext,teamStats,results,pbp,v2Context,v3Matchups,causal,shadow,propsHistory,legacyOddsApiCalls:0},id);
 }catch{return apiError({id,code:'INTERNAL_ERROR',message:'NBA GOAT market archive failed; downstream model stages were not assumed complete',status:500});}
}
export async function GET(r:NextRequest){return handle(r);}export async function POST(r:NextRequest){return handle(r);}
