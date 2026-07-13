import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getSportsDataIoRuntimeAdapterStatus,
  runSportsDataIoRuntimeValidation,
} from '@/services/sportsdataio-runtime-adapter.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(
      {
        ...getSportsDataIoRuntimeAdapterStatus(),
        validation: runSportsDataIoRuntimeValidation(),
      },
      id
    )
  } catch (error) {
    console.error('SportsDataIO runtime status error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown SportsDataIO runtime status error'),
    })
  }
}
