import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

function stable(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stable(item)).join(',')}]`
  }
  if (value !== null && typeof value === 'object') {
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

const ALLOWED_DATES = new Set(['2026-09-03', '2026-09-07'])

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date') ?? ''
  if (!ALLOWED_DATES.has(date)) {
    return NextResponse.json(
      { ok: false, error: 'DATE_NOT_ALLOWED', allowedDates: [...ALLOWED_DATES] },
      { status: 400 }
    )
  }

  const url = new URL('https://statsapi.mlb.com/api/v1/schedule')
  url.searchParams.set('sportId', '1')
  url.searchParams.set('startDate', date)
  url.searchParams.set('endDate', date)

  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    return NextResponse.json(
      { ok: false, error: 'MLB_OFFICIAL_FETCH_FAILED', status: response.status },
      { status: 502 }
    )
  }

  const payload = await response.json()
  const games = Array.isArray(payload?.dates)
    ? payload.dates.flatMap((entry: { games?: unknown[] }) =>
        Array.isArray(entry?.games) ? entry.games : []
      )
    : []

  const digests = games
    .map((game: any) => ({
      gamePk: Number(game?.gamePk),
      digest: sha256(stable(game)),
    }))
    .filter((row: { gamePk: number; digest: string }) => Number.isFinite(row.gamePk))
    .sort((a: { gamePk: number }, b: { gamePk: number }) => a.gamePk - b.gamePk)

  return NextResponse.json({
    ok: true,
    mode: 'READ_ONLY_MLB_OFFICIAL_DIGEST_PROBE_V1',
    date,
    provider: 'MLB StatsAPI',
    writesPerformed: 0,
    gameCount: digests.length,
    digests,
  })
}
