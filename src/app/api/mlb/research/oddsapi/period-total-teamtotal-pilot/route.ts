import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const BASE = 'https://api.the-odds-api.com/v4'
const SPORT = 'baseball_mlb'
const CREDIT_RESERVE = 2000
const MAX_PROVIDER_CALLS = 10
const MAX_OBSERVED_CREDITS = 402
const CONFIRM = 'MLB_PERIOD_TOTAL_TEAMTOTAL_PILOT_V1'
const ROUTE_VERSION = 'period-total-teamtotal-pilot-v1'

const MARKETS = [
  'totals_1st_3_innings',
  'totals_1st_5_innings',
  'totals_1st_7_innings',
  'team_totals',
  'alternate_team_totals',
]

const COHORTS = [
  {
    discoveryAt: '2025-05-15T15:00:00Z',
    targets: [
      { away: 'Washington Nationals', home: 'Atlanta Braves' },
      { away: 'Minnesota Twins', home: 'Baltimore Orioles' },
      { away: 'Chicago White Sox', home: 'Cincinnati Reds' },
      { away: 'Tampa Bay Rays', home: 'Toronto Blue Jays' },
    ],
  },
  {
    discoveryAt: '2025-08-15T15:00:00Z',
    targets: [
      { away: 'Pittsburgh Pirates', home: 'Chicago Cubs' },
      { away: 'Philadelphia Phillies', home: 'Washington Nationals' },
      { away: 'Texas Rangers', home: 'Toronto Blue Jays' },
      { away: 'San Diego Padres', home: 'Los Angeles Dodgers' },
    ],
  },
]

type ProviderCall = {
  path: string
  status: number
  ok: boolean
  last: number | null
  remaining: number | null
  used: number | null
}

function secret() {
  return process.env.CRON_SECRET?.trim() ?? ''
}

function authorized(request: NextRequest) {
  const expected = secret()
  return Boolean(expected) && request.headers.get('x-pick-analyzer-cron-secret') === expected
}

function apiKey() {
  return process.env.THE_ODDS_API_KEY?.trim() ?? ''
}

