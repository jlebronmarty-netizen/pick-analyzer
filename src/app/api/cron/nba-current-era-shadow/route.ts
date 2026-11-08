import {NextRequest} from 'next/server';
import {apiError,apiOk,requestId} from '@/lib/api-contract';
import {getNbaGoatRuntimeStatus,runNbaGoatShadowScheduler} from '@/services/nba-goat-runtime.service';
import {runSharedNbaArchive} from '@/services/nba-shared-storage.service';
export const dynamic='force-dynamic';export const revalidate=0;export const maxDuration=120;
function authorized(r:NextRequest){const s=process.env.CRON_SECRET;return Boolean(s)&&(r.headers.get('authorization')===`Bearer ${s}`||r.nextUrl.searchParams.get('secret')===s);}
async function handle(r:NextRequest){const id=requestId(r);if(!authorized(r))return apiError({id,code:'UNAUTHORIZED',message:'Unauthorized',status:401});
 try{if(r.nextUrl.searchParams.get('mode')==='status'||r.nextUrl.searchParams.get('status')==='precheck')return apiOk(await getNbaGoatRuntimeStatus(),id);
 const marketDataArchive=await runSharedNbaArchive(r.headers.get('x-vercel-oidc-token')??'','cron');
 console.log('NBA_MARKET_ARCHIVE',JSON.stringify(marketDataArchive));
 const shadow=await runNbaGoatShadowScheduler();console.log('NBA_GOAT_SHADOW',JSON.stringify({classification:shadow.finalClassification,provider:'balldontlie',providerCalls:0}));
 return apiOk({marketDataArchive,shadow,legacyOddsApiCalls:0},id);
 }catch{return apiError({id,code:'INTERNAL_ERROR',message:'NBA GOAT runtime failed; no provider fallback',status:500});}}
export async function GET(r:NextRequest){return handle(r);}export async function POST(r:NextRequest){return handle(r);}
