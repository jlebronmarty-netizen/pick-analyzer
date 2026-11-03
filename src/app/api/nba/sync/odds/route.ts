import {NextRequest,NextResponse} from 'next/server'
import {parseNbaSyncOptions,syncNbaOdds,validateNbaSyncOptions} from '@/services/nba-data-sync.service'
import {archiveEnabled,runLegacySharedSync} from '@/services/nba-shared-storage.service'
export const maxDuration=60
export async function POST(request:NextRequest){
 const secret=process.env.CRON_SECRET
 if(!secret||!(request.headers.get('authorization')===`Bearer ${secret}`||request.nextUrl.searchParams.get('secret')===secret))return NextResponse.json({success:false,error:'Unauthorized'},{status:401})
 const options=parseNbaSyncOptions(request.nextUrl.searchParams),validation=validateNbaSyncOptions(options)
 if(!validation.valid)return NextResponse.json({success:false,errors:validation.errors},{status:400})
 try{const result=archiveEnabled()?await runLegacySharedSync('odds',options):await syncNbaOdds(options);return NextResponse.json(result,{status:result.success?200:207})}catch{return NextResponse.json({success:false,error:'LIVE_FEED_SYNC_FAILED_OR_HISTORICAL_REQUEST_UNSUPPORTED'},{status:502})}
}
