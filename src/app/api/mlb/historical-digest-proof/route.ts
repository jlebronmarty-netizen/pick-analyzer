import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HISTORICAL_TARGET_DATE = '2026-09-03'
const HISTORICAL_CUTOFF_DATE = '2026-09-04'
const HISTORICAL_START_DATE = '2026-01-01'

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(record[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export async function GET() {
  const url = new URL('https://statsapi.mlb.com/api/v1/schedule')
  url.searchParams.set('sportId', '1')
  url.searchParams.set('startDate', HISTORICAL_START_DATE)
  url.searchParams.set('endDate', HISTORICAL_CUTOFF_DATE)
  url.searchParams.set('hydrate', 'probablePitcher')

  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    return NextResponse.json(
      { ok: false, status: response.status, endpoint: url.toString() },
      { status: 502 },
    )
  }

  const payload = (await response.json()) as {
    dates?: Array<{ games?: Array<Record<string, unknown>> }>
  }

  const games = (payload.dates ?? [])
    .flatMap((date) => date.games ?? [])
    .filter((game) => game.officialDate === HISTORICAL_TARGET_DATE)
    .map((game) => ({
      gamePk: Number(game.gamePk),
      officialDate: game.officialDate,
      digest: sha256(stable(game)),
    }))
    .sort((a, b) => a.gamePk - b.gamePk)

  return NextResponse.json({
    ok: true,
    readOnly: true,
    targetDate: HISTORICAL_TARGET_DATE,
    cutoffDate: HISTORICAL_CUTOFF_DATE,
    endpoint: url.toString(),
    algorithm: 'sha256(stable(game)); object keys sorted recursively; arrays preserved',
    count: games.length,
    uniqueGamePk: new Set(games.map((game) => game.gamePk)).size,
    games,
  })
}
