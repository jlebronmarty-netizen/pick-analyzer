import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const SPORT_KEY = 'baseball_mlb'
const MARKET = 'pitcher_earned_runs'
const PROVIDER_EVENT_ID = 'b9c3b50472005c67c30de323cd8a5396'

function headerNumber(headers: Headers, name: string) {
  const value = headers.get(name)
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ status: 'NOT_AVAILABLE' }, { status: 404 })
  }

  const apiKey = process.env.THE_ODDS_API_KEY?.trim() ?? ''
  if (!apiKey) {
    return NextResponse.json({ status: 'BLOCKED_MISSING_API_KEY' }, { status: 503 })
  }

  const url = new URL(`https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/events/${PROVIDER_EVENT_ID}/odds`)
  url.searchParams.set('apiKey', apiKey)
  url.searchParams.set('regions', 'us')
  url.searchParams.set('markets', MARKET)
  url.searchParams.set('oddsFormat', 'american')

  const response = await fetch(url.toString(), {
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })

  const requestsLast = headerNumber(response.headers, 'x-requests-last')
  const requestsRemaining = headerNumber(response.headers, 'x-requests-remaining')
  const requestsUsed = headerNumber(response.headers, 'x-requests-used')
  const payload = await response.json().catch(() => null) as any

  if (!response.ok) {
    return NextResponse.json({
      status: 'PROBE_HTTP_ERROR',
      provider: 'the-odds-api',
      market: MARKET,
      providerEventId: PROVIDER_EVENT_ID,
      httpStatus: response.status,
      requestsLast,
      requestsRemaining,
      requestsUsed,
      providerMessage: payload?.message ?? null,
      providerErrorCode: payload?.error_code ?? null,
      researchOnly: true,
      supabaseWrites: 0,
      officialPicksModified: false,
      apostarActivated: false,
      apiKeyExposed: false,
    }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  }

  const quotes: Array<Record<string, unknown>> = []
  for (const bookmaker of payload?.bookmakers ?? []) {
    for (const market of bookmaker?.markets ?? []) {
      if (market?.key !== MARKET) continue
      for (const outcome of market?.outcomes ?? []) {
        const price = Number(outcome?.price)
        const line = Number(outcome?.point)
        if (!Number.isFinite(price) || !Number.isFinite(line)) continue
        quotes.push({
          sportsbook: String(bookmaker?.key ?? bookmaker?.title ?? 'unknown'),
          sportsbookTitle: String(bookmaker?.title ?? bookmaker?.key ?? 'unknown'),
          bookmakerLastUpdate: bookmaker?.last_update ?? null,
          marketLastUpdate: market?.last_update ?? null,
          player: String(outcome?.description ?? outcome?.name ?? ''),
          selection: String(outcome?.name ?? ''),
          line,
          price,
        })
      }
    }
  }

  return NextResponse.json({
    status: quotes.length ? 'AVAILABLE' : 'NO_QUOTES_RETURNED',
    contractCandidate: 'PA13_PITCHER_ER_CURRENT_PROVIDER_PROBE/1.0.0',
    provider: 'the-odds-api',
    sportKey: SPORT_KEY,
    market: MARKET,
    providerEventId: PROVIDER_EVENT_ID,
    httpStatus: response.status,
    commenceTime: payload?.commence_time ?? null,
    homeTeam: payload?.home_team ?? null,
    awayTeam: payload?.away_team ?? null,
    bookmakerCount: new Set(quotes.map((row) => String(row.sportsbook))).size,
    quoteCount: quotes.length,
    playerCount: new Set(quotes.map((row) => String(row.player)).filter(Boolean)).size,
    lines: [...new Set(quotes.map((row) => Number(row.line)))].sort((a, b) => a - b),
    books: [...new Set(quotes.map((row) => String(row.sportsbook)))].sort(),
    quotes,
    requestsLast,
    requestsRemaining,
    requestsUsed,
    researchOnly: true,
    historicalPricingCertified: false,
    roiCertified: false,
    clvCertified: false,
    evCertified: false,
    supabaseWrites: 0,
    officialPicksModified: false,
    apostarActivated: false,
    apiKeyExposed: false,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
