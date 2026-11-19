import {checkNbaDecisionCronRequest} from '@/lib/nba/decision-cron-auth.mjs';
import {settleNbaDecisionShadow} from '@/services/nba-decision-learning.service';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=300;
export async function GET(request:Request){
 const response=(data:unknown,http=200)=>Response.json(data,{status:http,headers:{'Cache-Control':'private, no-store'}});
 const checked=checkNbaDecisionCronRequest({
  authorization:request.headers.get('authorization'),secret:process.env.CRON_SECRET,
  environment:process.env.VERCEL_ENV,enabled:process.env.NBA_DECISION_SHADOW_ENABLED,
  search:new URL(request.url).search,now:new Date(),mode:'settle'
 });
 if(checked.status!=='RUN_ALLOWED')return response({...checked,provider_calls:0},checked.http);
 try{
  const result=await settleNbaDecisionShadow();
  console.info('NBA_DECISION_SHADOW_SETTLE',JSON.stringify(result));
  return response(result);
 }catch(e){
  console.error('NBA_DECISION_SHADOW_SETTLE_FAILED',e instanceof Error?e.message:'UNKNOWN');
  return response({status:'SHADOW_SETTLEMENT_FAILED',provider_calls:0},503);
 }
}
