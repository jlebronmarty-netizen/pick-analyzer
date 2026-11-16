import {NextResponse} from 'next/server';
import {getNhlEspnFreeGoalieReadiness} from '@/services/nhl-espn-free-goalie-readiness.service';
export const dynamic='force-dynamic';export const revalidate=0;
export async function GET(){
 try{return NextResponse.json(await getNhlEspnFreeGoalieReadiness(),{headers:{'Cache-Control':'private, no-store'}});}
 catch{return NextResponse.json({status:'UNAVAILABLE',warning:'Free NHL goalie source not yet verified; no starter assumptions.'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
