import { NextResponse } from 'next/server'
import { SHARED_MLB_PITCHER_ER_OUTCOME_VERSION } from '@/lib/shared-mlb-pitcher-er-outcome-contract'
import { readSharedPitcherErOutcomePage } from '@/services/shared-mlb-pitcher-er-outcomes.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  const params = new URL(request.url).searchParams
  const cursorRaw = params.get('cursor') ?? '0'
  const limitRaw = params.get('limit') ?? '50'
  const season = params.get('season') ?? '2025'

  if (
    !/^\d+$/.test(cursorRaw) ||
    !/^\d+$/.test(limitRaw) ||
    !Number.isSafeInteger(Number(cursorRaw)) ||
    !Number.isSafeInteger(Number(limitRaw)) ||
    Number(limitRaw) < 1 ||
    Number(limitRaw) > 100 ||
    season !== '2025'
  ) {
    return NextResponse.json({
      version: SHARED_MLB_PITCHER_ER_OUTCOME_VERSION,
      status: 'INVALID_SCOPE',
      data: [],
    }, { status: 400, headers })
  }

  try {
    const cursor = Number(cursorRaw)
    const limit = Number(limitRaw)
    const page = await readSharedPitcherErOutcomePage(cursor, limit)
    return NextResponse.json({
      version: SHARED_MLB_PITCHER_ER_OUTCOME_VERSION,
      status: page.data.length ? 'AVAILABLE' : 'EMPTY',
      asOf: new Date().toISOString(),
      season: 2025,
      data: page.data,
      nextCursor: page.nextCursor,
    }, { headers })
  } catch {
    return NextResponse.json({
      version: SHARED_MLB_PITCHER_ER_OUTCOME_VERSION,
      status: 'CANONICAL_PITCHER_ER_READ_UNAVAILABLE',
      data: [],
    }, { status: 503, headers })
  }
}
