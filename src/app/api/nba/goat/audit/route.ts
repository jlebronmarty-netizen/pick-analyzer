import {NextResponse} from 'next/server';
import {getNbaGoatAuditReport} from '@/services/nba-goat-audit.service';
export const dynamic='force-dynamic';
export async function GET(){try{return NextResponse.json(await getNbaGoatAuditReport(),{headers:{'Cache-Control':'private, no-store'}});}catch{return NextResponse.json({status:'UNAVAILABLE',warning:'NBA GOAT audit unavailable.'},{status:503,headers:{'Cache-Control':'private, no-store'}});}}
