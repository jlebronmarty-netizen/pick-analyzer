import {timingSafeEqual} from 'node:crypto';
import {runMultiSports} from '@/services/edge-lab-multi.service.mjs';
import {runNcaafModule} from '@/services/edge-lab-ncaaf-runtime.mjs';
import {runIndependentCollectors} from '@/lib/edge-lab/independent-collectors.mjs';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=300;
export async function GET(request){
 const secret=process.env.CRON_SECRET?.trim(),a=Buffer.from(request.headers.get('authorization')??''),b=Buffer.from('Bearer '+(secret??''));if(!secret||a.length!==b.length||!timingSafeEqual(a,b))return Response.json({status:'UNAUTHORIZED'},{status:401});
 if(new URL(request.url).search)return Response.json({status:'NO_PARAMETERS_ALLOWED'},{status:400});if(process.env.VERCEL_ENV!=='production')return Response.json({status:'PRODUCTION_ONLY'},{status:409});
 const result=await runIndependentCollectors(request,{multi:runMultiSports,ncaaf:runNcaafModule});
 return Response.json(result,{status:result.unexpected_failures.length?500:200,headers:{'Cache-Control':'no-store'}});
}
