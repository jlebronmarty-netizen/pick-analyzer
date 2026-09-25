import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { probeMlbMainMarketBdlOpeningCoverage } from '@/services/mlb-main-market-bdl-opening-probe.service'

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
  if (new URL(request.url).search) {
    return NextResponse.json({ success: false, status: 'INVALID_REQUEST' }, { status: 400 })
  }
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ success: false, status: 'AUTH_REQUIRED' }, { status: 503 })
  }
  if (!authorized(request)) {
    return NextResponse.json({ success: false, status: 'UNAUTHORIZED' }, { status: 401 })
  }
  try {
    const result = await probeMlbMainMarketBdlOpeningCoverage()
    return NextResponse.json(result, {
      status: result.success ? 200 : 409,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      status: 'BDL_2025_OPENING_COVERAGE_PROBE_FAILED',
      researchOnly: true,
      officialPicksModified: false,
      apostarActivated: false,
      historicalOddsApiCalls: 0,
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
