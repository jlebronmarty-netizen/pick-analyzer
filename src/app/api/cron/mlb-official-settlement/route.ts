import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { settleMlbOfficialPickBacklog } from '@/services/pick2-mlb-certified-settlement-cron.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const supplied = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ success: false, status: 'AUTH_REQUIRED' }, { status: 503 })
  }
  if (!authorized(request)) {
    return NextResponse.json({ success: false, status: 'UNAUTHORIZED' }, { status: 401 })
  }

  try {
    const result = await settleMlbOfficialPickBacklog()
    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      status: 'MLB_OFFICIAL_SETTLEMENT_CRON_FAILED',
      error: error instanceof Error ? error.message : 'UNKNOWN_SETTLEMENT_CRON_ERROR',
      officialPicksModified: false,
      apostarActivated: false,
    }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
