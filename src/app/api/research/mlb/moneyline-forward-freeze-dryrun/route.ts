import { NextRequest } from 'next/server'
import { freezeMlbMoneylineForwardTracker } from '@/services/mlb-moneyline-forward-freeze.service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'preview') return Response.json({ status: 'NOT_FOUND' }, { status: 404 })
  const date = request.nextUrl.searchParams.get('date') ?? undefined
  try {
    const result = await freezeMlbMoneylineForwardTracker({ targetDate: date, dryRun: true, forceRecomputeDryRun: true })
    return Response.json(result, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return Response.json({ status: 'BLOCKED', reason: error instanceof Error ? error.message : 'UNKNOWN' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
