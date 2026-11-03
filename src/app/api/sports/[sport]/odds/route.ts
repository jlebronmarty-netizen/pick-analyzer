import {NextRequest,NextResponse} from 'next/server'
import {getMultiSportOdds,parseMultiSportQuery,getMultiSportDetail} from '@/services/multi-sport-query.service'
import {isSportKey} from '@/services/multi-sport-resolution.service'
import {archiveEnabled,storedNbaOdds} from '@/services/nba-shared-storage.service'
import {privateHost} from '@/lib/nba-production-feed.mjs'
type RouteContext={params:Promise<{sport:string}>}
export async function GET(request:NextRequest,context:RouteContext){
 const {sport}=await context.params
 if(!isSportKey(sport))return NextResponse.json({success:false,error:`Unsupported sport key: ${sport}`},{status:404})
 const query=parseMultiSportQuery(sport,request.nextUrl.searchParams)
 if(sport==='basketball_nba'&&archiveEnabled()&&(!query.providerId||query.providerId==='balldontlie')){
  if(!privateHost(request,process.env)||!request.headers.get('x-vercel-oidc-token'))return NextResponse.json({success:false,error:'PRIVATE_DEPLOYMENT_REQUIRED',odds:[]},{status:403})
  const r=await storedNbaOdds(query)
  return NextResponse.json({success:r.success,sport:getMultiSportDetail(sport).sport,odds:r.data,warnings:r.warnings,error:r.error,source:'DURABLE_SHARED_MARKET_ARCHIVE',modelValidation:false},{status:r.success?200:502,headers:{'Cache-Control':'private, no-store'}})
 }
 const result=await getMultiSportOdds(query)
 return NextResponse.json(result,{status:result.success?200:502})
}
