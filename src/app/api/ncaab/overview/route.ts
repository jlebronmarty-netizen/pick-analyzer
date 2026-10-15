import {NextResponse} from 'next/server';
import {getNcaabCheckpoint} from '@/services/ncaab-checkpoint-read.service';
export const dynamic='force-dynamic';
export async function GET(){const report=getNcaabCheckpoint();return NextResponse.json({...report,providerCalls:0,databaseWrites:0},{status:report.status==='AVAILABLE'?200:503,headers:{'Cache-Control':'no-store'}});}
