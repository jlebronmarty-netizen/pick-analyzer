import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getSportsDataIoRuntimeCapabilities } from '@/services/sportsdataio-runtime-adapter.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(getSportsDataIoRuntimeCapabilities(), id)
  } catch (error) {
    console.error('SportsDataIO runtime capabilities error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown SportsDataIO runtime capabilities error'
      ),
    })
  }
}
