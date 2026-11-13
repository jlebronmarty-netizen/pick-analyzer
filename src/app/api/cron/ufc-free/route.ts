import {timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {runUfcFree} from '@/services/ufc-free.service';
import {runUfcCausalLearning} from '@/services/ufc-causal-learning.service';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=300;
export async function GET(request:NextRequest){
 const secret=process.env.CRON_SECRET?.trim();if(!secret)return NextResponse.json({status:'AUTH_REQUIRED'},{status:503});
 const supplied=Buffer.from(request.headers.get('authorization')??''),expected=Buffer.from('Bearer '+secret);
 if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return NextResponse.json({status:'UNAUTHORIZED'},{status:401});
 if(request.nextUrl.search)return NextResponse.json({status:'NO_PARAMETERS_ALLOWED'},{status:400});
 if(process.env.VERCEL_ENV!=='production')return NextResponse.json({status:'PRODUCTION_SCHEDULER_ONLY'},{status:409});
 try{const core=await runUfcFree();let learning;try{learning=await runUfcCausalLearning();}catch{learning={status:'FAILED',error:'UFC_CAUSAL_LEARNING_FAILED'};}console.log('UFC_CAUSAL_PIPELINE',JSON.stringify({coreStatus:(core as any).status,contextStatus:(learning as any).context?.status??(learning as any).status,providerCalls:(learning as any).context?.provider_calls??0,diagnosticStatus:(learning as any).diagnostics?.status??null}));return NextResponse.json({...core,learning},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({status:'UFC_RUN_FAILED',warning:'Consultar registro persistente de ejecuciones.'},{status:500,headers:{'Cache-Control':'no-store'}});}
}
