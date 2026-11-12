import {NextResponse} from 'next/server';
import {getNbaCausalLearningReport} from '@/services/nba-causal-learning.service';
export const dynamic='force-dynamic';
export async function GET(){
  try{return NextResponse.json(await getNbaCausalLearningReport(),{headers:{'Cache-Control':'private, no-store'}});}
  catch{return NextResponse.json({status:'UNAVAILABLE',warning:'NBA causal learning unavailable; no causes are inferred.'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
