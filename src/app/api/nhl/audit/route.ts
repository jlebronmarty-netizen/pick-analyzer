import {NextResponse} from 'next/server';
import {getNhlProductionAudit} from '@/services/nhl-production-audit.service';
export const dynamic='force-dynamic';export const revalidate=0;
export async function GET(){
 try{return NextResponse.json(await getNhlProductionAudit(),{headers:{'Cache-Control':'private, no-store'}});}
 catch{return NextResponse.json({status:'UNAVAILABLE',warning:'NHL audit unavailable; model certification not assumed.'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
