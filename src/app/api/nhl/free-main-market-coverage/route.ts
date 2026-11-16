import {NextResponse} from 'next/server';
import {getNhlFreeCircaMainMarketsAudit} from '@/services/nhl-free-circa-market-audit.service';
export const dynamic='force-dynamic';export const revalidate=0;
export async function GET(){
 try{return NextResponse.json(await getNhlFreeCircaMainMarketsAudit(),{headers:{'Cache-Control':'private, no-store'}});}
 catch{return NextResponse.json({status:'UNAVAILABLE',warning:'Stored free Circa market-pair coverage could not be verified.'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
