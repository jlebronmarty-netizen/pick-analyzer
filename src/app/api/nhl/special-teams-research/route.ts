import {NextResponse} from 'next/server';
import {getNhlSpecialTeamsResearchStatus} from '@/services/nhl-special-teams-readiness.service';
export const dynamic='force-dynamic';export const revalidate=0;
export async function GET(){
 try{return NextResponse.json(await getNhlSpecialTeamsResearchStatus(),{headers:{'Cache-Control':'private, no-store'}});}
 catch{return NextResponse.json({status:'UNAVAILABLE',warning:'NHL special teams research source verification is unavailable; no PP/PK assumptions permitted.'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
