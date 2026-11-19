import {timingSafeEqual} from 'node:crypto';
import {runScheduledHoopsCapture, scheduledEnvReady} from '@/services/nba-hoopsapi-scheduler.service.mjs';
import {createHoopsDurableStore} from '@/lib/nba/hoopsapi-durable-store.mjs';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=45;
const noStore={'Cache-Control':'private, no-store'};

function validCronAuthorization(header,secret) {
  if (!secret || secret.length<12 || typeof header!=='string') return false;
  const expected=Buffer.from('Bearer '+secret);
  const received=Buffer.from(header);
  return received.length===expected.length && timingSafeEqual(received,expected);
}

export async function GET(request) {
  if (!validCronAuthorization(request.headers.get('authorization'),process.env.CRON_SECRET))
    return Response.json({status:'UNAUTHORIZED',provider_calls_made:0},{status:401,headers:noStore});
  if (new URL(request.url).search)
    return Response.json({status:'NO_PARAMETERS_ALLOWED',provider_calls_made:0},{status:400,headers:noStore});
  if (process.env.VERCEL_ENV!=='production')
    return Response.json({status:'PRODUCTION_ONLY',provider_calls_made:0},{status:404,headers:noStore});
  if (!scheduledEnvReady().enabled)
    return Response.json({status:'SCHEDULE_DISABLED',provider_calls_made:0},{headers:noStore});
  let result;
  try {
    const {supabaseAdmin}=await import('@/lib/supabase-admin');
    const readSlate=async now=>{
      const cutoff=new Date(now.getTime()-120*60*1000).toISOString();
      const response=await supabaseAdmin.from('nba_market_schedules_v1')
        .select('source_received_at,payload').gte('source_received_at',cutoff)
        .order('source_received_at',{ascending:false}).limit(12)
        .abortSignal(AbortSignal.timeout(5000));
      if (response.error || !Array.isArray(response.data)) throw new Error('SCHEDULE_READ_FAILED');
      return response.data;
    };
    result=await runScheduledHoopsCapture({
      env:process.env,now:new Date(),store:createHoopsDurableStore(supabaseAdmin),readSlate,
    });
  } catch {
    result={status:'SCHEDULE_INTERNAL_UNAVAILABLE',provider_calls_made:0};
  }
  // No raw bookmaker payload, credentials, personal information, or prices in cron logs.
  console.info('NBA_HOOPSAPI_SCHEDULE',JSON.stringify(result));
  return Response.json(result,{headers:noStore});
}
