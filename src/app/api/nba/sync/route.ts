import {NextRequest,NextResponse} from 'next/server';
import {parseNbaSyncOptions,validateNbaSyncOptions} from '@/services/nba-data-sync.service';
import {archiveEnabled,runLegacySharedSync} from '@/services/nba-shared-storage.service';
export const dynamic='force-dynamic';export const maxDuration=60;
async function handle(r:NextRequest){const secret=process.env.CRON_SECRET;if(!secret||(r.headers.get('authorization')!==`Bearer ${secret}`&&r.nextUrl.searchParams.get('secret')!==secret))return NextResponse.json({success:false,error:'Unauthorized'},{status:401});
 if(!archiveEnabled())return NextResponse.json({success:false,error:'NBA_GOAT_FEED_DISABLED_NO_ODDS_API_FALLBACK'},{status:503});
 const options=parseNbaSyncOptions(r.nextUrl.searchParams),validation=validateNbaSyncOptions(options);if(!validation.valid)return NextResponse.json({success:false,errors:validation.errors},{status:400});
 try{const markets=await runLegacySharedSync('odds',options);return NextResponse.json({success:false,status:'PARTIAL_MARKET_DATA_SYNC',provider:'balldontlie',markets,missingScopes:['CURRENT_TEAM_STATS','VERIFIED_RESULTS_PIPELINE','MODEL_READINESS'],legacyProviderCalls:0,warning:'Market archive refreshed only; not a full NBA data/model sync.'},{status:207});}catch{return NextResponse.json({success:false,error:'NBA_GOAT_SYNC_FAILED_NO_FALLBACK'},{status:502});}}
export async function POST(r:NextRequest){return handle(r);}export async function GET(r:NextRequest){return handle(r);}
