import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  validateMlbGamesByDateVerificationFixtures,
  verifyMlbGamesByDatePayload,
} from '@/services/mlb-games-by-date-verification.service'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return (
    request.headers.get('authorization') === `Bearer ${secret}` ||
    request.nextUrl.searchParams.get('secret') === secret
  )
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  if (!authorized(request)) {
    return apiError({
      id,
      code: 'UNAUTHORIZED',
      message: 'Unauthorized MLB provider verification request.',
      status: 401,
    })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const result = await verifyMlbGamesByDatePayload({
      date: body?.date ?? body?.selectedDate ?? null,
      confirmed: body?.confirmed === true,
      dryRun: body?.dryRun ?? true,
      timeoutMs: body?.timeoutMs ?? null,
    })
    const status = result.success === false ? 400 : 200
    return apiOk(result, id, { status })
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB provider verification error'),
    })
  }
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  if (!authorized(request)) {
    return apiError({
      id,
      code: 'UNAUTHORIZED',
      message: 'Unauthorized MLB provider verification request.',
      status: 401,
    })
  }

  return apiOk(
    {
      success: true,
      mode: 'sportsdataio_mlb_games_by_date_verification_route_v1',
      route: '/api/mlb/provider-verification/games-by-date',
      method: 'POST',
      body: {
        date: '2026-07-17 or 2026-JUL-17',
        confirmed: false,
        dryRun: true,
      },
      providerCallsMade: 0,
      validation: validateMlbGamesByDateVerificationFixtures(),
    },
    id
  )
}
