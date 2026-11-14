import {NextResponse} from 'next/server';
import {getNbaPropsProspectiveShadowReadiness} from '@/services/nba-goat-props-shadow-readiness.service';
export const dynamic='force-dynamic';export const revalidate=0;
export async function GET(){
 try{return NextResponse.json(await getNbaPropsProspectiveShadowReadiness(),{headers:{'Cache-Control':'private, no-store'}});}
 catch{return NextResponse.json({status:'UNAVAILABLE',warning:'NBA prospective props research readiness unavailable; no predictions assumed.'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
