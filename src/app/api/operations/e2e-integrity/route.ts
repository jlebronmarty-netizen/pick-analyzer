import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { getE2eSystemIntegrity } from '@/services/e2e-system-integrity.service'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}` || request.nextUrl.searchParams.get('secret') === secret
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    if (!authorized(request)) {
      return apiError({
        id,
        code: 'UNAUTHORIZED',
        message: 'Protected E2E integrity diagnostics require CRON_SECRET authorization.',
        status: 401,
      })
    }
    const params = request.nextUrl.searchParams
    return apiOk(
      await getE2eSystemIntegrity({
        operatingDate: params.get('operatingDate') ?? params.get('date'),
        limit: parseIntegerParam({ value: params.get('limit'), fallback: 200, min: 1, max: 200 }),
      }),
      id,
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown E2E integrity diagnostic error'),
    })
  }
}
