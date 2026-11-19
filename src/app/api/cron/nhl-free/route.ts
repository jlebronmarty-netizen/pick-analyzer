import {timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {runNhlFree} from '@/services/nhl-free.service';
import {runNhlCausalLearning} from '@/services/nhl-causal-learning.service';
import {syncNhlMainMarketHistory} from '@/services/nhl-main-market-history-backfill.service';
import {runNhlChallengerShadowFreeze} from '@/services/nhl-challenger-freeze-writer.service';
import {syncNhlSpecialTeamsResearchSnapshot} from '@/services/nhl-special-teams-capture.service';
import {captureNhlFreeEspnProbableGoalies} from '@/services/nhl-espn-goalie-probables-capture.service';
import {runNhlLateV6ShadowFreeze} from '@/services/nhl-late-v6-freeze-writer.service';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=300;
export async function GET(request:NextRequest){
 const secret=process.env.CRON_SECRET?.trim();if(!secret)return NextResponse.json({status:'AUTH_REQUIRED'},{status:503});
 const supplied=Buffer.from(request.headers.get('authorization')??''),expected=Buffer.from('Bearer '+secret);
 if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return NextResponse.json({status:'UNAUTHORIZED'},{status:401});
 if(request.nextUrl.search)return NextResponse.json({status:'NO_PARAMETERS_ALLOWED'},{status:400});
 if(process.env.VERCEL_ENV!=='production')return NextResponse.json({status:'PRODUCTION_SCHEDULER_ONLY'},{status:409});
 try{const core=await runNhlFree();const learning=await runNhlCausalLearning();
  // Opt-in historical context after existing model-free source, outcome settlement and causal stages.
  const researchHistory=await syncNhlMainMarketHistory().catch(()=>({status:'FAILED',providerCalls:0,written:0}));
  // Additive opt-in SHADOW-only row freeze; not coupled to moneyline or other sports.
  // Optional once-a-day NHL Stats team summary; model weights/official predictions unchanged.
  const specialTeamsCapture=await syncNhlSpecialTeamsResearchSnapshot().catch(()=>({status:'FAILED',providerCalls:0,written:0}));
  // Optional one free NHL-wide ESPN pregame probable-goalie source call per day; no confirmed starter claims.
  const espnGoalies=await captureNhlFreeEspnProbableGoalies().catch(()=>({status:'FAILED',providerCalls:0,written:0}));
  const challengerFreeze=await runNhlChallengerShadowFreeze().catch(()=>({status:'FAILED',sourceCalls:0,written:0}));
  // Strictly after the one-free-ESPN probable call. New independent research row;
  // never rewrites or supersedes earlier immutable Poisson/DRatings decisions.
  const lateV6=await runNhlLateV6ShadowFreeze().catch(()=>({status:'FAILED',providerCalls:0,written:0}));
  console.log('NHL_CAUSAL_PIPELINE',JSON.stringify({coreStatus:(core as any).status,contextStatus:(learning as any).context?.status,providerCalls:(learning as any).context?.provider_calls??0,diagnosticStatus:(learning as any).diagnostics?.status,researchHistoryStatus:researchHistory.status,researchHistoryCalls:researchHistory.providerCalls,challengerFreezeStatus:challengerFreeze.status,challengerRows:challengerFreeze.written,specialTeamsCaptureStatus:specialTeamsCapture.status,specialTeamsCalls:specialTeamsCapture.providerCalls,espnProbableStatus:espnGoalies.status,espnProbableCalls:espnGoalies.providerCalls,lateV6Status:lateV6.status,lateV6Rows:lateV6.written,lateV6ProviderCalls:lateV6.providerCalls}));
  return NextResponse.json({...core,learning,researchHistory,challengerFreeze,specialTeamsCapture,espnGoalies,lateV6},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({status:'NHL_RUN_FAILED',warning:'Consultar registro persistente de ejecuciones.'},{status:500,headers:{'Cache-Control':'no-store'}});}
}
