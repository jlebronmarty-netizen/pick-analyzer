import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { reconcileMlbUnresolvedPlayerIdentities } from '@/services/mlb-unresolved-player-identity.service'

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
    const result = await reconcileMlbUnresolvedPlayerIdentities({ season, dryRun: true })
    return apiOk(result, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB unresolved identity read error'),
    })
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  if (!authorized(request)) {
    return apiError({ id, code: 'UNAUTHORIZED', message: 'Unauthorized MLB unresolved identity request.', status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const season = typeof body?.season === 'string' && body.season.trim() ? body.season.trim() : '2026'
    const dryRun = body?.dryRun !== false
    const result = await reconcileMlbUnresolvedPlayerIdentities({ season, dryRun })
    return apiOk(result, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB unresolved identity reconciliation error'),
    })
  }
}
