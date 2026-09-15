import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SPORT = 'baseball_mlb'
const EVENTS_URL = `https://api.the-odds-api.com/v4/sports/${SPORT}/events`
const PLAYER_MARKETS = [
  'batter_doubles_alternate',
  'batter_first_home_run',
  'batter_hits_alternate',
  'batter_hits_runs_rbis_alternate',
  'batter_hits_runs_rbis',
  'batter_home_runs_alternate',
  'batter_home_runs',
  'batter_rbis_alternate',
  'batter_runs_scored_alternate',
  'batter_singles_alternate',
  'batter_stolen_bases',
  'batter_stolen_bases_alternate',
  'batter_total_bases_alternate',
  'batter_total_bases',
  'batter_triples_alternate',
  'batter_walks',
  'pitcher_outs',
  'pitcher_strikeouts',
  'pitcher_strikeouts_alternate',
] as const

function csv(value: unknown) {
  const text = value == null ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

function utcDate(value: string) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'preview') {
    return new Response('PREVIEW_ONLY', { status: 403 })
  }

  const apiKey = process.env.THE_ODDS_API_KEY?.trim()
  if (!apiKey) return new Response('THE_ODDS_API_KEY_NOT_PRESENT', { status: 503 })

  const targetDate = request.nextUrl.searchParams.get('date') || '2026-09-15'
  const eventFilter = request.nextUrl.searchParams.get('event')

  const eventsUrl = new URL(EVENTS_URL)
  eventsUrl.searchParams.set('apiKey', apiKey)
  eventsUrl.searchParams.set('dateFormat', 'iso')
  const eventsResponse = await fetch(eventsUrl.toString(), { cache: 'no-store' })
  const eventsPayload = await eventsResponse.json().catch(() => [])
  if (!eventsResponse.ok || !Array.isArray(eventsPayload)) {
    return new Response('EVENT_DISCOVERY_FAILED', { status: 502 })
  }

  const events = eventsPayload.filter((event: any) => {
    if (eventFilter && event.id !== eventFilter) return false
    const iso = typeof event.commence_time === 'string' ? event.commence_time : ''
    const localSlateDate = utcDate(iso)
    const nextUtcDate = new Date(`${targetDate}T00:00:00Z`)
    nextUtcDate.setUTCDate(nextUtcDate.getUTCDate() + 1)
    const next = nextUtcDate.toISOString().slice(0, 10)
    // Puerto Rico evening slate spans target UTC date and early next UTC date.
    return localSlateDate === targetDate || (localSlateDate === next && new Date(iso).getUTCHours() <= 3)
  })

  const header = [
    'provider_event_id','commence_time','away_team','home_team','book_key','book_title',
    'market_key','market_type','market_last_update','player_name','outcome_name','point','price'
  ]
  const lines = [header.map(csv).join(',')]
  let remaining = ''
  let used = ''
  let lastCost = ''

  for (const event of events) {
    const url = new URL(`https://api.the-odds-api.com/v4/sports/${SPORT}/events/${event.id}/odds`)
    url.searchParams.set('apiKey', apiKey)
    url.searchParams.set('bookmakers', 'fanduel,williamhill_us')
    url.searchParams.set('markets', PLAYER_MARKETS.join(','))
    url.searchParams.set('oddsFormat', 'american')
    url.searchParams.set('dateFormat', 'iso')

    const response = await fetch(url.toString(), { cache: 'no-store' })
    remaining = response.headers.get('x-requests-remaining') || remaining
    used = response.headers.get('x-requests-used') || used
    lastCost = response.headers.get('x-requests-last') || lastCost
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload) continue

    for (const book of payload.bookmakers || []) {
      if (!['fanduel','williamhill_us'].includes(book.key)) continue
      for (const market of book.markets || []) {
        if (!PLAYER_MARKETS.includes(market.key)) continue
        const marketType = market.key.includes('alternate') || market.key === 'batter_first_home_run' ? 'ALTERNATE' : 'MAIN'
        for (const outcome of market.outcomes || []) {
          const row = [
            payload.id,
            payload.commence_time,
            payload.away_team,
            payload.home_team,
            book.key,
            book.title,
            market.key,
            marketType,
            market.last_update || book.last_update || '',
            outcome.description || '',
            outcome.name || '',
            outcome.point ?? '',
            outcome.price ?? '',
          ]
          lines.push(row.map(csv).join(','))
        }
      }
    }
  }

  return new Response(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="mlb-all-props-${targetDate}.csv"`,
      'Cache-Control': 'no-store',
      'X-Odds-Remaining': remaining,
      'X-Odds-Used': used,
      'X-Odds-Last': lastCost,
      'X-Event-Count': String(events.length),
      'X-Row-Count': String(Math.max(lines.length - 1, 0)),
    },
  })
}
