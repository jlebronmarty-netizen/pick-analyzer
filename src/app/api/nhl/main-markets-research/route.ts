import {NextResponse} from 'next/server';
import {getNhlMainMarketsResearchAudit} from '@/services/nhl-main-markets-research.service';
export const dynamic='force-dynamic';export const revalidate=0;
export async function GET(){
 try{return NextResponse.json(await getNhlMainMarketsResearchAudit(),{headers:{'Cache-Control':'private, no-store'}});}
 catch{return NextResponse.json({status:'UNAVAILABLE',warning:'NHL main markets research audit unavailable; no betting recommendations inferred.'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
