import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const BASE = 'https://api.the-odds-api.com/v4'
const SPORT = 'baseball_mlb'
const HISTORICAL_AT = '2025-09-01T16:05:00Z'
const TARGET = { home: 'Washington Nationals', away: 'Miami Marlins' }
const CREDIT_RESERVE = 2000
const MAX_PROVIDER_CALLS = 2
const CONFIRM = 'ODDS_API_HISTORICAL_PERIOD_MARKET_DISCOVERY_V2'

type CallEvidence = {
  path: string
  status: number
  ok: boolean
  last: number | null
  remaining: number | null
  used: number | null
}

function cronSecret() {
  return process.env.CRON_SECRET?.trim() ?? ''
}

function authorized(request: NextRequest) {
  const secret = cronSecret()
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

function apiKey() {
  return process.env.THE_ODDS_API_KEY?.trim() ?? ''
}

function headerNumber(headers: Headers, name: string) {
  const raw = headers.get(name)
  if (raw === null) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function marketKeys(payload: unknown) {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const data = record.data && typeof record.data === 'object' ? record.data as Record<string, unknown> : record
  const bookmakers = Array.isArray(data.bookmakers) ? data.bookmakers : []
  const keys = new Set<string>()
  for (const bookmaker of bookmakers) {
    if (!bookmaker || typeof bookmaker !== 'object') continue
    const markets = Array.isArray((bookmaker as Record<string, unknown>).markets)
      ? (bookmaker as Record<string, unknown>).markets as unknown[]
      : []
    for (const market of markets) {
      if (!market || typeof market !== 'object') continue
      const key = String((market as Record<string, unknown>).key ?? '').trim()
      if (key) keys.add(key)
    }
  }
  return [...keys].sort()
}

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ success: false, status: 'BLOCKED_NON_PRODUCTION' }, { status: 403 })
  }
  if (!cronSecret()) {
    return NextResponse.json({ success: false, status: 'BLOCKED_MISSING_CRON_SECRET' }, { status: 503 })
  }
  if (!authorized(request)) {
    return NextResponse.json({ success: false, status: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (request.nextUrl.searchParams.get('confirm') !== CONFIRM) {
    return NextResponse.json({ success: false, status: 'CONFIRMATION_REQUIRED' }, { status: 403 })
  }

  const key = apiKey()
  if (!key) {
    return NextResponse.json({
      success: false,
      status: 'BLOCKED_MISSING_THE_ODDS_API_KEY',
      providerCallsMade: 0,
      creditsObserved: 0,
    }, { status: 503 })
  }

  const calls: CallEvidence[] = []
  const get = async (path: string, query: Record<string, string>) => {
    if (calls.length >= MAX_PROVIDER_CALLS) throw new Error('HARD_CALL_BUDGET_REACHED')
    const priorRemaining = calls.at(-1)?.remaining
    if (typeof priorRemaining === 'number' && priorRemaining <= CREDIT_RESERVE) {
      throw new Error('CREDIT_RESERVE_REACHED')
    }

    const url = new URL(BASE + path)
    url.searchParams.set('apiKey', key)
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value)

    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
    const text = await response.text()
    let payload: unknown = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = null
    }

    calls.push({
      path,
      status: response.status,
      ok: response.ok,
      last: headerNumber(response.headers, 'x-requests-last'),
      remaining: headerNumber(response.headers, 'x-requests-remaining'),
      used: headerNumber(response.headers, 'x-requests-used'),
    })

    if (calls.at(-1)?.remaining === null) throw new Error('CREDIT_HEADERS_UNAVAILABLE')
    if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`)
    return payload
  }

  try {
    const eventsPayload = await get(
      `/historical/sports/${SPORT}/events`,
      { date: HISTORICAL_AT },
    )
    const eventsRecord = eventsPayload && typeof eventsPayload === 'object'
      ? eventsPayload as Record<string, unknown>
      : {}
    const events = Array.isArray(eventsRecord.data) ? eventsRecord.data : []
    const event = events.find((candidate) => {
      if (!candidate || typeof candidate !== 'object') return false
      const row = candidate as Record<string, unknown>
      return row.home_team === TARGET.home && row.away_team === TARGET.away
    }) as Record<string, unknown> | undefined

    if (!event?.id) {
      return NextResponse.json({
        success: false,
        status: 'TARGET_EVENT_NOT_FOUND',
        historicalAt: HISTORICAL_AT,
        target: TARGET,
        providerCallsMade: calls.length,
        creditsObserved: calls.reduce((sum, call) => sum + (call.last ?? 0), 0),
        requestsRemainingAfter: calls.at(-1)?.remaining ?? null,
        calls,
        historicalOddsRequested: false,
        rowsPersisted: 0,
        productionMutationsMade: 0,
      })
    }

    if ((calls.at(-1)?.remaining ?? 0) <= CREDIT_RESERVE) {
      return NextResponse.json({
        success: false,
        status: 'CREDIT_RESERVE_REACHED_AFTER_EVENT_DISCOVERY',
        providerCallsMade: calls.length,
        creditsObserved: calls.reduce((sum, call) => sum + (call.last ?? 0), 0),
        requestsRemainingAfter: calls.at(-1)?.remaining ?? null,
        creditReserve: CREDIT_RESERVE,
        calls,
        historicalOddsRequested: false,
        rowsPersisted: 0,
        productionMutationsMade: 0,
      })
    }

    const providerEventId = String(event.id)
    const marketsPayload = await get(
      `/historical/sports/${SPORT}/events/${encodeURIComponent(providerEventId)}/markets`,
      { date: HISTORICAL_AT, regions: 'us', dateFormat: 'iso' },
    )
    const allMarketKeys = marketKeys(marketsPayload)
    const targetMarketKeys = allMarketKeys.filter((market) =>
      /(?:1st_[1357]_innings|team_totals|alternate_team_totals)/.test(market),
    )

    return NextResponse.json({
      success: true,
      status: 'PASS',
      mode: 'ODDS_API_HISTORICAL_PERIOD_MARKET_DISCOVERY_V2',
      historicalAt: HISTORICAL_AT,
      target: TARGET,
      providerEventId,
      commenceTime: event.commence_time ?? null,
      providerCallsMade: calls.length,
      creditsObserved: calls.reduce((sum, call) => sum + (call.last ?? 0), 0),
      requestsRemainingAfter: calls.at(-1)?.remaining ?? null,
      creditReserve: CREDIT_RESERVE,
      allMarketKeys,
      targetMarketKeys,
      calls,
      historicalOddsRequested: false,
      rowsPersisted: 0,
      productionMutationsMade: 0,
      researchOnly: true,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      status: 'FAILED',
      providerCallsMade: calls.length,
      creditsObserved: calls.reduce((sum, call) => sum + (call.last ?? 0), 0),
      requestsRemainingAfter: calls.at(-1)?.remaining ?? null,
      creditReserve: CREDIT_RESERVE,
      calls,
      error: error instanceof Error ? error.message : String(error),
      historicalOddsRequested: false,
      rowsPersisted: 0,
      productionMutationsMade: 0,
      researchOnly: true,
    }, { status: 500 })
  }
}
