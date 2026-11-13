import {NextResponse} from 'next/server';
import {getNcaabCausalLearningReport} from '@/services/ncaab-causal-learning.service';
export const dynamic='force-dynamic';
export async function GET(){try{return NextResponse.json(await getNcaabCausalLearningReport(),{headers:{'Cache-Control':'private, no-store'}});}catch{return NextResponse.json({status:'UNAVAILABLE',warning:'NCAAB causal learning unavailable; no causes are inferred.'},{status:503,headers:{'Cache-Control':'private, no-store'}});}}
