import {NextResponse} from 'next/server';
import {getNhlExactCircaMarketResearch} from '@/services/nhl-exact-circa-market-research.service';

export const dynamic='force-dynamic';
export const revalidate=0;

export async function GET(){
 try{return NextResponse.json(await getNhlExactCircaMarketResearch(),
  {headers:{'Cache-Control':'private, no-store'}});}
 catch{return NextResponse.json({
  status:'UNAVAILABLE',readOnly:true,
  warning:'NHL exact Circa line research could not be verified; do not infer picks or market edge.'
 },{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
