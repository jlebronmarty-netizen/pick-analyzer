import {NextResponse} from 'next/server';
import {getNhlFrozenShadowAudit} from '@/services/nhl-challenger-frozen-ledger-audit.service';
export const dynamic='force-dynamic';export const revalidate=0;
export async function GET(){
 try{return NextResponse.json(await getNhlFrozenShadowAudit(),{headers:{'Cache-Control':'private, no-store'}});}
 catch{return NextResponse.json({status:'UNAVAILABLE',warning:'NHL research ledger audit unavailable; no predictions or settlement assumed.'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
