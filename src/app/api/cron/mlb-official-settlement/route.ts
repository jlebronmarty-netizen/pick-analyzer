import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { settleMlbOfficialPickBacklog } from '@/services/pick2-mlb-certified-settlement-cron.service'
import { freezeBdlPregameLineups } from '@/services/mlb-bdl-pregame-lineup-freeze.service'

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

  let researchLineupCapture: unknown
  try {
    researchLineupCapture = await freezeBdlPregameLineups()
  } catch (error) {
    researchLineupCapture = {
      success: false,
      status: 'BDL_PREGAME_LINEUP_FREEZE_FAILED_NON_BLOCKING',
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      providerCallsMade: 0,
      rowsInserted: 0,
      error: error instanceof Error ? error.message : 'UNKNOWN_BDL_LINEUP_CAPTURE_ERROR',
    }
  }

  try {
    const result = await settleMlbOfficialPickBacklog()
    return NextResponse.json({
      ...result,
      researchLineupCapture,
    }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      status: 'MLB_OFFICIAL_SETTLEMENT_CRON_FAILED',
      error: error instanceof Error ? error.message : 'UNKNOWN_SETTLEMENT_CRON_ERROR',
      researchLineupCapture,
      officialPicksModified: false,
      apostarActivated: false,
    }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
