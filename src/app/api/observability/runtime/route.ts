import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getRuntimeObservabilityLazy } from '@/lib/server-lazy-diagnostics'

export async function GET(request: Request) {
  const id = requestId(request)

  try {
    return apiOk(await getRuntimeObservabilityLazy(), id)
  } catch (error) {
    console.error('Runtime observability error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown runtime observability error'),
    })
  }
}
