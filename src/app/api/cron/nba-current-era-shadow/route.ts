import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getNbaCurrentEraShadowSchedulerPrecheckStatus, runNbaCurrentEraShadowSchedulerCanary } from '@/services/nba-current-era-shadow-scheduler.service'
import { runSharedNbaArchive } from '@/services/nba-shared-storage.service'
export const dynamic='force-dynamic'
export const revalidate=0
export const maxDuration=120
function authorized(request:NextRequest){const secret=process.env.CRON_SECRET;return Boolean(secret)&&(request.headers.get('authorization')===`Bearer ${secret}`||request.nextUrl.searchParams.get('secret')===secret)}
function statusFor(c:string){return c==='PERSISTENCE_FAILURE_BLOCKED'||c==='PROVIDER_FAILURE_BLOCKED'?502:c==='PROVIDER_BUDGET_NO_OP'?409:200}
async function handle(request:NextRequest){
 const id=requestId(request)
 if(!authorized(request))return apiError({id,code:'UNAUTHORIZED',message:'Unauthorized',status:401})
 try{
  if(request.nextUrl.searchParams.get('mode')==='status'||request.nextUrl.searchParams.get('status')==='precheck'){
   const result=await getNbaCurrentEraShadowSchedulerPrecheckStatus();return apiOk({...result,route:'/api/cron/nba-current-era-shadow',providerCallsFromCertificationReads:0,databaseMutationsFromCertificationReads:0},id)
  }
  let marketDataArchive:unknown
  try{marketDataArchive=await runSharedNbaArchive(request.headers.get('x-vercel-oidc-token')??'','cron')}catch{marketDataArchive={status:'failed',error:'ARCHIVE_UNAVAILABLE'}}
  console.log('NBA_MARKET_ARCHIVE',JSON.stringify(marketDataArchive))
  const result=await runNbaCurrentEraShadowSchedulerCanary()
  return apiOk({...result,marketDataArchive,route:'/api/cron/nba-current-era-shadow',providerCallsFromCertificationReads:0},id,{status:statusFor(result.finalClassification)})
 }catch(e){return apiError({id,code:'INTERNAL_ERROR',message:errorMessage(e,'NBA shadow scheduler failed'),status:500})}
}
export async function GET(r:NextRequest){return handle(r)}
export async function POST(r:NextRequest){return handle(r)}
