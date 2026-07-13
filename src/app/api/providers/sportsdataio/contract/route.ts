import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getSportsDataIoAdapterStatus } from '@/services/sportsdataio-adapter-contract.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(getSportsDataIoAdapterStatus(), id)
  } catch (error) {
    console.error('SportsDataIO contract error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown SportsDataIO contract error'),
    })
  }
}
