import {timingSafeEqual} from 'node:crypto';
import {runMultisportLearningEvaluation} from '@/services/multisport-learning-evaluator.service';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=300;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET?.trim(),a=Buffer.from(request.headers.get('authorization')??''),b=Buffer.from('Bearer '+(secret??''));
 if(!secret||a.length!==b.length||!timingSafeEqual(a,b))return Response.json({status:'UNAUTHORIZED'},{status:401});
 if(new URL(request.url).search)return Response.json({status:'NO_PARAMETERS_ALLOWED'},{status:400});
 if(process.env.VERCEL_ENV!=='production')return Response.json({status:'PRODUCTION_ONLY'},{status:409});
 try{return Response.json(await runMultisportLearningEvaluation(),{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({status:'MODEL_LEARNING_EVALUATION_FAILED'},{status:500,headers:{'Cache-Control':'no-store'}});}
}