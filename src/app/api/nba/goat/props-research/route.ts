import {NextResponse} from 'next/server';
import {getNbaGoatPropsResearchAudit} from '@/services/nba-goat-props-research.service';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  return NextResponse.json(await getNbaGoatPropsResearchAudit(),{headers:{'Cache-Control':'private, no-store'}});
 }catch{
  return NextResponse.json({status:'UNAVAILABLE',warning:'NBA props research audit unavailable.'},{status:503,headers:{'Cache-Control':'private, no-store'}});
 }
}
