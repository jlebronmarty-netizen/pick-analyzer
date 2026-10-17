import { NextResponse } from 'next/server';
import { getTableTennisReport } from '@/services/table-tennis-read.service';
export const dynamic = 'force-dynamic';
export async function GET() { const report = await getTableTennisReport(); return NextResponse.json({ ...report, providerCalls: 0, databaseWrites: 0 }, { status: report.status === 'AVAILABLE' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }); }
