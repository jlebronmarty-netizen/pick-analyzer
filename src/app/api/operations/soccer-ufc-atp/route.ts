import {NextResponse} from 'next/server';
import {getThreeSportsReadiness} from '@/services/three-sports-readiness.service';

export const dynamic='force-dynamic';
export const revalidate=0;

export async function GET(){
 try{return NextResponse.json(await getThreeSportsReadiness(),{
  headers:{'Cache-Control':'private, no-store'}
 });}
 catch{return NextResponse.json({
  status:'UNAVAILABLE',readOnly:true,
  warning:'Soccer/UFC/ATP readiness could not be verified from saved evidence; no picks or accuracy can be inferred.'
 },{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
