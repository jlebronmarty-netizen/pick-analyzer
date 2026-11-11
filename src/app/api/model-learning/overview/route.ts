import {NextResponse} from 'next/server';
import {getMultisportLearningOverview} from '@/services/multisport-learning-overview.service';
export const dynamic='force-dynamic';
export async function GET(){
  try{return NextResponse.json(await getMultisportLearningOverview(),{headers:{'Cache-Control':'private, no-store'}});}
  catch{return NextResponse.json({status:'UNAVAILABLE',warning:'Model Learning no disponible; no se inventan candidatos.'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
