import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseBooleanParam, requestId } from '@/lib/api-contract'
import { runLiveProviderVerification } from '@/services/live-provider-verification.service'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const date = request.nextUrl.searchParams.get('date') ?? undefined
    const data = await runLiveProviderVerification({ date, dryRun: true })
    return apiOk(data, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown live provider verification dry-run error'),
    })
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    const body = (await request.json().catch(() => ({}))) as {
      dryRun?: boolean
      date?: string
      maxSportsDataIoCalls?: number
      maxOddsApiCalls?: number
      maxMlbStatsCalls?: number
    }
    const dryRun = body.dryRun !== false
    if (!dryRun && !authorized(request)) {
      return apiError({
        id,
        code: 'UNAUTHORIZED',
        message: 'Protected live provider verification requires CRON_SECRET authorization.',
        status: 401,
      })
    }
    const data = await runLiveProviderVerification({
      dryRun,
      date: body.date,
      maxSportsDataIoCalls: body.maxSportsDataIoCalls,
      maxOddsApiCalls: body.maxOddsApiCalls,
      maxMlbStatsCalls: body.maxMlbStatsCalls,
    })
    return apiOk(data, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown live provider verification error'),
    })
  }
}
