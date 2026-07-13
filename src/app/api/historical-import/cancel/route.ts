import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { cancelSportsDataIoHistoricalImport } from '@/services/sportsdataio-historical-import-readiness.service'

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
      message: 'Unauthorized historical import cancel request.',
      status: 401,
    })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const result = cancelSportsDataIoHistoricalImport({
      jobId: body?.jobId ?? null,
    })

    if (!result.success) {
      return apiError({
        id,
        code: 'BAD_REQUEST',
        message: result.validation.errors.join(' '),
        status: 400,
      })
    }

    return apiOk(result, id)
  } catch (error) {
    console.error('SportsDataIO historical import cancel error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown historical import cancel error'),
    })
  }
}
