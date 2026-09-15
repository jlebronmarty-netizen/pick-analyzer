import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BASE = 'https://api.the-odds-api.com/v4/sports/baseball_mlb/events'
const MARKETS = [
  'pitcher_strikeouts',
  'pitcher_outs',
  'batter_hits',
  'batter_total_bases',
  'batter_hits_runs_rbis',
  'batter_home_runs',
  'batter_walks',
  'batter_stolen_bases',
].join(',')

const EVENTS = [
  '4ee5706290157d66372729e7e70830e8',
  'e5ea1bb04bd365a0c15838cfb75266f9',
  '2f2faff81101f84158c3cfbd630bcb30',
  'baa7f738229bf9855e24037a2a30a2cb',
  '015394004322ca670004015ae5bd94a3',
  '1ddb6d18eafe93f1947471922f1938ea',
  'a1a608b633419833caf64ad8739781f3',
  'f367b112dcb4fea1a4ff67e49ee1f0cd',
  '256d7de8ceb3804256d260a74263d82c',
  '15c9ca42142414287f11247c92905d9f',
  '6279de5e7b4d4681d15f7d6ea90d4e66',
  '8cac5435079f2d8d51adb91e7950bb26',
  '54f473e11bd354c898e74efd34f3f78d',
  'cce625b7dac12280fdb88a6f44058c93',
  'e9344aee4810e4127e69c73c13c781d7',
]

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ ok: false, blocker: 'PREVIEW_ONLY' }, { status: 403 })
  }
  const apiKey = process.env.THE_ODDS_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ ok: false, blocker: 'THE_ODDS_API_KEY_NOT_PRESENT' }, { status: 503 })
  }

  const rows: unknown[][] = []
  const quota: Array<Record<string, string | null>> = []
  for (const eventId of EVENTS) {
    const url = new URL(`${BASE}/${eventId}/odds`)
    url.searchParams.set('apiKey', apiKey)
    url.searchParams.set('regions', 'us')
    url.searchParams.set('bookmakers', 'fanduel,williamhill_us')
    url.searchParams.set('markets', MARKETS)
    url.searchParams.set('oddsFormat', 'american')
    url.searchParams.set('dateFormat', 'iso')
    const response = await fetch(url, { cache: 'no-store' })
    quota.push({
      eventId,
      remaining: response.headers.get('x-requests-remaining'),
      used: response.headers.get('x-requests-used'),
      last: response.headers.get('x-requests-last'),
    })
    if (!response.ok) continue
    const event = await response.json()
    for (const book of event.bookmakers ?? []) {
      for (const market of book.markets ?? []) {
        for (const outcome of market.outcomes ?? []) {
          rows.push([
            event.id,
            event.commence_time,
            event.away_team,
            event.home_team,
            book.key,
            book.title,
            market.key,
            market.last_update,
            outcome.description ?? '',
            outcome.name,
            outcome.point ?? '',
            outcome.price ?? '',
          ])
        }
      }
    }
  }

  const header = ['event_id','commence_time','away_team','home_team','book_key','book','market','last_update','player','side','line','odds']
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
  const remaining = quota.map((q) => Number(q.remaining)).filter(Number.isFinite)
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="mlb-props-2026-09-15.csv"',
      'X-Props-Rows': String(rows.length),
      'X-Quota-Remaining': remaining.length ? String(Math.min(...remaining)) : '',
      'Cache-Control': 'no-store',
    },
  })
}
