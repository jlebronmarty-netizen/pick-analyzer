import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = 'https://statsapi.mlb.com'

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date') ?? '2026-09-03'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 })
  }

  const endpoint = `/api/v1/schedule?sportId=1&startDate=${encodeURIComponent(date)}&endDate=${encodeURIComponent(date)}&hydrate=probablePitcher,team,venue`
  const response = await fetch(`${BASE_URL}${endpoint}`, { cache: 'no-store' })
  if (!response.ok) {
    return NextResponse.json({ error: `MLB Stats API HTTP ${response.status}`, endpoint }, { status: 502 })
  }

  const payload = await response.json() as { dates?: Array<{ games?: unknown[] }> }
  const games = (payload.dates ?? []).flatMap((row) => Array.isArray(row.games) ? row.games : [])
  const proof = games.map((game) => {
    const record = game && typeof game === 'object' ? game as Record<string, unknown> : {}
    return {
      gamePk: record.gamePk ?? null,
      digest: sha256(stable(game)),
      game,
    }
  })

  return NextResponse.json({
    success: true,
    mode: 'MLB_DATA_02H_HISTORICAL_DIGEST_PROOF_READ_ONLY',
    date,
    endpoint,
    providerCallsMade: 1,
    databaseReadsMade: 0,
    databaseMutationsMade: 0,
    gameCount: proof.length,
    proof,
  })
}
