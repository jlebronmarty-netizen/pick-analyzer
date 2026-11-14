import {NextResponse} from 'next/server';
import {getNhlPoissonChallengerAudit} from '@/services/nhl-poisson-challenger-audit.service';
export const dynamic='force-dynamic';export const revalidate=0;
export async function GET(){
 try{return NextResponse.json(await getNhlPoissonChallengerAudit(),{headers:{'Cache-Control':'private, no-store'}});}
 catch{return NextResponse.json({status:'UNAVAILABLE',warning:'NHL challenger research could not be verified; no model performance or picks assumed.'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
