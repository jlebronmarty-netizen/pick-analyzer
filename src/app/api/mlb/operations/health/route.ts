import { NextResponse } from 'next/server'
import { getMlbOperationalHealth } from '@/services/pick2-mlb-health.service'
export const dynamic = 'force-dynamic'
export async function GET() { return NextResponse.json(await getMlbOperationalHealth(), { headers: { 'Cache-Control': 'no-store' } }) }
