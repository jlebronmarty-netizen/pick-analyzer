import { NextResponse } from 'next/server'
import { getMlbOperationalView } from '@/services/pick2-operational-read.service'
export const dynamic = 'force-dynamic'
export async function GET() { return NextResponse.json(await getMlbOperationalView(), { headers: { 'Cache-Control': 'no-store' } }) }
