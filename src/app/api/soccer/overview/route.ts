import {NextResponse} from 'next/server';
import {getSoccerShadowReport} from '@/services/soccer-shadow-read.service';
export const dynamic='force-dynamic';
export async function GET(){const r=await getSoccerShadowReport();return NextResponse.json({...r,providerCalls:0,databaseWrites:0},{status:r.status==='AVAILABLE'?200:503,headers:{'Cache-Control':'no-store'}});}
