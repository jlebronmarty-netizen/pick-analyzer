import {NextResponse} from 'next/server';
import {getNhlLateV6Readiness} from '@/services/nhl-late-v6-readiness.service';
export const dynamic='force-dynamic';export const revalidate=0;
export async function GET(){
 try{return NextResponse.json(await getNhlLateV6Readiness(),{headers:{'Cache-Control':'private, no-store'}});}
 catch{return NextResponse.json({status:'UNAVAILABLE',warning:'NHL late V6 research evidence could not be verified; no picks assumed.'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
