import {NextResponse} from 'next/server';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {readNhlDirectoryCache} from '@/lib/nhl-directory-cache';
import {parseNhlOfficialSpecialTeams} from '@/lib/nhl-special-teams-asof-core.mjs';
import {NHL_SPECIAL_TEAMS_SOURCE_URL} from '@/services/nhl-special-teams-capture.service';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=40;
// One-off PREVIEW-only source contract probe; no writes and no dynamic URLs.
// Production endpoint never makes a provider call.
export async function GET(){
 if(process.env.VERCEL_ENV!=='preview')return NextResponse.json({status:'NOT_AVAILABLE'},{status:404});
 const now=new Date();
 const d=await db.from('nhl_free_source_v1').select('id,captured_at,body')
  .eq('source_url','https://api.nhle.com/stats/rest/en/team')
  .eq('body->>http_status','200').order('captured_at',{ascending:false}).limit(1).maybeSingle();
 if(d.error)return NextResponse.json({status:'DIRECTORY_DATABASE_ERROR'},{status:503});
 let directory;
 try{directory=readNhlDirectoryCache(d.data as any,now.getTime())?.directory;}
 catch{return NextResponse.json({status:'DIRECTORY_CACHE_INVALID'},{status:503});}
 if(!directory)return NextResponse.json({status:'DIRECTORY_CACHE_MISSING'},{status:503});
 try{
  const response=await fetch(NHL_SPECIAL_TEAMS_SOURCE_URL,{redirect:'error',cache:'no-store',
   headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(!response.ok||!(response.headers.get('content-type')??'').includes('application/json'))
   return NextResponse.json({status:'OFFICIAL_SOURCE_UNAVAILABLE',http:response.status},{status:502});
  const raw=await response.text();
  if(Buffer.byteLength(raw)>1000000)return NextResponse.json({status:'OVERSIZE'},{status:502});
  const parsed=parseNhlOfficialSpecialTeams({payload:JSON.parse(raw),directory,
   capturedAt:new Date().toISOString(),seasonId:20262027});
  return NextResponse.json({
   status:parsed.status,
   reason:'reason' in parsed?String(parsed.reason):null,
   teamCount:'teams' in parsed?parsed.teams?.length??0:0,
   seasonId:20262027,readOnly:true,providerCalls:1,databaseWrites:0,
   officialPicksChanged:false,productionEnabled:false
  },{status:parsed.status==='VALIDATED_SOURCE_SCHEMA'?200:422,headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({status:'OFFICIAL_SOURCE_TRANSPORT_ERROR',
  providerCalls:1,databaseWrites:0},{status:502});}
}
