import { NextRequest } from 'next/server'

import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { getMultiSportDataReadiness } from '@/services/multi-sport-data-readiness.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = request.nextUrl
    return apiOk(
      await getMultiSportDataReadiness({
        sportKey: searchParams.get('sportKey'),
        readinessState: searchParams.get('readinessState'),
        provider: searchParams.get('provider'),
        limit: parseIntegerParam({
          value: searchParams.get('limit'),
          fallback: 100,
          min: 1,
          max: 100,
        }),
      }),
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown multi-sport data-readiness error'),
    })
  }
}
