import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const BASE_URL = 'https://api.the-odds-api.com/v4/sports/baseball_mlb/odds'

export async function GET(request: NextRequest) {
  const apiKey = process.env.THE_ODDS_API_KEY?.trim() ?? ''
  if (!apiKey) {
    return NextResponse.json({ ok: false, blocker: 'THE_ODDS_API_KEY_NOT_PRESENT' }, { status: 503 })
  }

  const expected = createHash('sha256').update(`${apiKey}:excel-v2-20260915`).digest('hex').slice(0, 32)
  if (request.nextUrl.searchParams.get('token') !== expected) {
    return NextResponse.json({ ok: false, blocker: 'UNAUTHORIZED' }, { status: 401 })
  }

  const url = new URL(BASE_URL)
  url.searchParams.set('apiKey', apiKey)
  url.searchParams.set('bookmakers', 'fanduel,williamhill_us')
  url.searchParams.set('markets', 'h2h,spreads,totals')
  url.searchParams.set('oddsFormat', 'american')
  url.searchParams.set('dateFormat', 'iso')
  url.searchParams.set('commenceTimeFrom', '2026-09-15T04:00:00Z')
  url.searchParams.set('commenceTimeTo', '2026-09-16T04:00:00Z')

  const response = await fetch(url.toString(), { cache: 'no-store' })
  const payload = await response.json().catch(() => null)

  return NextResponse.json({
    ok: response.ok,
    fetchedAt: new Date().toISOString(),
    providerStatus: response.status,
    quota: {
      remaining: response.headers.get('x-requests-remaining'),
      used: response.headers.get('x-requests-used'),
      last: response.headers.get('x-requests-last'),
    },
    events: response.ok && Array.isArray(payload) ? payload : [],
    providerError: response.ok ? null : payload,
  }, { status: response.ok ? 200 : 502 })
}
