import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { runMlbCurrentSeasonPlayerGameStatsBackfill } from '@/services/mlb-current-season-backfill-orchestrator.service'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return (
    request.headers.get('authorization') === `Bearer ${secret}` ||
    request.nextUrl.searchParams.get('secret') === secret
  )
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const season = request.nextUrl.searchParams.get('season') ?? '2026'
    const result = await runMlbCurrentSeasonPlayerGameStatsBackfill({ season, dryRun: true })
    return apiOk(result, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB current-season backfill plan error'),
    })
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  if (!authorized(request)) {
    return apiError({ id, code: 'UNAUTHORIZED', message: 'Unauthorized MLB backfill request.', status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const result = await runMlbCurrentSeasonPlayerGameStatsBackfill({
      season: typeof body?.season === 'string' ? body.season : '2026',
      dryRun: body?.dryRun !== false,
      confirmed: body?.confirmed === true,
      maxDatesPerInvocation: body?.maxDatesPerInvocation,
    })
    return apiOk(result, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB current-season backfill execution error'),
    })
  }
}
