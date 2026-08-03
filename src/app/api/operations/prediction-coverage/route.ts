import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getPredictionCoverage } from '@/services/prediction-coverage.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    if (!authorized(request)) {
      return apiError({
        id,
        code: 'UNAUTHORIZED',
        message: 'Protected prediction coverage diagnostics require CRON_SECRET authorization.',
        status: 401,
      })
    }
    return apiOk(await getPredictionCoverage(), id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown prediction coverage diagnostic error'),
    })
  }
}
