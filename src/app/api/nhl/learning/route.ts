import {NextResponse} from 'next/server';
import {getNhlCausalLearningReport} from '@/services/nhl-causal-learning.service';
export const dynamic='force-dynamic';
export async function GET(){
 try{return NextResponse.json(await getNhlCausalLearningReport(),{headers:{'Cache-Control':'private, no-store'}});}
 catch{return NextResponse.json({status:'UNAVAILABLE',warning:'NHL causal learning unavailable; no causes are inferred.'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
