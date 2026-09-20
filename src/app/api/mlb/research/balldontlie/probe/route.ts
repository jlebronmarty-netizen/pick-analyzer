import { NextRequest } from 'next/server'
import { apiOk } from '@/lib/api-contract'
import { probeBalldontlieMlbGoat } from '@/services/balldontlie-mlb-research-probe.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date') ?? '2026-09-20'
  const rawMode = request.nextUrl.searchParams.get('mode') ?? 'opening_props'
  const mode = rawMode === 'markets' || rawMode === 'opening_odds' ? rawMode : 'opening_props'
  const result = await probeBalldontlieMlbGoat({ date, mode })
  return apiOk(result, crypto.randomUUID(), { headers: { 'Cache-Control': 'no-store' } })
}
