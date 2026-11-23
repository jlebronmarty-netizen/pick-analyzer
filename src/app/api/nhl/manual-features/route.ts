import {NextRequest,NextResponse} from 'next/server';
import {getNhlManualFeatures} from '@/services/nhl-manual-features.service';
import {nhlManualFeatureDayBounds} from '@/lib/nhl-manual-features.mjs';

export const dynamic='force-dynamic';
export const revalidate=0;
export const maxDuration=30;
const headers={'Cache-Control':'private, no-store'};

export async function GET(request:NextRequest) {
  const date=request.nextUrl.searchParams.get('date')??undefined;
  if(date!==undefined)try{nhlManualFeatureDayBounds(date);}catch{
    return NextResponse.json({status:'INVALID_DATE',warnings:['Usa una fecha válida YYYY-MM-DD.'],readOnly:true,providerCalls:0,databaseWrites:0},{status:400,headers});
  }
  const report=await getNhlManualFeatures(date);
  return NextResponse.json(report,{status:['READ_UNAVAILABLE','SOURCE_SCAN_CAPPED'].includes(report.status)?503:200,headers});
}