function headerNumber(headers: Headers, name: string) {
  const raw = headers.get(name)
  if (raw === null) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function subtractMinutes(iso: string, minutes: number) {
  const value = new Date(iso).getTime()
  if (!Number.isFinite(value)) throw new Error('INVALID_COMMENCE_TIME')
  return new Date(value - minutes * 60_000).toISOString().replace('.000Z', 'Z')
}

function numeric(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function summarizeMarket(eventPayload: any, marketKey: string) {
  const event = eventPayload?.data && typeof eventPayload.data === 'object' ? eventPayload.data : eventPayload
  const books = Array.isArray(event?.bookmakers) ? event.bookmakers : []
  let bookCount = 0
  let outcomeCount = 0
  const points: number[] = []
  const participants = new Set<string>()
  const shapes: string[] = []

  for (const book of books) {
    const markets = Array.isArray(book?.markets) ? book.markets : []
    const market = markets.find((row: any) => row?.key === marketKey)
    if (!market) continue
    bookCount += 1

    const outcomes = Array.isArray(market?.outcomes) ? market.outcomes : []
    for (const outcome of outcomes) {
      outcomeCount += 1
      const point = numeric(outcome?.point)
      if (point !== null) points.push(point)
      const participant = String(outcome?.description ?? outcome?.participant ?? '').trim()
      if (participant) participants.add(participant)
      const side = String(outcome?.name ?? '').trim()
      shapes.push(`${participant || '__GAME__'}|${side || '__SIDE__'}|${point === null ? '__NO_POINT__' : point}`)
    }
  }

  const frequency = Object.entries(shapes.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  return {
    market: marketKey,
    bookCount,
    outcomeCount,
    uniquePoints: [...new Set(points)].sort((a, b) => a - b),
    participantLabels: [...participants].sort(),
    outcomeShapeFrequency: frequency,
  }
}

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ success: false, status: 'BLOCKED_NON_PRODUCTION', routeVersion: ROUTE_VERSION }, { status: 403 })
  }
  if (!secret()) {
    return NextResponse.json({ success: false, status: 'BLOCKED_MISSING_CRON_SECRET', routeVersion: ROUTE_VERSION }, { status: 503 })
  }
  if (!authorized(request)) {
    return NextResponse.json({ success: false, status: 'UNAUTHORIZED', routeVersion: ROUTE_VERSION }, { status: 401 })
  }
  if (request.nextUrl.searchParams.get('confirm') !== CONFIRM) {
    return NextResponse.json({ success: false, status: 'CONFIRMATION_REQUIRED', routeVersion: ROUTE_VERSION }, { status: 403 })
  }

  const key = apiKey()
  if (!key) {
    return NextResponse.json({
      success: false,
      status: 'BLOCKED_MISSING_THE_ODDS_API_KEY',
      routeVersion: ROUTE_VERSION,
      providerCallsMade: 0,
      creditsObserved: 0,
    }, { status: 503 })
  }

  const calls: ProviderCall[] = []
  const get = async (path: string, query: Record<string, string>) => {
    if (calls.length >= MAX_PROVIDER_CALLS) throw new Error('HARD_CALL_BUDGET_REACHED')
    const priorRemaining = calls.at(-1)?.remaining
    if (typeof priorRemaining === 'number' && priorRemaining <= CREDIT_RESERVE) {
      throw new Error('CREDIT_RESERVE_REACHED')
    }

    const url = new URL(BASE + path)
    url.searchParams.set('apiKey', key)
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value)

    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
    const text = await response.text()
    let payload: any = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = null
    }

    const call = {
      path,
      status: response.status,
      ok: response.ok,
      last: headerNumber(response.headers, 'x-requests-last'),
      remaining: headerNumber(response.headers, 'x-requests-remaining'),
      used: headerNumber(response.headers, 'x-requests-used'),
    }
    calls.push(call)

    const creditsObserved = calls.reduce((sum, item) => sum + (item.last ?? 0), 0)
    if (creditsObserved > MAX_OBSERVED_CREDITS) throw new Error('CREDIT_BUDGET_EXCEEDED')
    if (call.remaining === null) throw new Error('CREDIT_HEADERS_UNAVAILABLE')
    if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`)
    return payload
  }

  try {
    const eventRows: any[] = []
    for (const cohort of COHORTS) {
      const eventsPayload = await get(
        `/historical/sports/${SPORT}/events`,
        { date: cohort.discoveryAt },
      )
      const events = Array.isArray(eventsPayload?.data) ? eventsPayload.data : []

      for (const target of cohort.targets) {
        const event = events.find((row: any) =>
          row?.home_team === target.home && row?.away_team === target.away,
        )
        if (!event?.id || !event?.commence_time) {
          eventRows.push({ target, discoveryAt: cohort.discoveryAt, status: 'TARGET_EVENT_NOT_FOUND' })
          continue
        }

        const snapshotAt = subtractMinutes(String(event.commence_time), 60)
        const oddsPayload = await get(
          `/historical/sports/${SPORT}/events/${encodeURIComponent(String(event.id))}/odds`,
          {
            date: snapshotAt,
            regions: 'us',
            markets: MARKETS.join(','),
            dateFormat: 'iso',
            oddsFormat: 'american',
          },
        )

        eventRows.push({
          target,
          providerEventId: String(event.id),
          commenceTime: event.commence_time,
          snapshotAt,
          status: 'PASS',
          markets: MARKETS.map((market) => summarizeMarket(oddsPayload, market)),
        })
      }
    }

    return NextResponse.json({
      success: true,
      status: 'PASS',
      routeVersion: ROUTE_VERSION,
      mode: 'MLB_PERIOD_TOTAL_TEAMTOTAL_PILOT_V1',
      markets: MARKETS,
      targetGames: COHORTS.reduce((sum, cohort) => sum + cohort.targets.length, 0),
      eventRows,
      providerCallsMade: calls.length,
      creditsObserved: calls.reduce((sum, item) => sum + (item.last ?? 0), 0),
      requestsRemainingAfter: calls.at(-1)?.remaining ?? null,
      creditReserve: CREDIT_RESERVE,
      maxObservedCredits: MAX_OBSERVED_CREDITS,
      calls,
      rowsPersisted: 0,
      productionMutationsMade: 0,
      researchOnly: true,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      status: 'FAILED',
      routeVersion: ROUTE_VERSION,
      providerCallsMade: calls.length,
      creditsObserved: calls.reduce((sum, item) => sum + (item.last ?? 0), 0),
      requestsRemainingAfter: calls.at(-1)?.remaining ?? null,
      creditReserve: CREDIT_RESERVE,
      maxObservedCredits: MAX_OBSERVED_CREDITS,
      calls,
      error: error instanceof Error ? error.message : String(error),
      rowsPersisted: 0,
      productionMutationsMade: 0,
      researchOnly: true,
    }, { status: 500 })
  }
}
