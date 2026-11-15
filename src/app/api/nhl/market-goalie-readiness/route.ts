import {NextResponse} from 'next/server';
import {getNhlMarketGoalieV4Readiness} from '@/services/nhl-market-goalie-v4-readiness.service';
export const dynamic='force-dynamic';export const revalidate=0;
export async function GET(){
 try{return NextResponse.json(await getNhlMarketGoalieV4Readiness(),{headers:{'Cache-Control':'private, no-store'}});}
 catch{return NextResponse.json({status:'UNAVAILABLE',message:'Cannot certify NHL current market prices or starting goalies without source evidence.'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
