import {NextResponse} from 'next/server';
import {getNcaafCausalLearningReport} from '@/services/ncaaf-causal-learning.service';
export const dynamic='force-dynamic';
export async function GET(){try{return NextResponse.json(await getNcaafCausalLearningReport(),{headers:{'Cache-Control':'private, no-store'}});}catch{return NextResponse.json({status:'UNAVAILABLE',warning:'NCAAF causal learning unavailable; no causes are inferred.'},{status:503,headers:{'Cache-Control':'private, no-store'}});}}
