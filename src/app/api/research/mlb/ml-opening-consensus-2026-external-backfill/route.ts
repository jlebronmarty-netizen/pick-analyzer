import { timingSafeEqual } from 'node:crypto'
import { NextRequest,NextResponse } from 'next/server'
import { runMlbBdlOpeningMl2026ExternalBatch } from '@/services/mlb-bdl-opening-ml-2026-external-backfill.service'

export const dynamic='force-dynamic'
export const revalidate=0
export const runtime='nodejs'
export const maxDuration=300

function authorized(request:NextRequest){
  const secret=process.env.CRON_SECRET?.trim()
  if(!secret)return false
  const supplied=Buffer.from(request.headers.get('authorization')??'')
  const expected=Buffer.from('Bearer '+secret)
  return supplied.length===expected.length&&timingSafeEqual(supplied,expected)
}

export async function GET(request:NextRequest){
  if(new URL(request.url).search)return NextResponse.json({success:false,status:'INVALID_REQUEST'},{status:400})
  if(!process.env.CRON_SECRET?.trim())return NextResponse.json({success:false,status:'AUTH_REQUIRED'},{status:503})
  if(!authorized(request))return NextResponse.json({success:false,status:'UNAUTHORIZED'},{status:401})
  try{
    const result=await runMlbBdlOpeningMl2026ExternalBatch()
    return NextResponse.json(result,{status:result.success?200:409,headers:{'Cache-Control':'no-store'}})
  }catch(e){
    return NextResponse.json({success:false,status:'BDL_2026_ML_EXTERNAL_BACKFILL_FAILED',researchOnly:true,externalOnly:true,officialPicksModified:false,apostarActivated:false,historicalOddsApiCalls:0,error:e instanceof Error?e.message:'UNKNOWN_ERROR'},{status:500,headers:{'Cache-Control':'no-store'}})
  }
}
