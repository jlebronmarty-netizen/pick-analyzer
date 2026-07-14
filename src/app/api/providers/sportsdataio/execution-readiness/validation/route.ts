import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { runSportsDataIoExecutionReadinessValidation } from '@/services/sportsdataio-historical-import-readiness.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(runSportsDataIoExecutionReadinessValidation(), id)
  } catch (error) {
    console.error('SportsDataIO execution readiness validation error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown SportsDataIO execution readiness validation error'
      ),
    })
  }
}
