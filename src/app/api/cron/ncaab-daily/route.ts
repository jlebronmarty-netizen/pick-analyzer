import {timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {runNcaabDaily} from '@/services/ncaab-daily.service';
import {runNcaabCausalLearning} from '@/services/ncaab-causal-learning.service';
import {runNcaabProspectiveCalibrationShadow} from '@/services/ncaab-calibration-shadow-writer.service';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=300;
export async function GET(request:NextRequest){
 const secret=process.env.CRON_SECRET?.trim();if(!secret)return NextResponse.json({status:'AUTH_REQUIRED'},{status:503});
 const supplied=Buffer.from(request.headers.get('authorization')??''),expected=Buffer.from('Bearer '+secret);
 if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return NextResponse.json({status:'UNAUTHORIZED'},{status:401});
 if(request.nextUrl.search)return NextResponse.json({status:'NO_PARAMETERS_ALLOWED'},{status:400});
 if(process.env.VERCEL_ENV!=='production')return NextResponse.json({status:'PRODUCTION_SCHEDULER_ONLY'},{status:409});
 try{const core=await runNcaabDaily();const learning=await runNcaabCausalLearning();
  const calibration=await runNcaabProspectiveCalibrationShadow({status:(core as any).status,
   forecasts:(core as any).forecasts}).catch(()=>({status:'SHADOW_FAILED',providerCalls:0,written:0}));
  console.log('NCAAB_CAUSAL_PIPELINE',JSON.stringify({coreStatus:(core as any).status,contextStatus:(learning as any).context?.status,providerCalls:(learning as any).context?.provider_calls??0,diagnosticStatus:(learning as any).diagnostics?.status,
   calibrationStatus:calibration.status,calibrationRows:calibration.written,
   calibrationProviderCalls:calibration.providerCalls}));return NextResponse.json({...core,learning,calibration},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({status:'NCAAB_RUN_FAILED',warning:'Consultar registro persistente de ejecuciones.'},{status:500,headers:{'Cache-Control':'no-store'}});}
}
