import { NextResponse } from 'next/server'
import { getMlbOfficialPerformance } from '@/services/pick2-mlb-performance-read.service'
export const dynamic = 'force-dynamic'
export async function GET() { return NextResponse.json(await getMlbOfficialPerformance(), { headers: { 'Cache-Control': 'no-store' } }) }
