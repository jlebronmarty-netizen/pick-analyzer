import {timingSafeEqual} from 'node:crypto';import {runEdgeSoccer} from '@/services/edge-lab.service.mjs';import {runSoccerCausalLearning} from '@/services/soccer-causal-learning.service';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=300;
export async function GET(request){
 const secret=process.env.CRON_SECRET?.trim(),a=Buffer.from(request.headers.get('authorization')??''),b=Buffer.from('Bearer '+(secret??''));
 if(!secret||a.length!==b.length||!timingSafeEqual(a,b))return Response.json({status:'UNAUTHORIZED'},{status:401});
 if(new URL(request.url).search)return Response.json({status:'NO_PARAMETERS_ALLOWED'},{status:400});
 if(process.env.VERCEL_ENV!=='production')return Response.json({status:'PRODUCTION_ONLY'},{status:409});
 try{const core=await runEdgeSoccer();let learning;try{learning=await runSoccerCausalLearning();}catch{learning={status:'FAILED',error:'SOCCER_CAUSAL_LEARNING_FAILED'};}console.log('SOCCER_CAUSAL_PIPELINE',JSON.stringify({coreStatus:core?.status,contextStatus:learning?.context?.status??learning?.status,providerCalls:learning?.context?.provider_calls??0,diagnosticStatus:learning?.diagnostics?.status??null}));return Response.json({...core,learning},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({status:'EDGE_LAB_RUN_FAILED'},{status:500,headers:{'Cache-Control':'no-store'}});}
}
